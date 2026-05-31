"use client";

import {
  formatClassTypeLabel,
  formatWeekdayLabel,
} from "@/lib/classes/display-label";

import { useCallback, useEffect, useState } from "react";

type Klass = {
  id: string;
  label: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
  isActive: boolean;
};

export default function ClassesManager() {
  const [classes, setClasses] = useState<Klass[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const load = useCallback(async (refreshSheet = false) => {
    setLoading(true);
    const res = await fetch(
      `/api/classes?all=1${refreshSheet ? "&refresh=1" : ""}`,
    );
    if (!res.ok) {
      setError("Failed to load classes");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      classes: Klass[];
      weekdays?: string[];
      sheetSync?: { synced: boolean; source?: string; syncedAt?: string };
    };
    setClasses(data.classes);
    if (data.sheetSync?.syncedAt) {
      setLastSyncedAt(data.sheetSync.syncedAt);
    }
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshFromSheet() {
    setSyncing(true);
    setError("");
    await load(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div>
          <p className="text-sm text-zinc-600">
            Class dropdowns (students, trials, enrollments) use the database.
            Sync from your classes Google Sheet when the timetable changes.
          </p>
          {lastSyncedAt && (
            <p className="mt-1 text-xs text-zinc-400">
              Last synced:{" "}
              {new Date(lastSyncedAt).toLocaleString("en-SG", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refreshFromSheet}
          disabled={syncing || loading}
          className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync from sheet"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No classes yet. Sync from sheet or add one above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[40rem] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-3 py-2 font-semibold text-zinc-800">Day</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Type</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Time</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Tutor</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {formatWeekdayLabel(c.weekday)}
                    </td>
                    <td className="px-3 py-3 text-zinc-800">
                      {formatClassTypeLabel(c)}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {c.time.trim() || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {c.tutor.trim() || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          c.isActive
                            ? "inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                            : "inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                        }
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500">
            {classes.length} class{classes.length === 1 ? "" : "es"} · includes
            inactive rows from sheet sync
          </p>
        </div>
      )}
    </div>
  );
}
