// ─── Customers ───────────────────────────────────────────────────────────────

export const customers = [
    {
        id: "116d8b76-00cb-48f9-ae5f-c6062c2b6112",
        name: "Alice Martínez",
        email: "alice@example.com",
        phone: "+34 612 345 678",
        plan: "pro" as const,
        createdAt: "2023-06-15T08:00:00.000Z",
    },
    {
        id: "986b8983-ceb7-4fc5-a6e4-3f74f26b3aee",
        name: "Bob Chen",
        email: "bob@example.com",
        phone: "+1 415 555 0101",
        plan: "enterprise" as const,
        createdAt: "2022-11-01T10:30:00.000Z",
    },
    {
        id: "db0f3de5-7241-4436-b70e-4e8cfcc213c8",
        name: "Carol Dupont",
        email: "carol@example.com",
        phone: undefined,
        plan: "free" as const,
        createdAt: "2024-01-20T14:00:00.000Z",
    },
];

// ─── Products ─────────────────────────────────────────────────────────────────
// Alice has two products: one under warranty, one expired
// Bob has one product with a long warranty
// Carol has no products
export const products = [
    {
        // Alice – laptop, purchased 8 months ago, 12-month warranty → ACTIVE
        id: "62fc35df-f6fc-410f-b400-ae1620543a61",
        name: "ProBook Laptop 15",
        sku: "PB-LAPTOP-15-2023",
        customerId: "116d8b76-00cb-48f9-ae5f-c6062c2b6112",
        purchaseDate: new Date(
            Date.now() - 8 * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        warrantyMonths: 12,
    },
    {
        // Alice – headset, purchased 2 years ago, 12-month warranty → EXPIRED
        id: "98c97f1a-6e30-4842-a54c-cba48409c587",
        name: "SoundMax Pro Headset",
        sku: "SM-HEADSET-PRO",
        customerId: "116d8b76-00cb-48f9-ae5f-c6062c2b6112",
        purchaseDate: new Date(
            Date.now() - 24 * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        warrantyMonths: 12,
    },
    {
        // Bob – enterprise server, 36-month warranty, purchased 1 year ago → ACTIVE
        id: "4ae1e3a3-49f5-4145-8b4f-98b090135bbd",
        name: "CloudRack Server Unit",
        sku: "CR-SERVER-ENT-2022",
        customerId: "986b8983-ceb7-4fc5-a6e4-3f74f26b3aee",
        purchaseDate: new Date(
            Date.now() - 12 * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        warrantyMonths: 36,
    },
];