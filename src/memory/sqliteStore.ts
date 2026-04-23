/**
 * memory/sqliteStore.ts — v2
 * Updated to use userId as PK and prune expired fields on read.
 */

import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import {
    IMemoryStore, UserMemory, UserPreferences,
    pruneExpired,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PREFERENCES: UserPreferences = { language: "en", tone: "formal" };

export function createSqliteMemoryConnection(dbPath?: string): Database.Database {
    const resolvedPath = dbPath ?? join(__dirname, "../../data/memory.db");
    mkdirSync(join(resolvedPath, ".."), { recursive: true });
    const db = new Database(resolvedPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS user_memory (
      user_id    TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
    return db;
}

export class SqliteMemoryStore implements IMemoryStore {
    constructor(private readonly db: Database.Database) { }

    async getOrCreate(userId: string, osUsername = userId): Promise<UserMemory> {
        const row = this.db
            .prepare(`SELECT data FROM user_memory WHERE user_id = ?`)
            .get(userId) as { data: string } | undefined;

        if (row) return pruneExpired(JSON.parse(row.data) as UserMemory);

        const now = new Date().toISOString();
        const fresh: UserMemory = {
            user: { userId, osUsername, firstSeenAt: now, lastActiveAt: now },
            preferences: { language: "en", tone: "formal" },
            lastCustomerContext: null,
            notes: [],
            recentTickets: [],
        };
        this.db
            .prepare(`INSERT INTO user_memory (user_id, data, updated_at) VALUES (?, ?, ?)`)
            .run(userId, JSON.stringify(fresh), now);
        return fresh;
    }

    async save(memory: UserMemory): Promise<void> {
        const now = new Date().toISOString();
        this.db
            .prepare(`
        INSERT INTO user_memory (user_id, data, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `)
            .run(memory.user.userId, JSON.stringify(memory), now);
    }

    async touch(userId: string): Promise<void> {
        const row = this.db
            .prepare(`SELECT data FROM user_memory WHERE user_id = ?`)
            .get(userId) as { data: string } | undefined;
        if (!row) return;
        const memory = JSON.parse(row.data) as UserMemory;
        memory.user.lastActiveAt = new Date().toISOString();
        this.db
            .prepare(`UPDATE user_memory SET data = ?, updated_at = ? WHERE user_id = ?`)
            .run(JSON.stringify(memory), memory.user.lastActiveAt, userId);
    }
}

export function createSqliteMemoryStore(dbPath?: string): SqliteMemoryStore {
    return new SqliteMemoryStore(createSqliteMemoryConnection(dbPath));
}