"use client";

import {
  statusButtonClassName,
  statusDisplayLabel,
} from "@/lib/attendance/status-ui";
import {
  MAKEUP_VISITOR_MARKING_STATUSES,
  normalizeSessionMarkingStatus,
  SESSION_MARKING_STATUSES,
  type AttendanceStatus,
} from "@/lib/attendance/status";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReliefTutorField } from "@/components/relief-tutor-field";
import {
  formatScheduledMakeupMissedLine,
  formatScheduledMakeupMuLine,
} from "@/lib/attendance/makeup-display";
import { MakeupCustomTutorSelect } from "@/components/makeup-custom-tutor-select";
import { MakeupReminderWhatsAppButton } from "@/components/makeup-reminder-whatsapp";
import type { ContactType } from "@/lib/contacts";
import { formatMakeupNoteFromIso } from "@/lib/attendance/status";
import { sessionActiveExpectedTotal } from "@/lib/attendance/relief-tutor-session";
import type { SessionExpectedCounts } from "@/lib/attendance/session-expected-labels";
import { normalizeReliefForStorage } from "@/lib/tutors/relief-form";
import { MAKEUP_CUSTOM_VALUE } from "@/lib/attendance/makeup-constants";
import type { MakeupClassOption } from "@/lib/attendance/makeup-options";
import {
  normalizeTimeLabel,
  rescheduleTimeOptions,
} from "@/lib/scheduling/time-slots";
import { formatClassTypeLabel } from "@/lib/classes/display-label";
import { sessionTutorDisplay } from "@/lib/tutors/display";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type StudentRow = {
  student: { id: string; name: string };
  status: AttendanceStatus;
  makeupNote: string;
  makeupDisplayNote?: string;
  isMakeupVisitor?: boolean;
  isWalkIn?: boolean;
  isFreeTrial?: boolean;
  attendanceSaved?: boolean;
};

function statusLabelForStudentRow(
  row: StudentRow,
  sessionDate: string,
): string {
  const opts = {
    makeupNote: row.makeupNote,
    sessionDate,
  };
  if (row.isMakeupVisitor) {
    return statusDisplayLabel(row.status, opts);
  }
  if (
    SESSION_MARKING_STATUSES.includes(row.status) ||
    row.status === "free_trial" ||
    row.status === "pause"
  ) {
    return statusDisplayLabel(normalizeSessionMarkingStatus(row.status), opts);
  }
  return statusDisplayLabel(row.status, opts);
}

type AddableStudent = {
  id: string;
  name: string;
  levelDisplay: string;
  classesHint: string;
};

type ScheduledMakeup = {
  studentId: string;
  studentName: string;
  makeupDate: string;
  timeLabel: string;
  makeupClassLabel: string;
  makeupProgrammeType: string;
  makeupDayLabel: string;
  missedDayLabel: string;
  missedDate: string;
  makeupChoice: string;
  note: string;
  primaryContact: string;
  primaryContactType: ContactType | null;
  makeupRegularTutor: string;
  makeupReliefTutor: string;
  isComplete?: boolean;
};

type TrialLeadRow = {
  trialLeadId: string;
  name: string;
  status: AttendanceStatus;
  attendanceSaved?: boolean;
};

type SessionDetail = {
  session: {
    id: string;
    scheduledDate: string;
    timeLabel: string;
    status: "scheduled" | "cancelled";
    rescheduleNote: string;
    reliefTutor: string;
    expected?: SessionExpectedCounts;
  };
  class: { id: string; label: string; level: string; tutor: string; time: string };
  students: StudentRow[];
  trialLeads: TrialLeadRow[];
  rosterForMakeup: Array<{ id: string; name: string }>;
  scheduledMakeups: ScheduledMakeup[];
  role: "owner" | "staff" | "tutor";
};

