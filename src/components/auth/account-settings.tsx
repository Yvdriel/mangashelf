"use client";

import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";

interface AccountSettingsProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function AccountSettings({ userName, userEmail }: AccountSettingsProps) {
  return (
    <div className="space-y-8 max-w-2xl">
      <ProfileSection userName={userName} userEmail={userEmail} />
      <ChangePasswordSection />
      <TwoFactorSection />
      <PasskeySection />
      <SessionsSection />
    </div>
  );
}

function ProfileSection({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const [name, setName] = useState(userName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { error } = await authClient.updateUser({ name });
      if (error) {
        setMessage(error.message || "Failed to update profile");
      } else {
        setMessage("Profile updated");
      }
    } catch {
      setMessage("Failed to update profile");
    }
    setLoading(false);
  }

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-base font-semibold mb-4">Profile</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm text-surface-200 mb-1">Email</label>
          <input
            type="email"
            value={userEmail}
            disabled
            className="w-full rounded-lg border border-surface-600 bg-surface-700/50 px-3 py-2 text-sm text-surface-300 cursor-not-allowed"
          />
        </div>
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm text-surface-200 mb-1"
          >
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        {message && <p className="text-sm text-surface-200">{message}</p>}
        <button
          type="submit"
          disabled={loading || name === userName}
          className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </section>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      setIsError(true);
      return;
    }
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters");
      setIsError(true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        setMessage(error.message || "Failed to change password");
        setIsError(true);
      } else {
        setMessage("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage("Failed to change password");
      setIsError(true);
    }
    setLoading(false);
  }

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-base font-semibold mb-4">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-surface-200 mb-1">
            Current Password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        <div>
          <label className="block text-sm text-surface-200 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        <div>
          <label className="block text-sm text-surface-200 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        {message && (
          <p
            className={`text-sm ${isError ? "text-red-400" : "text-green-400"}`}
          >
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
    </section>
  );
}

