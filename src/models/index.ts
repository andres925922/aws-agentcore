/**
 * models/index.ts
 *
 * Zod schemas are the single source of truth for every data shape in this
 * project. TypeScript types are derived from them — never defined separately.
 *
 * Phase 2 note: only the DB layer changes. These schemas stay identical
 * when we swap SQLite for DynamoDB.
 */

import { z } from "zod";

// ─── Customer ────────────────────────────────────────────────────────────────

export const CustomerSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    plan: z.enum(["free", "pro", "enterprise"]),
    createdAt: z.string().datetime(), // ISO-8601, stored as TEXT in SQLite
});

export type Customer = z.infer<typeof CustomerSchema>;

// ─── Product ─────────────────────────────────────────────────────────────────

export const ProductSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    sku: z.string().min(1),
    customerId: z.string().uuid(),
    purchaseDate: z.string().datetime(),
    warrantyMonths: z.number().int().nonnegative(),
});

export type Product = z.infer<typeof ProductSchema>;

// ─── Support Ticket ───────────────────────────────────────────────────────────

export const TicketPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const TicketStatusSchema = z.enum([
    "open",
    "in_progress",
    "waiting_on_customer",
    "resolved",
    "closed",
]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const TicketSchema = z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    productId: z.string().uuid().optional(),
    subject: z.string().min(1).max(200),
    description: z.string().min(1),
    priority: TicketPrioritySchema,
    status: TicketStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type Ticket = z.infer<typeof TicketSchema>;

// ─── Warranty check result (not stored, computed on the fly) ─────────────────

export const WarrantyStatusSchema = z.object({
    productId: z.string().uuid(),
    productName: z.string(),
    sku: z.string(),
    purchaseDate: z.string().datetime(),
    warrantyExpiresAt: z.string().datetime(),
    isUnderWarranty: z.boolean(),
    daysRemaining: z.number().int(), // negative = expired N days ago
});

export type WarrantyStatus = z.infer<typeof WarrantyStatusSchema>;