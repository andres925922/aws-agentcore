/**
 * tools/getTicketsByCustomer.ts
 *
 * MCP tool: get_tickets_by_customer
 *
 * Accepts EITHER a customer `id` (UUID) OR an `email`. Exactly one must be
 * provided. Also returns all tickets associated with that customer.
 *
 * Phase 2 change: swap `getCustomerById` / `getCustomerByEmail` /
 * `getTicketsByCustomerId` with DynamoDB equivalents. Everything else stays.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InputSchema, InputType } from "./types.ts";
import {
    ICustomerRepository,
    ITicketRepository,
} from "../repositories/index.ts";

export function registerGetTicketsByCustomer(
    server: McpServer,
    customerRepo: ICustomerRepository,
    ticketRepo: ITicketRepository
): void {
    server.registerTool(
        "get_tickets_by_customer",
        {
            title: "Get Tickets by Customer",
            description:
                "Look up a customer by their UUID or email address and return a list of their support tickets.",
            inputSchema: InputSchema,
        },
        async (input: InputType) => {
            // Validate with the refined schema (requires at least one field)
            const parsed = InputSchema.safeParse(input);
            if (!parsed.success) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Invalid input: ${parsed.error.issues[0].message}`,
                        },
                    ],
                    isError: true,
                };
            }

            const { id, email } = parsed.data;

            // Lookup
            const customer = id
                ? await customerRepo.getById(id)
                : await customerRepo.getByEmail(email!);

            if (!customer) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No customer found with ${id ? `id "${id}"` : `email "${email}"`}.`,
                        },
                    ],
                    isError: true,
                };
            }

            const tickets = await ticketRepo.getByCustomerId(customer.id);

            return {
                content: [
                    {
                        type: "text",
                        text: `Customer "${customer.name}" has ${tickets.length} ticket(s):\n\n${JSON.stringify(
                            tickets,
                            null,
                            2
                        )}`,
                    },
                ],
            };
        }
    );
}