function TwoFactorSection() {
  const { data: session } = authClient.useSession();
  const [step, setStep] = useState<
    "idle" | "setup" | "verify" | "enabled" | "backup"
  >("idle");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const is2FAEnabled = session?.user?.twoFactorEnabled;

  useEffect(() => {
    if (is2FAEnabled) setStep("enabled");
  }, [is2FAEnabled]);

  async function handleEnable() {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await authClient.twoFactor.enable({
        password,
      });
      if (err) {
        setError(err.message || "Failed to enable 2FA");
        setLoading(false);
        return;
      }
      if (data?.totpURI) {
        setTotpURI(data.totpURI);
        setBackupCodes(data.backupCodes || []);
        setStep("verify");
      }
    } catch {
      setError("Failed to enable 2FA");
    }
    setLoading(false);
  }

  async function handleVerify() {
    setLoading(true);
    setError("");
    try {
      const { error: err } = await authClient.twoFactor.verifyTotp({
        code,
      });
      if (err) {
        setError(err.message || "Invalid code");
        setLoading(false);
        return;
      }
      setStep("backup");
    } catch {
      setError("Verification failed");
    }
    setLoading(false);
  }

  async function handleDisable() {
    setLoading(true);
    setError("");
    try {
      const { error: err } = await authClient.twoFactor.disable({
        password,
      });
      if (err) {
        setError(err.message || "Failed to disable 2FA");
        setLoading(false);
        return;
      }
      setStep("idle");
      setPassword("");
    } catch {
      setError("Failed to disable 2FA");
    }
    setLoading(false);
  }

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-base font-semibold mb-4">
        Two-Factor Authentication
      </h2>

      {step === "enabled" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
              Enabled
            </span>
            <span className="text-sm text-surface-200">
              Your account is protected with 2FA
            </span>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Enter password to disable"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleDisable}
              disabled={loading || !password}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </div>
      )}

      {step === "idle" && (
        <div className="space-y-4">
          <p className="text-sm text-surface-200">
            Add an extra layer of security with a TOTP authenticator app.
          </p>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleEnable}
              disabled={loading || !password}
              className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Setting up..." : "Enable 2FA"}
            </button>
          </div>
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-4">
          <p className="text-sm text-surface-200">
            Scan this QR code with your authenticator app, then enter the
            6-digit code below.
          </p>
          <div className="flex justify-center rounded-lg bg-white p-4">
            {/* Render QR as an img using Google Charts API for simplicity */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpURI)}`}
              alt="TOTP QR Code"
              width={200}
              height={200}
            />
          </div>
          <div className="rounded-lg bg-surface-700 p-3">
            <p className="text-xs text-surface-300 mb-1">Manual entry key:</p>
            <code className="text-xs text-surface-50 break-all">
              {totpURI.match(/secret=([^&]+)/)?.[1] || ""}
            </code>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-center font-mono tracking-widest text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verifying..." : "Verify & Enable"}
          </button>
        </div>
      )}

      {step === "backup" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
              2FA Enabled
            </span>
          </div>
          <p className="text-sm text-surface-200">
            Save these backup codes somewhere safe. Each code can only be used
            once.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-700 p-4">
            {backupCodes.map((c, i) => (
              <code key={i} className="text-xs text-surface-50 font-mono">
                {c}
              </code>
            ))}
          </div>
          <button
            onClick={() => setStep("enabled")}
            className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </section>
  );
}

function PasskeySection() {
  const [passkeys, setPasskeys] = useState<
    Array<{ id: string; name?: string; createdAt?: string | Date | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadPasskeys = useCallback(async () => {
    try {
      const { data } = await authClient.passkey.listUserPasskeys();
      if (data) setPasskeys(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  async function handleAdd() {
    setLoading(true);
    setMessage("");
    try {
      const name = prompt("Name for this passkey (e.g., MacBook, iPhone):");
      if (!name) {
        setLoading(false);
        return;
      }
      const { error } = await authClient.passkey.addPasskey({ name });
      if (error) {
        setMessage(error.message || "Failed to register passkey");
      } else {
        setMessage("Passkey registered");
        loadPasskeys();
      }
    } catch {
      setMessage("Passkey registration was cancelled or failed");
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this passkey?")) return;
    try {
      await authClient.passkey.deletePasskey({ id });
      loadPasskeys();
    } catch {
      setMessage("Failed to remove passkey");
    }
  }

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-base font-semibold mb-4">Passkeys</h2>
      <p className="text-sm text-surface-200 mb-4">
        Use biometrics or a security key for passwordless sign-in.
      </p>

      {passkeys.length > 0 && (
        <div className="space-y-2 mb-4">
          {passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between rounded-lg border border-surface-600 bg-surface-700 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-surface-50">
                  {pk.name || "Unnamed passkey"}
                </p>
                {pk.createdAt && (
                  <p className="text-xs text-surface-300">
                    Added {new Date(pk.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(pk.id)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {message && <p className="text-sm text-surface-200 mb-3">{message}</p>}

      <button
        onClick={handleAdd}
        disabled={loading}
        className="rounded-lg border border-surface-500 px-4 py-2 text-sm font-medium text-surface-200 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Registering..." : "Register New Passkey"}
      </button>
    </section>
  );
}

function SessionsSection() {
  const [sessions, setSessions] = useState<
    Array<{
      token: string;
      userAgent?: string | null;
      ipAddress?: string | null;
      createdAt: string | Date;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await authClient.listSessions();
      if (data) setSessions(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  function parseUserAgent(ua: string | null | undefined): string {
    if (!ua) return "Unknown device";
    if (ua.includes("Mobile")) return "Mobile browser";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    return "Browser";
  }

  async function handleRevokeOthers() {
    setLoading(true);
    try {
      await authClient.revokeOtherSessions();
      loadSessions();
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleRevoke(token: string) {
    try {
      await authClient.revokeSession({ token });
      loadSessions();
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Active Sessions</h2>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeOthers}
            disabled={loading}
            className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            Sign out all others
          </button>
        )}
      </div>

      <div className="space-y-2">
        {sessions.map((s, i) => (
          <div
            key={s.token}
            className="flex items-center justify-between rounded-lg border border-surface-600 bg-surface-700 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-surface-50">
                {parseUserAgent(s.userAgent)}
                {i === 0 && (
                  <span className="ml-2 text-xs text-accent-400">Current</span>
                )}
              </p>
              <p className="text-xs text-surface-300">
                {s.ipAddress || "Unknown IP"} · Since{" "}
                {new Date(s.createdAt).toLocaleDateString()}
              </p>
            </div>
            {i !== 0 && (
              <button
                onClick={() => handleRevoke(s.token)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
