"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  daysInMonth,
  defaultSlotsForDate,
  normalizeTime,
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

type StaffOption = { email: string; displayName: string };

function buildRows(
  month: string,
  existing: Array<{
    availDate: string;
    startTime: string;
    endTime: string;
    slotLabel: string;
  }>,
  timeOffDates: Set<string>,
): SlotRow[] {
  const rows: SlotRow[] = [];
  for (const date of daysInMonth(month)) {
    const blocked = timeOffDates.has(date);
    const [template] = defaultSlotsForDate(date);
    // Use the first saved slot for this date, ignoring any extras.
    const saved = existing.find((e) => e.availDate === date);
    rows.push({
      availDate: date,
      startTime: saved ? normalizeTime(saved.startTime) : template.start,
      endTime: saved ? normalizeTime(saved.endTime) : template.end,
      slotLabel: saved?.slotLabel?.trim() || template.label,
      enabled: !blocked && Boolean(saved),
    });
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
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState("");
  const [timeOffDates, setTimeOffDates] = useState<Set<string>>(new Set());

  const selectedStaff = staffOptions.find((s) => s.email === selectedStaffEmail);

  const load = useCallback(async (m: string, staffEmail: string) => {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const q = new URLSearchParams({ month: m });
      if (staffEmail) q.set("staffEmail", staffEmail);
      const res = await fetch(`/api/staff-availability?${q}`);
      const json = (await res.json()) as {
        slots?: Array<{
          availDate: string;
          startTime: string;
          endTime: string;
          slotLabel: string;
        }>;
        staff?: StaffOption[];
        staffEmail?: string | null;
        actingAsOwner?: boolean;
        timeOffDates?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");

      if (json.staff?.length) setStaffOptions(json.staff);

      const email = json.staffEmail ?? staffEmail;
      if (json.actingAsOwner && !email) {
        setRows([]);
        setHasSubmission(false);
        setEditing(false);
        setTimeOffDates(new Set());
        return;
      }

      const blocked = new Set(json.timeOffDates ?? []);
      setTimeOffDates(blocked);
      const slots = json.slots ?? [];
      setRows(buildRows(m, slots, blocked));
      const submitted = slots.some((s) => !blocked.has(s.availDate));
      setHasSubmission(submitted);
      setEditing(!submitted);
      if (email) setSelectedStaffEmail(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setIsOwner(Boolean(me?.isOwner)));
  }, []);

  useEffect(() => {
    if (!isOwner) {
      load(month, "");
      return;
    }
    load(month, selectedStaffEmail);
  }, [isOwner, month, selectedStaffEmail, load]);

  const byDate = useMemo(() => {
    const map = new Map<string, SlotRow[]>();
    for (const r of rows) {
      if (!map.has(r.availDate)) map.set(r.availDate, []);
      map.get(r.availDate)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const readOnly = hasSubmission && !editing;

  function updateRow(
    date: string,
    label: string,
    patch: Partial<Pick<SlotRow, "enabled" | "startTime" | "endTime">>,
  ) {
    if (readOnly) setEditing(true);
    setRows((prev) =>
      prev.map((r) =>
        r.availDate === date && r.slotLabel === label ? { ...r, ...patch } : r,
      ),
    );
  }

  function startEditing() {
    setEditing(true);
    setOk(null);
    setError(null);
  }

  async function save() {
    if (isOwner && !selectedStaffEmail) {
      setError("Select a staff member first.");
      return;
    }
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const slots = rows
        .filter((r) => r.enabled && !timeOffDates.has(r.availDate))
        .map((r) => ({
          availDate: r.availDate,
          startTime: r.startTime,
          endTime: r.endTime,
          slotLabel: r.slotLabel,
        }));
      const res = await fetch("/api/staff-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          slots,
          ...(isOwner ? { staffEmail: selectedStaffEmail } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      const updating = hasSubmission;
      await load(month, isOwner ? selectedStaffEmail : "");
      setEditing(false);
      const who = selectedStaff?.displayName ?? "Staff";
      setOk(
        slots.length === 0
          ? `Availability cleared for ${who}.`
          : updating
            ? `Submission updated for ${who}.`
            : `Submitted for ${who}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const ownerNeedsStaff = isOwner && !selectedStaffEmail;
  const primaryLabel = saving
    ? "Saving…"
    : readOnly
      ? "Edit Submission"
      : "Submit";

  function handlePrimaryAction() {
    if (readOnly) {
      startEditing();
      return;
    }
    void save();
  }

  if (loading && !isOwner) {
    return <p className="py-8 text-sm text-zinc-400">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Availability</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {isOwner
            ? "Choose a staff member and enter their admin duty availability for the month."
            : "Mark when you are available for admin duty. Default centre hours: weekdays 3–8pm, weekends 9am–6pm. You can edit times for outside centre hours. Days on staff time off stay unavailable here but your saved slots for those days are kept if time off is removed later."}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {isOwner && staffOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                Staff member
              </label>
              <select
                value={selectedStaffEmail}
                onChange={(e) => setSelectedStaffEmail(e.target.value)}
                className="mt-1 min-w-[12rem] rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Select staff…</option>
                {staffOptions.map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-zinc-600">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
              disabled={ownerNeedsStaff}
            />
          </div>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={saving || ownerNeedsStaff}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {primaryLabel}
          </button>
        </div>

        {readOnly && !ownerNeedsStaff && (
          <p className="mt-2 text-sm text-zinc-500">
            Click <span className="font-medium">Edit Submission</span> to change
            this month, then <span className="font-medium">Submit</span> when done.
          </p>
        )}

        {isOwner && selectedStaff && (
          <p className="mt-3 text-sm font-medium text-zinc-700">
            Logging availability for{" "}
            <span className="text-orange-700">{selectedStaff.displayName}</span>
            <span className="font-normal text-zinc-500"> ({selectedStaff.email})</span>
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {ok && <p className="mt-3 text-sm text-green-700">{ok}</p>}
      </section>

      {ownerNeedsStaff ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
          Select a staff member to view or submit their availability.
        </p>
      ) : loading ? (
        <p className="py-8 text-sm text-zinc-400">Loading…</p>
      ) : (
        <div className="max-h-[60vh] overflow-x-auto overflow-y-auto rounded-xl border border-zinc-200 bg-white">
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
              {byDate.map(([date, dayRows]) => {
                const onTimeOff = timeOffDates.has(date);
                const inputsLocked = readOnly || onTimeOff;
                return dayRows.map((row, idx) => (
                  <tr
                    key={`${date}-${row.slotLabel}-${row.startTime}`}
                    className={onTimeOff ? "bg-zinc-50 text-zinc-400" : undefined}
                  >
                    {idx === 0 && (
                      <td
                        className="px-3 py-2 font-medium text-zinc-800"
                        rowSpan={dayRows.length}
                      >
                        {formatAvailDateCell(date)}
                        {onTimeOff && (
                          <span className="mt-0.5 block text-xs font-normal text-amber-700">
                            Time off
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        disabled={inputsLocked}
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
                        disabled={inputsLocked || !row.enabled}
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
                        disabled={inputsLocked || !row.enabled}
                        onChange={(e) =>
                          updateRow(date, row.slotLabel, {
                            endTime: e.target.value,
                          })
                        }
                        className="rounded border border-zinc-300 px-1 py-0.5 text-xs disabled:opacity-40"
                      />
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
