/**
 * db/seed.ts
 *
 * Populates the SQLite DB with realistic test data so you can exercise all
 * three tools immediately after running `npm run seed`.
 *
 * Run with:  npm run seed
 */

import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initDb } from "./index.ts";
import { seedCustomer, seedProduct } from "../../../repositories/sqliteRepository.ts";
import { customers, products } from "../data/seedData.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, "../../../../data"), { recursive: true });

initDb();

for (const c of customers) seedCustomer(c);
for (const p of products) seedProduct(p);

console.log("✅ Database seeded successfully");
console.log("\nCustomers:");
for (const c of customers) {
    console.log(`  ${c.name} — id: ${c.id} — email: ${c.email} — plan: ${c.plan}`);
}
console.log("\nProducts:");
for (const p of products) {
    console.log(`  ${p.name} (${p.sku}) — owned by customerId: ${p.customerId}`);
}
console.log("\nTip: query these IDs and emails with your MCP client.");