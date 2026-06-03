"use client";

import {
  ColumnFilterDropdown,
  passesColumnFilter,
  type ColumnFilterState,
} from "@/components/column-filter-dropdown";
import {
  emptySiblingGroup,
  SiblingGroupPicker,
  siblingPayloadFromValue,
  type SiblingGroupValue,
} from "@/components/sibling-group-picker";
import { ContactFields } from "@/components/contact-fields";
import {
  contactFilterValues,
  formatContactLine,
  primaryContactDisplay,
  secondaryContactDisplay,
  type ContactType,
} from "@/lib/contacts";
import type { StudentRosterItem } from "@/lib/students/roster";
import { rosterStatusBadgeClass } from "@/lib/students/roster-status";
import { Fragment, useMemo, useState } from "react";

type FilterKey =
  | "name"
  | "status"
  | "school"
  | "contact"
  | "level"
  | "classes"
  | "siblings";

type ColumnFilters = Record<FilterKey, ColumnFilterState>;

const emptyColumnFilters = (): ColumnFilters => ({
  name: null,
  status: null,
  school: null,
  contact: null,
  level: null,
  classes: null,
  siblings: null,
});

function siblingsCellValue(s: StudentRosterItem): string {
  if (s.siblingNames.length > 0) return s.siblingNames.join(", ");
  if (s.billingGroupLabel) return `${s.billingGroupLabel} (group)`;
  return "—";
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const text = value?.trim() ? value : "—";
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{text}</dd>
    </div>
  );
}

type StudentEditForm = {
  name: string;
  primaryContactType: ContactType;
  primaryContact: string;
  secondaryContactType: ContactType | "";
  secondaryContact: string;
  school: string;
  parentName: string;
  startDate: string;
  notes: string;
};

function studentToEditForm(s: StudentRosterItem): StudentEditForm {
  return {
    name: s.name,
    primaryContactType: s.primaryContactType ?? "parent",
    primaryContact: s.primaryContact ?? "",
    secondaryContactType: s.secondaryContactType ?? "",
    secondaryContact: s.secondaryContact ?? "",
    school: s.school ?? "",
    parentName: s.parentName ?? "",
    startDate: s.startDate ?? "",
    notes: s.notes ?? "",
  };
}

