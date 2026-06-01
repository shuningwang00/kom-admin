"use client";

import { MAKEUP_CUSTOM_VALUE } from "@/lib/attendance/makeup-constants";
import type { MakeupClassOption } from "@/lib/attendance/makeup-options";
import {
  normalizeTimeLabel,
  rescheduleTimeOptions,
} from "@/lib/scheduling/time-slots";
import {
  formatScheduledMakeupMissedLine,
  formatScheduledMakeupMuLine,
} from "@/lib/attendance/makeup-display";
import type { ContactType } from "@/lib/contacts";
import type {
  MakeupWaivedRow,
  ReliefTutorNeededRow,
} from "@/lib/attendance/makeup-hub";
import { MakeupCustomTutorSelect } from "@/components/makeup-custom-tutor-select";
import { MakeupReliefNeededSection } from "@/components/makeup-relief-needed";
import { MakeupReminderWhatsAppButton } from "@/components/makeup-reminder-whatsapp";
import { normalizeReliefForStorage } from "@/lib/tutors/relief-form";
import Link from "next/link";
import { formatMakeupNoteFromIso } from "@/lib/attendance/status";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MakeupNeedRow = {
  studentId: string;
  studentName: string;
  sourceSessionId: string;
  sourceClassId: string;
  missedDate: string;
  classLabel: string;
  programmeType: string;
};

type ScheduledRow = {
  studentId: string;
  studentName: string;
  makeupDate: string;
  timeLabel: string;
  makeupClassLabel: string;
  makeupProgrammeType: string;
  makeupDayLabel: string;
  missedDayLabel: string;
  makeupChoice: string;
  note: string;
  sourceSessionId: string;
  missedDate: string;
  primaryContact: string;
  primaryContactType: ContactType | null;
  makeupRegularTutor: string;
  makeupReliefTutor: string;
  isComplete: boolean;
  targetSessionId: string;
  classLabel?: string;
};

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function needFormKey(need: MakeupNeedRow): string {
  return `need:${need.sourceSessionId}:${need.studentId}`;
}

function scheduledFormKey(row: ScheduledRow): string {
  return `scheduled:${row.sourceSessionId}:${row.studentId}:${row.makeupDate}`;
}