export default function SessionAttendancePanel({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus | undefined>>(
    {},
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [makeupStudentId, setMakeupStudentId] = useState("");
  const [makeupChoice, setMakeupChoice] = useState("");
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupTime, setMakeupTime] = useState("");
  const [makeupPeerClasses, setMakeupPeerClasses] = useState<
    MakeupClassOption[]
  >([]);
  const [makeupSourceClass, setMakeupSourceClass] =
    useState<MakeupClassOption | null>(null);
  const [makeupMissedDate, setMakeupMissedDate] = useState("");
  const [makeupProgrammeType, setMakeupProgrammeType] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleSuccess, setRescheduleSuccess] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [addableStudents, setAddableStudents] = useState<AddableStudent[]>([]);
  const [addableLevelLabel, setAddableLevelLabel] = useState("");
  const [addStudentId, setAddStudentId] = useState("");
  const [editingMakeupStudentId, setEditingMakeupStudentId] = useState("");
  const [makeupReliefTutor, setMakeupReliefTutor] = useState("");
  const [editingStudentIds, setEditingStudentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [trialDraft, setTrialDraft] = useState<
    Record<string, AttendanceStatus | undefined>
  >({});
  const [editingTrialIds, setEditingTrialIds] = useState<Set<string>>(
    () => new Set(),
  );
  const skipMakeupClassDefaultsRef = useRef(false);

  function isAttendanceFullySaved(students: StudentRow[]): boolean {
    if (students.length === 0) return false;
    return students.every((row) => row.attendanceSaved);
  }

  function isRowInEditMode(
    row: StudentRow,
    editingIds: Set<string>,
  ): boolean {
    return !row.attendanceSaved || editingIds.has(row.student.id);
  }

  function initDraftForStudents(
    students: StudentRow[],
    editingIds: Set<string>,
  ): Record<string, AttendanceStatus | undefined> {
    const next: Record<string, AttendanceStatus | undefined> = {};
    for (const row of students) {
      if (row.attendanceSaved && editingIds.has(row.student.id)) {
        next[row.student.id] = normalizeSessionMarkingStatus(row.status);
      }
    }
    return next;
  }

  function studentsNeedingSave(
    students: StudentRow[],
    editingIds: Set<string>,
  ): StudentRow[] {
    return students.filter(
      (row) => !row.attendanceSaved || editingIds.has(row.student.id),
    );
  }

  function startEditStudent(row: StudentRow) {
    setEditingStudentIds((prev) => new Set(prev).add(row.student.id));
    setDraft((d) => ({
      ...d,
      [row.student.id]: normalizeSessionMarkingStatus(row.status),
    }));
    setError("");
  }

  function cancelEditStudent(row: StudentRow) {
    setEditingStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(row.student.id);
      return next;
    });
    setDraft((d) => {
      const { [row.student.id]: _removed, ...rest } = d;
      return rest;
    });
    setError("");
  }

  const load = useCallback(async () => {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as SessionDetail;
    setDetail({
      ...data,
      trialLeads: data.trialLeads ?? [],
      scheduledMakeups: data.scheduledMakeups ?? [],
    });
    setEditingStudentIds(new Set());
    setEditingTrialIds(new Set());
    setDraft(initDraftForStudents(data.students, new Set()));
    setTrialDraft({});
    setRescheduleDate(data.session.scheduledDate);
    const timeNorm =
      normalizeTimeLabel(data.session.timeLabel) ||
      normalizeTimeLabel(data.class.time) ||
      "";
    setRescheduleTime(timeNorm);
    setRescheduleNote(data.session.rescheduleNote);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/addable-students`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as {
        students?: AddableStudent[];
        levelLabel?: string;
      };
      if (cancelled) return;
      setAddableStudents(data.students ?? []);
      setAddableLevelLabel(data.levelLabel ?? "");
      setAddStudentId("");
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, detail?.students.length, detail?.scheduledMakeups.length]);

  function applyMakeupDefaults(option: MakeupClassOption) {
    setMakeupDate(option.defaultDate);
    setMakeupTime(option.defaultTime);
  }

  function onMakeupClassChange(value: string) {
    setMakeupChoice(value);
    if (skipMakeupClassDefaultsRef.current) return;
    if (value === MAKEUP_CUSTOM_VALUE) {
      if (makeupSourceClass) applyMakeupDefaults(makeupSourceClass);
      setMakeupReliefTutor("");
      return;
    }
    setMakeupReliefTutor("");
    const peer = makeupPeerClasses.find((c) => c.classId === value);
    if (peer) applyMakeupDefaults(peer);
  }

  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/makeup-options`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as {
        peerClasses?: MakeupClassOption[];
        sourceClass?: MakeupClassOption;
        programmeType?: string;
        missedDate?: string;
      };
      if (cancelled) return;
      const peers = data.peerClasses ?? [];
      setMakeupPeerClasses(peers);
      setMakeupSourceClass(data.sourceClass ?? null);
      setMakeupMissedDate(data.missedDate ?? "");
      setMakeupProgrammeType(data.programmeType ?? "");
      if (peers.length > 0) {
        setMakeupChoice(peers[0].classId);
        applyMakeupDefaults(peers[0]);
      } else if (data.sourceClass) {
        setMakeupChoice(MAKEUP_CUSTOM_VALUE);
        applyMakeupDefaults(data.sourceClass);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, detail?.class.id]);

  function statusesForRow(row: StudentRow): AttendanceStatus[] {
    if (row.isMakeupVisitor || row.isWalkIn) {
      return MAKEUP_VISITOR_MARKING_STATUSES;
    }
    return SESSION_MARKING_STATUSES;
  }

  function isMakeupStudent(row: StudentRow): boolean {
    if (row.isWalkIn) return false;
    if (row.isMakeupVisitor) return true;
    if (row.status === "makeup_scheduled" || row.status === "makeup_done") {
      return true;
    }
    return /MU on/i.test(row.makeupNote.trim());
  }

  async function saveAttendance() {
    if (!detail) return;
    const pending = studentsNeedingSave(detail.students, editingStudentIds);
    const trialPending = (detail.trialLeads ?? []).filter(
      (row) => !row.attendanceSaved || editingTrialIds.has(row.trialLeadId),
    );
    if (pending.length === 0 && trialPending.length === 0) return;

    const missing = pending.filter((row) => !draft[row.student.id]);
    if (missing.length > 0) {
      setError(
        `Select a status for each student before saving (${missing.map((r) => r.student.name).join(", ")}).`,
      );
      return;
    }
    const missingTrials = trialPending.filter(
      (row) => !trialDraft[row.trialLeadId],
    );
    if (missingTrials.length > 0) {
      setError(
        `Select a status for each trial student (${missingTrials.map((r) => r.name).join(", ")}).`,
      );
      return;
    }
    setSaving(true);
    setError("");
    const updates = pending.map((row) => ({
      studentId: row.student.id,
      status: draft[row.student.id]!,
    }));
    const trialUpdates = trialPending.map((row) => ({
      trialLeadId: row.trialLeadId,
      status: trialDraft[row.trialLeadId]!,
    }));
    const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(updates.length ? { updates } : {}),
        ...(trialUpdates.length ? { trialUpdates } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Save failed");
      return;
    }
    setEditingStudentIds(new Set());
    setEditingTrialIds(new Set());
    await load();
  }

  const makeupIsCustom = makeupChoice === MAKEUP_CUSTOM_VALUE;

  const selectedMakeupClass = makeupIsCustom
    ? makeupSourceClass
    : makeupPeerClasses.find((c) => c.classId === makeupChoice) ?? null;

  const makeupTimeOptions = selectedMakeupClass
    ? rescheduleTimeOptions(
        selectedMakeupClass.defaultTime,
        selectedMakeupClass.defaultTime,
      )
    : [];

  function formatMissedDateLabel(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  function resetMakeupForm() {
    setEditingMakeupStudentId("");
    setMakeupStudentId("");
    setMakeupReliefTutor("");
    if (makeupPeerClasses.length > 0) {
      setMakeupChoice(makeupPeerClasses[0].classId);
      applyMakeupDefaults(makeupPeerClasses[0]);
    } else if (makeupSourceClass) {
      setMakeupChoice(MAKEUP_CUSTOM_VALUE);
      applyMakeupDefaults(makeupSourceClass);
    }
  }

  function applyMakeupEditSnapshot(m: ScheduledMakeup) {
    setMakeupChoice(m.makeupChoice);
    setMakeupDate(m.makeupDate);
    setMakeupTime(normalizeTimeLabel(m.timeLabel) || m.timeLabel);
    setMakeupReliefTutor(
      m.makeupChoice === MAKEUP_CUSTOM_VALUE ? m.makeupReliefTutor : "",
    );
  }

  function startEditMakeup(m: ScheduledMakeup) {
    skipMakeupClassDefaultsRef.current = true;
    setEditingMakeupStudentId(m.studentId);
    setMakeupStudentId(m.studentId);
    applyMakeupEditSnapshot(m);
    queueMicrotask(() => {
      skipMakeupClassDefaultsRef.current = false;
    });
  }

  async function cancelScheduledMakeup(studentId: string, studentName: string) {
    if (
      !confirm(
        `Cancel makeup for ${studentName}? They will show on this session list again.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}/makeup-booking`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Cancel failed");
      return;
    }
    if (editingMakeupStudentId === studentId) resetMakeupForm();
    await load();
  }

  async function scheduleMakeup(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !makeupStudentId || !makeupChoice || !makeupDate || !makeupTime)
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    const payload: Record<string, string> = {
      studentId: makeupStudentId,
      makeupDate,
      timeLabel: makeupTime,
      note: formatMakeupNoteFromIso(makeupDate),
    };
    if (!makeupIsCustom) payload.makeupClassId = makeupChoice;
    else if (makeupSourceClass) {
      payload.reliefTutor = normalizeReliefForStorage(
        makeupSourceClass.regularTutor,
        makeupReliefTutor,
      );
    }

    const isEdit = Boolean(editingMakeupStudentId);
    const res = await fetch(
      isEdit
        ? `/api/sessions/${sessionId}/makeup-booking`
        : "/api/sessions/makeup",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? payload
            : {
                classId: detail.class.id,
                sourceSessionId: sessionId,
                ...payload,
              },
        ),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Makeup failed");
      return;
    }
    setSuccess(
      isEdit
        ? "Make-up updated successfully."
        : "Make-up scheduled successfully.",
    );
    resetMakeupForm();
    await load();
  }

  const timeSlotOptions = detail
    ? rescheduleTimeOptions(detail.class.time, detail.session.timeLabel)
    : [];

  async function rescheduleSession(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime) return;
    if (!rescheduleNote.trim()) {
      setRescheduleError("Please indicate reason for rescheduling.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/sessions/${sessionId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newDate: rescheduleDate,
        timeLabel: rescheduleTime,
        note: rescheduleNote,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setRescheduleError(data.error ?? "Reschedule failed");
      return;
    }
    const data = (await res.json()) as { newSessionId?: string | null };
    if (data.newSessionId) {
      router.push(`/attendance/session/${data.newSessionId}`);
      return;
    }
    setRescheduleError("");
    await load();
    setRescheduleSuccess("Session rescheduled.");
  }

  if (error && !detail) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!detail) {
    return <p className="text-sm text-zinc-500">Loading session…</p>;
  }

  const tutorLine = sessionTutorDisplay(
    detail.class.tutor,
    detail.session.reliefTutor ?? "",
  );

  async function addWalkInStudent() {
    if (!addStudentId) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}/add-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: addStudentId }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not add student");
      return;
    }
    const added = (await res.json()) as SessionDetail;
    setDetail(added);
    setEditingStudentIds(new Set());
    setDraft(initDraftForStudents(added.students, new Set()));
    setAddStudentId("");
  }

  const isCancelledSession = detail.session.status === "cancelled";

  async function cancelOrRestoreSession(restore: boolean) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        restore ? { restore: true } : { note: cancelNote.trim() || undefined },
      ),
    });
    setSaving(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not update session.");
      return;
    }
    setShowCancelConfirm(false);
    setShowRestoreConfirm(false);
    setCancelNote("");
    setSuccess(
      restore
        ? "Session restored. Students marked from cancellation were reset to unmarked."
        : "Class cancelled. Enrolled students were set to Needs M/U.",
    );
    await load();
  }

  async function saveReliefTutor(reliefTutor: string) {
    const res = await fetch(`/api/sessions/${sessionId}/relief-tutor`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reliefTutor }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not save relief tutor.");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-orange-700 hover:underline"
      >
        ← Back
      </button>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-semibold text-zinc-900">
          {formatClassTypeLabel(detail.class)}
        </p>
        <p className="text-sm text-zinc-600">
          {detail.session.scheduledDate} · {detail.session.timeLabel || detail.class.time}{" "}
          · {tutorLine.primary}
          {isCancelledSession && (
            <span className="ml-2 font-semibold text-zinc-500">· Cancelled</span>
          )}
        </p>
        {tutorLine.subtitle && (
          <p className="text-xs font-medium text-sky-800">{tutorLine.subtitle}</p>
        )}
        {detail.session.rescheduleNote && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
              {isCancelledSession ? "Cancelled" : "Rescheduled"}
            </span>
            {detail.session.rescheduleNote}
          </p>
        )}
      </div>

      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
          {success}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isCancelledSession && (
        <p className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
          This class was cancelled. Enrolled students are marked{" "}
          <strong>Needs M/U</strong> for a makeup from this session. Schedule
          makeups below or restore the session if it will run after all.
        </p>
      )}

      <ReliefTutorField
        regularTutor={detail.class.tutor}
        reliefTutor={detail.session.reliefTutor ?? ""}
        onSave={saveReliefTutor}
        disabled={saving || isCancelledSession}
        allowReliefNeededOption={
          !isCancelledSession &&
          sessionActiveExpectedTotal(
            detail.session.expected ?? { regular: 0, trial: 0, makeup: 0 },
          ) > 0
        }
      />

      {detail.students.length === 0 && !(detail.trialLeads?.length) ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600 shadow-sm">
          No enrolled students to mark for this session.
        </p>
      ) : (
        (() => {
          const trialLeads = detail.trialLeads ?? [];
          const allStudentsSaved = detail.students.length === 0 || isAttendanceFullySaved(detail.students);
          const allTrialSaved = trialLeads.length === 0 || (trialLeads.every((r) => r.attendanceSaved) && editingTrialIds.size === 0);
          const allSaved = allStudentsSaved && allTrialSaved && editingStudentIds.size === 0;
          const pendingStudents = detail.students.filter((row) => !row.attendanceSaved);
          const pendingTrials = trialLeads.filter((row) => !row.attendanceSaved);
          const totalPending = pendingStudents.length + pendingTrials.length;
          const sortedStudents = [...detail.students].sort((a, b) => {
            const aPending = !a.attendanceSaved ? 0 : 1;
            const bPending = !b.attendanceSaved ? 0 : 1;
            if (aPending !== bPending) return aPending - bPending;
            return a.student.name.localeCompare(b.student.name);
          });
          const hasPendingSave =
            studentsNeedingSave(detail.students, editingStudentIds).length > 0 ||
            trialLeads.some((r) => !r.attendanceSaved || editingTrialIds.has(r.trialLeadId));

          return (
            <div
              className={`rounded-xl border bg-white shadow-sm ${
                allSaved
                  ? "border-green-200"
                  : "border-zinc-200"
              }`}
            >
              <div
                className={`flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3 ${
                  allSaved
                    ? "border-green-200/80 bg-green-50/40"
                    : "border-zinc-100"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {isCancelledSession
                      ? "Cancelled — Needs M/U"
                      : allSaved
                        ? "Attendance saved"
                        : "Attendance"}
                  </h2>
                  {isCancelledSession ? (
                    <p className="mt-0.5 text-xs text-zinc-600">
                      No attendance to mark. Students need a makeup from this
                      cancelled session.
                    </p>
                  ) : allSaved ? (
                    <p className="mt-0.5 text-xs text-green-800">
                      All students saved. Use Edit on a row to change a status.
                    </p>
                  ) : totalPending > 0 ? (
                    <p className="mt-0.5 text-xs text-amber-900">
                      {totalPending} still to mark. Saved students show
                      their status — use Edit to change.
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-600">
                      Save or cancel your edits below.
                    </p>
                  )}
                </div>
                {!isCancelledSession && hasPendingSave && (
                  <button
                    type="button"
                    onClick={saveAttendance}
                    disabled={saving}
                    className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save attendance"}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-zinc-100">
                {trialLeads.map((row) => {
                  const isSaved = row.attendanceSaved;
                  const isExpanded = editingTrialIds.has(row.trialLeadId);
                  const needsMark = !isSaved;
                  return (
                    <li
                      key={row.trialLeadId}
                      className={`px-4 py-3 ${
                        needsMark
                          ? "bg-amber-50/25"
                          : isExpanded
                            ? "bg-zinc-50/80"
                            : "bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-zinc-900">
                            <span>{row.name}</span>
                            {needsMark && (
                              <span className="text-xs font-normal text-amber-900">To mark</span>
                            )}
                            <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-900">
                              Free trial
                            </span>
                          </p>
                        </div>
                        {isSaved && (
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <span className={statusButtonClassName(normalizeSessionMarkingStatus(row.status), true)}>
                              {statusDisplayLabel(normalizeSessionMarkingStatus(row.status))}
                            </span>
                            {!isCancelledSession && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  isExpanded
                                    ? (setEditingTrialIds((prev) => { const n = new Set(prev); n.delete(row.trialLeadId); return n; }))
                                    : (setEditingTrialIds((prev) => new Set(prev).add(row.trialLeadId)),
                                       setTrialDraft((d) => ({ ...d, [row.trialLeadId]: normalizeSessionMarkingStatus(row.status) })))
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                              >
                                {isExpanded ? "Close" : "Edit"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {!isCancelledSession && (needsMark || isExpanded) && (
                        <div className={isSaved ? "mt-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm" : "mt-2"}>
                          <div className="flex flex-wrap gap-1">
                            {SESSION_MARKING_STATUSES.map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setTrialDraft((d) => ({ ...d, [row.trialLeadId]: status }))}
                                className={statusButtonClassName(status, trialDraft[row.trialLeadId] === status)}
                              >
                                {statusDisplayLabel(status)}
                              </button>
                            ))}
                          </div>
                          {isSaved && isExpanded && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setEditingTrialIds((prev) => { const n = new Set(prev); n.delete(row.trialLeadId); return n; })}
                              className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                {sortedStudents.map((row) => {
                  const isSaved = row.attendanceSaved;
                  const isExpanded = editingStudentIds.has(row.student.id);
                  const needsMark = !isSaved;

                  return (
                    <li
                      key={row.student.id}
                      className={`px-4 py-3 ${
                        needsMark
                          ? "bg-amber-50/25"
                          : isExpanded
                            ? "bg-zinc-50/80"
                            : "bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-zinc-900">
                            <span>{row.student.name}</span>
                            {needsMark && (
                              <span className="text-xs font-normal text-amber-900">
                                To mark
                              </span>
                            )}
                            {row.isFreeTrial && (
                              <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-900">
                                Free trial
                              </span>
                            )}
                            {isMakeupStudent(row) && (
                              <span className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-yellow-900">
                                M/U
                              </span>
                            )}
                            {row.isWalkIn && (
                              <span className="text-xs font-normal text-sky-800">
                                (showed up)
                              </span>
                            )}
                          </p>
                          {row.makeupDisplayNote &&
                            (isMakeupStudent(row) || isCancelledSession) && (
                            <p className="mt-0.5 text-xs text-amber-800">
                              {row.makeupDisplayNote}
                            </p>
                          )}
                        </div>
                        {isSaved && (
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <span
                              className={statusButtonClassName(
                                row.isMakeupVisitor
                                  ? row.status
                                  : normalizeSessionMarkingStatus(row.status),
                                true,
                              )}
                            >
                              {statusLabelForStudentRow(
                                row,
                                detail.session.scheduledDate,
                              )}
                            </span>
                            {!isCancelledSession && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                isExpanded
                                  ? cancelEditStudent(row)
                                  : startEditStudent(row)
                              }
                              aria-expanded={isExpanded}
                              className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {isExpanded ? "Close" : "Edit"}
                            </button>
                            )}
                          </div>
                        )}
                      </div>
                      {!isCancelledSession && (needsMark || isExpanded) && (
                        <div
                          className={
                            isSaved
                              ? "mt-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                              : "mt-2"
                          }
                        >
                          <div className="flex flex-wrap gap-1">
                            {statusesForRow(row).map((status) => {
                              const selected =
                                draft[row.student.id] === status;
                              return (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() =>
                                    setDraft((d) => ({
                                      ...d,
                                      [row.student.id]: status,
                                    }))
                                  }
                                  className={statusButtonClassName(
                                    status,
                                    selected,
                                  )}
                                >
                                  {statusDisplayLabel(status, {
                                    makeupNote: row.makeupNote,
                                    sessionDate:
                                      detail.session.scheduledDate,
                                  })}
                                </button>
                              );
                            })}
                          </div>
                          {isSaved && isExpanded && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => cancelEditStudent(row)}
                              className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()
      )}

      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
        <h2 className="text-sm font-semibold text-sky-950">
          Student showed up unexpectedly
        </h2>
        <p className="mt-1 text-xs text-sky-900/90">
          Add an existing {addableLevelLabel || "same level"} student who is not
          on the list (e.g. said they were not coming). Select their status and
          save attendance after adding.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="font-medium text-zinc-700">Student</span>
            <select
              value={addStudentId}
              onChange={(e) => setAddStudentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              disabled={addableStudents.length === 0 || saving}
            >
              <option value="">
                {addableStudents.length === 0
                  ? "No matching students available"
                  : "Choose student"}
              </option>
              {addableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.classesHint && s.classesHint !== "—"
                    ? ` · ${s.classesHint}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addWalkInStudent}
            disabled={!addStudentId || saving}
            className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-60"
          >
            Add to list
          </button>
        </div>
      </div>

      {(detail.scheduledMakeups?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h2 className="text-sm font-semibold text-amber-950">
            Scheduled makeup
          </h2>
          <p className="mt-1 text-xs text-amber-900/80">
            Not on the attendance list above — M/U on another date or this
            missed lesson.
          </p>
          <ul className="mt-3 divide-y divide-amber-200/80">
            {detail.scheduledMakeups.map((m) => (
              <li
                key={`${m.studentId}:${m.makeupDate}:${m.timeLabel}`}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm text-amber-950">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span>{m.studentName}</span>
                    {m.isComplete && (
                      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                        Completed
                      </span>
                    )}
                  </p>
                  <p className="text-amber-900/90">
                    {formatScheduledMakeupMuLine(m)}
                  </p>
                  <p className="text-xs text-amber-900/80">
                    {formatScheduledMakeupMissedLine(m)}
                  </p>
                </div>
                {(detail.role === "owner" || detail.role === "staff") &&
                  !m.isComplete && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <MakeupReminderWhatsAppButton row={m} />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => startEditMakeup(m)}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          cancelScheduledMakeup(m.studentId, m.studentName)
                        }
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(detail.role === "owner" || detail.role === "staff") && (
        <>
          <form
          onSubmit={scheduleMakeup}
          className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"
        >
          <h2 className="text-sm font-semibold text-amber-950">
            {editingMakeupStudentId ? "Edit makeup" : "Schedule makeup"}
          </h2>
          <p className="mt-1 text-xs text-amber-900/80">
            {makeupMissedDate ? (
              <>
                Missed lesson on{" "}
                <strong>{formatMissedDateLabel(makeupMissedDate)}</strong>.
                Makeup joins another{" "}
                {makeupProgrammeType || "same level & subject"} class — date
                and time default to the next available slot for that class.
              </>
            ) : (
              <>
                Join another active{" "}
                {makeupProgrammeType || "same level & subject"} class, or pick
                a custom date & time on this class.
              </>
            )}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={makeupStudentId}
              onChange={(e) => setMakeupStudentId(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
              required
              disabled={Boolean(editingMakeupStudentId)}
            >
              <option value="">Student</option>
              {(detail.rosterForMakeup ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-zinc-700">Makeup class</span>
              <select
                value={makeupChoice}
                onChange={(e) => onMakeupClassChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                required
              >
                {makeupPeerClasses.map((peer) => (
                  <option key={peer.classId} value={peer.classId}>
                    {peer.label}
                  </option>
                ))}
                <option value={MAKEUP_CUSTOM_VALUE}>
                  Custom ({makeupProgrammeType || "class"})
                </option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Date</span>
              <input
                type="date"
                value={makeupDate}
                onChange={(e) => setMakeupDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Time</span>
              <select
                value={makeupTime}
                onChange={(e) => setMakeupTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                required
              >
                <option value="" disabled>
                  Select time
                </option>
                {makeupTimeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {makeupIsCustom && makeupSourceClass && (
              <MakeupCustomTutorSelect
                regularTutor={makeupSourceClass.regularTutor}
                reliefTutor={makeupReliefTutor}
                onReliefTutorChange={setMakeupReliefTutor}
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900"
            >
              {editingMakeupStudentId ? "Save changes" : "Schedule makeup"}
            </button>
            {editingMakeupStudentId && (
              <button
                type="button"
                disabled={saving}
                onClick={resetMakeupForm}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
        </>
      )}

      {!isCancelledSession && (
      <form
        onSubmit={rescheduleSession}
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-zinc-800">
          Reschedule this class session
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Moves this session for all students (e.g. whole class from 2 Jun → 5 Jun).
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">New date</span>
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">
              Time slot <span className="font-normal text-zinc-500">(1h 45min)</span>
            </span>
            <select
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="" disabled>
                Select time
              </option>
              {timeSlotOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Note</span>
            <input
              value={rescheduleNote}
              onChange={(e) => setRescheduleNote(e.target.value)}
              placeholder="e.g. moved for PH holiday"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Reschedule session
        </button>
        {rescheduleError && (
          <p className="mt-2 text-sm text-red-600">{rescheduleError}</p>
        )}
        {rescheduleSuccess && (
          <p className="mt-2 text-sm font-medium text-green-700">{rescheduleSuccess}</p>
        )}
      </form>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">
          {isCancelledSession
            ? "Restore class session"
            : "Cancel class session (only if rescheduling is not an option)"}
        </h2>
        {isCancelledSession ? (
          <>
            <p className="mt-1 text-xs text-zinc-500">
              Puts the session back on the schedule and clears Needs M/U marks
              that were set only because of cancellation.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowRestoreConfirm(true)}
              className="mt-3 rounded-lg border border-zinc-400 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Restore session
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-zinc-500">
              If the class can be moved to another date, use Reschedule above
              instead. Cancels this lesson for everyone enrolled. Each student
              is marked Needs M/U with a note that the makeup is from a cancelled
              session.
            </p>
            <div className="mt-3 flex items-end gap-2">
              <label className="block flex-1 text-sm">
                <span className="font-medium text-zinc-700">Reason</span>
                <input
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="e.g. centre closed, tutor unwell"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (!cancelNote.trim()) {
                    setCancelError("Please indicate reason for cancellation.");
                    return;
                  }
                  setCancelError("");
                  setShowCancelConfirm(true);
                }}
                className="shrink-0 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                Cancel class
              </button>
            </div>
            {cancelError && (
              <p className="mt-2 text-sm text-red-600">{cancelError}</p>
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel this class?"
        destructive
        confirmLabel="Cancel class"
        message={
          <>
            <p>
              This cancels the lesson on{" "}
              <strong>{detail.session.scheduledDate}</strong> for all enrolled
              students. Each affected student (except waived) will be marked{" "}
              <strong>Needs M/U</strong> with a note that the makeup is from
              this cancelled session.
            </p>
            <p className="text-zinc-500">
              To end one student&apos;s enrollment only, use Enrollments — do
              not cancel the whole class.
            </p>
          </>
        }
        onConfirm={() => void cancelOrRestoreSession(false)}
        onCancel={() => setShowCancelConfirm(false)}
      />

      <ConfirmDialog
        open={showRestoreConfirm}
        title="Restore this session?"
        confirmLabel="Restore session"
        message="Put this class back on the schedule and clear Needs M/U marks that were set automatically when the class was cancelled."
        onConfirm={() => void cancelOrRestoreSession(true)}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </div>
  );
}
