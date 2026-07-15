"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";

type PasswordKey = "team_password" | "admin_password";

interface FormState {
  password: string;
  confirmPassword: string;
  loading: boolean;
  error: string;
  success: boolean;
}

const INITIAL: FormState = {
  password: "",
  confirmPassword: "",
  loading: false,
  error: "",
  success: false,
};

export default function PasswordsPage() {
  const [teamForm, setTeamForm] = useState<FormState>({ ...INITIAL });
  const [adminForm, setAdminForm] = useState<FormState>({ ...INITIAL });

  function updateTeam(patch: Partial<FormState>) {
    setTeamForm((f) => ({ ...f, ...patch }));
  }
  function updateAdmin(patch: Partial<FormState>) {
    setAdminForm((f) => ({ ...f, ...patch }));
  }

  async function handleSubmit(
    key: PasswordKey,
    form: FormState,
    update: (patch: Partial<FormState>) => void
  ) {
    update({ error: "", success: false, loading: true });

    if (form.password.length < 8) {
      update({ error: "Password must be at least 8 characters.", loading: false });
      return;
    }
    if (form.password !== form.confirmPassword) {
      update({ error: "Passwords do not match.", loading: false });
      return;
    }

    try {
      const res = await fetch("/api/admin/passwords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        update({ error: data.error ?? "Failed to update password.", loading: false });
        return;
      }
      update({ password: "", confirmPassword: "", success: true, loading: false });
    } catch {
      update({ error: "Something went wrong.", loading: false });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NavBar />
      <div className="max-w-xl mx-auto w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Password Settings</h1>
        <p className="text-sm text-gray-500 mb-8">
          Update the shared passwords used to log in. Changes take effect immediately.
        </p>

        <PasswordCard
          title="Team Password"
          description="Shared by all members and editors."
          badgeClass="bg-gray-100 text-gray-700"
          badgeLabel="members + editors"
          form={teamForm}
          onChange={updateTeam}
          onSubmit={() => handleSubmit("team_password", teamForm, updateTeam)}
        />

        <PasswordCard
          title="Admin Password"
          description="Used by admin accounts only."
          badgeClass="bg-purple-100 text-purple-700"
          badgeLabel="admins only"
          form={adminForm}
          onChange={updateAdmin}
          onSubmit={() => handleSubmit("admin_password", adminForm, updateAdmin)}
        />
      </div>
    </div>
  );
}

interface PasswordCardProps {
  title: string;
  description: string;
  badgeClass: string;
  badgeLabel: string;
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: () => void;
}

function PasswordCard({
  title,
  description,
  badgeClass,
  badgeLabel,
  form,
  onChange,
  onSubmit,
}: PasswordCardProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-5">{description}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            New Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => onChange({ password: e.target.value, success: false, error: "" })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600"
            placeholder="Min 8 characters"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={form.confirmPassword}
            onChange={(e) => onChange({ confirmPassword: e.target.value, success: false, error: "" })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600"
            placeholder="Repeat password"
          />
        </div>

        {form.error && (
          <p className="text-sm text-red-600">{form.error}</p>
        )}
        {form.success && (
          <p className="text-sm text-green-700 font-medium">
            ✓ Password updated successfully.
          </p>
        )}

        <button
          type="submit"
          disabled={form.loading}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {form.loading ? "Saving…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