export default function MakeupManager() {
  const [needs, setNeeds] = useState<MakeupNeedRow[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [reliefNeeded, setReliefNeeded] = useState<ReliefTutorNeededRow[]>([]);
  const [waived, setWaived] = useState<MakeupWaivedRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formSourceSessionId, setFormSourceSessionId] = useState("");
  const [formSourceClassId, setFormSourceClassId] = useState("");
  const [formStudentId, setFormStudentId] = useState("");
  const [formStudentName, setFormStudentName] = useState("");
  const [makeupChoice, setMakeupChoice] = useState("");
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupTime, setMakeupTime] = useState("");
  const [peerClasses, setPeerClasses] = useState<MakeupClassOption[]>([]);
  const [sourceClass, setSourceClass] = useState<MakeupClassOption | null>(
    null,
  );
  const [programmeType, setProgrammeType] = useState("");
  const [editingStudentId, setEditingStudentId] = useState("");
  const [activeFormKey, setActiveFormKey] = useState("");
  const [makeupReliefTutor, setMakeupReliefTutor] = useState("");
  const skipMakeupClassDefaultsRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/makeup");
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as {
      needs?: MakeupNeedRow[];
      scheduled?: ScheduledRow[];
      reliefNeeded?: ReliefTutorNeededRow[];
      waived?: MakeupWaivedRow[];
    };
    setNeeds(data.needs ?? []);
    setScheduled(data.scheduled ?? []);
    setReliefNeeded(data.reliefNeeded ?? []);
    setWaived(data.waived ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scheduledUpcoming = useMemo(
    () =>
      scheduled
        .filter((row) => !row.isComplete)
        .sort((a, b) => {
          const d = a.makeupDate.localeCompare(b.makeupDate);
          if (d !== 0) return d;
          return a.studentName.localeCompare(b.studentName);
        }),
    [scheduled],
  );

  const scheduledCompleted = useMemo(
    () =>
      scheduled
        .filter((row) => row.isComplete)
        .sort((a, b) => {
          const d = b.makeupDate.localeCompare(a.makeupDate);
          if (d !== 0) return d;
          return a.studentName.localeCompare(b.studentName);
        }),
    [scheduled],
  );

  function clearForm() {
    setSuccess("");
    setActiveFormKey("");
    setFormSourceSessionId("");
    setFormSourceClassId("");
    setFormStudentId("");
    setFormStudentName("");
    setEditingStudentId("");
    setPeerClasses([]);
    setSourceClass(null);
    setProgrammeType("");
    setMakeupReliefTutor("");
  }

  async function openScheduleNeed(need: MakeupNeedRow) {
    const key = needFormKey(need);
    if (activeFormKey === key) {
      clearForm();
      return;
    }
    setSuccess("");
    setError("");
    setActiveFormKey(key);
    setEditingStudentId("");
    setFormSourceSessionId(need.sourceSessionId);
    setFormSourceClassId(need.sourceClassId);
    setFormStudentId(need.studentId);
    setFormStudentName(need.studentName);
    const res = await fetch(
      `/api/sessions/${need.sourceSessionId}/makeup-options`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      peerClasses?: MakeupClassOption[];
      sourceClass?: MakeupClassOption;
      programmeType?: string;
    };
    setPeerClasses(data.peerClasses ?? []);
    setSourceClass(data.sourceClass ?? null);
    setProgrammeType(data.programmeType ?? "");
    const peers = data.peerClasses ?? [];
    if (peers.length > 0) {
      setMakeupChoice(peers[0].classId);
      setMakeupDate(peers[0].defaultDate);
      setMakeupTime(peers[0].defaultTime);
    } else if (data.sourceClass) {
      setMakeupChoice(MAKEUP_CUSTOM_VALUE);
      setMakeupDate(data.sourceClass.defaultDate);
      setMakeupTime(data.sourceClass.defaultTime);
      setMakeupReliefTutor("");
    }
  }

  function applyEditSnapshot(row: ScheduledRow) {
    setMakeupChoice(row.makeupChoice);
    setMakeupDate(row.makeupDate);
    setMakeupTime(normalizeTimeLabel(row.timeLabel) || row.timeLabel);
    setMakeupReliefTutor(
      row.makeupChoice === MAKEUP_CUSTOM_VALUE ? row.makeupReliefTutor : "",
    );
  }

  async function openEditScheduled(row: ScheduledRow) {
    const key = scheduledFormKey(row);
    if (activeFormKey === key) {
      clearForm();
      return;
    }
    setSuccess("");
    setError("");
    setActiveFormKey(key);
    skipMakeupClassDefaultsRef.current = true;
    setEditingStudentId(row.studentId);
    setFormSourceSessionId(row.sourceSessionId);
    setFormStudentId(row.studentId);
    setFormStudentName(row.studentName);
    applyEditSnapshot(row);
    const need = needs.find((n) => n.sourceSessionId === row.sourceSessionId);
    setFormSourceClassId(need?.sourceClassId ?? "");
    const res = await fetch(
      `/api/sessions/${row.sourceSessionId}/makeup-options`,
    );
    if (!res.ok) {
      skipMakeupClassDefaultsRef.current = false;
      return;
    }
    const data = (await res.json()) as {
      peerClasses?: MakeupClassOption[];
      sourceClass?: MakeupClassOption;
      programmeType?: string;
    };
    setPeerClasses(data.peerClasses ?? []);
    setSourceClass(data.sourceClass ?? null);
    setProgrammeType(data.programmeType ?? "");
    if (!need) {
      const srcRes = await fetch(`/api/sessions/${row.sourceSessionId}`);
      if (srcRes.ok) {
        const src = (await srcRes.json()) as { class?: { id: string } };
        if (src.class?.id) setFormSourceClassId(src.class.id);
      }
    }
    applyEditSnapshot(row);
    skipMakeupClassDefaultsRef.current = false;
  }

  function onMakeupClassChange(value: string) {
    setMakeupChoice(value);
    if (skipMakeupClassDefaultsRef.current) return;
    if (value === MAKEUP_CUSTOM_VALUE && sourceClass) {
      setMakeupDate(sourceClass.defaultDate);
      setMakeupTime(sourceClass.defaultTime);
      setMakeupReliefTutor("");
      return;
    }
    setMakeupReliefTutor("");
    const peer = peerClasses.find((c) => c.classId === value);
    if (peer) {
      setMakeupDate(peer.defaultDate);
      setMakeupTime(peer.defaultTime);
    }
  }

  const makeupIsCustom = makeupChoice === MAKEUP_CUSTOM_VALUE;
  const selectedClass = makeupIsCustom
    ? sourceClass
    : peerClasses.find((c) => c.classId === makeupChoice) ?? null;
  const timeOptions = selectedClass
    ? rescheduleTimeOptions(
        selectedClass.defaultTime,
        selectedClass.defaultTime,
      )
    : [];

  async function submitMakeup(e: React.FormEvent) {
    e.preventDefault();
    if (
      !formSourceSessionId ||
      !formSourceClassId ||
      !formStudentId ||
      !makeupChoice ||
      !makeupDate ||
      !makeupTime
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    const payload: Record<string, string> = {
      studentId: formStudentId,
      makeupDate,
      timeLabel: makeupTime,
      note: formatMakeupNoteFromIso(makeupDate),
    };
    if (!makeupIsCustom) payload.makeupClassId = makeupChoice;
    else if (sourceClass) {
      payload.reliefTutor = normalizeReliefForStorage(
        sourceClass.regularTutor,
        makeupReliefTutor,
      );
    }

    const isEdit = Boolean(editingStudentId);
    const res = await fetch(
      isEdit
        ? `/api/sessions/${formSourceSessionId}/makeup-booking`
        : "/api/sessions/makeup",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? payload
            : {
                classId: formSourceClassId,
                sourceSessionId: formSourceSessionId,
                ...payload,
              },
        ),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed");
      return;
    }
    clearForm();
    setSuccess(
      isEdit
        ? "Make-up updated successfully."
        : "Make-up scheduled successfully.",
    );
    await load();
  }

  async function assignReliefTutor(sessionId: string, reliefTutor: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}/relief-tutor`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reliefTutor }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Could not save relief tutor");
    }
    await load();
  }

  async function cancelWaive(row: MakeupWaivedRow) {
    if (
      !confirm(
        `Cancel waive for ${row.studentName}? They will be moved to "Needs M/U" so a makeup can be scheduled.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/sessions/${row.sessionId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [{ studentId: row.studentId, status: "absent_notified" }],
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not cancel waive");
      return;
    }
    await load();
  }

  async function waiveNeed(need: MakeupNeedRow) {
    if (
      !confirm(
        `Waive makeup for ${need.studentName}? They will leave the needs list and won't be billed for this session.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(
      `/api/sessions/${need.sourceSessionId}/attendance`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ studentId: need.studentId, status: "waive" }],
        }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not waive");
      return;
    }
    if (activeFormKey === needFormKey(need)) {
      clearForm();
    }
    await load();
  }

  async function cancelMakeup(row: ScheduledRow) {
    if (
      !confirm(
        `Cancel makeup for ${row.studentName}? They will return to the needs list if still absent.`,
      )
    ) {
      return;
    }
    setSaving(true);
    const res = await fetch(
      `/api/sessions/${row.sourceSessionId}/makeup-booking`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: row.studentId }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Cancel failed");
      return;
    }
    if (activeFormKey === scheduledFormKey(row)) clearForm();
    await load();
  }

  function renderMakeupFormPanel() {
    return (
      <form
        onSubmit={submitMakeup}
        className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 shadow-sm"
      >
        <p className="text-xs font-semibold text-amber-950">
          {editingStudentId ? "Edit makeup" : "Schedule makeup"} —{" "}
          {formStudentName}
        </p>
        {programmeType && (
          <p className="mt-0.5 text-xs text-amber-900/80">{programmeType}</p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Makeup class</span>
            <select
              value={makeupChoice}
              onChange={(e) => onMakeupClassChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              required
            >
              {peerClasses.map((peer) => (
                <option key={peer.classId} value={peer.classId}>
                  {peer.label}
                </option>
              ))}
              <option value={MAKEUP_CUSTOM_VALUE}>
                Custom ({programmeType || "class"})
              </option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Date</span>
            <input
              type="date"
              value={makeupDate}
              onChange={(e) => setMakeupDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Time</span>
            <select
              value={makeupTime}
              onChange={(e) => setMakeupTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="" disabled>
                Select time
              </option>
              {timeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {makeupIsCustom && sourceClass && (
            <MakeupCustomTutorSelect
              regularTutor={sourceClass.regularTutor}
              reliefTutor={makeupReliefTutor}
              onReliefTutorChange={setMakeupReliefTutor}
            />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-60"
          >
            {editingStudentId ? "Save changes" : "Schedule makeup"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={clearForm}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
      </form>
    );
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading makeup…</p>;
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-600">
        Students marked <strong>Absent</strong> on a session appear under{" "}
        <strong>Needs scheduling</strong>. Schedule a MU, <strong>Waive</strong> if
        no makeup is needed, or open the session to mark attendance. After booking,
        they move to <strong>Scheduled</strong>.
      </p>

      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
          {success}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <MakeupReliefNeededSection
        rows={reliefNeeded}
        saving={saving}
        onAssign={assignReliefTutor}
        onError={setError}
      />

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">
          Needs scheduling
          {needs.length > 0 && (
            <span className="ml-2 text-sm font-normal text-amber-800">
              ({needs.length})
            </span>
          )}
        </h2>
        {needs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No pending makeups.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {needs.map((n) => {
              const formOpen = activeFormKey === needFormKey(n);
              return (
                <li
                  key={`${n.sourceSessionId}-${n.studentId}`}
                  className={`px-4 py-3 ${formOpen ? "bg-amber-50/40" : ""}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-zinc-900">{n.studentName}</p>
                      <p className="text-zinc-600">
                        Missed {formatDate(n.missedDate)} · {n.classLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void openScheduleNeed(n)}
                        aria-expanded={formOpen}
                        className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900"
                      >
                        {formOpen ? "Close" : "Schedule"}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => waiveNeed(n)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Waive
                      </button>
                      <Link
                        href={`/attendance/session/${n.sourceSessionId}`}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Open session
                      </Link>
                    </div>
                  </div>
                  {formOpen && renderMakeupFormPanel()}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">
          Scheduled makeup (upcoming)
          {scheduledUpcoming.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              ({scheduledUpcoming.length})
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Nearest M/U date first.
        </p>
        {scheduledUpcoming.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No upcoming makeups.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {scheduledUpcoming.map((row) => {
              const formOpen = activeFormKey === scheduledFormKey(row);
              return (
                <li
                  key={`${row.sourceSessionId}-${row.studentId}-${row.makeupDate}`}
                  className={`px-4 py-3 ${formOpen ? "bg-amber-50/40" : ""}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-zinc-900">
                        {row.studentName}
                      </p>
                      <p className="text-zinc-600">
                        {formatScheduledMakeupMuLine(row)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatScheduledMakeupMissedLine(row)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <MakeupReminderWhatsAppButton row={row} />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void openEditScheduled(row)}
                        aria-expanded={formOpen}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
                      >
                        {formOpen ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => cancelMakeup(row)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                      <Link
                        href={`/attendance/session/${row.sourceSessionId}`}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Missed session
                      </Link>
                    </div>
                  </div>
                  {formOpen && renderMakeupFormPanel()}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">
          Scheduled makeup (completed)
          {scheduledCompleted.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              ({scheduledCompleted.length})
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Most recent M/U date first.
        </p>
        {scheduledCompleted.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No completed makeups yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-green-100 rounded-xl border border-green-200 bg-white shadow-sm">
            {scheduledCompleted.map((row) => (
              <li
                key={`${row.sourceSessionId}-${row.studentId}-${row.makeupDate}`}
                className="flex flex-col gap-2 bg-green-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                    <span>{row.studentName}</span>
                    <span className="inline-flex rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      Completed
                    </span>
                  </p>
                  <p className="text-green-900/90">
                    {formatScheduledMakeupMuLine(row)}
                  </p>
                  <p className="text-xs text-green-800/80">
                    {formatScheduledMakeupMissedLine(row)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/attendance/session/${row.targetSessionId}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    M/U session
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">
          Waived classes
          {waived.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              ({waived.length})
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Missed lessons marked <strong>Waive</strong> — no makeup scheduled.
          Most recent first.
        </p>
        {waived.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No waived classes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {waived.map((row) => (
              <li
                key={`${row.sessionId}-${row.studentId}`}
                className="flex flex-col gap-2 bg-zinc-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                    <span>{row.studentName}</span>
                    <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                      Waived
                    </span>
                  </p>
                  <p className="text-zinc-600">
                    {formatDate(row.waivedDate)} ({row.dayLabel})
                    {row.timeLabel ? ` · ${row.timeLabel}` : ""} · {row.classLabel}
                  </p>
                  {row.programmeType && (
                    <p className="text-xs text-zinc-500">{row.programmeType}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void cancelWaive(row)}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Cancel waive → Needs M/U
                  </button>
                  <Link
                    href={`/attendance/session/${row.sessionId}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Open session
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
