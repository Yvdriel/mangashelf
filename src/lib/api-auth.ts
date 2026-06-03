import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiToken, user } from "@/db/schema";
import { getSession } from "./auth-helpers";

const TOKEN_PREFIX = "mst_";

/** Normalized session usable as a drop-in for `session.user.id` in routes. */
export interface ApiSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: string | null;
  };
  via: "token" | "cookie";
}

/** sha256 hex of a plaintext token — what we store and compare against. */
export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/** Generate a new plaintext token `mst_<32 hex>`. Returned to the user once. */
export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(16).toString("hex");
}

/** Display prefix stored alongside the hash: `mst_` + first 8 hex chars. */
export function tokenPrefix(plain: string): string {
  return plain.slice(0, TOKEN_PREFIX.length + 8);
}

function parseBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  // HTTP auth schemes are case-insensitive; tolerate extra whitespace.
  const value = /^Bearer\s+(\S+)\s*$/i.exec(header)?.[1];
  if (!value?.startsWith(TOKEN_PREFIX)) return null;
  return value;
}

/**
 * Resolve the current user from a request, preferring a bearer API token
 * (native client) and falling back to the better-auth session cookie (web).
 * Returns null when neither yields a valid, non-revoked user.
 */
export async function getSessionFromRequest(
  req: Request,
): Promise<ApiSession | null> {
  const bearer = parseBearer(req);
  if (bearer) {
    const row = db
      .select({
        tokenId: apiToken.id,
        revokedAt: apiToken.revokedAt,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })
      .from(apiToken)
      .innerJoin(user, eq(apiToken.userId, user.id))
      .where(eq(apiToken.tokenHash, hashToken(bearer)))
      .get();

    if (!row || row.revokedAt) return null;

    db.update(apiToken)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiToken.id, row.tokenId))
      .run();

    return {
      user: { id: row.id, name: row.name, email: row.email, role: row.role },
      via: "token",
    };
  }

  const session = await getSession();
  if (!session) return null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role ?? null,
    },
    via: "cookie",
  };
}
