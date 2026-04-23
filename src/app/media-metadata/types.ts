export interface CoverageRow {
  prefix: string;
  counts: number[];
}

export interface CoverageResponse {
  suffixes: string[];
  rows: CoverageRow[];
  letters: string[];
  words: string[];
}

// ElevenLabs voice: "Natasha - Warm, Inviting and Clear" (Hindi, conversational).
export const NATASHA_VOICE_ID = "S2uC1CO2xXot4UtzYX68";