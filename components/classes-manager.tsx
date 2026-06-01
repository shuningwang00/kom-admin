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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ClassesManager() {
  const [classes, setClasses] = useState<Klass[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [backupAt, setBackupAt] = useState<string | null>(null);

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
      sheetSync?: { synced: boolean; syncedAt?: string; backupAt?: string };
    };
    setClasses(data.classes);
    if (data.sheetSync?.syncedAt) setLastSyncedAt(data.sheetSync.syncedAt);
    if (data.sheetSync?.backupAt) setBackupAt(data.sheetSync.backupAt);
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

  async function restorePrevious() {
    if (!confirm("Restore the previous version of the class schedule? This will revert all classes to the state before the last sync.")) return;
    setRestoring(true);
    setError("");
    const res = await fetch("/api/classes/restore", { method: "POST" });
    setRestoring(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Restore failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-600">
              The database is the source of truth — classes persist until you sync again.
              Press sync when your Google Sheet timetable has changed (class
              tutors and Team access schedule names update together).
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-400">
              {lastSyncedAt && (
                <span>Last synced: {fmtDate(lastSyncedAt)}</span>
              )}
              {backupAt && (
                <span>Previous version: {fmtDate(backupAt)}</span>
              )}
              {!lastSyncedAt && (
                <span className="text-amber-600">No sync yet — classes loaded from initial setup.</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {backupAt && (
              <button
                type="button"
                onClick={restorePrevious}
                disabled={restoring || syncing}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
              >
                {restoring ? "Restoring…" : "Restore previous"}
              </button>
            )}
            <button
              type="button"
              onClick={refreshFromSheet}
              disabled={syncing || loading}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {syncing ? "Syncing…" : "Sync from sheet"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No classes in the database yet. Press &quot;Sync from sheet&quot; to import your timetable.
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
            {classes.length} class{classes.length === 1 ? "" : "es"} · inactive rows shown
          </p>
        </div>
      )}
    </div>
  );
}
