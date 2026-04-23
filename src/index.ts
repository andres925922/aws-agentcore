/**
 * index.ts — MCP server entry point
 *
 * Controls two independent concerns via env vars:
 *
 *   DB_BACKEND=sqlite|dynamo        where customer/product/ticket data lives
 *   MEMORY_BACKEND=ram|sqlite|dynamo where session memory lives
 *
 * Production recommended:
 *   DB_BACKEND=dynamo MEMORY_BACKEND=dynamo
 *
 * Local dev:
 *   DB_BACKEND=sqlite MEMORY_BACKEND=sqlite
 */

import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";

import { createSqliteRepositories, createDynamoRepositories } from "./repositories/index.js";
import {
    RamMemoryStore,
    createSqliteMemoryStore,
    createDynamoMemoryStore,
} from "./memory/index.js";

import { registerGetCustomerProfile } from "./tools/getCustomerProfile.js";
import { registerCheckWarrantyStatus } from "./tools/checkWarrantyStatus.js";
import { registerCreateSupportTicket } from "./tools/createSupportTicket.js";
import { registerIdentifySession } from "./tools/identifySession.js";
import { registerGetSessionContext } from "./tools/getSessionContext.js";
import { registerSaveNote } from "./tools/saveNote.js";
import { BedrockChatOrchestrator, ChatRequest } from "./chat/bedrockChat.js";

// ─── Repository backend ───────────────────────────────────────────────────────

const DB_BACKEND = process.env.DB_BACKEND ?? "sqlite";
const repos = DB_BACKEND === "dynamo"
    ? createDynamoRepositories()
    : createSqliteRepositories();

// ─── Memory backend ───────────────────────────────────────────────────────────

const MEMORY_BACKEND = process.env.MEMORY_BACKEND ?? "ram";
const memoryStore =
    MEMORY_BACKEND === "dynamo" ? createDynamoMemoryStore() :
        MEMORY_BACKEND === "sqlite" ? createSqliteMemoryStore() :
            new RamMemoryStore();

const chatOrchestrator = new BedrockChatOrchestrator(repos, memoryStore);

// ─── MCP server ───────────────────────────────────────────────────────────────

const server = new McpServer({ name: "customer-support-mcp", version: "4.0.0" });

// Customer data tools
registerGetCustomerProfile(server, repos.customers, repos.products);
registerCheckWarrantyStatus(server, repos.products);
registerCreateSupportTicket(server, repos.customers, repos.products, repos.tickets);

// Session memory tools
registerIdentifySession(server, memoryStore);
registerGetSessionContext(server, memoryStore);
registerSaveNote(server, memoryStore);

// ─── HTTP transport ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "8000", 10);

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf-8");
    if (!body) return {};
    return JSON.parse(body);
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
    const text = JSON.stringify(payload, null, 2);
    res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
    res.end(text);
}

const httpServer = http.createServer(async (req, res) => {
    try {
        if (req.url === "/chat") {
            if (req.method !== "POST") { res.writeHead(405).end("Method not allowed"); return; }
            const body = await readJsonBody(req);
            const chatInput = body as ChatRequest;
            const result = await chatOrchestrator.run(chatInput);
            writeJson(res, 200, result);
            return;
        }

        if (req.url !== "/mcp") { res.writeHead(404).end("Not found"); return; }
        if (req.method !== "POST") { res.writeHead(405).end("Method not allowed"); return; }

        const body = await readJsonBody(req);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, body as object);
        await transport.close();
    } catch (error) {
        const asAny = error as any;
        const message = error instanceof Error ? error.message : "Unexpected error";
        const name = error instanceof Error ? error.name : "Error";
        const metadata = asAny?.$metadata
            ? {
                statusCode: asAny.$metadata.httpStatusCode,
                requestId: asAny.$metadata.requestId,
            }
            : undefined;

        writeJson(res, 500, {
            error: message,
            errorType: name,
            ...(metadata ? { metadata } : {}),
        });
    }
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Customer Support MCP Server v4`);
    console.log(`   DB backend:     ${DB_BACKEND}`);
    console.log(`   Memory backend: ${MEMORY_BACKEND}`);
    console.log(`   MCP endpoint:   http://0.0.0.0:${PORT}/mcp`);
    console.log(`   Chat endpoint:  http://0.0.0.0:${PORT}/chat\n`);
});

process.on("SIGINT", () => { httpServer.close(); process.exit(0); });