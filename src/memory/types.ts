/**
 * memory/types.ts
 *
 * Types for the in-memory session and user context store.
 * No DB-specific types here — just domain concepts.
 *
 * When you want to persist to SQLite or DynamoDB later, you implement
 * IMemoryStore with those backends. Nothing else changes.
 */

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AgentUser {
    /** OS username ($USER / whoami) */
    osUsername: string;
    /** When we first saw this user in this server process */
    firstSeenAt: string;
    /** Last time any tool was called for this user */
    lastActiveAt: string;
}

export interface UserPreferences {
    language: string;       // e.g. "es", "en"
    tone: "formal" | "casual";
}

export interface CustomerContext {
    customerId: string;
    customerName: string;
    customerEmail: string;
    lastAccessedAt: string;
}

export interface UserMemory {
    user: AgentUser;
    preferences: UserPreferences;
    /** The last customer this agent user was working with */
    lastCustomerContext: CustomerContext | null;
    /** Free-form notes the agent can write and read back */
    notes: Array<{ text: string; savedAt: string }>;
    /** Ticket IDs created during any session for this user */
    recentTicketIds: string[];
}

// ─── Repository interface ─────────────────────────────────────────────────────

export interface IMemoryStore {
    /** Get or create a UserMemory entry for this OS user */
    getOrCreate(osUsername: string): Promise<UserMemory>;
    /** Persist the full UserMemory back (overwrite) */
    save(memory: UserMemory): Promise<void>;
    /** Convenience: update only lastActiveAt */
    touch(osUsername: string): Promise<void>;
}