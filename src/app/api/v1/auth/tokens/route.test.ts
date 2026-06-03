import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { DELETE } from "./[id]/route";
import { authedRequest, seedToken, seedUser } from "@/test/db";

describe("POST /api/v1/auth/tokens", () => {
  it("creates a token and returns the plaintext exactly once", async () => {
    const userId = seedUser({ name: "Owner", email: "o@test.local" });
    seedToken(userId);

    const res = await POST(
      authedRequest("http://localhost/api/v1/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Kompakt" }),
      }),
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe("Kompakt");
    expect(body.token).toMatch(/^mst_[0-9a-f]{32}$/);
    expect(typeof body.id).toBe("string");
    expect(typeof body.prefix).toBe("string");
  });

  it("returns 400 when name is missing/empty", async () => {
    const userId = seedUser();
    seedToken(userId);

    const empty = await POST(
      authedRequest("http://localhost/api/v1/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      }),
    );
    expect(empty.status).toBe(400);

    const missing = await POST(
      authedRequest("http://localhost/api/v1/auth/tokens", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(missing.status).toBe(400);
  });

  it("returns 401 for an unknown bearer", async () => {
    seedToken(seedUser());
    const res = await POST(
      authedRequest("http://localhost/api/v1/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Kompakt" }),
        token: "mst_unknown0000",
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/auth/tokens", () => {
  it("lists the current user tokens without secrets", async () => {
    const userId = seedUser();
    seedToken(userId);

    // Create a token via the endpoint so it appears in the list.
    await POST(
      authedRequest("http://localhost/api/v1/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Kompakt" }),
      }),
    );

    const res = await GET(authedRequest("http://localhost/api/v1/auth/tokens"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    const item = body.find(
      (t: { name: string }) => t.name === "Kompakt",
    );
    expect(item).toBeTruthy();
    expect(typeof item.id).toBe("string");
    expect(typeof item.prefix).toBe("string");
    expect("createdAt" in item).toBe(true);
    expect("lastUsedAt" in item).toBe(true);
    expect("revokedAt" in item).toBe(true);
    // Secrets must never be exposed.
    expect("token" in item).toBe(false);
    expect("tokenHash" in item).toBe(false);
  });

  it("only lists tokens owned by the session user", async () => {
    const userId = seedUser({ email: "me@test.local" });
    seedToken(userId);
    const otherUser = seedUser({ email: "other@test.local" });
    seedToken(otherUser, "mst_" + "1".repeat(32), { name: "OtherUserToken" });

    const res = await GET(authedRequest("http://localhost/api/v1/auth/tokens"));
    const body = await res.json();
    const names = body.map((t: { name: string }) => t.name);
    expect(names).not.toContain("OtherUserToken");
  });

  it("returns 401 for an unknown bearer", async () => {
    seedToken(seedUser());
    const res = await GET(
      authedRequest("http://localhost/api/v1/auth/tokens", {
        token: "mst_unknown0000",
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/v1/auth/tokens/[id]", () => {
  it("revokes an owned token and it then shows revokedAt", async () => {
    const userId = seedUser();
    seedToken(userId);

    await POST(
      authedRequest("http://localhost/api/v1/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Kompakt" }),
      }),
    );

    const listRes = await GET(
      authedRequest("http://localhost/api/v1/auth/tokens"),
    );
    const list = await listRes.json();
    const created = list.find((t: { name: string }) => t.name === "Kompakt");
    expect(created).toBeTruthy();

    const delRes = await DELETE(
      authedRequest(
        `http://localhost/api/v1/auth/tokens/${created.id}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);

    const afterRes = await GET(
      authedRequest("http://localhost/api/v1/auth/tokens"),
    );
    const after = await afterRes.json();
    const revoked = after.find(
      (t: { id: string }) => t.id === created.id,
    );
    expect(revoked).toBeTruthy();
    expect(revoked.revokedAt).not.toBeNull();
  });

  it("returns 404 when the token is not owned by the session user", async () => {
    const userId = seedUser({ email: "me@test.local" });
    seedToken(userId);
    const otherUser = seedUser({ email: "other@test.local" });
    const otherTokenId = seedToken(otherUser, "mst_" + "1".repeat(32), {
      name: "OtherUserToken",
    });

    const res = await DELETE(
      authedRequest(
        `http://localhost/api/v1/auth/tokens/${otherTokenId}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: String(otherTokenId) }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown token id", async () => {
    const userId = seedUser();
    seedToken(userId);

    const res = await DELETE(
      authedRequest("http://localhost/api/v1/auth/tokens/does-not-exist", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "does-not-exist" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 for an unknown bearer", async () => {
    const userId = seedUser();
    const tokenId = seedToken(userId);
    const res = await DELETE(
      authedRequest(`http://localhost/api/v1/auth/tokens/${tokenId}`, {
        method: "DELETE",
        token: "mst_unknown0000",
      }),
      { params: Promise.resolve({ id: String(tokenId) }) },
    );
    expect(res.status).toBe(401);
  });
});
