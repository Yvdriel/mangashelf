"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type LoginState = "idle" | "loading" | "2fa-required";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [verifying, setVerifying] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    // Check if setup is needed
    fetch("/api/auth/setup-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsSetup) {
          router.replace("/setup");
        } else {
          setNeedsSetup(false);
        }
      })
      .catch(() => setNeedsSetup(false));

    // Check passkey support
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      setPasskeySupported(true);
    }
  }, [router]);

  async function handlePasskeyLogin() {
    setError("");
    setState("loading");

    try {
      const { error: passkeyError } = await authClient.signIn.passkey({
        fetchOptions: {
          onSuccess() {
            router.push("/");
            router.refresh();
          },
        },
      });

      if (passkeyError) {
        setError(passkeyError.message || "Passkey authentication failed");
        setState("idle");
      }
    } catch {
      setError("Passkey authentication was cancelled or failed");
      setState("idle");
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("loading");

    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || "Invalid credentials");
        setState("idle");
        return;
      }

      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        setState("2fa-required");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setState("idle");
    }
  }

  async function handleTotpVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);

    try {
      const { error: totpError } = await authClient.twoFactor.verifyTotp({
        code: totpCode,
      });

      if (totpError) {
        setError(totpError.message || "Invalid verification code");
        setVerifying(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Verification failed");
      setVerifying(false);
    }
  }

  if (needsSetup === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-400 border-t-accent-400" />
      </div>
    );
  }

  if (state === "2fa-required") {
    return (
      <form onSubmit={handleTotpVerify} className="space-y-4">
        <div className="text-center mb-2">
          <p className="text-sm text-surface-200">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={totpCode}
            onChange={(e) =>
              setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-3 text-center text-2xl font-mono tracking-[0.5em] text-surface-50 placeholder-surface-300 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            placeholder="000000"
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={verifying || totpCode.length !== 6}
          className="w-full rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-surface-900 transition-colors hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? "Verifying..." : "Verify"}
        </button>

        <button
          type="button"
          onClick={() => {
            setState("idle");
            setTotpCode("");
            setError("");
          }}
          className="w-full text-sm text-surface-300 hover:text-surface-100 transition-colors"
        >
          Back to login
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {/* Passkey login */}
      {passkeySupported && (
        <>
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={state === "loading"}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-surface-500 bg-surface-700 px-4 py-2.5 text-sm font-medium text-surface-50 transition-colors hover:bg-surface-600 hover:border-surface-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"
              />
            </svg>
            Sign in with Passkey
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-600" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface-800 px-2 text-surface-300">or</span>
            </div>
          </div>
        </>
      )}

      {/* Email/password login */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-surface-200 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-surface-50 placeholder-surface-300 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            placeholder="you@example.com"
            autoComplete="username webauthn"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-surface-200 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-surface-50 placeholder-surface-300 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            placeholder="Your password"
            autoComplete="current-password webauthn"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-surface-900 transition-colors hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "loading" ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
