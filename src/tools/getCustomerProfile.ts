/**
 * tools/getCustomerProfile.ts
 *
 * MCP tool: get_customer_profile
 *
 * Accepts EITHER a customer `id` (UUID) OR an `email`. Exactly one must be
 * provided. Also returns all products owned by that customer.
 *
 * Phase 2 change: swap `getCustomerById` / `getCustomerByEmail` /
 * `getProductsByCustomerId` with DynamoDB equivalents. Everything else stays.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InputSchema, ParsedInputSchema, InputType } from "./types.js";
import {
    ICustomerRepository,
    IProductRepository,
} from "../repositories/index.js";


export function registerGetCustomerProfile(
    server: McpServer,
    customerRepo: ICustomerRepository,
    productRepo: IProductRepository
): void {
    server.registerTool(
        "get_customer_profile",
        {
            title: "Get Customer Profile",
            description:
                "Look up a customer by their UUID or email address. Returns profile details and a list of their registered products.",
            inputSchema: InputSchema,
        },
        async (input: InputType) => {
            // Validate with the refined schema (requires at least one field)
            const parsed = ParsedInputSchema.safeParse(input);
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

            const products = await productRepo.getByCustomerId(customer.id);

            const result = {
                customer,
                products,
                productCount: products.length,
            };

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
    );
}