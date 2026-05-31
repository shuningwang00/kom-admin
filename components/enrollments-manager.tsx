"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import { formatCalendarDate } from "@/lib/dates/calendar";
import { isEnrollmentPausedOnDate } from "@/lib/enrollments/pause";
import { useCallback, useEffect, useMemo, useState } from "react";

function todayIso(): string {
  const now = new Date();
  return formatCalendarDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
}

type Row = {
  enrollment: {
    id: string;
    freeTrial: boolean;
    registrationFeeDue: boolean;
    startedAt: string | null;
    trialAttendedAt: string | null;
    pauseStartedAt: string | null;
    pauseEndedAt: string | null;
  };
  student: {
    id: string;
    name: string;
    startDate: string | null;
    billingGroupId: string | null;
    billingGroupLabel: string | null;
  };
  class: {
    id: string;
    label: string;
    level: string;
    time: string;
    tutor: string;
    weekday: string;
  };
};

type Student = { id: string; name: string; startDate: string | null };
type Klass = {
  id: string;
  label: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
};

type EnrollmentSection =
  | { kind: "family"; label: string; groupId: string; rows: Row[] }
  | { kind: "solo"; rows: Row[] };

function EnrollmentRow({
  row,
  onRequestWithdraw,
  onRequestPause,
  onResumePause,
  onTrialDateSave,
}: {
  row: Row;
  onRequestWithdraw: (row: Row) => void;
  onRequestPause: (row: Row) => void;
  onResumePause: (enrollmentId: string) => void;
  onTrialDateSave: (enrollmentId: string, trialAttendedAt: string) => void;
}) {
  const { enrollment, student, class: cls } = row;
  const [trialDate, setTrialDate] = useState(
    enrollment.trialAttendedAt ?? "",
  );

  useEffect(() => {
    setTrialDate(enrollment.trialAttendedAt ?? "");
  }, [enrollment.id, enrollment.trialAttendedAt]);

  const startLabel =
    enrollment.startedAt ?? student.startDate ?? null;
  const hasPause = Boolean(enrollment.pauseStartedAt?.trim());
  const pausedNow = hasPause
    ? isEnrollmentPausedOnDate({
        sessionDate: todayIso(),
        pauseStartedAt: enrollment.pauseStartedAt,
        pauseEndedAt: enrollment.pauseEndedAt,
      })
    : false;

  function commitTrialDateIfChanged() {
    const next = trialDate.trim();
    const saved = (enrollment.trialAttendedAt ?? "").trim();
    if (next !== saved) {
      onTrialDateSave(enrollment.id, next);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-900">{student.name}</p>
        <p className="text-sm text-zinc-600">
          {formatClassDropdownLabel(cls)}
          {startLabel && (
            <span className="ml-2 text-zinc-500">
              Starts {startLabel}
            </span>
          )}
          {enrollment.trialAttendedAt && (
            <span className="ml-2 text-blue-700">
              Trial lesson {enrollment.trialAttendedAt}
            </span>
          )}
          {enrollment.freeTrial && (
            <span className="ml-2 text-blue-600">Free trial</span>
          )}
          {enrollment.registrationFeeDue && (
            <span className="ml-2 text-amber-700">Reg fee</span>
          )}
          {hasPause && (
            <span
              className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                pausedNow
                  ? "border-violet-300 bg-violet-50 text-violet-900"
                  : "border-violet-200 bg-violet-50/60 text-violet-800"
              }`}
            >
              {pausedNow ? "Paused" : "Pause scheduled"}
              {enrollment.pauseStartedAt
                ? ` ${enrollment.pauseStartedAt}${enrollment.pauseEndedAt ? ` → ${enrollment.pauseEndedAt}` : ""}`
                : ""}
            </span>
          )}
        </p>
        <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          Trial lesson date
          <input
            type="date"
            value={trialDate}
            onChange={(e) => setTrialDate(e.target.value)}
            onBlur={commitTrialDateIfChanged}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <span className="text-zinc-500">(for attendance before class start)</span>
        </label>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {hasPause ? (
          <button
            type="button"
            onClick={() => onResumePause(enrollment.id)}
            className="text-sm text-violet-700 hover:text-violet-900"
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRequestPause(row)}
            className="text-sm text-zinc-500 hover:text-violet-800"
          >
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={() => onRequestWithdraw(row)}
          className="text-sm text-zinc-500 hover:text-red-600"
        >
          Withdraw
        </button>
      </div>
    </li>
  );
}

export default function EnrollmentsManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [trialAttendedAt, setTrialAttendedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [withdrawTarget, setWithdrawTarget] = useState<Row | null>(null);
  const [withdrawDate, setWithdrawDate] = useState("");
  const [pauseTarget, setPauseTarget] = useState<Row | null>(null);
  const [pauseStart, setPauseStart] = useState("");
  const [pauseEnd, setPauseEnd] = useState("");

  const selectedStudent = students.find((s) => s.id === studentId);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const [eRes, sRes, cRes] = await Promise.all([
      fetch("/api/enrollments"),
      fetch("/api/students"),
      fetch("/api/classes"),
    ]);
    if (eRes.ok) {
      const data = (await eRes.json()) as { enrollments: Row[] };
      setRows(data.enrollments);
    } else {
      const data = (await eRes.json().catch(() => ({}))) as { error?: string };
      setRows([]);
      setLoadError(
        data.error ?? `Could not load enrollments (${eRes.status}).`,
      );
    }
    if (sRes.ok) {
      const data = (await sRes.json()) as { students: Student[] };
      setStudents(data.students);
    }
    if (cRes.ok) {
      const data = (await cRes.json()) as { classes: Klass[] };
      setClasses(data.classes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!studentId) {
      setStartedAt("");
      return;
    }
    const s = students.find((x) => x.id === studentId);
    setStartedAt(s?.startDate ?? "");
  }, [studentId, students]);

  const sections = useMemo((): EnrollmentSection[] => {
    const familyMap = new Map<string, { label: string; rows: Row[] }>();
    const solo: Row[] = [];

    for (const row of rows) {
      const gid = row.student.billingGroupId;
      const label = row.student.billingGroupLabel;
      if (gid && label) {
        const bucket = familyMap.get(gid) ?? { label, rows: [] };
        bucket.rows.push(row);
        familyMap.set(gid, bucket);
      } else {
        solo.push(row);
      }
    }

    const families: EnrollmentSection[] = [...familyMap.entries()]
      .map(([groupId, { label, rows: familyRows }]) => ({
        kind: "family" as const,
        groupId,
        label,
        rows: familyRows,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...families, { kind: "solo", rows: solo }];
  }, [rows]);

  async function onEnroll(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        classId,
        startedAt: startedAt.trim() || null,
        trialAttendedAt: trialAttendedAt.trim() || null,
      }),
    });
    setStudentId("");
    setClassId("");
    setStartedAt("");
    setTrialAttendedAt("");
    load();
  }

  async function saveTrialDate(enrollmentId: string, date: string) {
    const trialAttendedAt = date.trim() || null;
    setRows((prev) =>
      prev.map((r) =>
        r.enrollment.id === enrollmentId
          ? {
              ...r,
              enrollment: { ...r.enrollment, trialAttendedAt },
            }
          : r,
      ),
    );
    const res = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trialAttendedAt }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setLoadError(data.error ?? "Could not save trial lesson date.");
      await load();
    }
  }

  function openWithdrawDialog(row: Row) {
    setWithdrawTarget(row);
    setWithdrawDate(new Date().toISOString().slice(0, 10));
  }

  function openPauseDialog(row: Row) {
    setPauseTarget(row);
    setPauseStart(new Date().toISOString().slice(0, 10));
    setPauseEnd("");
  }

  async function confirmPause() {
    if (!pauseTarget) return;
    const res = await fetch(`/api/enrollments/${pauseTarget.enrollment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pause: true,
        pauseStartedAt: pauseStart.trim(),
        pauseEndedAt: pauseEnd.trim() || null,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setLoadError(data.error ?? "Could not save pause.");
      setPauseTarget(null);
      return;
    }
    setPauseTarget(null);
    load();
  }

  async function resumePause(enrollmentId: string) {
    const res = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unpause: true }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setLoadError(data.error ?? "Could not resume enrollment.");
      return;
    }
    load();
  }

  async function confirmWithdraw() {
    if (!withdrawTarget) return;
    await fetch(`/api/enrollments/${withdrawTarget.enrollment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end: true,
        endedAt: withdrawDate.trim() || undefined,
      }),
    });
    setWithdrawTarget(null);
    load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600">
        Siblings linked on the Students page appear under one family heading — bill
        them together on the Billing screen. Students only appear on class sessions
        on or after their start date (registration or class start, whichever is
        later).
      </p>

      <form
        onSubmit={onEnroll}
        className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="min-w-[10rem] flex-1 text-sm">
          Student
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            required
          >
            <option value="">Select</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1 text-sm">
          Class
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            required
          >
            <option value="">Select</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {formatClassDropdownLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1 text-sm sm:w-40">
          <span className="block">Class start date</span>
          <input
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="min-w-[10rem] flex-1 text-sm sm:w-40">
          <span className="block">
            Trial lesson date{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <input
            type="date"
            value={trialAttendedAt}
            onChange={(e) => setTrialAttendedAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="h-[42px] shrink-0 self-end rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white"
        >
          Enroll
        </button>
      </form>
      {selectedStudent?.startDate && studentId && (
        <p className="text-xs text-zinc-500">
          Registration start for {selectedStudent.name}: {selectedStudent.startDate}
        </p>
      )}

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 && !loadError ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No active enrollments.
        </p>
      ) : (
        <div className="space-y-6">
          {sections.map((section) =>
            section.kind === "family" ? (
              <div key={section.groupId}>
                <h3 className="mb-2 text-sm font-semibold text-violet-900">
                  {section.label}
                  <span className="ml-2 font-normal text-violet-700">
                    — siblings, bill together
                  </span>
                </h3>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-violet-200 bg-white shadow-sm">
                  {section.rows.map((row) => (
                    <EnrollmentRow
                      key={row.enrollment.id}
                      row={row}
                      onRequestWithdraw={openWithdrawDialog}
                      onRequestPause={openPauseDialog}
                      onResumePause={resumePause}
                      onTrialDateSave={saveTrialDate}
                    />
                  ))}
                </ul>
              </div>
            ) : section.rows.length > 0 ? (
              <div key="solo">
                {sections.some((s) => s.kind === "family") && (
                  <h3 className="mb-2 text-sm font-semibold text-zinc-700">
                    Individual students
                  </h3>
                )}
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
                  {section.rows.map((row) => (
                    <EnrollmentRow
                      key={row.enrollment.id}
                      row={row}
                      onRequestWithdraw={openWithdrawDialog}
                      onRequestPause={openPauseDialog}
                      onResumePause={resumePause}
                      onTrialDateSave={saveTrialDate}
                    />
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}
      {pauseTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold text-zinc-900">
              Pause enrollment?
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {pauseTarget.student.name} will not appear on{" "}
              {formatClassDropdownLabel(pauseTarget.class)} sessions during the
              pause window (including when you generate sessions for the month).
            </p>
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
              <p className="font-medium">Pause end = first day back in class</p>
              <p className="mt-1 text-violet-900">
                If their last lesson before pause is <strong>10 June</strong>,
                set pause start <strong>11 June</strong>. If they return{" "}
                <strong>1 July</strong>, set pause end <strong>1 July</strong>.
              </p>
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-800">
              Pause start
              <input
                type="date"
                value={pauseStart}
                onChange={(e) => setPauseStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-zinc-800">
              Pause end{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
              <input
                type="date"
                value={pauseEnd}
                onChange={(e) => setPauseEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <p className="mt-2 text-xs text-zinc-500">
              Leave pause end empty for an open-ended pause. Use Resume on the
              enrollment row to clear it early.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPauseTarget(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPause}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
              >
                Confirm pause
              </button>
            </div>
          </div>
        </div>
      )}
      {withdrawTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold text-zinc-900">
              Withdraw from class?
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {withdrawTarget.student.name} will stop appearing on{" "}
              {formatClassDropdownLabel(withdrawTarget.class)} sessions from the
              withdrawal date you enter below.
            </p>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">Withdrawal date = day after their last lesson</p>
              <p className="mt-1 text-amber-900">
                If their last lesson is <strong>3 June</strong>, enter{" "}
                <strong>4 June</strong> so they are still counted on the 3 June
                session.
              </p>
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-800">
              Withdrawal date
              <input
                type="date"
                value={withdrawDate}
                onChange={(e) => setWithdrawDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </label>
            <p className="mt-2 text-xs text-zinc-500">
              Undo later from Students → Show withdrawn.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setWithdrawTarget(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmWithdraw}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
