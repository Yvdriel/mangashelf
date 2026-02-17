import { db } from "@/db";
import { user } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .get();
  const needsSetup = (result?.count ?? 0) === 0;
  return Response.json({ needsSetup });
}
