"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || "Failed to create account");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-surface-200 mb-1"
        >
          Display Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-surface-50 placeholder-surface-300 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          placeholder="Your name"
          autoComplete="name"
        />
      </div>

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
          placeholder="admin@example.com"
          autoComplete="email"
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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-surface-200 mb-1"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-surface-50 placeholder-surface-300 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          placeholder="Repeat your password"
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-surface-900 transition-colors hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating account..." : "Create Admin Account"}
      </button>
    </form>
  );
}
