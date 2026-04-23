/**
 * tools/identifySession.ts
 *
 * tool: identify_session
 *
 * Reads the OS username from the server process environment ($USER).
 * The agent should call this at the start of every conversation.
 * Returns the full UserMemory so the agent has immediate context.
 *
 * Why server-side $USER and not client-side?
 * Because this MCP server runs as a local process on YOUR machine.
 * process.env.USER is YOUR OS user — no spoofing needed for local dev.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IMemoryStore } from "../memory/index.js";

export function registerIdentifySession(
    server: McpServer,
    memoryStore: IMemoryStore,
): void {
    server.registerTool(
        "identify_session",
        {
            title: "Identify Session",
            description:
                "Call this at the start of every conversation. Reads the OS user running the MCP server, creates or retrieves their session memory, and returns their full context (preferences, last customer, notes, recent tickets). No input needed.",
            inputSchema: {},
        },
        async () => {
            // Read OS username from the server process — this is YOUR machine
            const osUsername = process.env.USER
                ?? process.env.USERNAME   // Windows fallback
                ?? "unknown";

            const memory = await memoryStore.getOrCreate(osUsername);

            // Update lastActiveAt
            memory.user.lastActiveAt = new Date().toISOString();
            await memoryStore.save(memory);

            const isReturning = memory.notes.length > 0
                || memory.lastCustomerContext !== null
                || memory.recentTicketIds.length > 0;

            const greeting = isReturning
                ? `Welcome back, ${osUsername}. I found your previous session context.`
                : `Hello ${osUsername}, this is your first session. Starting fresh.`;

            return {
                content: [{
                    type: "text",
                    text: `${greeting}\n\n${JSON.stringify(memory, null, 2)}`,
                }],
            };
        }
    );
}