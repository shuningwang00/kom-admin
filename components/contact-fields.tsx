"use client";

import { CONTACT_TYPE_LABELS, CONTACT_TYPES, type ContactType } from "@/lib/contacts";

export function ContactFields({
  prefix,
  typeLabel,
  typeValue,
  numberValue,
  onTypeChange,
  onNumberChange,
  required,
}: {
  prefix: string;
  typeLabel: string;
  typeValue: ContactType | "";
  numberValue: string;
  onTypeChange: (v: ContactType | "") => void;
  onNumberChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">{typeLabel}</span>
        <select
          value={typeValue}
          onChange={(e) =>
            onTypeChange(e.target.value as ContactType | "")
          }
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          required={required && !!numberValue}
        >
          {!required && <option value="">— Type —</option>}
          {CONTACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">{prefix} number</span>
        <input
          type="tel"
          value={numberValue}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="e.g. 9123 4567"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          required={required}
        />
      </label>
    </div>
  );
}
