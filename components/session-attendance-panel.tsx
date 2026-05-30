"use client";

import {
  ATTENDANCE_STATUSES,
  STATUS_LABELS,
  type AttendanceStatus,
} from "@/lib/attendance/status";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type StudentRow = {
  student: { id: string; name: string };
  status: AttendanceStatus;
  makeupNote: string;
};

type SessionDetail = {
  session: {
    id: string;
    scheduledDate: string;
    timeLabel: string;
    rescheduleNote: string;
  };
  class: { id: string; label: string; tutor: string; time: string };
  students: StudentRow[];
  role: "owner" | "staff" | "tutor";
};

const TUTOR_STATUSES: AttendanceStatus[] = [
  "present",
  "absent_pending",
  "waive",
  "pause",
  "free_trial",
  "makeup_done",
];

export default function SessionAttendancePanel({
  sessionId,
}: {
  sessionId: string;
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [makeupStudentId, setMakeupStudentId] = useState("");
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupNote, setMakeupNote] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as SessionDetail;
    setDetail(data);
    const initial: Record<string, AttendanceStatus> = {};
    for (const s of data.students) {
      initial[s.student.id] = s.status;
    }
    setDraft(initial);
    setRescheduleDate(data.session.scheduledDate);
    setRescheduleTime(data.session.timeLabel);
    setRescheduleNote(data.session.rescheduleNote);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const allowedStatuses =
    detail?.role === "owner" || detail?.role === "staff"
      ? ATTENDANCE_STATUSES
      : TUTOR_STATUSES;

  async function saveAttendance() {
    if (!detail) return;
    setSaving(true);
    setError("");
    const updates = Object.entries(draft).map(([studentId, status]) => ({
      studentId,
      status,
    }));
    const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Save failed");
      return;
    }
    load();
  }

  async function scheduleMakeup(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !makeupStudentId || !makeupDate) return;
    setSaving(true);
    const res = await fetch("/api/sessions/makeup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: detail.class.id,
        studentId: makeupStudentId,
        makeupDate,
        note: makeupNote,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Makeup failed");
      return;
    }
    alert("Makeup scheduled.");
    setMakeupStudentId("");
    setMakeupDate("");
    setMakeupNote("");
    load();
  }

  async function rescheduleSession(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleDate) return;
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
      setError(data.error ?? "Reschedule failed");
      return;
    }
    alert("Session rescheduled.");
    load();
  }

  if (error && !detail) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!detail) {
    return <p className="text-sm text-zinc-500">Loading session…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-semibold text-zinc-900">{detail.class.label}</p>
        <p className="text-sm text-zinc-600">
          {detail.session.scheduledDate} · {detail.session.timeLabel || detail.class.time}{" "}
          · {detail.class.tutor}
        </p>
        <Link
          href={detail.role === "tutor" ? "/attendance/tutor" : "/attendance"}
          className="mt-2 inline-block text-sm text-orange-700 hover:underline"
        >
          ← Back
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
        {detail.students.map((row) => (
          <li key={row.student.id} className="px-4 py-3">
            <p className="font-medium text-zinc-900">{row.student.name}</p>
            {row.makeupNote && (
              <p className="text-xs text-amber-800">{row.makeupNote}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {allowedStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, [row.student.id]: status }))
                  }
                  className={
                    draft[row.student.id] === status
                      ? "rounded-full bg-orange-600 px-2.5 py-1 text-xs font-medium text-white"
                      : "rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-200"
                  }
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={saveAttendance}
        disabled={saving}
        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save attendance"}
      </button>

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
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={rescheduleTime}
            onChange={(e) => setRescheduleTime(e.target.value)}
            placeholder="Time label"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={rescheduleNote}
            onChange={(e) => setRescheduleNote(e.target.value)}
            placeholder="Note"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-1"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Reschedule session
        </button>
      </form>

      {(detail.role === "owner" || detail.role === "staff") && (
        <form
          onSubmit={scheduleMakeup}
          className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"
        >
          <h2 className="text-sm font-semibold text-amber-950">
            Schedule makeup
          </h2>
          <p className="mt-1 text-xs text-amber-900/80">
            Creates or uses a session on the makeup date with M/U scheduled.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={makeupStudentId}
              onChange={(e) => setMakeupStudentId(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Student</option>
              {detail.students.map((s) => (
                <option key={s.student.id} value={s.student.id}>
                  {s.student.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={makeupDate}
              onChange={(e) => setMakeupDate(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={makeupNote}
              onChange={(e) => setMakeupNote(e.target.value)}
              placeholder="Note (optional, e.g. MU on 05/06)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900"
          >
            Schedule makeup
          </button>
        </form>
      )}
    </div>
  );
}
