"use client";

import { ContactFields } from "@/components/contact-fields";
import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import type { ContactType } from "@/lib/contacts";
import { formatDisplayDate } from "@/lib/dates/display-date";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

type Programme = {
  id: string;
  name: string;
  isActive: boolean;
};

type Session = {
  id: string;
  scheduledDate: string;
  timeLabel: string;
  tutorName: string;
  notes: string;
};

type Participant = {
  id: string;
  studentId: string | null;
  studentName?: string | null;
  name: string;
  primaryContact: string;
  primaryContactType: ContactType | null;
  secondaryContact: string;
  secondaryContactType: ContactType | null;
  level: string;
  school: string;
  parentName: string;
  notes: string;
  fee: string;
  feePaid: boolean;
  status: string;
  convertedStudentId: string | null;
};


type Klass = {
  id: string;
  label: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
};

type Student = { id: string; name: string };

const LEVEL_OPTIONS = [
  { value: "p5", label: "P5" },
  { value: "p6", label: "P6" },
  { value: "sec1", label: "Sec 1" },
  { value: "sec2", label: "Sec 2" },
  { value: "sec3", label: "Sec 3" },
  { value: "sec4", label: "Sec 4" },
  { value: "jc1", label: "JC 1" },
  { value: "jc2", label: "JC 2" },
];

const emptyLeadForm = {
  firstName: "",
  lastName: "",
  level: "",
  primaryContactType: "parent" as ContactType | "",
  primaryContact: "",
  secondaryContactType: "" as ContactType | "",
  secondaryContact: "",
  school: "",
  parentName: "",
  notes: "",
  fee: "",
};

const emptySessionForm = {
  scheduledDate: "",
  startTime: "",
  endTime: "",
  tutorName: "",
  notes: "",
};

function fmt12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return hhmm;
  const hour = h % 12 || 12;
  const mer = h >= 12 ? "pm" : "am";
  return m ? `${hour}:${String(m).padStart(2, "0")}${mer}` : `${hour}${mer}`;
}

function combineTimeLabel(start: string, end: string): string {
  if (!start && !end) return "";
  if (!end) return fmt12h(start);
  if (!start) return fmt12h(end);
  return `${fmt12h(start)} – ${fmt12h(end)}`;
}


