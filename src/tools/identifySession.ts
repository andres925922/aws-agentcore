/**
 * tools/identifySession.ts — v2
 *
 * Identity resolution strategy:
 *  - Local dev:    reads $USER from the server process env (your OS user)
 *  - Production:  inject USER=<corporate-id> as an env var in AgentCore
 *                 Runtime config (scripts/deploy.sh environment-variables)
 *
 * This keeps the tool simple and avoids fighting the SDK's header API.
 * When you need JWT-based auth, replace resolveUser() — nothing else changes.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IMemoryStore } from "../memory/index.js";
import { resolveUser } from "../utils/resolveUser.js";

export function registerIdentifySession(
    server: McpServer,
    memoryStore: IMemoryStore,
): void {
    server.registerTool(
        "identify_session",
        {
            title: "Identify Session",
            description:
                "Call this at the start of every conversation. Resolves the caller's identity from the USER environment variable (set automatically from OS locally, or injected by AgentCore in production). Creates or retrieves their full session memory.",
            inputSchema: {},
        },
        async () => {
            const { userId, osUsername } = resolveUser();

            const memory = await memoryStore.getOrCreate(userId, osUsername);
            memory.user.lastActiveAt = new Date().toISOString();
            await memoryStore.save(memory);

            const isReturning =
                memory.notes.length > 0 ||
                memory.lastCustomerContext !== null ||
                memory.recentTickets.length > 0;

            const greeting = isReturning
                ? `Welcome back, ${userId}. Previous session context loaded.`
                : `Hello ${userId}, first session — starting fresh.`;

            return {
                content: [{ type: "text", text: `${greeting}\n\n${JSON.stringify(memory, null, 2)}` }],
            };
        }
    );
}