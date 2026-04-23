import { randomUUID } from "crypto";
import { z } from "zod";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { IRepositories } from "../repositories/interfaces.js";
import { IMemoryStore, TTL_DAYS, expiresAt } from "../memory/index.js";
import { resolveUser } from "../utils/resolveUser.js";
import { computeWarrantyStatus } from "../utils/warranty.js";
import { TicketPrioritySchema } from "../models/index.js";

const getCustomerProfileInput = z.object({
    id: z.string().uuid().optional(),
    email: z.string().email().optional(),
});

const checkWarrantyInput = z.object({
    productId: z.string().uuid(),
});

const createSupportTicketInput = z.object({
    customerId: z.string().uuid(),
    productId: z.string().uuid().optional(),
    subject: z.string().min(5).max(200),
    description: z.string().min(10),
    priority: TicketPrioritySchema.default("medium"),
});

const getSessionContextInput = z.object({
    section: z.enum(["all", "preferences", "lastCustomer", "notes", "tickets"]).default("all"),
});

const saveNoteInput = z.object({
    note: z.string().optional(),
    ticket: z.object({
        ticketId: z.string().uuid(),
        subject: z.string(),
    }).optional(),
    preferences: z.object({
        language: z.string().optional(),
        tone: z.enum(["formal", "casual"]).optional(),
    }).optional(),
    customerContext: z.object({
        customerId: z.string().uuid(),
        customerName: z.string(),
        customerEmail: z.string().email(),
    }).optional(),
});

const getTicketsByCustomerInput = z.object({
    id: z.string().uuid().optional(),
    email: z.string().email().optional(),
});

const identifySessionInput = z.object({});

const TOOL_SPECS = [
    {
        toolSpec: {
            name: "identify_session",
            description: "Create or load session memory for the current user.",
            inputSchema: { json: { type: "object", properties: {} } },
        },
    },
    {
        toolSpec: {
            name: "get_session_context",
            description: "Read memory context: preferences, notes, last customer, and recent tickets.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        section: {
                            type: "string",
                            enum: ["all", "preferences", "lastCustomer", "notes", "tickets"],
                        },
                    },
                },
            },
        },
    },
    {
        toolSpec: {
            name: "save_note",
            description: "Persist note, ticket reference, preferences, or customer context in session memory.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        note: { type: "string" },
                        ticket: {
                            type: "object",
                            properties: {
                                ticketId: { type: "string" },
                                subject: { type: "string" },
                            },
                        },
                        preferences: {
                            type: "object",
                            properties: {
                                language: { type: "string" },
                                tone: { type: "string", enum: ["formal", "casual"] },
                            },
                        },
                        customerContext: {
                            type: "object",
                            properties: {
                                customerId: { type: "string" },
                                customerName: { type: "string" },
                                customerEmail: { type: "string" },
                            },
                        },
                    },
                },
            },
        },
    },
    {
        toolSpec: {
            name: "get_customer_profile",
            description: "Get customer by id or email with all registered products.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                    },
                },
            },
        },
    },
    {
        toolSpec: {
            name: "check_warranty_status",
            description: "Check if a product is under warranty and days remaining.",
            inputSchema: {
                json: {
                    type: "object",
                    required: ["productId"],
                    properties: {
                        productId: { type: "string" },
                    },
                },
            },
        },
    },
    {
        toolSpec: {
            name: "create_support_ticket",
            description: "Create a support ticket for a customer and optional product.",
            inputSchema: {
                json: {
                    type: "object",
                    required: ["customerId", "subject", "description"],
                    properties: {
                        customerId: { type: "string" },
                        productId: { type: "string" },
                        subject: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                    },
                },
            },
        },
    },
    {
        toolSpec: {
            name: "get_tickets_by_customer",
            description: "List tickets for a customer by id or email.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                    },
                },
            },
        },
    },
] as const;

export interface ChatRequest {
    message: string;
    userId?: string;
    systemPrompt?: string;
    maxSteps?: number;
    maxTokens?: number;
    temperature?: number;
    rememberResponse?: boolean;
}

export interface ChatResponse {
    modelId: string;
    reply: string;
    stopReason: string | undefined;
    toolCalls: Array<{ name: string; input: unknown }>;
}

export class BedrockChatOrchestrator {
    private readonly client: BedrockRuntimeClient;

