function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 ${className ?? ""}`} />;
}

/** Mimics a list of session/item rows (attendance, trials, etc.) */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center justify-between px-4 py-4">
          <div className="space-y-2">
            <Bone className="h-4 w-44" />
            <Bone className="h-3 w-28" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Bone className="h-3 w-14" />
            <Bone className="h-3 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Mimics a table of rows (students, trials table view, etc.) */
export function SkeletonTable({ rows = 6, cols = 3 }: { rows?: number; cols?: number }) {
  const widths = ["w-40", "w-28", "w-32", "w-20"];
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-6 border-b border-zinc-100 px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Bone key={j} className={`h-4 ${widths[j] ?? "w-24"} animate-pulse`} />
          ))}
        </div>
      ))}
    </div>
  );
}
