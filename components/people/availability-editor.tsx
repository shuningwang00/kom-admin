"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  daysInMonth,
  defaultSlotsForDate,
  suggestedAvailabilityMonth,
} from "@/lib/centre-hours";

function formatAvailDateCell(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = String(d.getDate()).padStart(2, "0");
  const dow = d.toLocaleDateString("en-SG", { weekday: "short" });
  return `${day} ${dow}`;
}

type SlotRow = {
  availDate: string;
  startTime: string;
  endTime: string;
  slotLabel: string;
  enabled: boolean;
};

function buildRows(month: string, existing: Array<{ availDate: string; startTime: string; endTime: string; slotLabel: string }>): SlotRow[] {
  const rows: SlotRow[] = [];
  for (const date of daysInMonth(month)) {
    const templates = defaultSlotsForDate(date);
    for (const t of templates) {
      const hit = existing.find(
        (e) =>
          e.availDate === date &&
          e.startTime === t.start &&
          e.endTime === t.end,
      );
      rows.push({
        availDate: date,
        startTime: t.start,
        endTime: t.end,
        slotLabel: t.label,
        enabled: Boolean(hit),
      });
    }
  }
  return rows;
}

export default function AvailabilityEditor() {
  const [month, setMonth] = useState(suggestedAvailabilityMonth());
  const [rows, setRows] = useState<SlotRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff-availability?month=${m}`);
      const json = (await res.json()) as {
        slots?: Array<{ availDate: string; startTime: string; endTime: string; slotLabel: string }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const slots = json.slots ?? [];
      setRows(buildRows(m, slots));
      setHasSubmission(slots.length > 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const byDate = useMemo(() => {
    const map = new Map<string, SlotRow[]>();
    for (const r of rows) {
      if (!map.has(r.availDate)) map.set(r.availDate, []);
      map.get(r.availDate)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  function updateRow(
    date: string,
    label: string,
    patch: Partial<Pick<SlotRow, "enabled" | "startTime" | "endTime">>,
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.availDate === date && r.slotLabel === label ? { ...r, ...patch } : r,
      ),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const slots = rows
        .filter((r) => r.enabled)
        .map((r) => ({
          availDate: r.availDate,
          startTime: r.startTime,
          endTime: r.endTime,
          slotLabel: r.slotLabel,
        }));
      const res = await fetch("/api/staff-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, slots }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      const updating = hasSubmission;
      setHasSubmission(slots.length > 0);
      setOk(
        slots.length === 0
          ? "Availability cleared."
          : updating
            ? "Submission updated."
            : "Submitted.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-8 text-sm text-zinc-400">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Availability</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Mark when you are available for admin duty. Default centre hours: weekdays
          3–8pm, weekends 9am–6pm. You can edit times for outside centre hours.
          Submit for the full month (target: by the 25th for the following month).
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : hasSubmission ? "Edit Submission" : "Submit"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        )}
        {ok && <p className="mt-3 text-sm text-green-700">{ok}</p>}
      </section>

      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Available</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {byDate.map(([date, dayRows]) => (
              dayRows.map((row, idx) => (
                <tr key={`${date}-${row.slotLabel}-${row.startTime}`}>
                  {idx === 0 && (
                    <td
                      className="px-3 py-2 font-medium text-zinc-800"
                      rowSpan={dayRows.length}
                    >
                      {formatAvailDateCell(date)}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        updateRow(date, row.slotLabel, {
                          enabled: e.target.checked,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={row.startTime}
                      disabled={!row.enabled}
                      onChange={(e) =>
                        updateRow(date, row.slotLabel, {
                          startTime: e.target.value,
                        })
                      }
                      className="rounded border border-zinc-300 px-1 py-0.5 text-xs disabled:opacity-40"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={row.endTime}
                      disabled={!row.enabled}
                      onChange={(e) =>
                        updateRow(date, row.slotLabel, {
                          endTime: e.target.value,
                        })
                      }
                      className="rounded border border-zinc-300 px-1 py-0.5 text-xs disabled:opacity-40"
                    />
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
