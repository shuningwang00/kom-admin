"use client";

import { ContactFields } from "@/components/contact-fields";
import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import { formatDisplayDate } from "@/lib/dates/display-date";
import {
  formatStudentContacts,
  type ContactType,
} from "@/lib/contacts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Trial = {
  id: string;
  name: string;
  primaryContact: string;
  primaryContactType: ContactType | null;
  secondaryContact: string;
  secondaryContactType: ContactType | null;
  school: string;
  parentName: string;
  classId: string | null;
  trialDate: string | null;
  notes: string;
  status: "active" | "converted";
  convertedStudentId: string | null;
  fromEnrollment?: boolean;
  startDate?: string | null;
};

type Klass = {
  id: string;
  label: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
};

const emptyForm = {
  name: "",
  primaryContactType: "parent" as ContactType,
  primaryContact: "",
  secondaryContactType: "" as ContactType | "",
  secondaryContact: "",
  school: "",
  parentName: "",
  trialDate: "",
  notes: "",
  classId: "",
};

export default function TrialsManager() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConverted, setShowConverted] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState({
    startDate: "",
    registrationFeeDue: false,
    classId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const status = showConverted ? "converted" : "active";
    const [tRes, cRes] = await Promise.all([
      fetch(`/api/trials?status=${status}`),
      fetch("/api/classes"),
    ]);
    if (!tRes.ok) {
      setError("Failed to load trials");
      setLoading(false);
      return;
    }
    const tData = (await tRes.json()) as { trials: Trial[] };
    setTrials(tData.trials);
    if (cRes.ok) {
      const cData = (await cRes.json()) as { classes: Klass[] };
      setClasses(cData.classes);
    }
    setLoading(false);
  }, [showConverted]);

  useEffect(() => {
    load();
  }, [load]);

  function classLabel(classId: string | null) {
    if (!classId) return "—";
    const c = classes.find((x) => x.id === classId);
    return c ? formatClassDropdownLabel(c) : classId.slice(0, 8);
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    let res: Response;
    try {
      res = await fetch("/api/trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          primaryContact: form.primaryContact,
          primaryContactType: form.primaryContactType,
          secondaryContact: form.secondaryContact,
          secondaryContactType: form.secondaryContactType || null,
          school: form.school,
          parentName: form.parentName,
          trialDate: form.trialDate || null,
          notes: form.notes,
          classId: form.classId,
        }),
      });
    } catch {
      setSaving(false);
      setError("Network error — trial was not saved.");
      return;
    }
    setSaving(false);

    const data = (await res.json()) as { error?: string; trial?: { name: string } };
    if (!res.ok) {
      setError(data.error ?? `Save failed (${res.status}).`);
      return;
    }

    setForm(emptyForm);
    await load();
    setSuccess(`Saved ${data.trial?.name ?? form.name} as a free trial lead.`);
  }

  function startConvert(trial: Trial) {
    setConvertingId(trial.id);
    setConvertForm({
      startDate: trial.trialDate ?? "",
      registrationFeeDue: false,
      classId: trial.classId ?? "",
    });
  }

  async function submitConvert(trialId: string) {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/trials/${trialId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: convertForm.startDate || null,
        registrationFeeDue: convertForm.registrationFeeDue,
        classId: convertForm.classId || undefined,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      student?: { id: string; name: string };
    };
    if (!res.ok) {
      setError(data.error ?? "Convert failed.");
      return;
    }
    setConvertingId(null);
    await load();
    setSuccess(
      `${data.student?.name ?? "Student"} is now on the roster. ` +
        "They are not listed under active trials anymore.",
    );
  }

  async function declineTrial(id: string, name: string) {
    if (
      !confirm(
        `Remove ${name} from trial records? They will not appear in student records.`,
      )
    ) {
      return;
    }
    setError("");
    const res = await fetch(`/api/trials/${id}/decline`, { method: "POST" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not remove trial.");
      return;
    }
    await load();
    setSuccess(`Removed ${name} — not kept in student records.`);
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-600">
        <strong>Workflow:</strong> (1) Register the free trial with trial date and
        class, or add the student on Enrollments with a trial lesson date. (2) On
        that date, open the class session and mark attendance (under &quot;Free trial
        (not enrolled yet)&quot; for new leads, or on their roster row once enrolled).
        (3) For leads only: convert to a full-time student — they appear under Show
        converted. Enrolled students with a trial date set on Enrollments appear there
        too.
      </p>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">Register free trial</h2>
        <form onSubmit={onRegister} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>

          <ContactFields
            prefix="Primary"
            typeLabel="Primary contact"
            typeValue={form.primaryContactType}
            numberValue={form.primaryContact}
            onTypeChange={(v) =>
              setForm((f) => ({
                ...f,
                primaryContactType: (v || "parent") as ContactType,
              }))
            }
            onNumberChange={(v) =>
              setForm((f) => ({ ...f, primaryContact: v }))
            }
            required
          />

          <ContactFields
            prefix="Secondary"
            typeLabel="Secondary contact"
            typeValue={form.secondaryContactType}
            numberValue={form.secondaryContact}
            onTypeChange={(v) =>
              setForm((f) => ({ ...f, secondaryContactType: v }))
            }
            onNumberChange={(v) =>
              setForm((f) => ({ ...f, secondaryContact: v }))
            }
          />

          <label className="block text-sm">
            <span className="font-medium text-zinc-700">School</span>
            <input
              value={form.school}
              onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Parent name (record)</span>
            <input
              value={form.parentName}
              onChange={(e) =>
                setForm((f) => ({ ...f, parentName: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Trial date</span>
            <input
              type="date"
              value={form.trialDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, trialDate: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Class *</span>
            <select
              required
              value={form.classId}
              onChange={(e) =>
                setForm((f) => ({ ...f, classId: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">— Select class —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClassDropdownLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {saving ? "Saving…" : "Add free trial"}
          </button>
        </form>
      </section>

      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {success}{" "}
          {success.includes("roster") && (
            <Link href="/students" className="font-medium underline">
              View students
            </Link>
          )}
        </p>
      )}
      {error && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          {error}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">
            {showConverted ? "Converted trials" : "Active trials"} ({trials.length})
          </h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={showConverted}
              onChange={(e) => {
                setShowConverted(e.target.checked);
                setConvertingId(null);
              }}
            />
            Show converted
          </label>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : showConverted ? (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Trial date</th>
                  <th className="px-4 py-2.5">Start date</th>
                  <th className="px-4 py-2.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {trials.map((t) => (
                  <tr key={t.id} className="text-zinc-800">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {classLabel(t.classId)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {formatDisplayDate(t.trialDate)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {formatDisplayDate(t.startDate)}
                    </td>
                    <td className="px-4 py-3">
                      {t.convertedStudentId ? (
                        <span className="text-green-800">
                          {t.fromEnrollment ? "Enrollments · " : "Converted · "}
                          <Link
                            href="/students"
                            className="font-medium underline"
                          >
                            Roster
                          </Link>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {trials.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      No converted trials yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {trials.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">{t.name}</p>
                    <p className="text-sm text-zinc-600">
                      {formatStudentContacts(t)}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {classLabel(t.classId)}
                      {t.trialDate
                        ? ` · trial ${formatDisplayDate(t.trialDate, "")}`
                        : ""}
                    </p>
                  </div>
                  {t.status === "active" && convertingId !== t.id && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startConvert(t)}
                        className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
                      >
                        Convert to student
                      </button>
                      <button
                        type="button"
                        onClick={() => declineTrial(t.id, t.name)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
                      >
                        Did not enroll
                      </button>
                    </div>
                  )}
                </div>
                {convertingId === t.id && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                    <p className="text-sm font-medium text-zinc-800">
                      Enroll as full-time student
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="text-zinc-700">Start date</span>
                        <input
                          type="date"
                          value={convertForm.startDate}
                          onChange={(e) =>
                            setConvertForm((f) => ({
                              ...f,
                              startDate: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-zinc-700">Class</span>
                        <select
                          required
                          value={convertForm.classId}
                          onChange={(e) =>
                            setConvertForm((f) => ({
                              ...f,
                              classId: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                        >
                          <option value="">— Select —</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {formatClassDropdownLabel(c)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={convertForm.registrationFeeDue}
                          onChange={(e) =>
                            setConvertForm((f) => ({
                              ...f,
                              registrationFeeDue: e.target.checked,
                            }))
                          }
                        />
                        Registration fee due
                      </label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitConvert(t.id)}
                        className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
                      >
                        Confirm enroll
                      </button>
                      <button
                        type="button"
                        onClick={() => setConvertingId(null)}
                        className="text-sm text-zinc-500 hover:text-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {trials.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">
                No active trials. Register one above.
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
