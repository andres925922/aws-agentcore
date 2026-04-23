/**
 * repositories/interfaces.ts
 *
 * These interfaces are the only thing the tools know about.
 * SQLite, DynamoDB, MongoDB, a mock for tests — all look identical
 * from the tools' point of view.
 *
 * Rules:
 *  - All methods return Promises (even SQLite, which is sync under the hood).
 *    This keeps the interface honest for async backends like DynamoDB.
 *  - No DB-specific types leak out. Only domain models from models/index.ts.
 */

import { Customer, Product, Ticket } from "../models/index.js";

// ─── Customer repository ──────────────────────────────────────────────────────

export interface ICustomerRepository {
    getById(id: string): Promise<Customer | null>;
    getByEmail(email: string): Promise<Customer | null>;
    seed(customer: Customer): Promise<void>;
}

// ─── Product repository ───────────────────────────────────────────────────────

export interface IProductRepository {
    getById(id: string): Promise<Product | null>;
    getByCustomerId(customerId: string): Promise<Product[]>;
    seed(product: Product): Promise<void>;
}

// ─── Ticket repository ────────────────────────────────────────────────────────

export interface ITicketRepository {
    create(ticket: Ticket): Promise<Ticket>;
    getByCustomerId(customerId: string): Promise<Ticket[]>;
}

// ─── Convenience bundle ───────────────────────────────────────────────────────
// Pass one object instead of three wherever all repos are needed.

export interface IRepositories {
    customers: ICustomerRepository;
    products: IProductRepository;
    tickets: ITicketRepository;
}