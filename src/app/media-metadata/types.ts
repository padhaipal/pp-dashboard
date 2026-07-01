export type MediaType = "audio" | "text" | "video" | "image" | "sticker";

export type MediaTypeCounts = Record<MediaType, number>;

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