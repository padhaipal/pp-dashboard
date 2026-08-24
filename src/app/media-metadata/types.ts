export type MediaType = "audio" | "text" | "video" | "image" | "sticker" | "flow";

export type MediaTypeCounts = Record<MediaType, number>;

// Fixed display order, matching pp-sketch's VALID_MEDIA_TYPES. "flow" is a
// WhatsApp Flow message (comprehension question) — payload JSON in .text, no
// S3 object, no WhatsApp preload.
export const ALL_MEDIA_TYPES: MediaType[] = [
  "audio",
  "text",
  "video",
  "image",
  "sticker",
  "flow",
];

// HARDCODED list of the non-lesson state_transition_ids (onboarding, notifications,
// re-engagement, quota). These are NOT covered by the /coverage grid, which only
// enumerates lesson STIDs (letter/word prefix × machine-suffix). This list is
// duplicated from pp-sketch code and will DRIFT if a new non-lesson STID is added
// there. The real fix is a `state_transitions` table in the database that both
// pp-sketch and this dashboard read from; until that exists, keep this in sync by
// hand.
export const NON_LESSON_STIDS: string[] = [
  "welcome-message",
  "audio-only-request",
  "stale-lesson-restart",
  "hail-mary",
  // Daily active-minute milestones (see ACTIVE_MINUTE_THRESHOLDS in pp-sketch
  // inbound.processor.ts — keep in sync).
  ...[5, 10, 15, 20, 25, 30, 45, 60].map(
    (m) => `threshold-reached-${m}-active-minutes-today`,
  ),
  "evening_notification_message",
  "morning_notification_message",
  // Sentence-lesson prompts (fixed `sentence` prefix — the /coverage grid only
  // enumerates per-letter/per-word prefixes; the per-word drill stid
  // `{word}-sentence-word-drillWord` DOES live in the grid). Keep in sync with
  // literacy-lesson.machine.ts in pp-sketch. The old
  // sentence-sentence-complete-correct-{first,retry} stids are GONE (2026-07):
  // a correct sentence read now leads into the comprehension state, whose
  // dynamic `${passageId}-…`/`${answerId}-…` stids live in the comprehension
  // table below the grid, not here.
  "sentence-start-sentence-initial",
  "sentence-sentence-complete-maxErrors",
  // Sentence failed but no teachable drill word (conjunct/nukta) — retry.
  "sentence-sentence-wrong-retry",
  "sentence-word-sentence-correct-retrySentence",
];

// Every reading-speed stid the audio-reply path can emit for a completed
// level-8+ sentence lesson — synced with inbound.processor.ts in pp-sketch.
// 203 entries, generic first: the `_` row is the generic fallback that
// serves every integer at send time (specific-beats-generic merge); 0 and
// 200plus are the corrupt-duration sentinels. Rendered in their own
// scrollable table (reading-speed-table.tsx), NOT in NON_LESSON_STIDS.
export const READING_SPEED_STIDS: string[] = [
  "_-wpm-reading-speed",
  "0-wpm-reading-speed",
  ...Array.from({ length: 200 }, (_, i) => `${i + 1}-wpm-reading-speed`),
  "200plus-wpm-reading-speed",
];

// One row of the paginated comprehension-stid table (dynamic
// `${passageId}-sentence-comprehension` flow rows and
// `${answerId}-comprehension-complete` explanation rows). level /
// passage_type / question_type are resolved server-side from the stid's
// passage family; null when the family is partially deleted.
export interface ComprehensionStidRow {
  state_transition_id: string;
  media_count: number;
  created_at: string;
  level: number | null;
  passage_type: string | null;
  question_type: string | null;
}

export interface ComprehensionStidsResponse {
  rows: ComprehensionStidRow[];
  total: number;
  limit: number;
  offset: number;
}

// Filter vocabularies — mirror pp-sketch's VALID_PASSAGE_TYPES /
// VALID_QUESTION_TYPES (llm-generate.dto.ts) and VALID_MEDIA_TYPES
// (media-meta-data.dto.ts).
export const PASSAGE_TYPES = ["narrative", "expository"] as const;
export const MEDIA_TYPES = [
  "audio",
  "text",
  "video",
  "image",
  "sticker",
  "flow",
] as const;
export const QUESTION_TYPE_CODES = [
  "R1.1",
  "R1.2",
  "R1.3",
  "R2.1",
  "R2.2",
  "R2.3",
  "R3.1",
  "R3.2",
] as const;

// GET /media-meta-data/passage-stats
export interface PassageStatsRow {
  level: number | null;
  passage_type: string | null;
  question_type: string | null;
  passages: number;
}

export interface PassageStatsResponse {
  rows: PassageStatsRow[];
}

// GET /media-meta-data/passages
export interface PassageSearchRow {
  id: string;
  level: number | null;
  passage_type: string | null;
  question_type: string | null;
  model: string | null;
  preview: string;
  created_at: string;
}

export interface PassageSearchResponse {
  rows: PassageSearchRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface CoverageRow {
  prefix: string;
  counts: MediaTypeCounts[];
}

export interface CoverageResponse {
  suffixes: string[];
  media_types: MediaType[];
  rows: CoverageRow[];
  letters: string[];
  words: string[];
}

// ElevenLabs voice: "Natasha - Warm, Inviting and Clear" (Hindi, conversational).
export const NATASHA_VOICE_ID = "S2uC1CO2xXot4UtzYX68";

// ── Static-upload guard rules ────────────────────────────────────────────────
// Mirror of the server-side limits in pp-sketch
// (src/media-meta-data/media-meta-data.dto.ts). Kept here only for fast, friendly
// client-side pre-validation — the server remains the source of truth. If the
// server limits change, update these to match.
export const TEXT_MAX_CHARS = 4096;
export const STICKER_DIMENSION = 512;

// Largest server-accepted body (video, 16 MB). There is no separate Railway/Next
// proxy body cap configured, so this per-type ceiling is the effective limit; we
// guard client-side so oversized bodies are never sent.
export const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

export type UploadKind = "image" | "sticker" | "video";

export const STATIC_MEDIA_RULES: Record<
  UploadKind,
  { accept: string; mimes: string[]; maxBytes: number; hint: string }
> = {
  image: {
    accept: "image/jpeg,image/png",
    mimes: ["image/jpeg", "image/png"],
    maxBytes: 5 * 1024 * 1024,
    hint: "JPEG or PNG, up to 5 MB. (WebP is a sticker — pick Sticker.)",
  },
  sticker: {
    accept: "image/webp",
    mimes: ["image/webp"],
    maxBytes: 500 * 1024,
    hint: "WebP, exactly 512×512. Static up to 100 KB, animated up to 500 KB.",
  },
  video: {
    accept: "video/mp4",
    mimes: ["video/mp4"],
    maxBytes: 16 * 1024 * 1024,
    hint: "MP4, up to 16 MB.",
  },
};