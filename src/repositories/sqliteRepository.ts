/**
 * repositories/sqlite.ts
 *
 * SQLite implementations of all three repository interfaces.
 * This is your existing db/client.ts logic, restructured into classes.
 *
 * The sync SQLite calls are wrapped in Promise.resolve() so the return
 * type matches the async interface — no actual async work happens.
 */

import Database from "better-sqlite3";
import { getDb } from "../utils/db/sqlite/index.ts";
import {
    Customer, CustomerSchema,
    Product, ProductSchema,
    Ticket, TicketSchema,
} from "../models/index.js";
import {
    ICustomerRepository,
    IProductRepository,
    ITicketRepository,
    IRepositories,
} from "./interfaces.js";


// ─── Customer repository ──────────────────────────────────────────────────────

export class SqliteCustomerRepository implements ICustomerRepository {
    constructor(private readonly db: Database.Database) { }

    async getById(id: string): Promise<Customer | null> {
        const row = this.db
            .prepare(`SELECT id, name, email, phone, plan, created_at as createdAt
                FROM customers WHERE id = ?`)
            .get(id);
        if (!row) return null;
        return CustomerSchema.parse(row);
    }

    async getByEmail(email: string): Promise<Customer | null> {
        const row = this.db
            .prepare(`SELECT id, name, email, phone, plan, created_at as createdAt
                FROM customers WHERE email = ?`)
            .get(email);
        if (!row) return null;
        return CustomerSchema.parse(row);
    }

    async seed(customer: Customer): Promise<void> {
        this.db
            .prepare(`INSERT OR IGNORE INTO customers (id, name, email, phone, plan, created_at)
                VALUES (@id, @name, @email, @phone, @plan, @createdAt)`)
            .run({ ...customer, createdAt: customer.createdAt });
    }
}

// ─── Product repository ───────────────────────────────────────────────────────

export class SqliteProductRepository implements IProductRepository {
    constructor(private readonly db: Database.Database) { }

    async getById(id: string): Promise<Product | null> {
        const row = this.db
            .prepare(`SELECT id, name, sku,
                       customer_id as customerId,
                       purchase_date as purchaseDate,
                       warranty_months as warrantyMonths
                FROM products WHERE id = ?`)
            .get(id);
        if (!row) return null;
        return ProductSchema.parse(row);
    }

    async getByCustomerId(customerId: string): Promise<Product[]> {
        const rows = this.db
            .prepare(`SELECT id, name, sku,
                       customer_id as customerId,
                       purchase_date as purchaseDate,
                       warranty_months as warrantyMonths
                FROM products WHERE customer_id = ?`)
            .all(customerId);
        return rows.map((r) => ProductSchema.parse(r));
    }

    async seed(product: Product): Promise<void> {
        this.db
            .prepare(`INSERT OR IGNORE INTO products (id, name, sku, customer_id, purchase_date, warranty_months)
                VALUES (@id, @name, @sku, @customerId, @purchaseDate, @warrantyMonths)`)
            .run(product);
    }
}

// ─── Ticket repository ────────────────────────────────────────────────────────

export class SqliteTicketRepository implements ITicketRepository {
    constructor(private readonly db: Database.Database) { }

    async create(ticket: Ticket): Promise<Ticket> {
        this.db
            .prepare(`INSERT INTO tickets
                  (id, customer_id, product_id, subject, description, priority, status, created_at, updated_at)
                VALUES
                  (@id, @customerId, @productId, @subject, @description, @priority, @status, @createdAt, @updatedAt)`)
            .run({ ...ticket, productId: ticket.productId ?? null });
        return ticket;
    }

    async getByCustomerId(customerId: string): Promise<Ticket[]> {
        const rows = this.db
            .prepare(`SELECT id,
                       customer_id as customerId,
                       product_id  as productId,
                       subject, description, priority, status,
                       created_at  as createdAt,
                       updated_at  as updatedAt
                FROM tickets WHERE customer_id = ?
                ORDER BY created_at DESC`)
            .all(customerId);
        return rows.map((r) => TicketSchema.parse(r));
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────
// Creates all three repos sharing one DB connection.

export function createSqliteRepositories(): IRepositories {
    const db = getDb();
    return {
        customers: new SqliteCustomerRepository(db),
        products: new SqliteProductRepository(db),
        tickets: new SqliteTicketRepository(db),
    };
}

// ─── Seed functions ─────────────────────────────────────────────────────────
export function seedCustomer(c: Customer): void {
    getDb()
        .prepare(
            `INSERT OR IGNORE INTO customers (id, name, email, phone, plan, created_at)
       VALUES (@id, @name, @email, @phone, @plan, @createdAt)`
        )
        .run({ ...c, createdAt: c.createdAt });
}

export function seedProduct(p: Product): void {
    getDb()
        .prepare(
            `INSERT OR IGNORE INTO products (id, name, sku, customer_id, purchase_date, warranty_months)
       VALUES (@id, @name, @sku, @customerId, @purchaseDate, @warrantyMonths)`
        )
        .run(p);
}