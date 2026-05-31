import { programmeLevelSubjectLine } from "@/lib/classes/match-programme";

type SessionListPreviewProps = {
  cls: { label: string; level: string };
  tutorPrimary: string;
  tutorSubtitle?: string | null;
  titleClassName?: string;
  isReliefNeeded?: boolean;
};

/** Shared title block for daily / tutor session list rows. */
export function SessionListPreview({
  cls,
  tutorPrimary,
  tutorSubtitle,
  titleClassName = "font-semibold text-zinc-900",
  isReliefNeeded = false,
}: SessionListPreviewProps) {
  const programmeLine = programmeLevelSubjectLine(cls);

  return (
    <div>
      {programmeLine ? (
        <p className={titleClassName}>{programmeLine}</p>
      ) : (
        <p className={titleClassName}>{cls.label}</p>
      )}
      <p className={`text-sm font-medium ${isReliefNeeded ? "text-red-600" : "text-zinc-600"}`}>
        {tutorPrimary}
      </p>
      {tutorSubtitle && (
        <p className="text-xs text-sky-800">{tutorSubtitle}</p>
      )}
    </div>
  );
}
