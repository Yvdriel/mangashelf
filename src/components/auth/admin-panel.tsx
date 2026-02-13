"use client";

import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";

interface User {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  twoFactorEnabled: boolean | null;
  createdAt: string | Date;
}

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query: {
        limit?: number;
        offset?: number;
        searchValue?: string;
        searchField?: "email" | "name";
        searchOperator?: "contains" | "starts_with" | "ends_with";
      } = { limit: 100, offset: 0 };
      if (search) {
        query.searchValue = search;
        query.searchField = "email";
        query.searchOperator = "contains";
      }
      const { data } = await authClient.admin.listUsers({ query });
      if (data) {
        setUsers(data.users as User[]);
        setTotal(data.total);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Search and create */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 placeholder-surface-300 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
        />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 transition-colors whitespace-nowrap"
        >
          Create User
        </button>
      </div>

      {showCreate && (
        <CreateUserForm
          onCreated={() => {
            setShowCreate(false);
            loadUsers();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* User list */}
      <div className="rounded-lg border border-surface-600 bg-surface-800 overflow-hidden">
        <div className="border-b border-surface-600 px-4 py-3">
          <p className="text-sm text-surface-200">
            {total} user{total !== 1 ? "s" : ""}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-400 border-t-accent-400" />
          </div>
        ) : (
          <div className="divide-y divide-surface-600">
            {users.map((u) => (
              <UserRow key={u.id} user={u} onUpdate={loadUsers} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateUserForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await authClient.admin.createUser({
        name,
        email,
        password,
        role,
      });
      if (err) {
        setError(err.message || "Failed to create user");
        setLoading(false);
        return;
      }
      onCreated();
    } catch {
      setError("Failed to create user");
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-surface-600 bg-surface-800 p-6 space-y-4"
    >
      <h3 className="text-sm font-semibold">Create New User</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-surface-200 mb-1">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        <div>
          <label className="block text-xs text-surface-200 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        <div>
          <label className="block text-xs text-surface-200 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        <div>
          <label className="block text-xs text-surface-200 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-surface-500 px-4 py-2 text-sm font-medium text-surface-200 hover:bg-surface-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function UserRow({ user, onUpdate }: { user: User; onUpdate: () => void }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSetRole(newRole: "user" | "admin") {
    setLoading(true);
    try {
      await authClient.admin.setRole({ userId: user.id, role: newRole });
      onUpdate();
    } catch {
      // ignore
    }
    setLoading(false);
    setActionsOpen(false);
  }

  async function handleBan() {
    if (!confirm(`Ban ${user.name}?`)) return;
    setLoading(true);
    try {
      await authClient.admin.banUser({
        userId: user.id,
        banReason: "Banned by admin",
      });
      onUpdate();
    } catch {
      // ignore
    }
    setLoading(false);
    setActionsOpen(false);
  }

  async function handleUnban() {
    setLoading(true);
    try {
      await authClient.admin.unbanUser({ userId: user.id });
      onUpdate();
    } catch {
      // ignore
    }
    setLoading(false);
    setActionsOpen(false);
  }

  async function handleRevokeSessions() {
    setLoading(true);
    try {
      await authClient.admin.revokeUserSessions({ userId: user.id });
    } catch {
      // ignore
    }
    setLoading(false);
    setActionsOpen(false);
  }

  async function handleRemove() {
    if (
      !confirm(
        `Permanently delete ${user.name}? This will remove all their data.`,
      )
    )
      return;
    setLoading(true);
    try {
      await authClient.admin.removeUser({ userId: user.id });
      onUpdate();
    } catch {
      // ignore
    }
    setLoading(false);
    setActionsOpen(false);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-600 text-xs font-semibold text-surface-200">
          {user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-surface-50 truncate">
              {user.name}
            </p>
            {user.role === "admin" && (
              <span className="rounded-full bg-accent-400/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-300">
                Admin
              </span>
            )}
            {user.banned && (
              <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                Banned
              </span>
            )}
            {user.twoFactorEnabled && (
              <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                2FA
              </span>
            )}
          </div>
          <p className="text-xs text-surface-300 truncate">{user.email}</p>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setActionsOpen(!actionsOpen)}
          disabled={loading}
          className="rounded-md p-1.5 text-surface-300 hover:bg-surface-600 hover:text-surface-100 transition-colors disabled:opacity-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
            />
          </svg>
        </button>

        {actionsOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setActionsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-surface-600 bg-surface-800 py-1 shadow-xl z-50">
              {user.role !== "admin" ? (
                <button
                  onClick={() => handleSetRole("admin")}
                  className="w-full px-4 py-2 text-left text-sm text-surface-200 hover:bg-surface-700"
                >
                  Promote to Admin
                </button>
              ) : (
                <button
                  onClick={() => handleSetRole("user")}
                  className="w-full px-4 py-2 text-left text-sm text-surface-200 hover:bg-surface-700"
                >
                  Demote to User
                </button>
              )}
              {user.banned ? (
                <button
                  onClick={handleUnban}
                  className="w-full px-4 py-2 text-left text-sm text-surface-200 hover:bg-surface-700"
                >
                  Unban User
                </button>
              ) : (
                <button
                  onClick={handleBan}
                  className="w-full px-4 py-2 text-left text-sm text-yellow-400 hover:bg-surface-700"
                >
                  Ban User
                </button>
              )}
              <button
                onClick={handleRevokeSessions}
                className="w-full px-4 py-2 text-left text-sm text-surface-200 hover:bg-surface-700"
              >
                Revoke Sessions
              </button>
              <button
                onClick={handleRemove}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-surface-700"
              >
                Delete User
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
