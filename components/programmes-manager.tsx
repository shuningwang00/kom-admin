"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Programme = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  participantCount: number;
  firstSessionDate: string | null;
};

function formatSessionMonth(iso: string | null): { month: string; year: string } | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  return {
    month: d.toLocaleDateString("en-SG", { month: "short" }),
    year: String(d.getFullYear()),
  };
}

const emptyForm = { name: "" };

export default function ProgrammesManager() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/programmes");
    if (!res.ok) {
      setError("Failed to load programmes.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { programmes: Programme[] };
    setProgrammes(data.programmes);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create programme.");
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      setSuccess("Programme created.");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Programme) {
    const res = await fetch(`/api/programmes/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          One-off holiday programmes — create a programme, add sessions and
          register participants.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError("");
            setSuccess("");
          }}
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
        >
          + New programme
        </button>
      </div>

      {showForm && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">
            Create programme
          </h2>
          <form onSubmit={onCreate} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Programme name"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </form>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : programmes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No programmes yet. Create one above.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {programmes.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/programmes/${p.id}`}
                  className="font-medium text-sky-700 hover:underline"
                >
                  {p.name}
                </Link>
                {!p.isActive && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                    Archived
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-6 text-sm text-zinc-500">
                {(() => {
                  const dt = formatSessionMonth(p.firstSessionDate);
                  return dt ? (
                    <>
                      <span className="w-8 text-center">{dt.month}</span>
                      <span className="w-10 text-center">{dt.year}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-8 text-center text-zinc-300">—</span>
                      <span className="w-10 text-center text-zinc-300">—</span>
                    </>
                  );
                })()}
                <span className="w-24 text-center">
                  {p.participantCount > 0 ? (
                    <span className="font-medium text-zinc-700">
                      {p.participantCount} participant{p.participantCount !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-zinc-300">0 participants</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(p)}
                className="shrink-0 text-xs text-zinc-500 hover:text-zinc-800"
              >
                {p.isActive ? "Archive" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
