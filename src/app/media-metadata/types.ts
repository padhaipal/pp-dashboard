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