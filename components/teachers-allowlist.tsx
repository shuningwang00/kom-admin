"use client";

import { useCallback, useEffect, useState } from "react";

type Member = {
  id: string;
  email: string;
  role: "staff" | "tutor" | "staff_tutor";
  displayName: string;
  fullName: string;
  tutorMatch: string;
  isActive: boolean;
};

type OwnerInfo = {
  email: string;
  displayName: string;
  fullName: string;
};

type RoleDraft = { isStaff: boolean; isTutor: boolean };

function draftToRole({ isStaff, isTutor }: RoleDraft): "staff" | "tutor" | "staff_tutor" {
  if (isStaff && isTutor) return "staff_tutor";
  if (isStaff) return "staff";
  return "tutor";
}

function roleToDraft(role: "staff" | "tutor" | "staff_tutor"): RoleDraft {
  return {
    isStaff: role === "staff" || role === "staff_tutor",
    isTutor: role === "tutor" || role === "staff_tutor",
  };
}

function roleLabel({ isStaff, isTutor }: RoleDraft) {
  if (isStaff && isTutor) return "Staff + Tutor";
  if (isStaff) return "Staff";
  return "Tutor";
}

/** Primary name shown in app for a member. */
function primaryName(m: Member) {
  return m.tutorMatch || m.displayName || m.fullName || m.email;
}

function RoleCheckboxes({
  isStaff,
  isTutor,
  onChange,
}: {
  isStaff: boolean;
  isTutor: boolean;
  onChange: (d: RoleDraft) => void;
}) {
  return (
    <div className="flex gap-4 text-sm text-zinc-700">
      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={isStaff}
          onChange={(e) => onChange({ isStaff: e.target.checked, isTutor })}
          className="h-3.5 w-3.5"
        />
        Staff
      </label>
      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={isTutor}
          onChange={(e) => onChange({ isStaff, isTutor: e.target.checked })}
          className="h-3.5 w-3.5"
        />
        Tutor
      </label>
    </div>
  );
}

type EditDraft = {
  email: string;
  displayName: string;
  fullName: string;
  tutorMatch: string;
} & RoleDraft;

type TutorAddDraft = { email: string; fullName: string; isStaff: boolean };

const EMPTY_TUTOR_DRAFT: TutorAddDraft = { email: "", fullName: "", isStaff: false };

const inputCls =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400";

