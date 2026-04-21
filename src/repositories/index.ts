import { getDb } from "../utils/db.js";
import {
    Customer,
    CustomerSchema,
    Product,
    ProductSchema,
    Ticket,
    TicketSchema,
} from "../models/index.js";

// ─── Customer operations ─────────────────────────────────────────────────────

/** Look up by primary key (id). Returns null if not found. */
export function getCustomerById(id: string): Customer | null {
    const row = getDb()
        .prepare(
            `SELECT id, name, email, phone, plan, created_at as createdAt
       FROM customers WHERE id = ?`
        )
        .get(id);

    if (!row) return null;
    return CustomerSchema.parse(row);
}

/** Look up by email (unique index). Returns null if not found. */
export function getCustomerByEmail(email: string): Customer | null {
    const row = getDb()
        .prepare(
            `SELECT id, name, email, phone, plan, created_at as createdAt
       FROM customers WHERE email = ?`
        )
        .get(email);

    if (!row) return null;
    return CustomerSchema.parse(row);
}

// ─── Product operations ───────────────────────────────────────────────────────

/** All products owned by a customer. */
export function getProductsByCustomerId(customerId: string): Product[] {
    const rows = getDb()
        .prepare(
            `SELECT id, name, sku,
              customer_id   as customerId,
              purchase_date as purchaseDate,
              warranty_months as warrantyMonths
       FROM products WHERE customer_id = ?`
        )
        .all(customerId);

    return rows.map((r) => ProductSchema.parse(r));
}

/** Single product by id. */
export function getProductById(id: string): Product | null {
    const row = getDb()
        .prepare(
            `SELECT id, name, sku,
              customer_id   as customerId,
              purchase_date as purchaseDate,
              warranty_months as warrantyMonths
       FROM products WHERE id = ?`
        )
        .get(id);

    if (!row) return null;
    return ProductSchema.parse(row);
}

// ─── Ticket operations ────────────────────────────────────────────────────────

/** Insert a new ticket row. */
export function createTicket(ticket: Ticket): Ticket {
    getDb()
        .prepare(
            `INSERT INTO tickets
         (id, customer_id, product_id, subject, description, priority, status, created_at, updated_at)
       VALUES
         (@id, @customerId, @productId, @subject, @description, @priority, @status, @createdAt, @updatedAt)`
        )
        .run({
            id: ticket.id,
            customerId: ticket.customerId,
            productId: ticket.productId ?? null,
            subject: ticket.subject,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
        });

    return ticket;
}

/** All open tickets for a customer. */
export function getTicketsByCustomerId(customerId: string): Ticket[] {
    const rows = getDb()
        .prepare(
            `SELECT id,
              customer_id  as customerId,
              product_id   as productId,
              subject, description, priority, status,
              created_at   as createdAt,
              updated_at   as updatedAt
       FROM tickets WHERE customer_id = ?
       ORDER BY created_at DESC`
        )
        .all(customerId);

    return rows.map((r) => TicketSchema.parse(r));
}

// ─── Seed helpers (used by seed.ts only) ────────────────────────────────────

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