export function StudentsRosterTable({
  students,
  allStudents,
  showArchived,
  onArchive,
  onDeleteRequest,
  onSiblingSaved,
  onError,
  onSuccess,
}: {
  students: StudentRosterItem[];
  allStudents: StudentRosterItem[];
  showArchived: boolean;
  onArchive: (id: string) => void;
  onDeleteRequest: (id: string, name: string) => void;
  onSiblingSaved: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const [columnFilters, setColumnFilters] =
    useState<ColumnFilters>(emptyColumnFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StudentEditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingSiblingId, setEditingSiblingId] = useState<string | null>(null);
  const [editSiblingGroup, setEditSiblingGroup] =
    useState<SiblingGroupValue>(emptySiblingGroup);

  const cellValues = useMemo(() => {
    const names = new Set<string>();
    const statuses = new Set<string>();
    const schools = new Set<string>();
    const contactOptions = new Set<string>();
    const levels = new Set<string>();
    const classes = new Set<string>();
    const siblings = new Set<string>();

    for (const s of students) {
      names.add(s.name);
      statuses.add(s.rosterStatus);
      schools.add(s.school?.trim() || "—");
      for (const v of contactFilterValues(s)) contactOptions.add(v);
      levels.add(s.levelDisplay);
      classes.add(s.classesEnrolledDisplay);
      siblings.add(siblingsCellValue(s));
    }

    return {
      name: [...names],
      status: [...statuses],
      school: [...schools],
      contact: [...contactOptions],
      level: [...levels],
      classes: [...classes],
      siblings: [...siblings],
    };
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const contactPass =
        columnFilters.contact === null ||
        contactFilterValues(s).some((v) => columnFilters.contact!.has(v));
      return (
        passesColumnFilter(s.name, columnFilters.name) &&
        passesColumnFilter(s.rosterStatus, columnFilters.status) &&
        passesColumnFilter(s.school?.trim() || "—", columnFilters.school) &&
        contactPass &&
        passesColumnFilter(s.levelDisplay, columnFilters.level) &&
        passesColumnFilter(
          s.classesEnrolledDisplay,
          columnFilters.classes,
        ) &&
        passesColumnFilter(siblingsCellValue(s), columnFilters.siblings)
      );
    });
  }, [students, columnFilters]);

  function setFilter(key: FilterKey, value: ColumnFilterState) {
    setColumnFilters((f) => ({ ...f, [key]: value }));
  }

  function clearAllFilters() {
    setColumnFilters(emptyColumnFilters());
  }

  const hasFilters = Object.values(columnFilters).some((v) => v !== null);

  function clearStudentEdit() {
    setEditingStudentId(null);
    setEditForm(null);
  }

  function clearSiblingEdit() {
    setEditingSiblingId(null);
    setEditSiblingGroup(emptySiblingGroup);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    if (editingSiblingId && editingSiblingId !== id) clearSiblingEdit();
    if (editingStudentId && editingStudentId !== id) clearStudentEdit();
  }

  function startEditStudent(s: StudentRosterItem) {
    clearSiblingEdit();
    setEditingStudentId(s.id);
    setEditForm(studentToEditForm(s));
    setExpandedId(s.id);
  }

  async function saveEditStudent(studentId: string) {
    if (!editForm) return;
    const name = editForm.name.trim();
    if (!name) {
      onError("Name is required.");
      return;
    }
    setSavingEdit(true);
    const res = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        primaryContact: editForm.primaryContact,
        primaryContactType: editForm.primaryContactType,
        secondaryContact: editForm.secondaryContact,
        secondaryContactType: editForm.secondaryContactType || null,
        school: editForm.school,
        parentName: editForm.parentName,
        startDate: editForm.startDate || null,
        notes: editForm.notes,
      }),
    });
    setSavingEdit(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      onError(data.error ?? "Could not save student.");
      return;
    }
    clearStudentEdit();
    onSiblingSaved();
    onSuccess(`Saved ${name}.`);
  }

  function startEditSiblings(s: StudentRosterItem) {
    clearStudentEdit();
    setEditingSiblingId(s.id);
    setExpandedId(s.id);
    if (s.billingGroupId) {
      setEditSiblingGroup({
        mode: "existing",
        billingGroupId: s.billingGroupId,
        siblingStudentIds: [],
        billingGroupLabel: s.billingGroupLabel ?? "",
      });
    } else {
      setEditSiblingGroup(emptySiblingGroup);
    }
  }

  async function saveEditSiblings(studentId: string) {
    const payload =
      editSiblingGroup.mode === "none"
        ? { clearBillingGroup: true }
        : siblingPayloadFromValue(editSiblingGroup);
    const res = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      onError(data.error ?? "Could not update sibling group.");
      return;
    }
    setEditingSiblingId(null);
    setEditSiblingGroup(emptySiblingGroup);
    onSiblingSaved();
    onSuccess("Sibling billing group updated.");
  }

  const filterHeaders: Array<{ key: FilterKey; label: string }> = [
    { key: "name", label: "Name" },
    { key: "school", label: "School" },
    { key: "contact", label: "Contact" },
    { key: "level", label: "Level" },
    { key: "classes", label: "Classes enrolled" },
    { key: "siblings", label: "Siblings" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {hasFilters && (
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-600">
            Showing {filtered.length} of {students.length} students (filtered)
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-medium text-orange-700 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-[56rem] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              {filterHeaders.map(({ key, label }) => (
                <th key={key} className="px-3 py-2 align-top">
                  <ColumnFilterDropdown
                    label={label}
                    options={cellValues[key]}
                    selected={columnFilters[key]}
                    onChange={(next) => setFilter(key, next)}
                  />
                </th>
              ))}
              <th className="w-10 px-2 py-2" aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const expanded = expandedId === s.id;
              const siblingsDisplay = siblingsCellValue(s);

              return (
                <Fragment key={s.id}>
                  <tr
                    onClick={() => toggleExpand(s.id)}
                    className={`cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 ${
                      expanded ? "bg-orange-50/60" : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {s.name}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{s.school || "—"}</td>
                    <td className="px-3 py-3 text-zinc-600">
                      <div className="space-y-1 text-xs leading-snug">
                        <p>{primaryContactDisplay(s)}</p>
                        <p>{secondaryContactDisplay(s)}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{s.levelDisplay}</td>
                    <td className="max-w-xs px-3 py-3 text-zinc-600">
                      <span className="line-clamp-2">
                        {s.classesEnrolledDisplay}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{siblingsDisplay}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${rosterStatusBadgeClass(s.rosterStatus)}`}
                      >
                        {s.rosterStatus}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center text-zinc-400">
                      {expanded ? "▾" : "▸"}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-zinc-100 bg-zinc-50/80">
                      <td colSpan={8} className="px-4 py-4">
                        {editingStudentId === s.id && editForm ? (
                          <form
                            className="grid gap-3 sm:grid-cols-2"
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveEditStudent(s.id);
                            }}
                          >
                            <label className="block text-sm sm:col-span-2">
                              <span className="font-medium text-zinc-700">
                                Name *
                              </span>
                              <input
                                required
                                value={editForm.name}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f ? { ...f, name: e.target.value } : f,
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                              />
                            </label>
                            <ContactFields
                              prefix="Primary"
                              typeLabel="Primary contact"
                              typeValue={editForm.primaryContactType}
                              numberValue={editForm.primaryContact}
                              onTypeChange={(v) =>
                                setEditForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        primaryContactType: (v ||
                                          "parent") as ContactType,
                                      }
                                    : f,
                                )
                              }
                              onNumberChange={(v) =>
                                setEditForm((f) =>
                                  f ? { ...f, primaryContact: v } : f,
                                )
                              }
                              required
                            />
                            <ContactFields
                              prefix="Secondary"
                              typeLabel="Secondary contact"
                              typeValue={editForm.secondaryContactType}
                              numberValue={editForm.secondaryContact}
                              onTypeChange={(v) =>
                                setEditForm((f) =>
                                  f
                                    ? { ...f, secondaryContactType: v }
                                    : f,
                                )
                              }
                              onNumberChange={(v) =>
                                setEditForm((f) =>
                                  f ? { ...f, secondaryContact: v } : f,
                                )
                              }
                            />
                            <label className="block text-sm">
                              <span className="font-medium text-zinc-700">
                                School
                              </span>
                              <input
                                value={editForm.school}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f ? { ...f, school: e.target.value } : f,
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                              />
                            </label>
                            <label className="block text-sm">
                              <span className="font-medium text-zinc-700">
                                Parent name (record)
                              </span>
                              <input
                                value={editForm.parentName}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f
                                      ? { ...f, parentName: e.target.value }
                                      : f,
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                              />
                            </label>
                            <label className="block text-sm">
                              <span className="font-medium text-zinc-700">
                                Start date
                              </span>
                              <input
                                type="date"
                                value={editForm.startDate}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f ? { ...f, startDate: e.target.value } : f,
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                              />
                            </label>
                            <label className="block text-sm sm:col-span-2">
                              <span className="font-medium text-zinc-700">
                                Notes
                              </span>
                              <textarea
                                value={editForm.notes}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f ? { ...f, notes: e.target.value } : f,
                                  )
                                }
                                rows={2}
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                              />
                            </label>
                            <p className="text-xs text-zinc-500 sm:col-span-2">
                              Level and classes come from enrollments — change
                              class assignments under Classes.
                            </p>
                            <div className="flex gap-2 sm:col-span-2">
                              <button
                                type="submit"
                                disabled={savingEdit}
                                className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={clearStudentEdit}
                                className="text-sm text-zinc-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <DetailField label="Name" value={s.name} />
                          <DetailField label="School" value={s.school} />
                          <DetailField label="Parent name" value={s.parentName} />
                          <DetailField
                            label="Primary contact"
                            value={formatContactLine(
                              s.primaryContactType,
                              s.primaryContact,
                            )}
                          />
                          <DetailField
                            label="Secondary contact"
                            value={formatContactLine(
                              s.secondaryContactType,
                              s.secondaryContact,
                            )}
                          />
                          <DetailField label="Level" value={s.levelDisplay} />
                          <DetailField
                            label="Start date"
                            value={s.startDate ?? undefined}
                          />
                          <DetailField label="Notes" value={s.notes} />
                          <DetailField
                            label="Sibling billing group"
                            value={s.billingGroupLabel ?? undefined}
                          />
                          <DetailField
                            label="Siblings"
                            value={
                              s.siblingNames.length > 0
                                ? s.siblingNames.join(", ")
                                : undefined
                            }
                          />
                        </dl>
                        )}

                        <div className="mt-4">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                            Classes enrolled
                          </h3>
                          {s.activeEnrollments.length === 0 ? (
                            <p className="mt-1 text-sm text-zinc-500">None</p>
                          ) : (
                            <ul className="mt-2 space-y-2">
                              {s.activeEnrollments.map((e) => (
                                <li
                                  key={e.id}
                                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                                >
                                  <p className="font-medium text-zinc-900">
                                    {e.classLabel}
                                  </p>
                                  <p className="text-xs text-zinc-600">
                                    {e.startedAt
                                      ? `Started ${e.startedAt}`
                                      : "No start date"}
                                    {e.freeTrial && " · Free trial"}
                                    {e.registrationFeeDue &&
                                      " · Registration fee due"}
                                    {e.notes ? ` · ${e.notes}` : ""}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {!showArchived && !s.archivedAt && editingStudentId !== s.id && (
                          <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-200 pt-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditStudent(s);
                              }}
                              className="text-sm font-medium text-orange-700 hover:underline"
                            >
                              Edit student
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditSiblings(s);
                              }}
                              className="text-sm font-medium text-orange-700 hover:underline"
                            >
                              Edit sibling group
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchive(s.id);
                              }}
                              className="text-sm text-zinc-500 hover:text-red-600"
                            >
                              Archive student
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteRequest(s.id, s.name);
                              }}
                              className="text-sm text-red-600 hover:text-red-800"
                            >
                              Delete student…
                            </button>
                          </div>
                        )}

                        {editingSiblingId === s.id && (
                          <div
                            className="mt-4 rounded-lg border border-violet-200 bg-white p-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SiblingGroupPicker
                              value={editSiblingGroup}
                              onChange={setEditSiblingGroup}
                              students={allStudents}
                              excludeStudentId={s.id}
                              compact
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditSiblings(s.id)}
                                className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSiblingId(null);
                                  setEditSiblingGroup(emptySiblingGroup);
                                }}
                                className="text-sm text-zinc-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">
          {hasFilters
            ? "No students match your filters."
            : "No students yet. Register one above."}
        </p>
      )}
    </div>
  );
}