export default function TeamAllowlist() {
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTutors, setActiveTutors] = useState<string[]>([]);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    email: "",
    displayName: "",
    fullName: "",
    tutorMatch: "",
    isStaff: false,
    isTutor: true,
  });

  const [addDrafts, setAddDrafts] = useState<Record<string, TutorAddDraft>>({});

  const [showNewStaff, setShowNewStaff] = useState(false);
  const [staffDraft, setStaffDraft] = useState({
    email: "",
    displayName: "",
    fullName: "",
    isTutor: false,
    tutorMatch: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/teachers");
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Owner access required.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      members: Member[];
      activeTutors: string[];
      owner: OwnerInfo;
    };
    setMembers(data.members ?? []);
    setActiveTutors(data.activeTutors ?? []);
    setOwner(data.owner ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const tutorByMatch = new Map(
    members
      .filter((m) => m.tutorMatch)
      .map((m) => [m.tutorMatch.toUpperCase(), m]),
  );

  const scheduleTutors = activeTutors.map((name) => ({
    name,
    member: tutorByMatch.get(name.toUpperCase()) ?? null,
  }));

  const staffMembers = members.filter((m) => m.role === "staff");

  const orphanedTutors = members.filter(
    (m) =>
      m.tutorMatch &&
      !activeTutors.some((t) => t.toUpperCase() === m.tutorMatch.toUpperCase()),
  );

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function startEdit(m: Member) {
    setEditId(m.id);
    setEditDraft({
      email: m.email,
      displayName: m.displayName,
      fullName: m.fullName,
      tutorMatch: m.tutorMatch,
      ...roleToDraft(m.role),
    });
  }

  function getDraft(name: string): TutorAddDraft {
    return addDrafts[name] ?? EMPTY_TUTOR_DRAFT;
  }

  function patchDraft(name: string, patch: Partial<TutorAddDraft>) {
    setAddDrafts((prev) => ({
      ...prev,
      [name]: { ...(prev[name] ?? EMPTY_TUTOR_DRAFT), ...patch },
    }));
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function saveMember(id: string) {
    setError("");
    const res = await fetch(`/api/admin/teachers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: editDraft.email,
        displayName: editDraft.displayName,
        fullName: editDraft.fullName,
        tutorMatch: editDraft.tutorMatch,
        role: draftToRole(editDraft),
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to save");
      return;
    }
    setEditId(null);
    load();
  }

  async function addTutorFromSchedule(name: string) {
    setError("");
    const draft = getDraft(name);
    const res = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: draft.email,
        fullName: draft.fullName,
        tutorMatch: name,
        role: draft.isStaff ? "staff_tutor" : "tutor",
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to add");
      return;
    }
    setAddDrafts((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    load();
  }

  async function addStaffMember() {
    setError("");
    const res = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: staffDraft.email,
        displayName: staffDraft.displayName,
        fullName: staffDraft.fullName,
        tutorMatch: staffDraft.isTutor ? staffDraft.tutorMatch : "",
        role: staffDraft.isTutor ? "staff_tutor" : "staff",
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to add");
      return;
    }
    setShowNewStaff(false);
    setStaffDraft({ email: "", displayName: "", fullName: "", isTutor: false, tutorMatch: "" });
    load();
  }

  async function toggleActive(m: Member) {
    await fetch(`/api/admin/teachers/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    load();
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this person from the allowlist?")) return;
    await fetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
    load();
  }

  // ── Member row ───────────────────────────────────────────────────────────────
  function renderMemberRow(m: Member) {
    const rd = roleToDraft(m.role);
    // Pure staff (no tutorMatch) show a display name field; tutors use tutorMatch as their name.
    const isPureStaff = !m.tutorMatch;

    if (editId === m.id) {
      const editIsPureStaff = !editDraft.tutorMatch && !editDraft.isTutor;
      return (
        <li key={m.id} className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-zinc-700">
            {primaryName(m)}
          </p>
          <input
            type="email"
            value={editDraft.email}
            onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="Email"
            className={inputCls}
          />
          {editIsPureStaff && (
            <input
              value={editDraft.displayName}
              onChange={(e) => setEditDraft((d) => ({ ...d, displayName: e.target.value }))}
              placeholder="Display name"
              className={inputCls}
            />
          )}
          <input
            value={editDraft.fullName}
            onChange={(e) => setEditDraft((d) => ({ ...d, fullName: e.target.value }))}
            placeholder="Full name"
            className={inputCls}
          />
          <RoleCheckboxes
            isStaff={editDraft.isStaff}
            isTutor={editDraft.isTutor}
            onChange={(rd) => setEditDraft((d) => ({ ...d, ...rd }))}
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => saveMember(m.id)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="text-xs text-zinc-500"
            >
              Cancel
            </button>
          </div>
        </li>
      );
    }

    return (
      <li
        key={m.id}
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
      >
        <div>
          <p className="font-medium text-zinc-900">
            {primaryName(m)}
            {!m.isActive && (
              <span className="ml-2 text-xs font-normal text-amber-700">inactive</span>
            )}
          </p>
          {/* For pure staff show displayName as the primary; fullName is secondary */}
          {isPureStaff && m.displayName && m.fullName && (
            <p className="text-sm text-zinc-500">{m.fullName}</p>
          )}
          {!isPureStaff && m.fullName && (
            <p className="text-sm text-zinc-500">{m.fullName}</p>
          )}
          <p className="text-sm text-zinc-400">{m.email}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{roleLabel(rd)}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => startEdit(m)}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => toggleActive(m)}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            {m.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => removeMember(m.id)}
            className="text-sm text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-600">
        <strong>Staff</strong> — attendance, billing, makeup.{" "}
        <strong>Tutor</strong> — mark attendance for their own classes. A person
        can hold both roles.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ── Owner ── */}
      {owner && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">Owner</h2>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm opacity-60">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium text-zinc-900">
                  {owner.displayName}
                  <span className="ml-2 text-xs font-normal text-zinc-500">Owner</span>
                </p>
                <p className="text-sm text-zinc-500">{owner.fullName}</p>
                <p className="text-sm text-zinc-400">{owner.email}</p>
              </div>
              <span className="text-xs text-zinc-400">not editable here</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Tutors ── */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-zinc-800">Tutors</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Names are pulled from the class schedule. Fill in each tutor&apos;s
          Google account email so they can log in.
        </p>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {scheduleTutors.map(({ name, member }) =>
              member ? (
                renderMemberRow(member)
              ) : (
                <li key={name} className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <span className="font-medium text-zinc-700">{name}</span>
                    <span className="text-xs text-zinc-400">— not set up</span>
                  </div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={getDraft(name).email}
                    onChange={(e) => patchDraft(name, { email: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    placeholder="Full name"
                    value={getDraft(name).fullName}
                    onChange={(e) => patchDraft(name, { fullName: e.target.value })}
                    className={inputCls}
                  />
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={getDraft(name).isStaff}
                      onChange={(e) => patchDraft(name, { isStaff: e.target.checked })}
                      className="h-3.5 w-3.5"
                    />
                    Also staff
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => addTutorFromSchedule(name)}
                      disabled={!getDraft(name).email}
                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </li>
              ),
            )}
            {orphanedTutors.map((m) => renderMemberRow(m))}
            {scheduleTutors.length === 0 && orphanedTutors.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                No classes in the database yet. Go to Classes and sync from Google Sheets to get started.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* ── Staff ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Staff</h2>
            <p className="text-xs text-zinc-500">
              Office staff — all classes, billing, makeup.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewStaff(true)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            + New
          </button>
        </div>

        {showNewStaff && (
          <div className="mb-3 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2">
            <input
              type="email"
              placeholder="Email"
              value={staffDraft.email}
              onChange={(e) => setStaffDraft((d) => ({ ...d, email: e.target.value }))}
              className={inputCls}
            />
            <input
              placeholder="Display name"
              value={staffDraft.displayName}
              onChange={(e) => setStaffDraft((d) => ({ ...d, displayName: e.target.value }))}
              className={inputCls}
            />
            <input
              placeholder="Full name"
              value={staffDraft.fullName}
              onChange={(e) => setStaffDraft((d) => ({ ...d, fullName: e.target.value }))}
              className={inputCls}
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={staffDraft.isTutor}
                onChange={(e) => setStaffDraft((d) => ({ ...d, isTutor: e.target.checked }))}
                className="h-3.5 w-3.5"
              />
              Also a tutor
            </label>
            {staffDraft.isTutor && (
              <input
                placeholder="Schedule name (e.g. JUNYANG)"
                value={staffDraft.tutorMatch}
                onChange={(e) => setStaffDraft((d) => ({ ...d, tutorMatch: e.target.value }))}
                className={inputCls}
              />
            )}
            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="button"
                onClick={addStaffMember}
                disabled={!staffDraft.email}
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewStaff(false);
                  setStaffDraft({ email: "", displayName: "", fullName: "", isTutor: false, tutorMatch: "" });
                }}
                className="text-xs text-zinc-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!loading && (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {staffMembers.map((m) => renderMemberRow(m))}
            {staffMembers.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                No staff members yet. Click &quot;+ New&quot; to add one.
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
