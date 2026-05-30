"use client";

import { useCallback, useEffect, useState } from "react";

type Member = {
  id: string;
  email: string;
  role: "staff" | "tutor";
  displayName: string;
  tutorMatch: string;
  isActive: boolean;
};

export default function TeamAllowlist() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    tutorMatch: "",
    role: "staff" as "staff" | "tutor",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/teachers");
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(
        data.error ??
          "Sign in with Google as owner (shuning.wang.00@gmail.com).",
      );
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      members?: Member[];
      tutors?: Member[];
    };
    setMembers(data.members ?? data.tutors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed");
      return;
    }
    setForm({
      email: "",
      displayName: "",
      tutorMatch: "",
      role: "staff",
    });
    load();
  }

  async function toggleActive(m: Member) {
    await fetch(`/api/admin/teachers/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this person from the allowlist?")) return;
    await fetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600">
        Only the <strong>owner</strong> (shuning.wang.00@gmail.com) manages this
        list.
      </p>
      <ul className="list-inside list-disc text-sm text-zinc-600">
        <li>
          <strong>Staff</strong> — attendance, enroll new students, schedule
          makeup, billing & invoices. Cannot add classes, generate sessions, or
          manage this team list.
        </li>
        <li>
          <strong>Tutor</strong> — mark attendance for their classes only
          (tutor match required).
        </li>
      </ul>

      <form
        onSubmit={onAdd}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2"
      >
        <select
          value={form.role}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              role: e.target.value as "staff" | "tutor",
            }))
          }
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
        >
          <option value="staff">Staff (attendance + billing)</option>
          <option value="tutor">Tutor (own classes)</option>
        </select>
        <input
          type="email"
          placeholder="email@gmail.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
        <input
          placeholder="Display name"
          value={form.displayName}
          onChange={(e) =>
            setForm((f) => ({ ...f, displayName: e.target.value }))
          }
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {form.role === "tutor" && (
          <input
            placeholder="Tutor match (e.g. JUNYANG)"
            value={form.tutorMatch}
            onChange={(e) =>
              setForm((f) => ({ ...f, tutorMatch: e.target.value }))
            }
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
            required
          />
        )}
        <button
          type="submit"
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2 sm:w-fit"
        >
          Add
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="font-medium text-zinc-900">
                  {m.displayName || m.email}
                  <span className="ml-2 text-xs font-normal uppercase text-zinc-500">
                    {m.role}
                  </span>
                </p>
                <p className="text-sm text-zinc-600">
                  {m.email}
                  {m.role === "tutor" && m.tutorMatch
                    ? ` · match: ${m.tutorMatch}`
                    : ""}
                  {!m.isActive && (
                    <span className="ml-2 text-amber-700">inactive</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(m)}
                  className="text-sm text-zinc-600 hover:text-zinc-900"
                >
                  {m.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
