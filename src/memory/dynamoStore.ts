/**
 * memory/dynamoStore.ts
 *
 * DynamoDB implementation of IMemoryStore.
 *
 * Table design:
 *   PK: userId (string)             — one row per user, no sort key needed
 *   Attributes:
 *     data       (S) — full UserMemory as JSON blob
 *     updated_at (S) — ISO timestamp, for debugging
 *     ttl        (N) — Unix epoch seconds — DynamoDB deletes the row
 *                      automatically after this time (TTL attribute)
 *
 * TTL strategy:
 *   - The ROW ttl is set to max(notes expiresAt, tickets expiresAt) + 7 days
 *     as a safety buffer. DynamoDB TTL deletion is eventually consistent
 *     (can take up to 48h after expiry) so we prune expired items in code too.
 *   - Individual notes and ticket references carry their own expiresAt inside
 *     the JSON blob — pruneExpired() filters them on every read.
 *
 * Why a blob and not separate attributes?
 *   UserMemory is a document with nested arrays. Mapping it to DynamoDB
 *   attributes would require marshalling every field separately and querying
 *   with complex expressions. The blob keeps the code simple and the read
 *   pattern is always "get the whole user record" — no partial reads needed.
 */

import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { IMemoryStore, UserMemory, pruneExpired, TTL_DAYS } from "./types.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface DynamoMemoryConfig {
    region: string;
    tableName: string;
}

export function dynamoMemoryConfigFromEnv(): DynamoMemoryConfig {
    const tableName = process.env.DYNAMODB_MEMORY_TABLE;
    if (!tableName) throw new Error("Missing env var: DYNAMODB_MEMORY_TABLE");
    return {
        region: process.env.AWS_REGION ?? "eu-west-2",
        tableName,
    };
}

// ─── TTL helpers ──────────────────────────────────────────────────────────────

/**
 * Compute a Unix epoch TTL for the DynamoDB row.
 * We use the furthest-away expiry in the memory + a 7-day buffer.
 * If there's nothing expirable, default to 90 days from now.
 */
function computeRowTtl(memory: UserMemory): number {
    const candidates: number[] = [
        ...memory.notes.map((n) => new Date(n.expiresAt).getTime()),
        ...memory.recentTickets.map((t) => new Date(t.expiresAt).getTime()),
    ];

    const bufferMs = 7 * 24 * 60 * 60 * 1000;
    const defaultMs = TTL_DAYS.tickets * 24 * 60 * 60 * 1000;
    const base = candidates.length > 0 ? Math.max(...candidates) : Date.now() + defaultMs;

    // Return Unix epoch in seconds (DynamoDB TTL is seconds, not ms)
    return Math.floor((base + bufferMs) / 1000);
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class DynamoMemoryStore implements IMemoryStore {
    private readonly client: DynamoDBClient;
    private readonly tableName: string;

    constructor(config: DynamoMemoryConfig) {
        this.client = new DynamoDBClient({ region: config.region });
        this.tableName = config.tableName;
    }

    async getOrCreate(userId: string, osUsername = userId): Promise<UserMemory> {
        // Try to fetch existing record
        const result = await this.client.send(
            new GetItemCommand({
                TableName: this.tableName,
                Key: marshall({ userId }),
            })
        );

        if (result.Item) {
            const raw = unmarshall(result.Item);
            const memory = JSON.parse(raw["data"] as string) as UserMemory;
            return pruneExpired(memory); // filter expired notes/tickets in-app
        }

        // First time — create a fresh record and persist it
        const now = new Date().toISOString();
        const fresh: UserMemory = {
            user: { userId, osUsername, firstSeenAt: now, lastActiveAt: now },
            preferences: { language: "en", tone: "formal" },
            lastCustomerContext: null,
            notes: [],
            recentTickets: [],
        };

        await this._put(fresh);
        return fresh;
    }

    async save(memory: UserMemory): Promise<void> {
        await this._put(memory);
    }

    async touch(userId: string): Promise<void> {
        const now = new Date().toISOString();

        // UpdateItem so we only write the two fields that changed
        await this.client.send(
            new UpdateItemCommand({
                TableName: this.tableName,
                Key: marshall({ userId }),
                UpdateExpression: "SET updated_at = :ua",
                ExpressionAttributeValues: marshall({ ":ua": now }),
                // Only update if the row already exists — don't create a skeleton row
                ConditionExpression: "attribute_exists(userId)",
            })
        ).catch((e) => {
            // Row doesn't exist yet — silently skip (getOrCreate will make it)
            if (e.name !== "ConditionalCheckFailedException") throw e;
        });
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    private async _put(memory: UserMemory): Promise<void> {
        const now = new Date().toISOString();
        const ttl = computeRowTtl(memory);

        await this.client.send(
            new PutItemCommand({
                TableName: this.tableName,
                Item: marshall(
                    {
                        userId: memory.user.userId,   // PK
                        data: JSON.stringify(memory),
                        updated_at: now,
                        ttl,                               // DynamoDB TTL attribute (seconds)
                    },
                    { removeUndefinedValues: true }
                ),
            })
        );
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createDynamoMemoryStore(config?: DynamoMemoryConfig): DynamoMemoryStore {
    return new DynamoMemoryStore(config ?? dynamoMemoryConfigFromEnv());
}