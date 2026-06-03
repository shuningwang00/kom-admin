"use client";

import { useCallback, useEffect, useState } from "react";

type ClockEntry = {
  staffEmail: string;
  staffName: string;
  startTime: string;
  endTime: string;
};

type StaffMember = {
  email: string;
  displayName: string;
  fullName: string;
  hourlyRate: string;
};

type Claim = {
  staffEmail: string;
  amount: string;
  status: string;
};

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function computeHours(start: string, end: string): number {
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return Math.max(0, (parse(end) - parse(start)) / 60);
}

function formatHours(h: number): string {
  if (h === Math.floor(h)) return `${h}h`;
  const mins = Math.round((h % 1) * 60);
  return `${Math.floor(h)}h ${mins}m`;
}

export default function PayrollPlaceholder() {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [entries, setEntries] = useState<ClockEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selfStaff, setSelfStaff] = useState<StaffMember | null>(null);
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Per-staff rate editing
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [rateSaving, setRateSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [clockRes, claimsRes] = await Promise.all([
      fetch(`/api/clock?month=${month}`),
      fetch(`/api/claims?month=${month}&status=approved`),
    ]);
    setLoading(false);
    if (!clockRes.ok) {
      const d = (await clockRes.json()) as { error?: string };
      setError(d.error ?? "Failed to load");
      return;
    }
    const data = (await clockRes.json()) as {
      entries: ClockEntry[];
      staff: StaffMember[];
      isOwner: boolean;
      selfStaff?: StaffMember | null;
    };
    setEntries(data.entries);
    setStaffList(data.staff);
    setSelfStaff(data.selfStaff ?? null);
    setIsOwnerView(data.isOwner);
    if (claimsRes.ok) {
      const claimsData = (await claimsRes.json()) as { claims: Claim[] };
      setClaims(claimsData.claims ?? []);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRate(email: string) {
    setRateSaving(true);
    const res = await fetch("/api/clock/rate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, hourlyRate: rateInput }),
    });
    setRateSaving(false);
    if (!res.ok) return;
    setEditingRate(null);
    // Update local staff list
    setStaffList((prev) =>
      prev.map((s) => (s.email === email ? { ...s, hourlyRate: rateInput } : s)),
    );
  }

  // Build per-staff summary — non-owners only ever see their own row
  const staffEmails = isOwnerView
    ? staffList.map((s) => s.email)
    : selfStaff
    ? [selfStaff.email]
    : entries.length > 0
    ? [...new Set(entries.map((e) => e.staffEmail))]
    : [];

  const summaryRows = staffEmails.map((email) => {
    const staffEntry = isOwnerView
      ? staffList.find((s) => s.email === email)
      : selfStaff?.email === email ? selfStaff : undefined;
    const name = staffEntry?.displayName || staffEntry?.fullName || email;
    const rate = staffEntry?.hourlyRate ?? "";
    const staffEntries = entries.filter((e) => e.staffEmail === email);
    const totalHours = staffEntries.reduce(
      (sum, e) => sum + computeHours(e.startTime, e.endTime),
      0,
    );
    const rateNum = parseFloat(rate);
    const pay = !isNaN(rateNum) && rateNum > 0 ? totalHours * rateNum : null;
    const claimsTotal = claims
      .filter((c) => c.staffEmail === email)
      .reduce((sum, c) => sum + parseFloat(c.amount), 0);
    return { email, name, rate, totalHours, pay, sessionCount: staffEntries.length, claimsTotal };
  }).filter((r) => r.sessionCount > 0 || r.claimsTotal > 0 || isOwnerView);

  const grandPayTotal = summaryRows.reduce((sum, r) => sum + (r.pay ?? 0), 0);
  const grandClaimsTotal = summaryRows.reduce((sum, r) => sum + r.claimsTotal, 0);
  const grandTotal = grandPayTotal + grandClaimsTotal;

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth(prevMonth(month))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >←</button>
        <span className="min-w-44 text-center text-sm font-semibold text-zinc-800">
          {formatMonthLabel(month)}
        </span>
        <button
          type="button"
          onClick={() => setMonth(nextMonth(month))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >→</button>
        <button
          type="button"
          onClick={() => setMonth(today.slice(0, 7))}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
        >This month</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : summaryRows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No clock entries for {formatMonthLabel(month)}.
        </p>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Admin hours — {formatMonthLabel(month)}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                {isOwnerView && <th className="px-4 py-2">Staff</th>}
                <th className="px-4 py-2 text-right">Sessions</th>
                <th className="px-4 py-2 text-right">Hours</th>
                <th className="px-4 py-2 text-right">Rate/hr</th>
                <th className="px-4 py-2 text-right">Pay</th>
                <th className="px-4 py-2 text-right">Claims</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {summaryRows.map((row) => (
                <tr key={row.email}>
                  {isOwnerView && <td className="px-4 py-3 font-medium text-zinc-900">{row.name}</td>}
                  <td className="px-4 py-3 text-right text-zinc-600">{row.sessionCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-800">
                    {formatHours(row.totalHours)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isOwnerView ? (
                      editingRate === row.email ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-zinc-500">S$</span>
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            value={rateInput}
                            onChange={(e) => setRateInput(e.target.value)}
                            className="w-20 rounded border border-zinc-300 px-1.5 py-0.5 text-right text-sm"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={rateSaving}
                            onClick={() => saveRate(row.email)}
                            className="rounded bg-sky-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                          >
                            {rateSaving ? "…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRate(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-800"
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingRate(row.email); setRateInput(row.rate); }}
                          className="text-zinc-600 hover:text-zinc-900"
                        >
                          {row.rate ? `S$${parseFloat(row.rate).toFixed(2)}` : <span className="text-zinc-400">Set rate</span>}
                        </button>
                      )
                    ) : (
                      <span className="text-zinc-600">
                        {row.rate ? `S$${parseFloat(row.rate).toFixed(2)}` : <span className="text-zinc-400">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {row.pay !== null ? (
                      <span className="text-zinc-900">S${row.pay.toFixed(2)}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">
                    {row.claimsTotal > 0 ? `S$${row.claimsTotal.toFixed(2)}` : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-zinc-900">
                    {(row.pay !== null || row.claimsTotal > 0)
                      ? `S$${((row.pay ?? 0) + row.claimsTotal).toFixed(2)}`
                      : <span className="text-zinc-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {isOwnerView && grandTotal > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td colSpan={isOwnerView ? 4 : 3} className="px-4 py-3 text-sm font-semibold text-zinc-700">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-zinc-900">
                    {grandPayTotal > 0 ? `S$${grandPayTotal.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-zinc-900">
                    {grandClaimsTotal > 0 ? `S$${grandClaimsTotal.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-orange-700">
                    S${grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
