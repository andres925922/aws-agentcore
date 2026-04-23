import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IMemoryStore, TTL_DAYS, expiresAt } from "../memory/index.js";
import { resolveUser } from "../utils/resolveUser.js";

export function registerSaveNote(
    server: McpServer,
    memoryStore: IMemoryStore,
): void {
    server.registerTool(
        "save_note",
        {
            title: "Save Note",
            description:
                "Persist information to the current user's memory. Use `note` for free-form text. Use `customerContext` after looking up a customer. Use `preferences` when the user expresses language or tone preferences. Use `ticket` after creating a ticket.",
            inputSchema: {
                note: z.string().optional().describe("Free-form text to remember across sessions"),
                ticket: z
                    .object({
                        ticketId: z.string().uuid(),
                        subject: z.string().describe("Short summary — helps recall later"),
                    })
                    .optional()
                    .describe("Ticket reference to add to recent tickets"),
                preferences: z
                    .object({
                        language: z.string().optional().describe("e.g. 'es' or 'en'"),
                        tone: z.enum(["formal", "casual"]).optional(),
                    })
                    .optional(),
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
        async ({ note, ticket, preferences, customerContext }) => {
            const { userId, osUsername } = resolveUser();
            const memory = await memoryStore.getOrCreate(userId, osUsername);
            const saved: string[] = [];

            if (note) {
                memory.notes.push({ text: note, savedAt: new Date().toISOString(), expiresAt: expiresAt(TTL_DAYS.notes) });
                if (memory.notes.length > 20) memory.notes = memory.notes.slice(-20);
                saved.push("note");
            }

            if (ticket) {
                if (!memory.recentTickets.some((t) => t.ticketId === ticket.ticketId)) {
                    memory.recentTickets.unshift({
                        ticketId: ticket.ticketId,
                        subject: ticket.subject,
                        savedAt: new Date().toISOString(),
                        expiresAt: expiresAt(TTL_DAYS.tickets),
                    });
                    if (memory.recentTickets.length > 50) memory.recentTickets = memory.recentTickets.slice(0, 50);
                }
                saved.push("ticket");
            }

            if (preferences) {
                if (preferences.language) memory.preferences.language = preferences.language;
                if (preferences.tone) memory.preferences.tone = preferences.tone;
                saved.push("preferences");
            }

            if (customerContext) {
                memory.lastCustomerContext = { ...customerContext, lastAccessedAt: new Date().toISOString() };
                saved.push("customerContext");
            }

            memory.user.lastActiveAt = new Date().toISOString();
            await memoryStore.save(memory);

            return {
                content: [{
                    type: "text",
                    text: saved.length > 0 ? `Saved to memory: ${saved.join(", ")}` : "Nothing to save — no fields provided.",
                }],
            };
        }
    );
}