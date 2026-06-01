"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string;
  email: string;
  name: string;
  role: "tutor" | "staff" | "staff_tutor";
  tutorMatch: string;
  resolvedPerms: Record<string, boolean>;
};

type PermRow = {
  flag: string;
  label: string;
  description: string;
};

const TUTOR_PERM_ROWS: PermRow[] = [
  { flag: "viewCalendar", label: "View calendar", description: "Can see the calendar page" },
  { flag: "viewPeople", label: "View people", description: "Can see the people directory (OOO)" },
  { flag: "viewByDay", label: "View attendance by day", description: "Can browse any day's sessions, not just their own" },
  { flag: "viewStudents", label: "View students", description: "Can see the student registry (filtered to their classes)" },
];

const STAFF_PERM_ROWS: PermRow[] = [
  { flag: "generateSessions", label: "Generate sessions", description: "Can generate weekly sessions for a month" },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
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
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function MemberCard({
  member,
  permRows,
  saving,
  onToggle,
}: {
  member: Member;
  permRows: PermRow[];
  saving: string | null;
  onToggle: (memberId: string, flag: string, value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const enabledCount = permRows.filter((r) => member.resolvedPerms[r.flag]).length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">{member.name}</p>
          <p className="text-xs text-zinc-400">{member.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {enabledCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              {enabledCount} on
            </span>
          )}
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-zinc-50 border-t border-zinc-100">
          {permRows.map((row) => {
            const val = member.resolvedPerms[row.flag] ?? false;
            const key = `${member.id}:${row.flag}`;
            return (
              <div key={row.flag} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800">{row.label}</p>
                  <p className="text-xs text-zinc-500">{row.description}</p>
                </div>
                <Toggle
                  checked={val}
                  onChange={(v) => onToggle(member.id, row.flag, v)}
                  disabled={saving === key}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PermissionsManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/permissions")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { members?: Member[] }) => {
        if (data.members) setMembers(data.members);
      })
      .catch(() => setError("Failed to load permissions"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(memberId: string, flag: string, value: boolean) {
    const key = `${memberId}:${flag}`;
    setSaving(key);
    setError("");

    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    const newPerms = { ...member.resolvedPerms, [flag]: value };

    try {
      const res = await fetch(`/api/admin/permissions/user/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPerms),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save");
        return;
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, resolvedPerms: newPerms } : m,
        ),
      );
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(null);
    }
  }

  const tutors = members.filter((m) => m.role === "tutor" || m.role === "staff_tutor");
  const staff = members.filter((m) => m.role === "staff" || m.role === "staff_tutor");

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Tutors</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Tutors always see their own classes and can mark attendance. Toggle anything beyond that here.
        </p>
        {tutors.length === 0 ? (
          <p className="text-sm text-zinc-400">No tutors on the team yet.</p>
        ) : (
          <div className="space-y-4">
            {tutors.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                permRows={TUTOR_PERM_ROWS}
                saving={saving}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Staff</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Staff can access attendance, billing, makeups, and trials. Extra capabilities below.
        </p>
        {staff.length === 0 ? (
          <p className="text-sm text-zinc-400">No staff on the team yet.</p>
        ) : (
          <div className="space-y-4">
            {staff.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                permRows={STAFF_PERM_ROWS}
                saving={saving}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
