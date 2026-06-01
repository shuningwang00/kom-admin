"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  statusButtonClassName,
} from "@/lib/attendance/status-ui";
import type { AttendanceStatus } from "@/lib/attendance/status";

type HolAttendanceStatus = "present" | "absent_notified" | "waive" | "absent_pending";

const HOL_MARKING_STATUSES: HolAttendanceStatus[] = [
  "present",
  "absent_notified",
  "waive",
];

function holStatusLabel(status: HolAttendanceStatus): string {
  if (status === "present") return "Present";
  if (status === "absent_notified") return "Absent";
  if (status === "waive") return "Waive";
  return "Unmarked";
}

function holStatusButtonClassName(status: HolAttendanceStatus, selected: boolean): string {
  // Absent maps to absent_notified but should render red like absent_pending
  const styleKey = status === "absent_notified" ? "absent_pending" : status;
  return statusButtonClassName(styleKey as AttendanceStatus, selected);
}

type ParticipantRow = {
  id: string;
  studentId?: string | null;
  name: string;
  fee: string;
  feePaid: boolean;
  attendanceStatus: HolAttendanceStatus;
  attendanceSaved: boolean;
};

type HolSessionDetail = {
  session: {
    id: string;
    programmeId: string;
    scheduledDate: string;
    timeLabel: string;
    tutorName: string;
    notes: string;
  };
  programme: { id: string; name: string };
  participants: ParticipantRow[];
};

export default function HolSessionAttendancePanel({
  sessionId,
}: {
  sessionId: string;
}) {
  const [detail, setDetail] = useState<HolSessionDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, HolAttendanceStatus>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/hol-sessions/${sessionId}`);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as HolSessionDetail;
    setDetail(data);
    setDraft({});
    setEditingIds(new Set());
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(p: ParticipantRow) {
    setEditingIds((prev) => new Set(prev).add(p.id));
    setDraft((d) => ({ ...d, [p.id]: p.attendanceStatus }));
    setSuccess("");
  }

  function cancelEdit(p: ParticipantRow) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(p.id);
      return next;
    });
    setDraft((d) => {
      const next = { ...d };
      delete next[p.id];
      return next;
    });
  }

  async function saveAttendance() {
    if (!detail) return;
    setSaving(true);
    setError("");
    // Only save participants explicitly marked in draft — leave others as "to mark"
    const toSave = detail.participants.filter((p) => draft[p.id] !== undefined);
    if (toSave.length === 0) {
      setSaving(false);
      return;
    }
    const updates = toSave.map((p) => ({
      participantId: p.id,
      status: draft[p.id],
    }));
    const res = await fetch(`/api/hol-sessions/${sessionId}/attendance`, {
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
    setSuccess("Attendance saved.");
    await load();
  }

  if (error && !detail) return <p className="text-sm text-red-600">{error}</p>;
  if (!detail) return <p className="text-sm text-zinc-500">Loading…</p>;

  const pendingRows = detail.participants.filter(
    (p) => !p.attendanceSaved || p.attendanceStatus === "absent_pending",
  );
  const allSaved =
    detail.participants.length > 0 &&
    pendingRows.length === 0 &&
    editingIds.size === 0;
  const draftedCount =
    detail.participants.filter((p) => draft[p.id] !== undefined).length;
  const needsSave = draftedCount > 0 || editingIds.size > 0;

  const sortedParticipants = [...detail.participants].sort((a, b) => {
    const aPend = !a.attendanceSaved ? 0 : 1;
    const bPend = !b.attendanceSaved ? 0 : 1;
    if (aPend !== bPend) return aPend - bPend;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-semibold text-zinc-900">
          {detail.programme.name}
        </p>
        <p className="text-sm text-zinc-600">
          {detail.session.scheduledDate}
          {detail.session.timeLabel && ` · ${detail.session.timeLabel}`}
          {detail.session.tutorName && ` · ${detail.session.tutorName}`}
        </p>
        <Link
          href="/attendance"
          className="mt-2 inline-block text-sm text-orange-700 hover:underline"
        >
          ← Back
        </Link>
      </div>

      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
          {success}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {detail.participants.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600 shadow-sm">
          No participants added to this programme yet.
        </p>
      ) : (
        <div
          className={`rounded-xl border bg-white shadow-sm ${
            allSaved ? "border-green-200" : "border-zinc-200"
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
                {allSaved ? "Attendance saved" : "Attendance"}
              </h2>
              {allSaved ? (
                <p className="mt-0.5 text-xs text-green-800">
                  All participants saved. Use Edit on a row to change a status.
                </p>
              ) : pendingRows.length > 0 ? (
                <p className="mt-0.5 text-xs text-amber-900">
                  {pendingRows.length} still to mark. Saved participants show
                  their status — use Edit to change.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-zinc-600">
                  Save or cancel your edits below.
                </p>
              )}
            </div>
            {needsSave && (
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
            {sortedParticipants.map((p) => {
              // absent_pending = never explicitly marked, treat as still needing marking
              const isSaved = p.attendanceSaved && p.attendanceStatus !== "absent_pending";
              const isEditing = editingIds.has(p.id);
              const needsMark = !isSaved;
              const currentStatus = draft[p.id] ?? p.attendanceStatus;

              return (
                <li
                  key={p.id}
                  className={`px-4 py-3 ${
                    needsMark
                      ? "bg-amber-50/25"
                      : isEditing
                        ? "bg-zinc-50/80"
                        : "bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-zinc-900">
                        <span>{p.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.studentId
                              ? "bg-sky-100 text-sky-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {p.studentId ? "Existing" : "New"}
                        </span>
                        {needsMark && (
                          <span className="text-xs font-normal text-amber-900">
                            To mark
                          </span>
                        )}
                      </p>
                    </div>
                    {isSaved && !isEditing && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span
                          className={holStatusButtonClassName(
                            p.attendanceStatus,
                            true,
                          )}
                        >
                          {holStatusLabel(p.attendanceStatus)}
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => startEdit(p)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {(needsMark || isEditing) && (
                    <div
                      className={
                        isSaved
                          ? "mt-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                          : "mt-2"
                      }
                    >
                      <div className="flex flex-wrap gap-1">
                        {HOL_MARKING_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({ ...d, [p.id]: status }))
                            }
                            className={holStatusButtonClassName(
                              status,
                              currentStatus === status,
                            )}
                          >
                            {holStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                      {isSaved && isEditing && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => cancelEdit(p)}
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
      )}
    </div>
  );
}
