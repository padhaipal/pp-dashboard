export interface QuestionData {
  prompt: string;
  prefix: string;
  suffix: string;
  correct: number;
  /**
   * Optional human-readable suffix added after the formatted research answer
   * (e.g. " higher" or " — that's roughly 1.6× Australia's population!").
   * Kept in plain text so it's safe to use in server components, OG images, etc.
   */
  researchAnnotation?: string;
}

export const QUESTIONS_DATA: QuestionData[] = [
  {
    prompt: "How much richer would the country be?",
    prefix: "$",
    suffix: "",
    correct: 37_000_000_000_000,
  },
  {
    prompt: "How much higher would India's per capita GDP be?",
    prefix: "",
    suffix: "%",
    correct: 47,
    researchAnnotation: " higher",
  },
  {
    prompt: "How many more Indian children would have gone to secondary school?",
    prefix: "",
    suffix: "",
    correct: 44_000_000,
    researchAnnotation: " — that's roughly 1.6× Australia's population!",
  },
  {
    prompt: "How many Indian child marriages would have been averted?",
    prefix: "",
    suffix: "",
    correct: 1_200_000,
  },
  {
    prompt:
      "How many children's lives would be saved (because their mums can now read)?",
    prefix: "",
    suffix: "",
    correct: 420_000,
  },
];

export function fmtFull(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatQuestionAnswer(q: QuestionData, n: number): string {
  return `${q.prefix}${fmtFull(n)}${q.suffix}`;
}

export function formatResearchAnswer(q: QuestionData): string {
  return `${q.prefix}${fmtFull(q.correct)}${q.suffix}`;
}

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashboard.padhaipal.com";