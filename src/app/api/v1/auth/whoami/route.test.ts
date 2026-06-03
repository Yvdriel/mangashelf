import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { authedRequest, seedToken, seedUser } from "@/test/db";

describe("GET /api/v1/auth/whoami", () => {
  it("returns the current user identity for a valid bearer", async () => {
    const userId = seedUser({ name: "Owner", email: "o@test.local" });
    seedToken(userId);

    const res = await GET(authedRequest("http://localhost/api/v1/auth/whoami"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.userId).toBe(userId);
    expect(body.name).toBe("Owner");
    expect(body.email).toBe("o@test.local");
  });

  it("returns 401 for an unknown bearer", async () => {
    seedToken(seedUser());
    const res = await GET(
      authedRequest("http://localhost/api/v1/auth/whoami", {
        token: "mst_unknown0000",
      }),
    );
    expect(res.status).toBe(401);
  });
});
