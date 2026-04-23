/**
 * repositories/index.ts
 *
 * Single import point. Tools only need to import from here.
 */

export type {
  ICustomerRepository,
  IProductRepository,
  ITicketRepository,
  IRepositories,
} from "./interfaces.js";

export { createSqliteRepositories } from "./sqliteRepository.js";
export { createDynamoRepositories } from "./dynamoRepository.js";