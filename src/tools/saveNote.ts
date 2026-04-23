/**
 * tools/saveNote.ts
 *
 * tool: save_note
 *
 * Lets the agent persist free-form notes and structured context
 * (preferences, last customer) for the current OS user.
 *
 * The agent decides when to call this — e.g. after looking up a customer,
 * after the user expresses a preference, after creating a ticket.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IMemoryStore } from "../memory/index.js";

export function registerSaveNote(
    server: McpServer,
    memoryStore: IMemoryStore,
): void {
    server.registerTool(
        "save_note",
        {
            title: "Save Note",
            description:
                "Persist information to the current user's memory. Use `note` for free-form text. Use `customerContext` when you've just looked up a customer so it can be recalled later. Use `preferences` when the user expresses language or tone preferences. Use `ticketId` after creating a ticket.",
            inputSchema: {
                note: z
                    .string()
                    .optional()
                    .describe("Free-form text to remember across sessions"),
                ticketId: z
                    .string()
                    .uuid()
                    .optional()
                    .describe("Ticket ID to add to the user's recent tickets list"),
                preferences: z
                    .object({
                        language: z.string().optional().describe("e.g. 'es' or 'en'"),
                        tone: z.enum(["formal", "casual"]).optional(),
                    })
                    .optional()
                    .describe("Update user preferences"),
                customerContext: z
                    .object({
                        customerId: z.string().uuid(),
                        customerName: z.string(),
                        customerEmail: z.string().email(),
                    })
                    .optional()
                    .describe("Save the customer currently being worked with"),
            },
        },
        async ({ note, ticketId, preferences, customerContext }) => {
            const osUsername = process.env.USER ?? process.env.USERNAME ?? "unknown";
            const memory = await memoryStore.getOrCreate(osUsername);
            const saved: string[] = [];

            if (note) {
                memory.notes.push({ text: note, savedAt: new Date().toISOString() });
                // Keep only the last 20 notes to avoid unbounded growth
                if (memory.notes.length > 20) memory.notes = memory.notes.slice(-20);
                saved.push("note");
            }

            if (ticketId) {
                if (!memory.recentTicketIds.includes(ticketId)) {
                    memory.recentTicketIds.unshift(ticketId);
                    // Keep only the last 50 ticket IDs
                    if (memory.recentTicketIds.length > 50) {
                        memory.recentTicketIds = memory.recentTicketIds.slice(0, 50);
                    }
                }
                saved.push("ticketId");
            }

            if (preferences) {
                if (preferences.language) memory.preferences.language = preferences.language;
                if (preferences.tone) memory.preferences.tone = preferences.tone;
                saved.push("preferences");
            }

            if (customerContext) {
                memory.lastCustomerContext = {
                    ...customerContext,
                    lastAccessedAt: new Date().toISOString(),
                };
                saved.push("customerContext");
            }

            memory.user.lastActiveAt = new Date().toISOString();
            await memoryStore.save(memory);

            return {
                content: [{
                    type: "text",
                    text: saved.length > 0
                        ? `✅ Saved to memory: ${saved.join(", ")}`
                        : "Nothing to save — no fields provided.",
                }],
            };
        }
    );
}