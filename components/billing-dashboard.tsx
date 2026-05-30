"use client";

import {
  buildInvoiceNumber,
  buildPaymentReference,
  invoiceIndexForRow,
} from "@/lib/invoice-number";
import { columnLetter } from "@/lib/sheets/row-utils";
import type { BillingPreview, StudentBillingRow } from "@/lib/types";
import {
  buildInvoiceWhatsAppMessage,
  buildReceiptWhatsAppMessage,
  parsePhoneFromContact,
  whatsAppDeepLink,
} from "@/lib/whatsapp";
import { parseSpreadsheetId } from "@/lib/sheets/spreadsheet-id";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kom_billing_spreadsheet_id";

async function downloadPdf(
  preview: BillingPreview,
  row: StudentBillingRow,
  type: "invoice" | "receipt",
  invoiceNumber: string,
) {
  const res = await fetch("/api/invoices/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      preview,
      row,
      invoiceNumber,
      receiptNumber: row.receiptNo || undefined,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "PDF failed");
  }
  const contentType = res.headers.get("Content-Type") ?? "";
  if (!contentType.includes("pdf")) {
    throw new Error("Server did not return a PDF. Try again or check the terminal.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
    `${type}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function LoginGate({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Incorrect password.");
      return;
    }
    onLoggedIn();
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-24 max-w-sm rounded-xl border border-orange-100 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-zinc-900">Sign in</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Enter the billing admin password.
      </p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        autoComplete="current-password"
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? "…" : "Continue"}
      </button>
    </form>
  );
}

function StatusBadge({
  status,
  onPaidClick,
  busy,
}: {
  status: string;
  onPaidClick?: () => void;
  busy?: boolean;
}) {
  const s = status.toLowerCase();
  if (s.includes("paid")) {
    return (
      <button
        type="button"
        disabled={busy}
        title="Download receipt PDF"
        onClick={onPaidClick}
        className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 hover:bg-green-200 disabled:opacity-50"
      >
        Paid
      </button>
    );
  }
  if (s.includes("sent")) {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        Sent
      </span>
    );
  }
  if (!status) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
        —
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
      {status}
    </span>
  );
}

type GoogleStatus = {
  method: "service_account" | "oauth" | "none";
  connected: boolean;
};

export default function BillingDashboard() {
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterStudent, setFilterStudent] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const dayOptions = useMemo(() => {
    if (!preview) return [];
    return [...new Set(preview.rows.map((r) => r.day))].sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" }),
    );
  }, [preview]);

  const levelOptions = useMemo(() => {
    if (!preview) return [];
    return [...new Set(preview.rows.map((r) => r.level))].sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" }),
    );
  }, [preview]);

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    const nameQ = filterStudent.trim().toLowerCase();
    return preview.rows.filter((row) => {
      if (nameQ && !row.studentName.toLowerCase().includes(nameQ)) {
        return false;
      }
      if (filterDay && row.day !== filterDay) return false;
      if (filterLevel && row.level !== filterLevel) return false;
      return true;
    });
  }, [preview, filterStudent, filterDay, filterLevel]);

  useEffect(() => {
    setFilterStudent("");
    setFilterDay("");
    setFilterLevel("");
  }, [preview?.spreadsheetId]);

  const checkAuth = useCallback(async () => {
    const [adminRes, googleRes] = await Promise.all([
      fetch("/api/auth/status"),
      fetch("/api/auth/google/status"),
    ]);
    const admin = await adminRes.json();
    const google = await googleRes.json();
    setAuthRequired(Boolean(admin.authRequired && !admin.authed));
    setGoogleStatus(google);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSpreadsheetId(saved);
    checkAuth();

    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      checkAuth();
    }
    const googleError = params.get("google_error");
    if (googleError) {
      setError(`Google sign-in failed: ${googleError}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkAuth]);

  async function loadSheet() {
    const raw = spreadsheetId.trim();
    if (!raw) {
      setError("Paste your Google Sheets URL first.");
      return;
    }
    const id = parseSpreadsheetId(raw);
    if (!id) {
      setError("Could not read a sheet ID from that URL. Paste the full Google Sheets link.");
      return;
    }
    localStorage.setItem(STORAGE_KEY, raw);
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch(
        `/api/billing?spreadsheetId=${encodeURIComponent(id)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  function invoiceNumberFor(row: StudentBillingRow): string {
    if (!preview) return "";
    if (row.invMarker) return row.invMarker;
    const index = invoiceIndexForRow(preview.rows, row.id);
    return buildInvoiceNumber(preview.yearMonth, index);
  }

  async function markInvOnSheet(row: StudentBillingRow) {
    if (!preview) return;
    const invoiceNumber = invoiceNumberFor(row);
    setBusyId(row.id);
    try {
      const res = await fetch("/api/billing/mark-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: preview.spreadsheetId,
          invoiceNumber,
          row,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setPreview({
        ...preview,
        rows: preview.rows.map((r) =>
          r.id === row.id ? { ...r, invMarker: invoiceNumber } : r,
        ),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  if (authRequired === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (authRequired) {
    return <LoginGate onLoggedIn={() => setAuthRequired(false)} />;
  }

  const totalDue = filteredRows.reduce((s, r) => s + r.computedAmount, 0);
  const hasFilters =
    filterStudent.trim() !== "" || filterDay !== "" || filterLevel !== "";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Knockout Math Billing
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Load sheet → INV (invoice) / Paid (receipt) → WhatsApp (you send).
          </p>
          <nav className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href="/students" className="text-orange-700 hover:underline">
              Students
            </Link>
            <Link href="/classes" className="text-orange-700 hover:underline">
              Classes
            </Link>
            <Link href="/enrollments" className="text-orange-700 hover:underline">
              Enrollments
            </Link>
          </nav>
          {process.env.NODE_ENV === "development" ? (
            <a
              href="/dev/pdf-preview"
              className="mt-2 inline-block text-sm text-orange-600 hover:underline"
            >
              Dev: live PDF preview
            </a>
          ) : null}
        </div>
        <img
          src="/logo-full-dark.png"
          alt="Knockout Math"
          className="h-8 w-auto self-start sm:self-auto"
        />
      </header>

      {googleStatus && !googleStatus.connected ? (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Connect Google Sheets</h2>
          <p className="mt-1 text-sm text-amber-800">
            Your organisation blocks service account keys. Sign in with the Google
            account that owns your attendance spreadsheets instead.
          </p>
          {googleStatus.method === "oauth" ? (
            <a
              href="/api/auth/google"
              className="mt-3 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              Connect Google
            </a>
          ) : (
            <p className="mt-2 text-sm text-amber-800">
              Add <code className="rounded bg-amber-100 px-1">GOOGLE_OAUTH_CLIENT_ID</code>{" "}
              and <code className="rounded bg-amber-100 px-1">GOOGLE_OAUTH_CLIENT_SECRET</code>{" "}
              to <code className="rounded bg-amber-100 px-1">.env.local</code> (see README).
            </p>
          )}
        </section>
      ) : null}

      {googleStatus?.connected && googleStatus.method === "oauth" ? (
        <p className="mb-4 text-sm text-green-700">
          Google Sheets connected (signed in as your account).
        </p>
      ) : null}

      <details className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600">
        <summary className="cursor-pointer font-medium text-zinc-800">
          Default lesson rates
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Sec 1–2: $70</li>
          <li>Sec 3–4: $85 (both A &amp; E same month: $77.50)</li>
          <li>JC: $100</li>
          <li>Vera Ng, Lyra Ng: $90</li>
          <li>Override any student: fill <strong>Amount Payable</strong> on the sheet</li>
        </ul>
      </details>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-zinc-700">
          Google Sheets URL
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Paste the full link from your browser — no need to trim it.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={loadSheet}
            disabled={loading}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load month"}
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}
      </section>

      {preview ? (
        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-baseline gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              {preview.monthLabel}
            </h2>
            <span className="text-sm text-zinc-500">
              {hasFilters
                ? `${filteredRows.length} of ${preview.rows.length} rows`
                : `${preview.rows.length} rows`}
              {" · "}Total S$
              {totalDue.toFixed(2)}
              {hasFilters ? " (filtered)" : ""}
            </span>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[160px] flex-1">
              <label className="text-xs font-medium text-zinc-600">
                Student name
              </label>
              <input
                type="search"
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value)}
                placeholder="Search…"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-[120px]">
              <label className="text-xs font-medium text-zinc-600">Day</label>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="">All days</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-zinc-600">Level</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="">All levels</option>
                {levelOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setFilterStudent("");
                  setFilterDay("");
                  setFilterLevel("");
                }}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Tutor</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                    >
                      No rows match your filters.
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map((row) => {
                  const inv = invoiceNumberFor(row);
                  const phone = parsePhoneFromContact(row.contact);
                  const payRef = buildPaymentReference(
                    row.studentName,
                    preview.yearMonth,
                  );
                  const waText = buildInvoiceWhatsAppMessage({
                    studentName: row.studentName,
                    monthLabel: preview.monthLabel,
                    sessionCount: row.sessionCount,
                    amount: row.computedAmount,
                    paymentReference: payRef,
                    invoiceNumber: inv,
                  });
                  const waUrl = phone
                    ? whatsAppDeepLink(phone, waText)
                    : null;
                  const expanded = expandedId === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr
                        className="border-b border-zinc-50 hover:bg-orange-50/30"
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="font-medium text-zinc-900 hover:underline"
                            onClick={() =>
                              setExpandedId(expanded ? null : row.id)
                            }
                          >
                            {row.studentName}
                          </button>
                          {row.warnings.length > 0 ? (
                            <p className="text-xs text-amber-600">
                              {row.warnings[0]}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                          {row.day}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-800">
                          {row.level}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600">
                          {row.time}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-800">
                          {row.tutor}
                        </td>
                        <td className="px-3 py-2">{row.sessionCount}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium">
                            ${row.computedAmount.toFixed(2)}
                          </span>
                          {row.sessionCount > 0 ? (
                            <span className="block text-xs text-zinc-500">
                              {row.sessionCount} × ${row.ratePerSession.toFixed(2)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={row.paymentStatus}
                            busy={busyId === row.id}
                            onPaidClick={
                              row.paymentStatus.toLowerCase().includes("paid")
                                ? async () => {
                                    setBusyId(row.id);
                                    try {
                                      await downloadPdf(
                                        preview,
                                        row,
                                        "receipt",
                                        inv,
                                      );
                                    } catch (e) {
                                      alert(
                                        e instanceof Error
                                          ? e.message
                                          : "PDF failed",
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }
                                : undefined
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              title="Download invoice PDF"
                              className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-50"
                              onClick={async () => {
                                setBusyId(row.id);
                                try {
                                  await downloadPdf(
                                    preview,
                                    row,
                                    "invoice",
                                    inv,
                                  );
                                } catch (e) {
                                  alert(
                                    e instanceof Error
                                      ? e.message
                                      : "PDF failed",
                                  );
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                            >
                              INV
                            </button>
                            {waUrl ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                              >
                                WhatsApp
                              </a>
                            ) : (
                              <span
                                className="text-xs text-zinc-400"
                                title="No phone in Contact column"
                              >
                                No phone
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                              onClick={() => markInvOnSheet(row)}
                            >
                              Mark INV
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr key={`${row.id}-detail`} className="bg-zinc-50">
                          <td colSpan={9} className="px-4 py-3 text-xs text-zinc-600">
                            <p>
                              <strong>Invoice:</strong> {inv} ·{" "}
                              <strong>PayNow ref:</strong> {payRef}
                            </p>
                            <p className="mt-1">
                              <strong>Contact:</strong> {row.contact || "—"} ·{" "}
                              <strong>INV cell:</strong> {row.invMarker || "—"} ·{" "}
                              <strong>Payment (col{" "}
                              {row.paymentColumnIndex != null
                                ? columnLetter(row.paymentColumnIndex)
                                : "?"}
                              ):</strong> {row.paymentStatus || "—"}
                            </p>
                            <ul className="mt-2 list-inside list-disc">
                              {row.sessions.map((s, i) => (
                                <li key={i}>
                                  {s.dateLabel} · {s.sheetName} · {s.classLabel}
                                  {s.makeupNote ? ` (${s.makeupNote})` : ""}
                                </li>
                              ))}
                              {row.sessions.length === 0 ? (
                                <li>No billable sessions</li>
                              ) : null}
                            </ul>
                            {phone &&
                            row.paymentStatus.toLowerCase().includes("paid") ? (
                              <a
                                className="mt-2 inline-block text-green-700 underline"
                                href={whatsAppDeepLink(
                                  phone,
                                  buildReceiptWhatsAppMessage({
                                    studentName: row.studentName,
                                    monthLabel: preview.monthLabel,
                                    amount: row.computedAmount,
                                    receiptNo:
                                      row.receiptNo || inv,
                                  }),
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Send receipt via WhatsApp
                              </a>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
