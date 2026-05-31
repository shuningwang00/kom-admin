"use client";

import { useEffect, useState } from "react";

export type SiblingGroupValue = {
  mode: "none" | "existing" | "new";
  billingGroupId: string;
  siblingStudentIds: string[];
  billingGroupLabel: string;
};

export const emptySiblingGroup: SiblingGroupValue = {
  mode: "none",
  billingGroupId: "",
  siblingStudentIds: [],
  billingGroupLabel: "",
};

type Group = {
  id: string;
  label: string;
  members: Array<{ id: string; name: string }>;
};

type StudentOption = { id: string; name: string };

export function SiblingGroupPicker({
  value,
  onChange,
  students,
  excludeStudentId,
  compact,
}: {
  value: SiblingGroupValue;
  onChange: (v: SiblingGroupValue) => void;
  students: StudentOption[];
  /** When editing one student, hide them from sibling multi-select. */
  excludeStudentId?: string;
  compact?: boolean;
}) {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    fetch("/api/billing-groups")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.groups) setGroups(data.groups as Group[]);
      })
      .catch(() => setGroups([]));
  }, []);

  const pickable = students.filter((s) => s.id !== excludeStudentId);

  function toggleSibling(id: string) {
    const set = new Set(value.siblingStudentIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...value, siblingStudentIds: [...set] });
  }

  const boxClass = compact
    ? "mt-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3"
    : "mt-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 sm:col-span-2";

  return (
    <div className={boxClass}>
      <p className="text-sm font-medium text-zinc-800">Siblings (bill together)</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Same family on one invoice — grouped on Enrollments and Billing.
      </p>

      <div className="mt-3 flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`sibling-mode-${excludeStudentId ?? "new"}`}
            checked={value.mode === "none"}
            onChange={() => onChange(emptySiblingGroup)}
          />
          Not part of a sibling group
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`sibling-mode-${excludeStudentId ?? "new"}`}
            checked={value.mode === "existing"}
            onChange={() =>
              onChange({
                ...emptySiblingGroup,
                mode: "existing",
              })
            }
          />
          Join existing family group
        </label>
        {value.mode === "existing" && (
          <select
            value={value.billingGroupId}
            onChange={(e) =>
              onChange({ ...value, billingGroupId: e.target.value })
            }
            className="ml-6 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2"
            required
          >
            <option value="">Select family…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label || "Family"} (
                {g.members.map((m) => m.name).join(", ")})
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`sibling-mode-${excludeStudentId ?? "new"}`}
            checked={value.mode === "new"}
            onChange={() =>
              onChange({
                ...emptySiblingGroup,
                mode: "new",
              })
            }
          />
          Link with sibling(s)
        </label>
        {value.mode === "new" && (
          <div className="ml-6 space-y-2">
            <p className="text-xs text-zinc-600">
              Select brother/sister already on the roster (pick at least one).
            </p>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2">
              {pickable.length === 0 ? (
                <p className="text-xs text-zinc-500">No other students yet.</p>
              ) : (
                pickable.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={value.siblingStudentIds.includes(s.id)}
                      onChange={() => toggleSibling(s.id)}
                    />
                    {s.name}
                  </label>
                ))
              )}
            </div>
            <label className="block text-sm">
              <span className="text-zinc-600">Family label (optional)</span>
              <input
                value={value.billingGroupLabel}
                onChange={(e) =>
                  onChange({ ...value, billingGroupLabel: e.target.value })
                }
                placeholder="e.g. Ng family"
                className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

export function siblingPayloadFromValue(
  value: SiblingGroupValue,
): Record<string, unknown> {
  if (value.mode === "none") return {};
  if (value.mode === "existing" && value.billingGroupId) {
    return { billingGroupId: value.billingGroupId };
  }
  if (value.mode === "new" && value.siblingStudentIds.length > 0) {
    return {
      siblingStudentIds: value.siblingStudentIds,
      ...(value.billingGroupLabel.trim()
        ? { billingGroupLabel: value.billingGroupLabel.trim() }
        : {}),
    };
  }
  return {};
}
