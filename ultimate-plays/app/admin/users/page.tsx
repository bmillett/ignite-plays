"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

interface User {
  id: number;
  email: string;
  role: "member" | "admin";
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New user form state
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401 || res.status === 403) {
        router.push("/");
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      setUsers(await res.json());
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add user");
        return;
      }
      setNewEmail("");
      setNewRole("member");
      await loadUsers();
    } catch {
      setAddError("Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(email: string) {
    if (!confirm(`Remove ${email} from the allowlist?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to remove user");
        return;
      }
      await loadUsers();
    } catch {
      alert("Something went wrong.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NavBar />
      <div className="max-w-2xl mx-auto w-full p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">User Management</h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage the email allowlist and roles.
      </p>

      {/* Add user form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add User</h2>
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="player@team.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "member" | "admin")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {addError && (
          <p className="mt-2 text-sm text-red-600">{addError}</p>
        )}
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Allowed Users ({users.length})
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-gray-500 text-center">
            Loading…
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-sm text-red-600 text-center">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-500 text-center">
            No users yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  <span className="text-sm text-gray-900">{u.email}</span>
                  <span
                    className={`ml-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(u.email)}
                  className="text-xs text-red-600 hover:text-red-800 transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
