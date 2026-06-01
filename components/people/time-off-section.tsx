"use client";

import { useEffect, useState } from "react";

type OooRecord = {
  id: string;
  tutorMatch: string;
  startDate: string;
  endDate: string;
  reason: string;
};

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function TimeOffSection() {
  const [oooRecords, setOooRecords] = useState<OooRecord[]>([]);
  const [myTutorMatch, setMyTutorMatch] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [isTutor, setIsTutor] = useState(false);
  const [tutorMatch, setTutorMatch] = useState("");
  const [activeTutors, setActiveTutors] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/tutor-ooo").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([me, ooo]) => {
        const role = me?.user?.role ?? "owner";
        setIsOwner(role === "owner");
        setIsTutor(role === "tutor");
        if (ooo) {
          setOooRecords(ooo.oooRecords ?? []);
          setActiveTutors(ooo.activeTutors ?? []);
          setMyTutorMatch(ooo.myTutorMatch ?? "");
          setTutorMatch(role === "tutor" ? ooo.myTutorMatch ?? "" : "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor-ooo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorMatch, startDate, endDate, reason }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      const refresh = await fetch("/api/tutor-ooo");
      if (refresh.ok) {
        const data = (await refresh.json()) as { oooRecords: OooRecord[] };
        setOooRecords(data.oooRecords ?? []);
      }
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tutor-ooo/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed");
      }
      setOooRecords((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-8 text-sm text-zinc-400">Loading…</p>;
  }

  const canAdd = isOwner || isTutor;
  const showForm = canAdd && (isOwner || myTutorMatch);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900">Time off</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Tutors mark when they are away. Sessions in that window show as needing
        relief on the calendar and makeup hub.
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {isOwner ? (
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                Tutor
              </label>
              <select
                required
                value={tutorMatch}
                onChange={(e) => setTutorMatch(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Select tutor</option>
                {activeTutors.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                Tutor
              </label>
              <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm">
                {myTutorMatch || "—"}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Start{" "}
              <span className="font-normal text-zinc-400">(inclusive)</span>
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              End{" "}
              <span className="font-normal text-zinc-400">(inclusive)</span>
            </label>
            <input
              type="date"
              required
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={saving || !tutorMatch}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add time off"}
            </button>
          </div>
        </form>
      )}

      {oooRecords.length > 0 ? (
        <ul className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {oooRecords.map((ooo) => (
            <li
              key={ooo.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <div>
                <span className="font-medium">{ooo.tutorMatch}</span>
                <span className="mx-2 text-zinc-400">·</span>
                {isoToDisplay(ooo.startDate)}
                {ooo.startDate !== ooo.endDate &&
                  ` – ${isoToDisplay(ooo.endDate)}`}
                {ooo.reason && (
                  <span className="text-zinc-500"> · {ooo.reason}</span>
                )}
              </div>
              {(isOwner || (isTutor && ooo.tutorMatch === myTutorMatch)) && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleDelete(ooo.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-zinc-400">No time off logged.</p>
      )}
    </section>
  );
}
