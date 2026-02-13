import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

export const auth = betterAuth({
  baseURL: process.env.AUTH_ORIGIN || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute client cache
    },
  },
  plugins: [
    twoFactor({
      issuer: "MangaShelf",
    }),
    passkey({
      rpID: process.env.AUTH_RP_ID || "localhost",
      rpName: "MangaShelf",
      origin: process.env.AUTH_ORIGIN || "http://localhost:3000",
    }),
    admin({
      defaultRole: "user",
    }),
    nextCookies(),
  ],
  trustedOrigins: [process.env.AUTH_ORIGIN || "http://localhost:3000"],
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          // Check if any users exist — only allow creation when zero users exist
          // (first user setup) or when called from admin context
          const result = db
            .select({ count: sql<number>`count(*)` })
            .from(schema.user)
            .get();
          const userCount = result?.count ?? 0;
          if (userCount === 0) {
            // First user — auto-assign admin role
            return {
              data: {
                ...userData,
                role: "admin",
              },
            };
          }
          // After first user, Better Auth admin plugin handles authorization
          // for admin.createUser() calls. Direct signUp attempts from
          // non-admin context will still go through — we block those
          // at the API level via the setup-status check + disabled signup UI.
          return undefined;
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
