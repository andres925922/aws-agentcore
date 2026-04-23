/**
 * utils/resolveUser.ts
 *
 * Resolves the caller's identity from environment variables.
 *
 * Priority:
 *   1. USER_ID env var  — set explicitly (e.g. injected by AgentCore per deployment)
 *   2. USER / USERNAME  — OS user (automatic on Mac/Linux/Windows)
 *   3. "unknown"        — last resort
 *
 * To support multi-user production deployments:
 *   - Option A: inject USER_ID=<corporate-id> per AgentCore instance
 *   - Option B: upgrade to JWT validation in this function — nothing else changes
 */

export interface ResolvedUser {
    userId: string;
    osUsername: string;
}

export function resolveUser(): ResolvedUser {
    const osUsername =
        process.env.USER ??
        process.env.USERNAME ??
        "unknown";

    const userId =
        process.env.USER_ID ??  // explicit override (production)
        osUsername;              // OS user (local dev)

    return { userId, osUsername };
}