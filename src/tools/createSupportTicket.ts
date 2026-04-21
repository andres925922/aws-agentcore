/**
 * tools/createSupportTicket.ts
 *
 * MCP tool: create_support_ticket
 *
 * Creates a new support ticket for a customer. Validates that the customer
 * exists, and optionally that the product belongs to them.
 *
 * Phase 2 change: swap `getCustomerById`, `getProductById`, `createTicket`
 * for DynamoDB equivalents. Everything else stays identical.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getCustomerById, getProductById, createTicket } from "../repositories/index.js";
import { TicketPrioritySchema, TicketStatusSchema } from "../models/index.js";

export function registerCreateSupportTicket(server: McpServer): void {
    server.registerTool(
        "create_support_ticket",
        {
            title: "Create Support Ticket",
            description:
                "Open a new support ticket for a customer. Optionally link it to a specific product. Returns the created ticket with its assigned ID.",
            inputSchema: {
                customerId: z
                    .string()
                    .uuid()
                    .describe("UUID of the customer opening the ticket"),
                productId: z
                    .string()
                    .uuid()
                    .optional()
                    .describe(
                        "UUID of the product the issue relates to (optional but recommended)"
                    ),
                subject: z
                    .string()
                    .min(5)
                    .max(200)
                    .describe("Short summary of the issue (5–200 chars)"),
                description: z
                    .string()
                    .min(10)
                    .describe("Full description of the issue (at least 10 chars)"),
                priority: TicketPrioritySchema.default("medium").describe(
                    "Ticket priority: low | medium | high | urgent"
                ),
            },
        },
        async ({ customerId, productId, subject, description, priority }) => {
            // 1. Verify customer exists
            const customer = getCustomerById(customerId);
            if (!customer) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Customer "${customerId}" not found. Cannot create ticket.`,
                        },
                    ],
                    isError: true,
                };
            }

            // 2. If a product was provided, verify it exists AND belongs to this customer
            if (productId !== undefined) {
                const product = getProductById(productId);
                if (!product) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Product "${productId}" not found.`,
                            },
                        ],
                        isError: true,
                    };
                }
                if (product.customerId !== customerId) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Product "${productId}" does not belong to customer "${customerId}".`,
                            },
                        ],
                        isError: true,
                    };
                }
            }

            // 3. Create the ticket
            const now = new Date().toISOString();
            const ticket = createTicket({
                id: randomUUID(),
                customerId,
                productId,
                subject,
                description,
                priority,
                status: "open",
                createdAt: now,
                updatedAt: now,
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Ticket created successfully.\n\n${JSON.stringify(ticket, null, 2)}`,
                    },
                ],
            };
        }
    );
}