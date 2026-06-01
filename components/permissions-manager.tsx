"use client";

import { useEffect, useState } from "react";

type AppPermissions = {
  tutor: {
    viewCalendar: boolean;
    viewPeople: boolean;
    viewByDay: boolean;
  };
  staff: {
    generateSessions: boolean;
  };
};

const DEFAULT: AppPermissions = {
  tutor: { viewCalendar: false, viewPeople: false, viewByDay: false },
  staff: { generateSessions: false },
};

type PermRow = {
  key: string;
  label: string;
  description: string;
  role: "tutor" | "staff";
  flag: string;
};

const PERM_ROWS: PermRow[] = [
  { key: "tutor.viewCalendar", label: "View calendar", description: "Tutors can see the calendar page", role: "tutor", flag: "viewCalendar" },
  { key: "tutor.viewPeople", label: "View people", description: "Tutors can see the people directory", role: "tutor", flag: "viewPeople" },
  { key: "tutor.viewByDay", label: "View attendance by day", description: "Tutors can browse any day's attendance (not just their own classes)", role: "tutor", flag: "viewByDay" },
  { key: "staff.generateSessions", label: "Generate sessions", description: "Staff can generate weekly sessions for a month", role: "staff", flag: "generateSessions" },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-orange-500" : "bg-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function PermissionsManager() {
  const [perms, setPerms] = useState<AppPermissions>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/permissions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { permissions?: AppPermissions } | null) => {
        if (data?.permissions) setPerms(data.permissions);
      })
      .catch(() => setError("Failed to load permissions"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(row: PermRow, value: boolean) {
    setSaving(row.key);
    setError("");
    const patch: Partial<AppPermissions> =
      row.role === "tutor"
        ? { tutor: { ...perms.tutor, [row.flag]: value } }
        : { staff: { ...perms.staff, [row.flag]: value } };

    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { permissions?: AppPermissions; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      if (data.permissions) setPerms(data.permissions);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(null);
    }
  }

  const tutorRows = PERM_ROWS.filter((r) => r.role === "tutor");
  const staffRows = PERM_ROWS.filter((r) => r.role === "staff");

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <section>
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Tutor permissions</h2>
        <p className="mb-4 text-sm text-zinc-500">Controls what tutors can access beyond their own classes.</p>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {tutorRows.map((row) => {
            const val = (perms.tutor as Record<string, boolean>)[row.flag] ?? false;
            return (
              <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{row.label}</p>
                  <p className="text-xs text-zinc-500">{row.description}</p>
                </div>
                <Toggle
                  checked={val}
                  onChange={(v) => void toggle(row, v)}
                  disabled={saving === row.key}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Staff permissions</h2>
        <p className="mb-4 text-sm text-zinc-500">Extra actions staff can perform (beyond viewing).</p>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {staffRows.map((row) => {
            const val = (perms.staff as Record<string, boolean>)[row.flag] ?? false;
            return (
              <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{row.label}</p>
                  <p className="text-xs text-zinc-500">{row.description}</p>
                </div>
                <Toggle
                  checked={val}
                  onChange={(v) => void toggle(row, v)}
                  disabled={saving === row.key}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
