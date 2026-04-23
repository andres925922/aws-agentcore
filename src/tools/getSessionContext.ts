import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IMemoryStore } from "../memory/index.js";
import { resolveUser } from "../utils/resolveUser.js";

export function registerGetSessionContext(
    server: McpServer,
    memoryStore: IMemoryStore,
): void {
    server.registerTool(
        "get_session_context",
        {
            title: "Get Session Context",
            description:
                "Retrieve memory context for the current user: preferences, last customer worked with, saved notes, and recent ticket references. Use when the user refers to previous context without being explicit.",
            inputSchema: {
                section: z
                    .enum(["all", "preferences", "lastCustomer", "notes", "tickets"])
                    .default("all")
                    .describe("Which section of memory to return"),
            },
        },
        async ({ section }) => {
            const { userId, osUsername } = resolveUser();
            const memory = await memoryStore.getOrCreate(userId, osUsername);
            await memoryStore.touch(userId);

            let payload: unknown;
            switch (section) {
                case "preferences": payload = memory.preferences; break;
                case "lastCustomer": payload = memory.lastCustomerContext ?? "No customer context saved yet."; break;
                case "notes": payload = memory.notes.length > 0 ? memory.notes : "No notes saved yet."; break;
                case "tickets": payload = memory.recentTickets.length > 0 ? memory.recentTickets : "No recent tickets."; break;
                default: payload = memory;
            }

            return {
                content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
            };
        }
    );
}