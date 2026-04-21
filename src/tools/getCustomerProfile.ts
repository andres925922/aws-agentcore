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
import { z } from "zod";
import {
    getCustomerById,
    getCustomerByEmail,
    getProductsByCustomerId,
} from "../repositories/index.js";

// Input schema — at least one of id / email must be present
// z.preprocess normalises empty string / null → undefined so the SDK's
// habit of sending missing optional fields as "" doesn't break UUID/email validation.
const idField = z
    .preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional())
    .describe("Customer UUID (use this OR email, not both)");

const emailField = z
    .preprocess((v) => (v === "" || v === null ? undefined : v), z.string().email().optional())
    .describe("Customer email address (use this OR id, not both)");

const InputSchema = z
    .object({ id: idField, email: emailField })
    .refine((v) => v.id !== undefined || v.email !== undefined, {
        message: "Provide either `id` or `email`",
    });


export function registerGetCustomerProfile(server: McpServer): void {
    server.registerTool(
        "get_customer_profile",
        {
            title: "Get Customer Profile",
            description:
                "Look up a customer by their UUID or email address. Returns profile details and a list of their registered products.",
            inputSchema: InputSchema,
        },
        async (input) => {
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
                ? getCustomerById(id)
                : getCustomerByEmail(email!);

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

            const products = getProductsByCustomerId(customer.id);

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