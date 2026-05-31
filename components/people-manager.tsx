"use client";

import { useEffect, useState } from "react";

type OooRecord = {
  id: string;
  tutorMatch: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdBy: string;
};

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function OooSection({
  oooRecords,
  activeTutors,
  myTutorMatch,
  isStaff,
  saving,
  onAdd,
  onDelete,
  error,
}: {
  oooRecords: OooRecord[];
  activeTutors: string[];
  myTutorMatch: string;
  isStaff: boolean;
  saving: boolean;
  onAdd: (data: {
    tutorMatch: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  error: string | null;
}) {
  const [tutorMatch, setTutorMatch] = useState(isStaff ? "" : myTutorMatch);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onAdd({ tutorMatch, startDate, endDate, reason });
    setStartDate("");
    setEndDate("");
    setReason("");
  }

  const tutorOptions = isStaff ? activeTutors : [myTutorMatch].filter(Boolean);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900">Tutor OOO / unavailability</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Mark a tutor as unavailable. Sessions in that window will be flagged red
        and appear in the Makeup tab as needing a relief tutor.
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label className="block text-xs font-medium text-zinc-600">Tutor</label>
          {isStaff ? (
            <select
              required
              value={tutorMatch}
              onChange={(e) => setTutorMatch(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
            >
              <option value="">Select tutor</option>
              {tutorOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-700">
              {myTutorMatch || "—"}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600">Start date</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600">
            End date <span className="font-normal text-zinc-400">(inclusive)</span>
          </label>
          <input
            type="date"
            required
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600">
            Reason <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. family trip"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
          />
        </div>

        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={saving || !tutorMatch || !startDate || !endDate}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add OOO period"}
          </button>
        </div>
      </form>

      {oooRecords.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Logged OOO periods
          </h3>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {oooRecords.map((ooo) => (
              <li
                key={ooo.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-zinc-800">{ooo.tutorMatch}</span>
                  <span className="mx-2 text-zinc-400">·</span>
                  <span className="text-zinc-600">
                    {isoToDisplay(ooo.startDate)}
                    {ooo.startDate !== ooo.endDate &&
                      ` – ${isoToDisplay(ooo.endDate)}`}
                  </span>
                  {ooo.reason && (
                    <>
                      <span className="mx-2 text-zinc-400">·</span>
                      <span className="text-zinc-500">{ooo.reason}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onDelete(ooo.id)}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function PeopleManager() {
  const [oooRecords, setOooRecords] = useState<OooRecord[]>([]);
  const [activeTutors, setActiveTutors] = useState<string[]>([]);
  const [myTutorMatch, setMyTutorMatch] = useState("");
  const [isStaff, setIsStaff] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/tutor-ooo").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(
        ([me, ooo]: [
          { user: { role: string } | null } | null,
          {
            oooRecords: OooRecord[];
            activeTutors: string[];
            myTutorMatch: string;
          } | null,
        ]) => {
          const role = me?.user?.role ?? "owner";
          setIsStaff(role === "owner" || role === "staff");
          if (ooo) {
            setOooRecords(ooo.oooRecords ?? []);
            setActiveTutors(ooo.activeTutors ?? []);
            setMyTutorMatch(ooo.myTutorMatch ?? "");
          }
        },
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(params: {
    tutorMatch: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor-ooo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      const oooRes = await fetch("/api/tutor-ooo");
      if (oooRes.ok) {
        const oooJson = (await oooRes.json()) as {
          oooRecords: OooRecord[];
          activeTutors: string[];
          myTutorMatch: string;
        };
        setOooRecords(oooJson.oooRecords ?? []);
        setActiveTutors(oooJson.activeTutors ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tutor-ooo/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to delete");
      setOooRecords((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">Loading…</div>
    );
  }

  return (
    <div className="space-y-6">
      <OooSection
        oooRecords={oooRecords}
        activeTutors={activeTutors}
        myTutorMatch={myTutorMatch}
        isStaff={isStaff}
        saving={saving}
        onAdd={handleAdd}
        onDelete={handleDelete}
        error={error}
      />
    </div>
  );
}
