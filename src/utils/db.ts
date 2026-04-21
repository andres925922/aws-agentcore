import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../../data/support.db");

// ─── Singleton connection ────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export const getDb: () => Database.Database = () => {
    if (!_db) {
        _db = new Database(DB_PATH);
        _db.pragma("journal_mode = WAL"); // better concurrent read performance
        _db.pragma("foreign_keys = ON");
    }
    return _db;
}

export const initDb: () => void = () => {
    const db = getDb();

    db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      phone         TEXT,
      plan          TEXT NOT NULL CHECK(plan IN ('free','pro','enterprise')),
      created_at    TEXT NOT NULL
    );
 
    CREATE TABLE IF NOT EXISTS products (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      sku              TEXT NOT NULL,
      customer_id      TEXT NOT NULL REFERENCES customers(id),
      purchase_date    TEXT NOT NULL,
      warranty_months  INTEGER NOT NULL DEFAULT 12
    );
 
    CREATE TABLE IF NOT EXISTS tickets (
      id           TEXT PRIMARY KEY,
      customer_id  TEXT NOT NULL REFERENCES customers(id),
      product_id   TEXT REFERENCES products(id),
      subject      TEXT NOT NULL,
      description  TEXT NOT NULL,
      priority     TEXT NOT NULL CHECK(priority IN ('low','medium','high','urgent')),
      status       TEXT NOT NULL CHECK(status IN ('open','in_progress','waiting_on_customer','resolved','closed')),
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
  `);
}