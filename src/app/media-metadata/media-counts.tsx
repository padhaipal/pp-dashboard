import type { ReactNode } from "react";
import type { MediaType, MediaTypeCounts } from "./types";

// Shared between the coverage grid and the non-lesson table so the two stay
// visually identical.
export function MediaIcon({ type }: { type: MediaType }) {
  const common = {
    width: 11,
    height: 11,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-label": type,
  };
  switch (type) {
    case "audio":
      return (
        <svg {...common}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    case "text":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "sticker":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
  }
}

// Renders an icon + number for each media type with a non-zero count. When all
// counts are zero, renders `emptyContent` (defaults to nothing).
export function MediaCounts({
  counts,
  mediaTypes,
  className = "",
  emptyContent = null,
}: {
  counts: MediaTypeCounts;
  mediaTypes: MediaType[];
  className?: string;
  emptyContent?: ReactNode;
}) {
  const shown = mediaTypes.filter((mt) => counts[mt] > 0);
  return (
    <div
      className={`flex gap-1.5 font-mono whitespace-nowrap items-center min-h-[14px] ${className}`}
    >
      {shown.length === 0
        ? emptyContent
        : shown.map((mt) => (
            <span key={mt} className="inline-flex items-center gap-0.5">
              <MediaIcon type={mt} />
              {counts[mt]}
            </span>
          ))}
    </div>
  );
}
