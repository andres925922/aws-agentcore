/**
 * memory/types.ts
 *
 * Domain types for session memory.
 * v2: adds userId (corporate/email ID) separate from osUsername,
 *     and expiresAt on notes and recentTickets for TTL-aware cleanup.
 */

export interface AgentUser {
    /** Corporate or email ID — primary identifier in production */
    userId: string;
    /** OS username — used as fallback when no X-User-Id header is present */
    osUsername: string;
    firstSeenAt: string;
    lastActiveAt: string;
}

export interface UserPreferences {
    language: string;
    tone: "formal" | "casual";
}

export interface CustomerContext {
    customerId: string;
    customerName: string;
    customerEmail: string;
    lastAccessedAt: string;
}

export interface TimestampedNote {
    text: string;
    savedAt: string;
    /** ISO-8601 — filtered out on read when past this date */
    expiresAt: string;
}

export interface RecentTicket {
    ticketId: string;
    subject: string;
    savedAt: string;
    /** ISO-8601 — filtered out on read when past this date */
    expiresAt: string;
}

export interface UserMemory {
    user: AgentUser;
    preferences: UserPreferences;
    lastCustomerContext: CustomerContext | null;
    notes: TimestampedNote[];
    recentTickets: RecentTicket[];
}

// ─── Repository interface ─────────────────────────────────────────────────────

export interface IMemoryStore {
    getOrCreate(userId: string, osUsername?: string): Promise<UserMemory>;
    save(memory: UserMemory): Promise<void>;
    touch(userId: string): Promise<void>;
}

// ─── TTL helpers ──────────────────────────────────────────────────────────────

export const TTL_DAYS = {
    notes: 30,   // notes expire after 30 days
    tickets: 90,   // ticket references expire after 90 days
} as const;

export function expiresAt(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

export function isExpired(isoDate: string): boolean {
    return new Date(isoDate) < new Date();
}

/** Strip expired notes and tickets from a UserMemory before returning it */
export function pruneExpired(memory: UserMemory): UserMemory {
    return {
        ...memory,
        notes: memory.notes.filter((n) => !isExpired(n.expiresAt)),
        recentTickets: memory.recentTickets.filter((t) => !isExpired(t.expiresAt)),
    };
}