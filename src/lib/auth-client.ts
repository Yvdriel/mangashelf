"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // Handled in the login form — don't redirect automatically
      },
    }),
    passkeyClient(),
    adminClient(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
