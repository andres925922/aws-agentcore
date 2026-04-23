/**
 * repositories/dynamo.ts
 *
 * DynamoDB implementations of the same three interfaces.
 * Swap createSqliteRepositories() for createDynamoRepositories() in
 * index.ts and everything else is untouched.
 */

import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient, getTableNames } from "../utils/db/dynamodb/index.js";
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

export class DynamoCustomerRepository implements ICustomerRepository {
    constructor(
        private readonly client: DynamoDBClient,
        private readonly tableName: string,
    ) { }

    async getById(id: string): Promise<Customer | null> {
        const result = await this.client.send(
            new GetItemCommand({ TableName: this.tableName, Key: marshall({ id }) })
        );
        if (!result.Item) return null;
        return CustomerSchema.parse(unmarshall(result.Item));
    }

    async getByEmail(email: string): Promise<Customer | null> {
        const result = await this.client.send(
            new QueryCommand({
                TableName: this.tableName,
                IndexName: "email-index",
                KeyConditionExpression: "email = :email",
                ExpressionAttributeValues: marshall({ ":email": email }),
                Limit: 1,
            })
        );
        const item = result.Items?.[0];
        if (!item) return null;
        return CustomerSchema.parse(unmarshall(item));
    }

    async seed(customer: Customer): Promise<void> {
        await this.client.send(
            new PutItemCommand({
                TableName: this.tableName,
                Item: marshall(customer, { removeUndefinedValues: true }),
                ConditionExpression: "attribute_not_exists(id)",
            })
        ).catch((e) => {
            if (e.name !== "ConditionalCheckFailedException") throw e;
        });
    }
}

// ─── Product repository ───────────────────────────────────────────────────────

export class DynamoProductRepository implements IProductRepository {
    constructor(
        private readonly client: DynamoDBClient,
        private readonly tableName: string,
    ) { }

    async getById(id: string): Promise<Product | null> {
        const result = await this.client.send(
            new GetItemCommand({ TableName: this.tableName, Key: marshall({ id }) })
        );
        if (!result.Item) return null;
        return ProductSchema.parse(unmarshall(result.Item));
    }

    async getByCustomerId(customerId: string): Promise<Product[]> {
        const result = await this.client.send(
            new QueryCommand({
                TableName: this.tableName,
                IndexName: "customerId-index",
                KeyConditionExpression: "customerId = :customerId",
                ExpressionAttributeValues: marshall({ ":customerId": customerId }),
            })
        );
        return (result.Items ?? []).map((item) => ProductSchema.parse(unmarshall(item)));
    }

    async seed(product: Product): Promise<void> {
        await this.client.send(
            new PutItemCommand({
                TableName: this.tableName,
                Item: marshall(product, { removeUndefinedValues: true }),
                ConditionExpression: "attribute_not_exists(id)",
            })
        ).catch((e) => {
            if (e.name !== "ConditionalCheckFailedException") throw e;
        });
    }
}

// ─── Ticket repository ────────────────────────────────────────────────────────

export class DynamoTicketRepository implements ITicketRepository {
    constructor(
        private readonly client: DynamoDBClient,
        private readonly tableName: string,
    ) { }

    async create(ticket: Ticket): Promise<Ticket> {
        await this.client.send(
            new PutItemCommand({
                TableName: this.tableName,
                Item: marshall(ticket, { removeUndefinedValues: true }),
            })
        );
        return ticket;
    }

    async getByCustomerId(customerId: string): Promise<Ticket[]> {
        const result = await this.client.send(
            new QueryCommand({
                TableName: this.tableName,
                IndexName: "customerId-index",
                KeyConditionExpression: "customerId = :customerId",
                ExpressionAttributeValues: marshall({ ":customerId": customerId }),
            })
        );
        return (result.Items ?? []).map((item) => TicketSchema.parse(unmarshall(item)));
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createDynamoRepositories(): IRepositories {
    const client = getDynamoClient();
    const tableNames = getTableNames();
    return {
        customers: new DynamoCustomerRepository(client, tableNames.customers),
        products: new DynamoProductRepository(client, tableNames.products),
        tickets: new DynamoTicketRepository(client, tableNames.tickets),
    };
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

export async function seedCustomer(customer: Customer): Promise<void> {
    const client = getDynamoClient();
    const tableNames = getTableNames();
    await client.send(
        new PutItemCommand({
            TableName: tableNames.customers,
            Item: marshall(customer, { removeUndefinedValues: true }),
            ConditionExpression: "attribute_not_exists(id)",
        })
    ).catch((e) => {
        if (e.name !== "ConditionalCheckFailedException") throw e;
    });
}

export async function seedProduct(product: Product): Promise<void> {
    const client = getDynamoClient();
    const tableNames = getTableNames();
    await client.send(
        new PutItemCommand({
            TableName: tableNames.products,
            Item: marshall(product, { removeUndefinedValues: true }),
            ConditionExpression: "attribute_not_exists(id)",
        })
    ).catch((e) => {
        if (e.name !== "ConditionalCheckFailedException") throw e;
    });
}