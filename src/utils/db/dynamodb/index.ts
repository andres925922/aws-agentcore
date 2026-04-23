/**
 *
 * Singleton DynamoDB client + table name resolution from environment.
 * Only imported by the DynamoDB repository implementations.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { requireEnv } from "../../environment.js";

// Lazy singleton — only throws if DynamoDB repos are actually used
let _client: DynamoDBClient | null = null;

export function getDynamoClient(): DynamoDBClient {
    if (!_client) {
        _client = new DynamoDBClient({
            region: process.env.AWS_REGION ?? "eu-west-2",
        });
    }
    return _client;
}

// Table names are set by `terraform apply` and written to .env
export function getTableNames(): { customers: string; products: string; tickets: string } {
    return {
        customers: requireEnv("DYNAMODB_CUSTOMERS_TABLE"),
        products: requireEnv("DYNAMODB_PRODUCTS_TABLE"),
        tickets: requireEnv("DYNAMODB_TICKETS_TABLE"),
    };
}