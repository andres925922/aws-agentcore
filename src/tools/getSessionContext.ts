/**
 * tools/getSessionContext.ts
 *
 * tool: get_session_context
 *
 * Retrieves everything the agent knows about the current OS user:
 * preferences, last customer worked with, notes, recent ticket IDs.
 *
 * The agent calls this when the user refers to "that customer from before"
 * or "my previous note" — without the user having to repeat themselves.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IMemoryStore } from "../memory/index.js";

export function registerGetSessionContext(
    server: McpServer,
    memoryStore: IMemoryStore,
): void {
    server.registerTool(
        "get_session_context",
        {
            title: "Get Session Context",
            description:
                "Retrieve the full memory context for the current OS user: their preferences, the last customer they worked with, their saved notes, and recent ticket IDs. Use this when the user refers to previous context without being explicit.",
            inputSchema: {
                // Optional filter — agent can ask for just one section
                section: z
                    .enum(["all", "preferences", "lastCustomer", "notes", "tickets"])
                    .default("all")
                    .describe("Which section of memory to return"),
            },
        },
        async ({ section }) => {
            const osUsername = process.env.USER ?? process.env.USERNAME ?? "unknown";
            const memory = await memoryStore.getOrCreate(osUsername);
            await memoryStore.touch(osUsername);

            let payload: unknown;

            switch (section) {
                case "preferences":
                    payload = memory.preferences;
                    break;
                case "lastCustomer":
                    payload = memory.lastCustomerContext
                        ?? "No customer context saved yet.";
                    break;
                case "notes":
                    payload = memory.notes.length > 0
                        ? memory.notes
                        : "No notes saved yet.";
                    break;
                case "tickets":
                    payload = memory.recentTicketIds.length > 0
                        ? memory.recentTicketIds
                        : "No recent tickets in memory.";
                    break;
                default:
                    payload = memory;
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(payload, null, 2),
                }],
            };
        }
    );
}