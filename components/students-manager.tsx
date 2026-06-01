"use client";

import { ContactFields } from "@/components/contact-fields";
import {
  emptySiblingGroup,
  SiblingGroupPicker,
  siblingPayloadFromValue,
  type SiblingGroupValue,
} from "@/components/sibling-group-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StudentsRosterTable } from "@/components/students-roster-table";
import { StudentsWithdrawnTable } from "@/components/students-withdrawn-table";
import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import type { ContactType } from "@/lib/contacts";
import type { StudentRosterItem } from "@/lib/students/roster";
import { useCallback, useEffect, useState } from "react";

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
  startDate: "",
  notes: "",
  classId: "",
  registrationFeeDue: false,
};

export default function StudentsManager() {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [reinstateTarget, setReinstateTarget] = useState<{
    enrollmentId: string;
    studentName: string;
    classLabel: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [siblingGroup, setSiblingGroup] = useState<SiblingGroupValue>(
    emptySiblingGroup,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const sRes = await fetch(
      `/api/students?withdrawn=${showWithdrawn ? "1" : "0"}`,
    );
    if (!sRes.ok) {
      setError("Failed to load students");
      setLoading(false);
      return;
    }
    const sData = (await sRes.json()) as { students: StudentRosterItem[] };
    setStudents(sData.students);
    setLoading(false);
  }, [showWithdrawn]);

  const loadClasses = useCallback(async () => {
    const cRes = await fetch("/api/classes");
    if (cRes.ok) {
      const cData = (await cRes.json()) as { classes: Klass[] };
      setClasses(cData.classes);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showRegister) loadClasses();
  }, [showRegister, loadClasses]);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    let res: Response;
    try {
      res = await fetch("/api/students", {
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
          startDate: form.startDate || null,
          notes: form.notes,
          classId: form.classId || undefined,
          registrationFeeDue: form.registrationFeeDue,
          ...siblingPayloadFromValue(siblingGroup),
        }),
      });
    } catch {
      setSaving(false);
      setError("Network error — student was not saved. Check your connection.");
      return;
    }
    setSaving(false);

    let data: { error?: string; student?: { name: string } } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      setError(
        res.ok
          ? "Saved but server returned an invalid response."
          : `Save failed (${res.status}). Is DATABASE_URL set?`,
      );
      return;
    }

    if (!res.ok) {
      setError(
        data.error ??
          `Save failed (${res.status}). Nothing was stored — fix the error and try again.`,
      );
      return;
    }

    const savedName = data.student?.name ?? form.name;
    setForm(emptyForm);
    setSiblingGroup(emptySiblingGroup);
    setShowRegister(false);
    await load();
    setSuccess(`Saved ${savedName} to the database.`);
  }

  async function confirmReinstate() {
    if (!reinstateTarget) return;
    const target = reinstateTarget;
    const res = await fetch(`/api/enrollments/${target.enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reinstate: true }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not restore enrollment.");
      setReinstateTarget(null);
      return;
    }
    setReinstateTarget(null);
    setShowWithdrawn(false);
    setSuccess(`${target.studentName} is back in ${target.classLabel}.`);
    load();
  }

  async function archiveStudent(id: string) {
    if (!confirm("Archive this student? History is kept.")) return;
    await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    load();
  }

  async function confirmDeleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    const res = await fetch(`/api/students/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not delete student.");
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setSuccess(`${deleteTarget.name} and all related records were permanently deleted.`);
    load();
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-800">
            {showWithdrawn ? "Withdrawn enrollments" : "Active students"} (
            {students.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={showWithdrawn}
                onChange={(e) => setShowWithdrawn(e.target.checked)}
              />
              Show withdrawn
            </label>
            <button
              type="button"
              onClick={() => {
                setShowRegister((open) => !open);
                setError("");
              }}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              {showRegister ? "Close" : "+ Register student"}
            </button>
          </div>
        </div>

        {success && (
          <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            {success}
          </p>
        )}
        {error && (
          <p
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
            role="alert"
          >
            {error}
          </p>
        )}

        {showRegister && (
          <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-800">
              Register full-time student
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              For free trials, use{" "}
              <a
                href="/trials"
                className="font-medium text-orange-700 hover:underline"
              >
                Free trials
              </a>{" "}
              instead — convert here only after they enroll.
            </p>
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
              setForm((f) => ({
                ...f,
                secondaryContactType: v,
              }))
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
            <span className="font-medium text-zinc-700">Start date</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Class (optional)</span>
            <select
              value={form.classId}
              onChange={(e) =>
                setForm((f) => ({ ...f, classId: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">— Select later —</option>
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
              checked={form.registrationFeeDue}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  registrationFeeDue: e.target.checked,
                }))
              }
            />
            Registration fee due
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>

          <SiblingGroupPicker
            value={siblingGroup}
            onChange={setSiblingGroup}
            students={students}
          />

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60 sm:col-span-2 sm:w-fit"
              >
                {saving ? "Saving…" : "Add student"}
              </button>
            </form>
          </section>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : showWithdrawn ? (
          <StudentsWithdrawnTable
            students={students}
            onReinstate={(enrollmentId, studentName, classLabel) =>
              setReinstateTarget({ enrollmentId, studentName, classLabel })
            }
          />
        ) : (
          <StudentsRosterTable
            students={students}
            allStudents={students.filter((s) => !s.archivedAt)}
            showArchived={false}
            onArchive={archiveStudent}
            onDeleteRequest={(id, name) => setDeleteTarget({ id, name })}
            onSiblingSaved={load}
            onError={setError}
            onSuccess={setSuccess}
          />
        )}
      </section>

      <ConfirmDialog
        open={reinstateTarget !== null}
        title="Undo withdrawal?"
        message={
          reinstateTarget
            ? `Put ${reinstateTarget.studentName} back in ${reinstateTarget.classLabel}? They will appear on class sessions again from their start date.`
            : ""
        }
        confirmLabel="Undo withdraw"
        onConfirm={confirmReinstate}
        onCancel={() => setReinstateTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete student permanently?"
        destructive
        confirmLabel={deleting ? "Deleting…" : "Delete all records"}
        message={
          deleteTarget ? (
            <>
              <p>
                This permanently removes <strong>{deleteTarget.name}</strong> and
                cannot be undone. All related data is deleted, including:
              </p>
              <ul className="list-inside list-disc space-y-0.5 pl-1">
                <li>Active and past class enrollments</li>
                <li>Attendance and makeup records</li>
                <li>Contact details and notes on this student</li>
              </ul>
              <p>
                To withdraw someone from a class but keep their history, use the{" "}
                <a
                  href="/enrollments"
                  className="font-medium text-orange-700 hover:underline"
                >
                  Enrollments
                </a>{" "}
                tab instead — do not delete the student.
              </p>
            </>
          ) : (
            ""
          )
        }
        onConfirm={() => {
          if (!deleting) void confirmDeleteStudent();
        }}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
