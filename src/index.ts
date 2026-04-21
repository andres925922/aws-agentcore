/**
 * index.ts  — MCP server entry point
 *
 * Transport: Streamable HTTP (the modern MCP transport for remote servers)
 * Port:      8000  — the path AgentCore Runtime expects: 0.0.0.0:8000/mcp
 *
 * Run locally:
 *   npm run seed   (first time only)
 *   npm run dev    (tsx watch, hot-reload)
 *
 * The server exposes three tools:
 *   - get_customer_profile
 *   - check_warranty_status
 *   - create_support_ticket
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";

import { initDb } from "./utils/db.js";
import { registerGetCustomerProfile } from "./tools/getCustomerProfile.js";
import { registerCheckWarrantyStatus } from "./tools/checkWarrantyStatus.js";
import { registerCreateSupportTicket } from "./tools/createSupportTicket.js";

// ─── Bootstrap DB ─────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, "../data"), { recursive: true });
initDb();

// ─── Create MCP server ────────────────────────────────────────────────────────

const server = new McpServer({
    name: "customer-support-mcp",
    version: "1.0.0",
});

// Register all tools
registerGetCustomerProfile(server);
registerCheckWarrantyStatus(server);
registerCreateSupportTicket(server);

// ─── HTTP transport ───────────────────────────────────────────────────────────
// Streamable HTTP is the recommended transport for remote/hosted MCP servers.
// AgentCore Runtime expects the server at 0.0.0.0:8000/mcp — we match that.

const PORT = parseInt(process.env.PORT ?? "8000", 10);

const httpServer = http.createServer(async (req, res) => {
    // Only handle POST /mcp — everything else returns 404
    if (req.url !== "/mcp") {
        res.writeHead(404).end("Not found");
        return;
    }
    if (req.method !== "POST") {
        res.writeHead(405).end("Method not allowed");
        return;
    }

    // Read the full body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf-8");

    // One transport instance per request (stateless mode)
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — no session header needed
    });

    // Wire transport → server, handle the request, then close
    await server.connect(transport);
    await transport.handleRequest(req, res, JSON.parse(body));
    await transport.close();
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Customer Support MCP Server`);
    console.log(`   Listening on http://0.0.0.0:${PORT}/mcp`);
    console.log(`\n   Tools available:`);
    console.log(`     • get_customer_profile`);
    console.log(`     • check_warranty_status`);
    console.log(`     • create_support_ticket`);
    console.log(`\n   Run "npm run seed" first if you haven't already.\n`);
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\nShutting down...");
    httpServer.close();
    process.exit(0);
});