export default function ProgrammeDetail({ programmeId }: { programmeId: string }) {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionForm, setEditSessionForm] = useState(emptySessionForm);

  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [addMode, setAddMode] = useState<"lead" | "student">("lead");
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [participantFee, setParticipantFee] = useState("");

  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState({ startDate: "", classId: "", registrationFeeDue: false });

  const [editFeeId, setEditFeeId] = useState<string | null>(null);
  const [editFeeValue, setEditFeeValue] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tutorOptions = useMemo(() => {
    const names = new Set(classes.map((c) => c.tutor.trim()).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }, [classes]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/programmes/${programmeId}`),
      fetch("/api/students"),
    ]);
    if (!pRes.ok) {
      setError("Failed to load programme.");
      setLoading(false);
      return;
    }
    const pData = (await pRes.json()) as {
      programme: Programme;
      sessions: Session[];
      participants: Participant[];
    };
    setProgramme(pData.programme);
    setSessions(pData.sessions);
    setParticipants(pData.participants);

    if (sRes.ok) {
      const sData = (await sRes.json()) as { students: Student[] };
      setAllStudents(sData.students);
    }

    setLoading(false);
  }, [programmeId]);

  useEffect(() => {
    load();
    fetch("/api/classes").then((r) => r.ok ? r.json() : { classes: [] }).then((d: { classes: Klass[] }) => setClasses(d.classes));
  }, [load]);

  async function onAddSession(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/programmes/${programmeId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sessionForm,
          timeLabel: combineTimeLabel(sessionForm.startTime, sessionForm.endTime),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to add session.");
        return;
      }
      setSessionForm(emptySessionForm);
      setShowSessionForm(false);
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function onEditSession(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSessionId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/programmes/${programmeId}/sessions/${editingSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editSessionForm,
            timeLabel: combineTimeLabel(editSessionForm.startTime, editSessionForm.endTime),
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to update session.");
        return;
      }
      setEditingSessionId(null);
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(sessionId: string) {
    if (!confirm("Delete this session? All attendance records will be removed.")) return;
    const res = await fetch(`/api/programmes/${programmeId}/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  }

  async function onAddParticipant(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body =
        addMode === "student"
          ? { studentId: selectedStudentId, fee: participantFee }
          : {
              ...leadForm,
              name: `${leadForm.firstName.trim()} ${leadForm.lastName.trim()}`.trim(),
              fee: participantFee,
            };

      const res = await fetch(`/api/programmes/${programmeId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to add participant.");
        return;
      }
      setLeadForm(emptyLeadForm);
      setSelectedStudentId("");
      setParticipantFee("");
      setShowParticipantForm(false);
      setSuccess("Participant added.");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeePaid(p: Participant) {
    const res = await fetch(
      `/api/programmes/${programmeId}/participants/${p.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feePaid: !p.feePaid }),
      },
    );
    if (res.ok) await load();
  }

  async function saveFee(participantId: string) {
    const res = await fetch(
      `/api/programmes/${programmeId}/participants/${participantId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fee: editFeeValue }),
      },
    );
    if (res.ok) {
      setEditFeeId(null);
      await load();
    }
  }

  async function removeParticipant(participantId: string) {
    if (!confirm("Remove this participant?")) return;
    const res = await fetch(
      `/api/programmes/${programmeId}/participants/${participantId}`,
      { method: "DELETE" },
    );
    if (res.ok) await load();
  }

  async function submitConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!convertingId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/programmes/${programmeId}/participants/${convertingId}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(convertForm),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Conversion failed.");
        return;
      }
      setConvertingId(null);
      setConvertForm({ startDate: "", classId: "", registrationFeeDue: false });
      setSuccess("Converted to student.");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const participantName = (p: Participant) =>
    p.studentId ? (p.studentName ?? p.name) : p.name;

  if (loading) return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
  if (!programme)
    return <p className="p-4 text-sm text-red-600">Programme not found.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4">
      {/* Header */}
      <div>
        <Link href="/programmes" className="mb-3 inline-block text-sm text-orange-700 hover:underline">
          ← Programmes
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">{programme.name}</h1>
          {!programme.isActive && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              Archived
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      {/* Sessions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-800">Sessions</h2>
          <button
            type="button"
            onClick={() => {
              setShowSessionForm((v) => !v);
              setEditingSessionId(null);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            + Add session
          </button>
        </div>

        {showSessionForm && (
          <form
            onSubmit={onAddSession}
            className="mb-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Date</span>
                <input
                  type="date"
                  required
                  value={sessionForm.scheduledDate}
                  onChange={(e) =>
                    setSessionForm((f) => ({ ...f, scheduledDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Start time</span>
                <select
                  value={sessionForm.startTime}
                  onChange={(e) =>
                    setSessionForm((f) => ({ ...f, startTime: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">End time</span>
                <select
                  value={sessionForm.endTime}
                  onChange={(e) =>
                    setSessionForm((f) => ({ ...f, endTime: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Tutor</span>
                <select
                  value={sessionForm.tutorName}
                  onChange={(e) =>
                    setSessionForm((f) => ({ ...f, tutorName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select tutor —</option>
                  {tutorOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-zinc-700">Notes</span>
                <input
                  type="text"
                  placeholder="Optional"
                  value={sessionForm.notes}
                  onChange={(e) =>
                    setSessionForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add session"}
              </button>
              <button
                type="button"
                onClick={() => setShowSessionForm(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No sessions yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {sessions.map((s) => (
              <li key={s.id}>
                {editingSessionId === s.id ? (
                  <form onSubmit={onEditSession} className="px-4 py-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700">Date</span>
                        <input
                          type="date"
                          required
                          value={editSessionForm.scheduledDate}
                          onChange={(e) =>
                            setEditSessionForm((f) => ({ ...f, scheduledDate: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700">Start time</span>
                        <select
                          value={editSessionForm.startTime}
                          onChange={(e) =>
                            setEditSessionForm((f) => ({ ...f, startTime: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        >
                          <option value="">— Select —</option>
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700">End time</span>
                        <select
                          value={editSessionForm.endTime}
                          onChange={(e) =>
                            setEditSessionForm((f) => ({ ...f, endTime: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        >
                          <option value="">— Select —</option>
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700">Tutor</span>
                        <select
                          value={editSessionForm.tutorName}
                          onChange={(e) =>
                            setEditSessionForm((f) => ({ ...f, tutorName: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        >
                          <option value="">— Select tutor —</option>
                          {tutorOptions.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="font-medium text-zinc-700">Notes</span>
                        <input
                          type="text"
                          value={editSessionForm.notes}
                          onChange={(e) =>
                            setEditSessionForm((f) => ({ ...f, notes: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSessionId(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center">
                    <Link
                      href={`/attendance/hol-session/${s.id}`}
                      className="flex flex-1 items-center gap-3 px-4 py-3 hover:bg-zinc-50"
                    >
                      <div className="min-w-0 flex-1 text-sm">
                        <span className="font-medium text-zinc-900">
                          {formatDisplayDate(s.scheduledDate)}
                        </span>
                        {s.timeLabel && (
                          <span className="ml-2 text-zinc-500">{s.timeLabel}</span>
                        )}
                        {s.tutorName && (
                          <span className="ml-2 text-zinc-500">· {s.tutorName}</span>
                        )}
                        {s.notes && (
                          <span className="ml-2 text-zinc-400 italic">{s.notes}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-zinc-400">→</span>
                    </Link>
                    <div className="flex shrink-0 gap-3 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSessionId(s.id);
                          const [st, et] = s.timeLabel.split("–").map((x) => x.trim());
                          setEditSessionForm({
                            scheduledDate: s.scheduledDate,
                            startTime: st ?? "",
                            endTime: et ?? "",
                            tutorName: s.tutorName,
                            notes: s.notes,
                          });
                          setShowSessionForm(false);
                        }}
                        className="text-xs text-zinc-400 hover:text-zinc-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSession(s.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Participants */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-800">Participants</h2>
          <button
            type="button"
            onClick={() => {
              setShowParticipantForm((v) => !v);
              setConvertingId(null);
              setError("");
              setSuccess("");
            }}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            + Add participant
          </button>
        </div>

        {showParticipantForm && (
          <form
            onSubmit={onAddParticipant}
            className="mb-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAddMode("lead")}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${addMode === "lead" ? "bg-sky-700 text-white" : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
              >
                New lead
              </button>
              <button
                type="button"
                onClick={() => setAddMode("student")}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${addMode === "student" ? "bg-sky-700 text-white" : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
              >
                Existing student
              </button>
            </div>

            {addMode === "lead" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">First name</span>
                  <input
                    type="text"
                    required
                    value={leadForm.firstName}
                    onChange={(e) => setLeadForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Last name</span>
                  <input
                    type="text"
                    value={leadForm.lastName}
                    onChange={(e) => setLeadForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Level</span>
                  <select
                    value={leadForm.level}
                    onChange={(e) => setLeadForm((f) => ({ ...f, level: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Select level —</option>
                    {LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">School</span>
                  <input
                    type="text"
                    value={leadForm.school}
                    onChange={(e) => setLeadForm((f) => ({ ...f, school: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Parent name</span>
                  <input
                    type="text"
                    value={leadForm.parentName}
                    onChange={(e) => setLeadForm((f) => ({ ...f, parentName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Fee (leave blank if free)</span>
                  <input
                    type="text"
                    placeholder="e.g. 150"
                    value={participantFee}
                    onChange={(e) => setParticipantFee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <ContactFields
                  prefix="Primary"
                  typeLabel="Primary contact type"
                  typeValue={leadForm.primaryContactType}
                  numberValue={leadForm.primaryContact}
                  onTypeChange={(v) => setLeadForm((f) => ({ ...f, primaryContactType: v }))}
                  onNumberChange={(v) => setLeadForm((f) => ({ ...f, primaryContact: v }))}
                />
                <ContactFields
                  prefix="Secondary"
                  typeLabel="Secondary contact type"
                  typeValue={leadForm.secondaryContactType}
                  numberValue={leadForm.secondaryContact}
                  onTypeChange={(v) => setLeadForm((f) => ({ ...f, secondaryContactType: v }))}
                  onNumberChange={(v) => setLeadForm((f) => ({ ...f, secondaryContact: v }))}
                />
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-zinc-700">Notes</span>
                  <input
                    type="text"
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm((f) => ({ ...f, notes: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-zinc-700">Student</span>
                  <select
                    required
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Select student —</option>
                    {allStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-700">Fee (leave blank if free)</span>
                  <input
                    type="text"
                    placeholder="e.g. 150"
                    value={participantFee}
                    onChange={(e) => setParticipantFee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add participant"}
              </button>
              <button
                type="button"
                onClick={() => setShowParticipantForm(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {participants.length === 0 ? (
          <p className="text-sm text-zinc-500">No participants yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {participants.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    className="font-medium text-zinc-900 hover:text-orange-700 flex items-center gap-1"
                  >
                    <span className={`text-xs text-zinc-400 transition-transform ${expandedId === p.id ? "rotate-90" : ""}`}>▶</span>
                    {participantName(p)}
                  </button>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                    {p.studentId ? "Student" : "Lead"}
                  </span>
                  {p.level && (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                      {LEVEL_OPTIONS.find((o) => o.value === p.level)?.label ?? p.level}
                    </span>
                  )}

                  {/* Fee */}
                  {editFeeId === p.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editFeeValue}
                        onChange={(e) => setEditFeeValue(e.target.value)}
                        placeholder="Fee"
                        className="w-20 rounded border border-zinc-300 px-2 py-0.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveFee(p.id)}
                        className="text-xs text-sky-700 hover:text-sky-900"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditFeeId(null)}
                        className="text-xs text-zinc-400 hover:text-zinc-600"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditFeeId(p.id);
                        setEditFeeValue(p.fee);
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-800"
                    >
                      {p.fee ? `$${p.fee}` : "Free"}
                    </button>
                  )}


                  {/* Convert */}
                  {!p.studentId && p.status === "active" && (
                    <button
                      type="button"
                      onClick={() => {
                        setConvertingId(convertingId === p.id ? null : p.id);
                        setConvertForm({ startDate: "", classId: "", registrationFeeDue: false });
                      }}
                      className="text-xs text-orange-600 hover:text-orange-800"
                    >
                      Convert to student
                    </button>
                  )}
                  {p.status === "converted" && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Converted
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeParticipant(p.id)}
                    className="ml-auto text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>

                {/* Expanded details */}
                {expandedId === p.id && (
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-xs sm:grid-cols-3">
                    {p.school && (
                      <div>
                        <span className="font-medium text-zinc-500">School</span>
                        <p className="text-zinc-800">{p.school}</p>
                      </div>
                    )}
                    {p.primaryContact && (
                      <div>
                        <span className="font-medium text-zinc-500">Primary Contact</span>
                        <p className="text-zinc-800">{p.primaryContact}</p>
                        {p.primaryContactType && (
                          <p className="text-zinc-400">{p.primaryContactType.charAt(0).toUpperCase() + p.primaryContactType.slice(1)}</p>
                        )}
                      </div>
                    )}
                    {p.secondaryContact && (
                      <div>
                        <span className="font-medium text-zinc-500">Secondary Contact</span>
                        <p className="text-zinc-800">{p.secondaryContact}</p>
                        {p.secondaryContactType && (
                          <p className="text-zinc-400">{p.secondaryContactType.charAt(0).toUpperCase() + p.secondaryContactType.slice(1)}</p>
                        )}
                      </div>
                    )}
                    {p.parentName && (
                      <div>
                        <span className="font-medium text-zinc-500">Parent Name</span>
                        <p className="text-zinc-800">{p.parentName}</p>
                      </div>
                    )}
                    {p.notes && (
                      <div>
                        <span className="font-medium text-zinc-500">Notes</span>
                        <p className="text-zinc-800">{p.notes}</p>
                      </div>
                    )}
                    {!p.school && !p.parentName && !p.primaryContact && !p.secondaryContact && !p.notes && (
                      <p className="col-span-2 text-zinc-400 sm:col-span-3">No details recorded.</p>
                    )}
                  </div>
                )}

                {/* Conversion form */}
                {convertingId === p.id && (
                  <form
                    onSubmit={submitConvert}
                    className="mt-2 rounded-lg border border-orange-200 bg-orange-50/50 p-3"
                  >
                    <p className="mb-2 text-xs font-medium text-orange-800">
                      Convert {participantName(p)} to a regular student
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700">Start date</span>
                        <input
                          type="date"
                          value={convertForm.startDate}
                          onChange={(e) =>
                            setConvertForm((f) => ({ ...f, startDate: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-zinc-700">Class (optional)</span>
                        <select
                          value={convertForm.classId}
                          onChange={(e) =>
                            setConvertForm((f) => ({ ...f, classId: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        >
                          <option value="">— No class yet —</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {formatClassDropdownLabel(c)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-sm pt-6">
                        <input
                          type="checkbox"
                          checked={convertForm.registrationFeeDue}
                          onChange={(e) =>
                            setConvertForm((f) => ({ ...f, registrationFeeDue: e.target.checked }))
                          }
                        />
                        <span className="text-zinc-700">Reg. fee due</span>
                      </label>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                      >
                        {saving ? "Converting…" : "Confirm enroll"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConvertingId(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
