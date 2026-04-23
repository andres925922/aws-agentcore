/**
 * memory/ramStore.ts
 *
 * In-memory implementation of IMemoryStore.
 * Data lives in a plain Map — fast, zero dependencies, lost on restart.
 *
 * This is intentionally simple so the pattern is clear.
 * To swap to SQLite: implement IMemoryStore in sqliteMemoryStore.ts
 * To swap to DynamoDB: implement IMemoryStore in dynamoMemoryStore.ts
 * Nothing outside this file changes.
 */

import { IMemoryStore, UserMemory, UserPreferences } from "./types.js";

const DEFAULT_PREFERENCES: UserPreferences = {
    language: "es",
    tone: "formal",
};

function createFreshMemory(osUsername: string): UserMemory {
    const now = new Date().toISOString();
    return {
        user: {
            osUsername,
            firstSeenAt: now,
            lastActiveAt: now,
        },
        preferences: { ...DEFAULT_PREFERENCES },
        lastCustomerContext: null,
        notes: [],
        recentTicketIds: [],
    };
}

export class RamMemoryStore implements IMemoryStore {
    // keyed by osUsername
    private readonly store = new Map<string, UserMemory>();

    async getOrCreate(osUsername: string): Promise<UserMemory> {
        if (!this.store.has(osUsername)) {
            this.store.set(osUsername, createFreshMemory(osUsername));
        }
        // Return a deep clone so callers can't mutate the store directly
        return structuredClone(this.store.get(osUsername)!);
    }

    async save(memory: UserMemory): Promise<void> {
        this.store.set(memory.user.osUsername, structuredClone(memory));
    }

    async touch(osUsername: string): Promise<void> {
        const memory = this.store.get(osUsername);
        if (memory) {
            memory.user.lastActiveAt = new Date().toISOString();
        }
    }

    /** Debug helper — not part of the interface */
    dump(): Record<string, UserMemory> {
        return Object.fromEntries(this.store.entries());
    }
}