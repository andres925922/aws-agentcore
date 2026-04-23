/**
 * memory/ramStore.ts — v2
 * Updated to accept userId as primary key and prune expired entries.
 */

import {
    IMemoryStore, UserMemory, UserPreferences,
    TTL_DAYS, expiresAt, pruneExpired,
} from "./types.js";

const DEFAULT_PREFERENCES: UserPreferences = { language: "en", tone: "formal" };

function freshMemory(userId: string, osUsername: string): UserMemory {
    const now = new Date().toISOString();
    return {
        user: { userId, osUsername, firstSeenAt: now, lastActiveAt: now },
        preferences: { ...DEFAULT_PREFERENCES },
        lastCustomerContext: null,
        notes: [],
        recentTickets: [],
    };
}

export class RamMemoryStore implements IMemoryStore {
    private readonly store = new Map<string, UserMemory>();

    async getOrCreate(userId: string, osUsername = userId): Promise<UserMemory> {
        if (!this.store.has(userId)) {
            this.store.set(userId, freshMemory(userId, osUsername));
        }
        return pruneExpired(structuredClone(this.store.get(userId)!));
    }

    async save(memory: UserMemory): Promise<void> {
        this.store.set(memory.user.userId, structuredClone(memory));
    }

    async touch(userId: string): Promise<void> {
        const m = this.store.get(userId);
        if (m) m.user.lastActiveAt = new Date().toISOString();
    }
}