"use client";

import { useCallback, useEffect, useState } from "react";

type TimeOffEntry = {
  ids: string[];
  startDate: string;
  endDate: string;
  reason: string;
  personEmail: string;
  personLabel: string;
};

type PersonOption = {
  email: string;
  displayName: string;
  role?: "staff" | "tutor" | "staff_tutor";
};

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function roleLabel(role: PersonOption["role"]): string {
  if (role === "staff_tutor") return "Staff & tutor";
  if (role === "tutor") return "Tutor";
  if (role === "staff") return "Staff";
  return "";
}

function optionLabel(person: PersonOption): string {
  const name = person.displayName.trim() || person.email;
  const role = roleLabel(person.role);
  return role ? `${name} (${role})` : name;
}

export default function TimeOffSection() {
  const [entries, setEntries] = useState<TimeOffEntry[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [addPersonEmail, setAddPersonEmail] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [myEmail, setMyEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<TimeOffEntry | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/time-off");
    const json = (await res.json()) as {
      entries?: TimeOffEntry[];
      people?: PersonOption[];
      error?: string;
    };
    if (!res.ok) throw new Error(json.error ?? "Failed to load");
    setEntries(json.entries ?? []);
    if (json.people?.length) setPeople(json.people);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        setIsOwner(Boolean(me?.isOwner));
        setMyEmail(me?.user?.email?.trim().toLowerCase() ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    load().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load"),
    );
  }, [loading, load]);

  function canManage(entry: TimeOffEntry): boolean {
    return isOwner || entry.personEmail === myEmail;
  }

  function startEdit(entry: TimeOffEntry) {
    setEditing(entry);
    setEditStart(entry.startDate);
    setEditEnd(entry.endDate);
    setEditReason(entry.reason);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setEditStart("");
    setEditEnd("");
    setEditReason("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (isOwner && !addPersonEmail) {
      setError("Select a team member.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          reason,
          ...(isOwner ? { personEmail: addPersonEmail } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await load();
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/time-off/${encodeURIComponent(editing.ids.join(","))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: editStart,
            endDate: editEnd,
            reason: editReason,
          }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: TimeOffEntry) {
    if (!confirm("Remove this time off?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/time-off/${encodeURIComponent(entry.ids.join(","))}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed");
      }
      if (editing?.ids.join(",") === entry.ids.join(",")) cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-8 text-sm text-zinc-400">Loading…</p>;
  }

  const showAddForm = isOwner ? Boolean(addPersonEmail) : Boolean(myEmail);
  const logEntries = isOwner
    ? entries
    : entries.filter((e) => e.personEmail === myEmail || !e.personEmail);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900">Time off</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {isOwner
          ? "Log when a team member is away. Lessons may need relief on the calendar; admin-duty availability is blocked for those dates."
          : "Log when you are away. Lessons may need relief on the calendar; admin-duty availability is blocked for those dates."}
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-5 rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
        <h3 className="text-sm font-medium text-zinc-800">Add time off</h3>

        {isOwner && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-600">
              Team member
            </label>
            <select
              value={addPersonEmail}
              onChange={(e) => setAddPersonEmail(e.target.value)}
              className="mt-1 min-w-[16rem] rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {people.map((p) => (
                <option key={p.email} value={p.email}>
                  {optionLabel(p)}
                </option>
              ))}
            </select>
          </div>
        )}

        {showAddForm ? (
          <form
            onSubmit={handleAdd}
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                Start{" "}
                <span className="font-normal text-zinc-400">(inclusive)</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                End{" "}
                <span className="font-normal text-zinc-400">(inclusive)</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-zinc-600">
                Reason
              </label>
              <input
                type="text"
                placeholder="e.g. overseas trip, exams"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add"}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            {isOwner
              ? "Select a team member to add time off."
              : "Unable to load your account."}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-zinc-800">
          {isOwner ? "Time off log (everyone)" : "Your time off"}
        </h3>

        {logEntries.length > 0 ? (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {logEntries.map((entry) => {
              const isEditing =
                editing?.ids.join(",") === entry.ids.join(",");
              return (
                <li key={entry.ids.join(",")} className="px-4 py-3 text-sm">
                  {isEditing ? (
                    <form onSubmit={handleSaveEdit} className="grid gap-3">
                      {isOwner && (
                        <p className="font-medium text-zinc-800">
                          {entry.personLabel}
                        </p>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs text-zinc-600">
                            Start
                          </label>
                          <input
                            type="date"
                            required
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-600">
                            End
                          </label>
                          <input
                            type="date"
                            required
                            value={editEnd}
                            min={editStart}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600">
                          Reason
                        </label>
                        <input
                          type="text"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={cancelEdit}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        {isOwner && (
                          <>
                            <span className="font-medium text-zinc-900">
                              {entry.personLabel}
                            </span>
                            <span className="mx-2 text-zinc-400">·</span>
                          </>
                        )}
                        {isoToDisplay(entry.startDate)}
                        {entry.startDate !== entry.endDate &&
                          ` – ${isoToDisplay(entry.endDate)}`}
                        {entry.reason && (
                          <span className="text-zinc-500">
                            {" "}
                            · {entry.reason}
                          </span>
                        )}
                      </div>
                      {canManage(entry) && (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => startEdit(entry)}
                            className="text-xs text-orange-700 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleDelete(entry)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">No time off logged yet.</p>
        )}
      </div>
    </section>
  );
}
