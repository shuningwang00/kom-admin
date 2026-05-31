"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ColumnFilterState = Set<string> | null;

/** `null` = no filter (all values shown). Non-null set = only those values. */
export function passesColumnFilter(
  value: string,
  selected: ColumnFilterState,
): boolean {
  if (selected === null) return true;
  return selected.has(value);
}

export function ColumnFilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: ColumnFilterState;
  onChange: (next: ColumnFilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.localeCompare(b)),
    [options],
  );

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedOptions;
    return sortedOptions.filter((o) => o.toLowerCase().includes(q));
  }, [sortedOptions, search]);

  const active = selected !== null;
  const effectiveSelected = selected ?? new Set(sortedOptions);
  const allChecked =
    sortedOptions.length > 0 &&
    sortedOptions.every((o) => effectiveSelected.has(o));
  const checkedCount = sortedOptions.filter((o) =>
    effectiveSelected.has(o),
  ).length;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function ensureSet(): Set<string> {
    return selected ? new Set(selected) : new Set(sortedOptions);
  }

  function toggleValue(value: string) {
    const next = ensureSet();
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === sortedOptions.length) onChange(null);
    else onChange(next);
  }

  function selectAll() {
    onChange(null);
  }

  function clearFilter() {
    onChange(null);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left text-sm font-semibold hover:bg-zinc-200/80 ${
          active ? "text-orange-800" : "text-zinc-800"
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{label}</span>
        <span
          className={`shrink-0 text-xs ${active ? "text-orange-600" : "text-zinc-400"}`}
          title={active ? `Filtered (${checkedCount} of ${sortedOptions.length})` : "Filter"}
        >
          {active ? "▾*" : "▾"}
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[min(20rem,90vw)] rounded-lg border border-zinc-200 bg-white py-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
          role="listbox"
          aria-label={`Filter ${label}`}
        >
          <div className="border-b border-zinc-100 px-2 pb-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search values…"
              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
            />
          </div>

          <div className="max-h-52 overflow-y-auto px-2 py-1">
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={() => selectAll()}
              />
              <span className="font-medium text-zinc-700">Select all</span>
            </label>
            {filteredOptions.length === 0 ? (
              <p className="px-1 py-2 text-xs text-zinc-500">No values</p>
            ) : (
              filteredOptions.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={effectiveSelected.has(value)}
                    onChange={() => toggleValue(value)}
                  />
                  <span className="break-words text-zinc-800">{value}</span>
                </label>
              ))
            )}
          </div>

          <div className="mt-1 flex gap-2 border-t border-zinc-100 px-2 pt-2">
            <button
              type="button"
              onClick={clearFilter}
              className="text-xs text-zinc-600 hover:text-zinc-900"
            >
              Clear filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
