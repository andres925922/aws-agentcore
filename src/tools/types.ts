import { z } from "zod";

// Plain z.object() so the MCP SDK can generate a proper JSON Schema with
// visible `properties`. Using .transform() or .refine() on the top-level
// object produces a ZodEffects type that is opaque to schema generators.
export const InputSchema = z.object({
    id:    z.string().optional().describe("Customer UUID (use this OR email, not both)"),
    email: z.string().optional().describe("Customer email address (use this OR id, not both)"),
});

// Full validation schema used inside the tool handler: normalises empty
// strings / null values and enforces that at least one field is provided.
export const ParsedInputSchema = InputSchema
    .transform((data) => ({
        id:    data.id    === "" || data.id    === null ? undefined : data.id,
        email: data.email === "" || data.email === null ? undefined : data.email,
    }))
    .refine((v) => v.id !== undefined || v.email !== undefined, {
        message: "Provide either `id` or `email`",
    });

export type InputType = z.infer<typeof InputSchema>;