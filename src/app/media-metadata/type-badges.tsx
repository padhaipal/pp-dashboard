// Subtle passage-classification badges shared by the comprehension table and
// the passage search results: level chip, narrative/expository tint, R-code.
// Renders nothing for fields the server could not resolve (null).
export function TypeBadges({
  level,
  passageType,
  questionType,
}: {
  level: number | null;
  passageType: string | null;
  questionType: string | null;
}) {
  if (level === null && passageType === null && questionType === null) {
    return null;
  }
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {level !== null && (
        <span className="rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600">
          L{level}
        </span>
      )}
      {passageType !== null && (
        <span
          title={passageType}
          className={`rounded px-1 text-[10px] font-medium ${
            passageType === "narrative"
              ? "bg-sky-50 text-sky-700"
              : "bg-violet-50 text-violet-700"
          }`}
        >
          {passageType === "narrative" ? "N" : "E"}
        </span>
      )}
      {questionType !== null && (
        <span className="rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600">
          {questionType}
        </span>
      )}
    </span>
  );
}
