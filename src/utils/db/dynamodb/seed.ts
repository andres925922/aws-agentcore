/**
 * db/seed.ts — Phase 2
 *
 * Populates DynamoDB tables with the same test data as Phase 1.
 * Idempotent: re-running skips items that already exist.
 *
 * Run with:  npm run seed
 * Requires:  .env file with table names (output of `terraform apply`)
 */

import "dotenv/config";
import { seedCustomer, seedProduct } from "../../../repositories/dynamoRepository.js";
import { customers, products } from "../data/seedData.js";

console.log("Seeding DynamoDB tables...\n");

// Note: no need to init the db, this will be managed by Terraform and AWS. Just seed the data directly.

for (const c of customers) {
    await seedCustomer(c);
    console.log(`✅ Customer: ${c.name} (${c.email})`);
}

for (const p of products) {
    await seedProduct(p);
    console.log(`✅ Product:  ${p.name} (${p.sku})`);
}

console.log("\nDone. Tables are ready.");