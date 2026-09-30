// Types + pure helpers for the /user/[id] interactions table (media-table.tsx).
// Mirrors pp-sketch's GET users/:id/media (user.dto.ts MediaRow) — requested
// with `?onboarding=1`, which the proxy forwards for staff sessions only.
// No React, no DOM.

export interface Transcript {
  text: string | null;
  source: string;
  created_at?: string;
}

export interface ScoreChange {
  grapheme: string;
  score: number;
  prev_score: number | null;
}

// voice = a voice note answered by the lesson; tap = a comprehension flow
// answer (no audio); onboarding = a parent-onboarding voice note.
export type InteractionKind = "voice" | "tap" | "onboarding";

export interface TapDetail {
  question: string | null;
  chosen: string | null;
  correct: string | null;
}

export type OnboardingSavedField = "name" | "birth_year" | "birth_month";

// pp-sketch src/onboarding/onboarding-turns.ts. `question` = the onboarding
// state before the turn (null = the message that started onboarding),
// `understood` = what the reply was taken to mean, `saved` = what the turn
// added to the onboarding record, `completed` = the turn that wrote the
// record to the student.
export interface OnboardingTurn {
  question: string | null;
  next: string | null;
  understood: string | null;
  saved: { field: OnboardingSavedField; value: string }[];
  completed: boolean;
}

export interface MediaRow {
  id: string;
  // Absent on a pp-sketch that predates the field → a voice note.
  kind?: InteractionKind;
  created_at: string;
  has_audio: boolean;
  transcripts: Transcript[];
  word: string | null;
  starting_state: string | null;
  answer: string | null;
  answer_correct: boolean | null;
  score_changes?: ScoreChange[];
  final_state: string | null;
  level: number | null;
  wpm: number | null;
  tap?: TapDetail | null;
  onboarding?: OnboardingTurn | null;
}

export const kindOf = (row: MediaRow): InteractionKind => row.kind ?? "voice";

// Light row tints so taps and onboarding turns stand out from recordings.
export const ROW_TINT: Record<InteractionKind, string> = {
  voice: "",
  tap: "bg-sky-50/60",
  onboarding: "bg-amber-50/60",
};

// Onboarding machine states (pp-sketch onboarding.machine.ts) as the
// question the parent was asked in that state.
const ONBOARDING_STATE_LABEL: Record<string, string> = {
  askGuardian: "Are you the guardian?",
  askConsent: "May we record?",
  consentRefused: "Hear more before deciding?",
  declined: "Declined",
  askName: "Child's name?",
  askAge: "Child's age?",
  askMonth: "Birth month?",
  done: "Onboarding complete",
};

export const onboardingStateLabel = (state: string | null): string =>
  state === null ? "Onboarding started" : (ONBOARDING_STATE_LABEL[state] ?? state);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const monthName = (value: string): string => MONTHS[parseInt(value, 10) - 1] ?? value;

const UNDERSTOOD_LABEL: Record<string, string> = {
  YES: "Yes",
  NO: "No",
  INFORMATION: "Wants more information",
  UNINTELLIGIBLE: "Could not understand the reply",
};

// What the parent's reply was taken to mean, in words. Null when nothing was
// interpreted (the first message, or a reply after declining).
export function onboardingUnderstood(turn: OnboardingTurn): string | null {
  const { question, understood } = turn;
  if (understood === null) return null;
  if (UNDERSTOOD_LABEL[understood]) return UNDERSTOOD_LABEL[understood];
  if (question === "askName") return understood === "NONE" ? "No name heard" : understood;
  if (question === "askAge") return `${understood} years old`;
  if (question === "askMonth") return understood === "NONE" ? "No month heard" : monthName(understood);
  return understood;
}

const SAVED_LABEL: Record<OnboardingSavedField, string> = {
  name: "name",
  birth_year: "birth year",
  birth_month: "birth month",
};

// What the turn put in the database, one line each. Values are held in the
// onboarding record and reach the student's own record only on the
// completing turn, together with the recording-permission time.
export function onboardingSaved(turn: OnboardingTurn): string[] {
  const lines = turn.saved.map((s) => `${SAVED_LABEL[s.field]}: ${s.field === "birth_month" ? monthName(s.value) : s.value}`);
  if (turn.completed) lines.push("written to the student's record, with recording permission");
  return lines;
}
