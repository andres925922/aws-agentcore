/**
 * tools/checkWarrantyStatus.ts
 *
 * MCP tool: check_warranty_status
 *
 * Given a product ID, returns whether it's currently under warranty, how many
 * days remain (or how many days ago it expired), and the expiry date.
 *
 * Phase 2 change: swap `getProductById` for DynamoDB get-item. That's it.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IProductRepository } from "../repositories/index.ts";
import { computeWarrantyStatus } from "../utils/warranty.js";

export function registerCheckWarrantyStatus(
    server: McpServer,
    productRepo: IProductRepository
): void {
    server.registerTool(
        "check_warranty_status",
        {
            title: "Check Warranty Status",
            description:
                "Check whether a registered product is currently under warranty. Returns expiry date and days remaining (negative = already expired).",
            inputSchema: {
                productId: z.string().uuid().describe("The product UUID to check"),
            },
        },
        async ({ productId }) => {
            const product = await productRepo.getById(productId);

            if (!product) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No product found with id "${productId}".`,
                        },
                    ],
                    isError: true,
                };
            }

            const status = computeWarrantyStatus(product);

            // Build a human-readable summary on top of the raw JSON
            const summary = status.isUnderWarranty
                ? `✅ Under warranty — ${status.daysRemaining} days remaining (expires ${status.warrantyExpiresAt.slice(0, 10)})`
                : `❌ Warranty expired ${Math.abs(status.daysRemaining)} days ago (expired ${status.warrantyExpiresAt.slice(0, 10)})`;

            return {
                content: [
                    {
                        type: "text",
                        text: `${summary}\n\n${JSON.stringify(status, null, 2)}`,
                    },
                ],
            };
        }
    );
}