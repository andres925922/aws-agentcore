/**
 * utils/warranty.ts
 *
 * Pure function — no I/O, no dependencies beyond models. Easy to unit-test.
 */

import { Product, WarrantyStatus } from "../models/index.js";

export function computeWarrantyStatus(product: Product): WarrantyStatus {
    const purchaseMs = new Date(product.purchaseDate).getTime();
    const expiryMs =
        purchaseMs + product.warrantyMonths * 30 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const daysRemaining = Math.round((expiryMs - nowMs) / (24 * 60 * 60 * 1000));

    return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        purchaseDate: product.purchaseDate,
        warrantyExpiresAt: new Date(expiryMs).toISOString(),
        isUnderWarranty: nowMs <= expiryMs,
        daysRemaining,
    };
}