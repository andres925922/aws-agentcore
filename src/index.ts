/**
 * index.ts — MCP server entry point
 *
 * This is the ONLY file that knows which repository implementation is used.
 * Switch DB backend by changing one line:
 *
 *   createSqliteRepositories()   ← local dev, no AWS needed
 *   createDynamoRepositories()   ← production, needs .env + Terraform
 */

import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";

import { createSqliteRepositories, createDynamoRepositories } from "./repositories/index.js";
import { registerGetCustomerProfile } from "./tools/getCustomerProfile.js";
import { registerCheckWarrantyStatus } from "./tools/checkWarrantyStatus.js";
import { registerCreateSupportTicket } from "./tools/createSupportTicket.js";
import { registerGetTicketsByCustomer } from "./tools/getTicketsByCustomer.js";
import { registerIdentifySession } from "./tools/identifySession.js";
import { registerGetSessionContext } from "./tools/getSessionContext.js";
import { registerSaveNote } from "./tools/saveNote.js";
import { RamMemoryStore } from "./memory/index.js";

// ─── Choose your backend here ─────────────────────────────────────────────────
//
//  "sqlite"  → local file, no AWS, good for development
//  "dynamo"  → AWS DynamoDB, needs .env populated from terraform output
//
const BACKEND = process.env.DB_BACKEND ?? "sqlite";

const repos = BACKEND === "dynamo"
    ? createDynamoRepositories()
    : createSqliteRepositories();

console.log(`📦 Repository backend: ${BACKEND}`);

// ─── MCP server ───────────────────────────────────────────────────────────────

const server = new McpServer({
    name: "customer-support-mcp",
    version: "3.0.0",
});

const memoryStore = new RamMemoryStore();

// Each tool receives only the repositories it actually needs
registerGetCustomerProfile(server, repos.customers, repos.products);
registerCheckWarrantyStatus(server, repos.products);
registerCreateSupportTicket(server, repos.customers, repos.products, repos.tickets);
registerGetTicketsByCustomer(server, repos.customers, repos.tickets);

// Session memory tools
registerIdentifySession(server, memoryStore);
registerGetSessionContext(server, memoryStore);
registerSaveNote(server, memoryStore);

// ─── HTTP transport ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "8000", 10);

const httpServer = http.createServer(async (req, res) => {
    if (req.url !== "/mcp") { res.writeHead(404).end("Not found"); return; }
    if (req.method !== "POST") { res.writeHead(405).end("Method not allowed"); return; }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf-8");

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, JSON.parse(body));
    await transport.close();
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Customer Support MCP Server`);
    console.log(`   Backend:   ${BACKEND}`);
    console.log(`   Listening: http://0.0.0.0:${PORT}/mcp\n`);
});

process.on("SIGINT", () => { httpServer.close(); process.exit(0); });