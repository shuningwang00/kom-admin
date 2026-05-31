"use client";

import {
  OTHER_TUTOR_VALUE,
  RELIEF_TUTOR_NEEDED_VALUE,
  tutorOptionsExcludingRegular,
} from "@/lib/tutors/constants";
import { initReliefTutorForm } from "@/lib/tutors/relief-form";
import { reliefTutorSavedLabel } from "@/lib/tutors/display";
import { useEffect, useState } from "react";

export function ReliefTutorField({
  regularTutor,
  reliefTutor,
  onSave,
  disabled,
}: {
  regularTutor: string;
  reliefTutor: string;
  onSave: (reliefTutor: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [tutors, setTutors] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [choice, setChoice] = useState("");
  const [otherText, setOtherText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingRelief, setEditingRelief] = useState(true);

  useEffect(() => {
    if (reliefTutor.trim()) setEditingRelief(false);
  }, []);

  useEffect(() => {
    fetch("/api/tutors/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setTutors((data?.tutors as string[] | undefined) ?? []);
      })
      .finally(() => setLoadingOptions(false));
  }, []);

  useEffect(() => {
    if (!editingRelief || loadingOptions) return;
    const init = initReliefTutorForm(reliefTutor, tutors);
    setChoice(init.choice);
    setOtherText(init.other);
  }, [reliefTutor, tutors, loadingOptions, editingRelief]);

  function startEditRelief() {
    const init = initReliefTutorForm(reliefTutor, tutors);
    setChoice(init.choice);
    setOtherText(init.other);
    setEditingRelief(true);
  }

  function canSaveDraft(): boolean {
    if (choice === OTHER_TUTOR_VALUE) return otherText.trim().length > 0;
    return true;
  }

  async function apply() {
    setSaving(true);
    try {
      let relief = "";
      if (choice === RELIEF_TUTOR_NEEDED_VALUE) {
        relief = RELIEF_TUTOR_NEEDED_VALUE;
      } else if (choice === OTHER_TUTOR_VALUE) {
        relief = otherText.trim();
      } else if (choice) {
        relief = choice;
      }
      await onSave(relief);
      setEditingRelief(false);
    } finally {
      setSaving(false);
    }
  }

  const savedLabel = reliefTutorSavedLabel(regularTutor, reliefTutor);

  return (
    <div
      className={`rounded-xl border p-4 ${
        editingRelief
          ? "border-zinc-400 bg-zinc-100"
          : "border-green-200 bg-green-50/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            {editingRelief ? "Relief tutor" : "Relief tutor saved"}
          </h2>
          {editingRelief ? (
            <p className="mt-1 text-xs text-zinc-600">
              Regular tutor: <strong>{regularTutor.trim() || "—"}</strong>. Set a
              relief tutor only when someone else is covering this session.
            </p>
          ) : (
            <p className="mt-1 text-xs text-green-800">
              Covering tutor is saved for this session.
            </p>
          )}
        </div>
        {!editingRelief && (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={startEditRelief}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Edit
          </button>
        )}
      </div>

      {editingRelief ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm">
              <select
                value={choice}
                disabled={disabled || loadingOptions || saving}
                aria-label="Relief tutor"
                onChange={(e) => {
                  const v = e.target.value;
                  setChoice(v);
                  if (v !== OTHER_TUTOR_VALUE) setOtherText("");
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Regular tutor —</option>
                <option value={RELIEF_TUTOR_NEEDED_VALUE}>
                  Relief tutor needed
                </option>
                {tutorOptionsExcludingRegular(tutors, regularTutor).map(
                  (name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ),
                )}
                <option value={OTHER_TUTOR_VALUE}>
                  Others, please specify:
                </option>
              </select>
            </label>
            <button
              type="button"
              disabled={disabled || saving || !canSaveDraft()}
              onClick={() => void apply()}
              className="shrink-0 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save relief tutor"}
            </button>
          </div>
          {choice === OTHER_TUTOR_VALUE && (
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Name</span>
              <input
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Relief tutor name"
                disabled={disabled || saving}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-zinc-900">{savedLabel}</p>
      )}
    </div>
  );
}
