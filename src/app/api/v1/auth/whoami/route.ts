import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
}
