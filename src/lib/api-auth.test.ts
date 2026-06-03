import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiToken } from "@/db/schema";
import {
  generateToken,
  getSessionFromRequest,
  hashToken,
  tokenPrefix,
} from "./api-auth";
import { authedRequest, seedToken, seedUser, TEST_TOKEN } from "@/test/db";

describe("token helpers", () => {
  it("generates an mst_ token with 32 hex chars", () => {
    const t = generateToken();
    expect(t).toMatch(/^mst_[0-9a-f]{32}$/);
  });

  it("hashes deterministically (sha256 hex)", () => {
    expect(hashToken("mst_abc")).toBe(hashToken("mst_abc"));
    expect(hashToken("mst_abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("mst_abc")).not.toBe(hashToken("mst_abd"));
  });

  it("prefix is mst_ + first 8 hex", () => {
    expect(tokenPrefix("mst_0123456789abcdef")).toBe("mst_01234567");
  });
});

describe("getSessionFromRequest (bearer path)", () => {
  it("resolves the user for a valid token and bumps lastUsedAt", async () => {
    const userId = seedUser({ name: "Kompakt Owner" });
    const tokenId = seedToken(userId);

    const session = await getSessionFromRequest(
      authedRequest("http://localhost/api/v1/auth/whoami"),
    );

    expect(session).not.toBeNull();
    expect(session?.via).toBe("token");
    expect(session?.user.id).toBe(userId);
    expect(session?.user.name).toBe("Kompakt Owner");

    const row = db
      .select()
      .from(apiToken)
      .where(eq(apiToken.id, tokenId))
      .get();
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it("rejects an unknown token", async () => {
    seedToken(seedUser());
    const session = await getSessionFromRequest(
      authedRequest("http://localhost/x", { token: "mst_deadbeef" }),
    );
    expect(session).toBeNull();
  });

  it("rejects a revoked token", async () => {
    const userId = seedUser();
    seedToken(userId, TEST_TOKEN, { revokedAt: new Date() });
    const session = await getSessionFromRequest(
      authedRequest("http://localhost/x"),
    );
    expect(session).toBeNull();
  });

});
