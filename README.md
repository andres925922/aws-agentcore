# Customer Support MCP Server — Phase 1

A local MCP server written in TypeScript. No cloud, no agent framework, no magic.
This is the foundation everything else will build on.

## What's in here

```
src/
├── index.ts                   # Entry point — HTTP server + tool registration
├── models/
│   └── index.ts               # Zod schemas (single source of truth for all types)
├── db/
│   ├── client.ts              # SQLite wrapper (swapped for DynamoDB in Phase 2)
│   └── seed.ts                # Populate DB with test data
├── tools/
│   ├── getCustomerProfile.ts  # Tool: get_customer_profile
│   ├── checkWarrantyStatus.ts # Tool: check_warranty_status
│   └── createSupportTicket.ts # Tool: create_support_ticket
└── utils/
    └── warranty.ts            # Pure function: compute warranty from a Product
```

## Quick start

```bash
npm install
npm run seed     # creates data/support.db with test customers + products
npm run dev      # starts server on http://localhost:8000/mcp
```

## Test data (after seed)

| Customer     | ID suffix | Email              | Plan       |
|--------------|-----------|--------------------|------------|
| Alice Martínez | …000001 | alice@example.com  | pro        |
| Bob Chen     | …000002   | bob@example.com    | enterprise |
| Carol Dupont | …000003   | carol@example.com  | free       |

| Product               | Owner | Warranty         |
|-----------------------|-------|------------------|
| ProBook Laptop 15     | Alice | ✅ Active (~4mo left) |
| SoundMax Pro Headset  | Alice | ❌ Expired        |
| CloudRack Server Unit | Bob   | ✅ Active (~24mo left) |

## Tools

### `get_customer_profile`
Look up a customer by **id** or **email**. Returns profile + all their products.

```json
{ "email": "alice@example.com" }
```

### `check_warranty_status`
Check if a product is under warranty, and how many days remain.

```json
{ "productId": "p0000000-0000-0000-0000-000000000001" }
```

### `create_support_ticket`
Open a new ticket. Validates customer exists, and that the product belongs to them.

```json
{
  "customerId": "c1a2b3c4-0000-0000-0000-000000000001",
  "productId":  "p0000000-0000-0000-0000-000000000002",
  "subject":    "Headset crackling noise after 1 year",
  "description": "After about 12 months of use, the left ear started crackling. Happens at all volume levels.",
  "priority":   "medium"
}
```

## Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "customer-support": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/customer-support-mcp/src/index.ts"],
      "env": { "PORT": "8000" }
    }
  }
}
```

## Connect with copilot-cli:

```bash
mkdir -p ~/.config/gh-copilot
touch ~/.config/gh-copilot/mcp.json
```

```json
{
  "servers": {
    "customer-support": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
``` 

Or use a generic MCP client pointed at `http://localhost:8000/mcp`.

## Phase 2 — what changes?

Only `src/db/client.ts`. Every function signature stays identical — you swap
the SQLite calls for `@aws-sdk/client-dynamodb` calls. Models, tools, and
utils are untouched.

## Key design decisions

**Why Zod everywhere?**  
Zod schemas define the shape once. TypeScript types, MCP input schemas, and
DB row validation all derive from the same definition. A mismatch surfaces at
compile time, not in production.

**Why stateless HTTP transport?**  
Stateless = one transport instance per request. This is simpler locally and
exactly what AgentCore Runtime expects. When you need multi-turn interactions
(elicitation, streaming progress) you'd switch to stateful mode — but not yet.

**Why 8000/mcp?**  
AgentCore Runtime expects MCP servers at `0.0.0.0:8000/mcp`. Building to that
spec now means zero changes to the server address in Phase 4.
