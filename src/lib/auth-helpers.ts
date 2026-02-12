import { auth } from "./auth";
import { headers } from "next/headers";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getRequiredSession() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  return session;
}

export async function requireAdmin() {
  const session = await getRequiredSession();
  if (!session) return null;
  if (session.user.role !== "admin") return null;
  return session;
}