    constructor(
        private readonly repos: IRepositories,
        private readonly memoryStore: IMemoryStore,
    ) {
        this.client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "eu-west-2" });
    }

    async run(input: ChatRequest): Promise<ChatResponse> {
        const modelId = process.env.BEDROCK_MODEL_ID;
        if (!modelId) {
            throw new Error("Missing required environment variable: BEDROCK_MODEL_ID");
        }

        if (!input.message || input.message.trim().length === 0) {
            throw new Error("message is required");
        }

        const resolved = resolveUser();
        const userId = input.userId ?? resolved.userId;
        const osUsername = resolved.osUsername;

        const memory = await this.memoryStore.getOrCreate(userId, osUsername);
        await this.memoryStore.touch(userId);

        const compactContext = {
            preferences: memory.preferences,
            lastCustomerContext: memory.lastCustomerContext,
            notes: memory.notes.slice(-3),
            recentTickets: memory.recentTickets.slice(0, 5),
        };

        const systemPrompt = input.systemPrompt
            ?? process.env.BEDROCK_SYSTEM_PROMPT
            ?? "You are a customer support assistant. Use tools whenever account-specific facts are needed.";

        const system = [
            { text: systemPrompt },
            { text: `Current userId: ${userId}` },
            { text: `Session context (JSON): ${JSON.stringify(compactContext)}` },
            { text: "When user data might be stale or missing, call the relevant tool before answering." },
        ];

        const messages: any[] = [
            {
                role: "user",
                content: [{ text: input.message }],
            },
        ];

        const maxSteps = Math.max(1, Math.min(input.maxSteps ?? 6, 10));
        const toolCalls: Array<{ name: string; input: unknown }> = [];
        let stopReason: string | undefined;
        let finalText = "";

        for (let step = 0; step < maxSteps; step += 1) {
            const command = new ConverseCommand({
                modelId,
                system,
                messages,
                toolConfig: { tools: [...TOOL_SPECS] as any[] },
                inferenceConfig: {
                    maxTokens: input.maxTokens ?? 800,
                    temperature: input.temperature ?? 0.2,
                },
            });

            const response = await this.client.send(command);
            stopReason = response.stopReason;

            const assistantMessage = response.output?.message;
            if (!assistantMessage) {
                throw new Error("Bedrock response did not include an assistant message");
            }

            messages.push(assistantMessage as any);

            const contentBlocks = assistantMessage.content ?? [];
            const toolUseBlocks = contentBlocks.filter((b: any) => Boolean(b.toolUse));

            if (response.stopReason !== "tool_use" || toolUseBlocks.length === 0) {
                finalText = contentBlocks
                    .filter((b: any) => typeof b.text === "string")
                    .map((b: any) => b.text as string)
                    .join("\n")
                    .trim();
                break;
            }

            const toolResults = [];
            for (const block of toolUseBlocks) {
                const toolUse = block.toolUse;
                if (!toolUse) continue;
                const name = String(toolUse.name);
                const toolInput = toolUse.input ?? {};
                toolCalls.push({ name, input: toolInput });

                const result = await this.executeTool(name, toolInput, userId, osUsername);
                toolResults.push({
                    toolResult: {
                        toolUseId: toolUse.toolUseId,
                        content: [{ json: result }],
                        status: "success",
                    },
                });
            }

            messages.push({
                role: "user",
                content: toolResults,
            });
        }

        if (!finalText) {
            finalText = "No textual response produced by the model.";
        }

        if (input.rememberResponse) {
            const current = await this.memoryStore.getOrCreate(userId, osUsername);
            current.notes.push({
                text: `User: ${input.message}\nAssistant: ${finalText}`.slice(0, 1200),
                savedAt: new Date().toISOString(),
                expiresAt: expiresAt(TTL_DAYS.notes),
            });
            if (current.notes.length > 20) current.notes = current.notes.slice(-20);
            current.user.lastActiveAt = new Date().toISOString();
            await this.memoryStore.save(current);
        }

        return {
            modelId,
            reply: finalText,
            stopReason,
            toolCalls,
        };
    }

    private async executeTool(name: string, rawInput: unknown, userId: string, osUsername: string): Promise<unknown> {
        switch (name) {
            case "identify_session": {
                identifySessionInput.parse(rawInput ?? {});
                const memory = await this.memoryStore.getOrCreate(userId, osUsername);
                memory.user.lastActiveAt = new Date().toISOString();
                await this.memoryStore.save(memory);
                return {
                    greeting: memory.notes.length > 0 || memory.lastCustomerContext || memory.recentTickets.length > 0
                        ? `Welcome back, ${userId}.`
                        : `Hello ${userId}, first session.`,
                    memory,
                };
            }

            case "get_session_context": {
                const { section } = getSessionContextInput.parse(rawInput ?? {});
                const memory = await this.memoryStore.getOrCreate(userId, osUsername);
                await this.memoryStore.touch(userId);

                if (section === "preferences") return memory.preferences;
                if (section === "lastCustomer") return memory.lastCustomerContext ?? null;
                if (section === "notes") return memory.notes;
                if (section === "tickets") return memory.recentTickets;
                return memory;
            }

            case "save_note": {
                const parsed = saveNoteInput.parse(rawInput ?? {});
                const memory = await this.memoryStore.getOrCreate(userId, osUsername);
                const saved: string[] = [];

                if (parsed.note) {
                    memory.notes.push({
                        text: parsed.note,
                        savedAt: new Date().toISOString(),
                        expiresAt: expiresAt(TTL_DAYS.notes),
                    });
                    if (memory.notes.length > 20) memory.notes = memory.notes.slice(-20);
                    saved.push("note");
                }

                if (parsed.ticket) {
                    if (!memory.recentTickets.some((t) => t.ticketId === parsed.ticket!.ticketId)) {
                        memory.recentTickets.unshift({
                            ticketId: parsed.ticket.ticketId,
                            subject: parsed.ticket.subject,
                            savedAt: new Date().toISOString(),
                            expiresAt: expiresAt(TTL_DAYS.tickets),
                        });
                    }
                    if (memory.recentTickets.length > 50) memory.recentTickets = memory.recentTickets.slice(0, 50);
                    saved.push("ticket");
                }

                if (parsed.preferences) {
                    if (parsed.preferences.language) memory.preferences.language = parsed.preferences.language;
                    if (parsed.preferences.tone) memory.preferences.tone = parsed.preferences.tone;
                    saved.push("preferences");
                }

                if (parsed.customerContext) {
                    memory.lastCustomerContext = {
                        customerId: parsed.customerContext.customerId,
                        customerName: parsed.customerContext.customerName,
                        customerEmail: parsed.customerContext.customerEmail,
                        lastAccessedAt: new Date().toISOString(),
                    };
                    saved.push("customerContext");
                }

                memory.user.lastActiveAt = new Date().toISOString();
                await this.memoryStore.save(memory);
                return { saved };
            }

            case "get_customer_profile": {
                const parsed = getCustomerProfileInput.parse(rawInput ?? {});
                if (!parsed.id && !parsed.email) {
                    throw new Error("Provide id or email");
                }

                const customer = parsed.id
                    ? await this.repos.customers.getById(parsed.id)
                    : await this.repos.customers.getByEmail(parsed.email!);

                if (!customer) {
                    return { error: "Customer not found" };
                }

                const products = await this.repos.products.getByCustomerId(customer.id);

                const memory = await this.memoryStore.getOrCreate(userId, osUsername);
                memory.lastCustomerContext = {
                    customerId: customer.id,
                    customerName: customer.name,
                    customerEmail: customer.email,
                    lastAccessedAt: new Date().toISOString(),
                };
                memory.user.lastActiveAt = new Date().toISOString();
                await this.memoryStore.save(memory);

                return {
                    customer,
                    products,
                    productCount: products.length,
                };
            }

            case "check_warranty_status": {
                const { productId } = checkWarrantyInput.parse(rawInput ?? {});
                const product = await this.repos.products.getById(productId);
                if (!product) return { error: "Product not found" };
                return computeWarrantyStatus(product);
            }

            case "create_support_ticket": {
                const parsed = createSupportTicketInput.parse(rawInput ?? {});

                const customer = await this.repos.customers.getById(parsed.customerId);
                if (!customer) return { error: "Customer not found" };

                if (parsed.productId) {
                    const product = await this.repos.products.getById(parsed.productId);
                    if (!product) return { error: "Product not found" };
                    if (product.customerId !== parsed.customerId) {
                        return { error: "Product does not belong to customer" };
                    }
                }

                const now = new Date().toISOString();
                const ticket = await this.repos.tickets.create({
                    id: randomUUID(),
                    customerId: parsed.customerId,
                    productId: parsed.productId,
                    subject: parsed.subject,
                    description: parsed.description,
                    priority: parsed.priority,
                    status: "open",
                    createdAt: now,
                    updatedAt: now,
                });

                const memory = await this.memoryStore.getOrCreate(userId, osUsername);
                memory.recentTickets.unshift({
                    ticketId: ticket.id,
                    subject: ticket.subject,
                    savedAt: now,
                    expiresAt: expiresAt(TTL_DAYS.tickets),
                });
                if (memory.recentTickets.length > 50) memory.recentTickets = memory.recentTickets.slice(0, 50);
                memory.user.lastActiveAt = now;
                await this.memoryStore.save(memory);

                return ticket;
            }

            case "get_tickets_by_customer": {
                const parsed = getTicketsByCustomerInput.parse(rawInput ?? {});
                if (!parsed.id && !parsed.email) {
                    throw new Error("Provide id or email");
                }

                const customer = parsed.id
                    ? await this.repos.customers.getById(parsed.id)
                    : await this.repos.customers.getByEmail(parsed.email!);
                if (!customer) {
                    return { error: "Customer not found" };
                }

                const tickets = await this.repos.tickets.getByCustomerId(customer.id);
                return { customer, tickets, ticketCount: tickets.length };
            }

            default:
                throw new Error(`Unsupported tool: ${name}`);
        }
    }
}