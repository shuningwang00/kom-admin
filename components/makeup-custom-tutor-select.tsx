"use client";

import {
  OTHER_TUTOR_VALUE,
  tutorOptionsExcludingRegular,
} from "@/lib/tutors/constants";
import { initCoveringTutorForm } from "@/lib/tutors/relief-form";
import { useEffect, useState } from "react";

export function MakeupCustomTutorSelect({
  regularTutor,
  reliefTutor,
  onReliefTutorChange,
  hideLabel = false,
  hideClassTutorOption = false,
}: {
  regularTutor: string;
  reliefTutor: string;
  onReliefTutorChange: (relief: string) => void;
  hideLabel?: boolean;
  hideClassTutorOption?: boolean;
}) {
  const [tutors, setTutors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");

  useEffect(() => {
    fetch("/api/tutors/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setTutors((data?.tutors as string[] | undefined) ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const init = initCoveringTutorForm(reliefTutor, tutors);
    setChoice(init.choice);
    setOther(init.other);
  }, [reliefTutor, tutors, loading]);

  function emit(choiceValue: string, otherValue: string) {
    if (!choiceValue) {
      onReliefTutorChange("");
      return;
    }
    if (choiceValue === OTHER_TUTOR_VALUE) {
      onReliefTutorChange(otherValue.trim());
      return;
    }
    onReliefTutorChange(choiceValue);
  }

  return (
    <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        {!hideLabel && <span className="font-medium text-zinc-700">Tutor</span>}
        <select
          value={choice}
          disabled={loading}
          onChange={(e) => {
            const v = e.target.value;
            setChoice(v);
            if (v !== OTHER_TUTOR_VALUE) {
              setOther("");
              emit(v, "");
            }
          }}
          className={`w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm${hideLabel ? "" : " mt-1"}`}
        >
          <option value="">
            {hideClassTutorOption
              ? "— Select relief tutor —"
              : regularTutor.trim()
                ? `${regularTutor.trim()} (class tutor)`
                : "— Class tutor —"}
          </option>
          {tutorOptionsExcludingRegular(tutors, regularTutor).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          <option value={OTHER_TUTOR_VALUE}>Other…</option>
        </select>
      </label>
      {choice === OTHER_TUTOR_VALUE && (
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">Tutor name</span>
          <input
            value={other}
            onChange={(e) => {
              const v = e.target.value;
              setOther(v);
              emit(OTHER_TUTOR_VALUE, v);
            }}
            placeholder="Covering tutor"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      )}
    </div>
  );
}
