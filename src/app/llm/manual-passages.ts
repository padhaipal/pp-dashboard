// Client-side half of the manual passage upload: CSV → one request body per
// row for pp-sketch's POST /media-meta-data/manual-passage, which runs the
// SAME validation + quality/judge/solvability gates as LLM seeding. The
// checks here only flag bad rows early (before minutes of gate calls); the
// server re-validates everything and is the authority.
//
// Columns are the content subset of the "Download CSV" export
// (pp-sketch passages-csv.ts), so an exported sheet works as a template;
// the export's other columns (passage_id, level, status, …) are ignored —
// the level is always computed server-side from word count.

// Mirrors pp-sketch llm-generate.dto.ts (VALID_PASSAGE_TYPES,
// VALID_QUESTION_TYPES, PASSAGE_DIGITS_RE, PASSAGE_MAX_CHARS,
// FLOW_QUESTION_MAX_CHARS, FLOW_OPTION_DESCRIPTION_MAX_CHARS,
// EXPLANATION_MAX_CHARS).
export const PASSAGE_TYPES = ["narrative", "expository"];
export const QUESTION_TYPES = ["R1.1", "R1.2", "R1.3", "R2.1", "R2.2", "R2.3", "R3.1", "R3.2"];
const DIGITS_RE = /[0-9\u0966-\u096F]/;
const LETTERS = ["a", "b", "c", "d"] as const;
const PASSAGE_MAX_CHARS = 4096;
const QUESTION_MAX_CHARS = 1000;
const OPTION_MAX_CHARS = 300;
const EXPLANATION_MAX_CHARS = 4096;

export type ManualColumn = {
  name: string;
  required: boolean;
  rule: string;
  example: string;
  maxChars?: number;
};

// THE column spec: the dashboard's column table, the template download and
// the parser's required-column check all read from this list, so they
// cannot drift apart.
export const MANUAL_COLUMNS: ManualColumn[] = [
  {
    name: "passage_type",
    required: true,
    rule: `Exactly one of: ${PASSAGE_TYPES.join(", ")}.`,
    example: "narrative",
  },
  {
    name: "passage_text",
    required: true,
    rule: `The full reading passage in Hindi. No digits (0-9 or ०-९) — write numbers as words. Must not match a passage that is already live or another row in the file. Max ${PASSAGE_MAX_CHARS} characters.`,
    example:
      "राम सुबह जल्दी उठा। उसने अपनी माँ के साथ बाज़ार जाकर ताज़े आम खरीदे और घर लौटकर अपनी छोटी बहन के साथ बाँट दिए।",
    maxChars: PASSAGE_MAX_CHARS,
  },
  {
    name: "question_type",
    required: true,
    rule: `Exactly one of: ${QUESTION_TYPES.join(", ")} (capital R).`,
    example: "R1.2",
  },
  {
    name: "question_text",
    required: true,
    rule: `The one comprehension question. Max ${QUESTION_MAX_CHARS} characters.`,
    example: "राम ने बाज़ार से क्या खरीदा?",
    maxChars: QUESTION_MAX_CHARS,
  },
  {
    name: "option_a",
    required: true,
    rule: `Answer option A. Max ${OPTION_MAX_CHARS} characters.`,
    example: "आम",
    maxChars: OPTION_MAX_CHARS,
  },
  {
    name: "option_b",
    required: true,
    rule: `Answer option B. Max ${OPTION_MAX_CHARS} characters.`,
    example: "केले",
    maxChars: OPTION_MAX_CHARS,
  },
  {
    name: "option_c",
    required: false,
    rule: `Answer option C. Leave empty for a 2-option question. Max ${OPTION_MAX_CHARS} characters.`,
    example: "सेब",
    maxChars: OPTION_MAX_CHARS,
  },
  {
    name: "option_d",
    required: false,
    rule: `Answer option D. Only allowed if option_c is filled. Max ${OPTION_MAX_CHARS} characters.`,
    example: "",
    maxChars: OPTION_MAX_CHARS,
  },
  {
    name: "correct_option",
    required: true,
    rule: "Exactly one letter: a, b, c or d. It must name a filled option. Only one option can be correct.",
    example: "a",
  },
  {
    name: "explanation_a",
    required: true,
    rule: `Why option A is right or wrong (the student hears this after answering). Max ${EXPLANATION_MAX_CHARS} characters.`,
    example: "सही! राम ने बाज़ार से आम खरीदे थे।",
    maxChars: EXPLANATION_MAX_CHARS,
  },
  {
    name: "explanation_b",
    required: true,
    rule: `Why option B is right or wrong. Max ${EXPLANATION_MAX_CHARS} characters.`,
    example: "नहीं, कहानी में केले की बात नहीं है।",
    maxChars: EXPLANATION_MAX_CHARS,
  },
  {
    name: "explanation_c",
    required: false,
    rule: "Required if option_c is filled; must be empty if option_c is empty.",
    example: "नहीं, राम ने सेब नहीं खरीदे।",
    maxChars: EXPLANATION_MAX_CHARS,
  },
  {
    name: "explanation_d",
    required: false,
    rule: "Required if option_d is filled; must be empty if option_d is empty.",
    example: "",
    maxChars: EXPLANATION_MAX_CHARS,
  },
];

export const MANUAL_REQUIRED_COLUMNS = MANUAL_COLUMNS.filter((c) => c.required).map((c) => c.name);

export const MANUAL_MAX_ROWS = 1000;

export type ManualPassageBody = {
  passage: { text: string; passage_type: string };
  question: {
    text: string;
    question_type: string;
    send_as_flow: true;
    options: { text: string; correct: boolean; explanation: { text: string } }[];
  };
  filename: string;
  row: number;
};

export type ParsedRow = {
  /** Spreadsheet row number (header = row 1). */
  row: number;
  passagePreview: string;
  /** Present when the row is sendable. */
  body?: ManualPassageBody;
  /** Problems that stop the row being sent. */
  errors: string[];
};

export type ParseResult =
  | { ok: false; error: string }
  | { ok: true; rows: ParsedRow[] };

/** RFC 4180: quoted fields, "" escapes, CRLF/LF, embedded newlines, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  // Drop blank lines (a lone empty field).
  return records.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

const normalise = (s: string) => s.trim().replace(/\s+/g, " ");

export function parseManualPassagesCsv(text: string, filename: string): ParseResult {
  const records = parseCsv(text);
  if (records.length === 0) return { ok: false, error: "The file is empty." };
  const header = records[0].map((h) => h.trim().toLowerCase());
  const missing = MANUAL_REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { ok: false, error: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}` };
  }
  const dataRows = records.slice(1);
  if (dataRows.length === 0) return { ok: false, error: "The file has a header but no rows." };
  if (dataRows.length > MANUAL_MAX_ROWS) {
    return { ok: false, error: `Too many rows (${dataRows.length}); upload at most ${MANUAL_MAX_ROWS} at a time.` };
  }

  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i === -1 ? "" : (r[i] ?? "").trim();
  };

  const seenPassages = new Map<string, number>();
  const rows = dataRows.map((r, idx): ParsedRow => {
    const row = idx + 2;
    const errors: string[] = [];
    const passageText = col(r, "passage_text");
    const passageType = col(r, "passage_type").toLowerCase();
    const questionType = col(r, "question_type").toUpperCase();
    const questionText = col(r, "question_text");
    const correctLetter = col(r, "correct_option").toLowerCase();

    for (const c of ["passage_text", "passage_type", "question_type", "question_text", "correct_option"]) {
      if (!col(r, c)) errors.push(`${c} is empty`);
    }
    if (passageType && !PASSAGE_TYPES.includes(passageType)) {
      errors.push(`passage_type must be ${PASSAGE_TYPES.join(" or ")}`);
    }
    if (questionType && !QUESTION_TYPES.includes(questionType)) {
      errors.push(`question_type must be one of ${QUESTION_TYPES.join(", ")}`);
    }
    for (const c of MANUAL_COLUMNS) {
      const v = col(r, c.name);
      if (c.maxChars !== undefined && v.length > c.maxChars) {
        errors.push(`${c.name} is ${v.length} characters (max ${c.maxChars})`);
      }
    }
    if (DIGITS_RE.test(passageText)) {
      errors.push("passage_text contains digits — write numbers as words");
    }

    const options: ManualPassageBody["question"]["options"] = [];
    let gap = false;
    for (const letter of LETTERS) {
      const option = col(r, `option_${letter}`);
      const explanation = col(r, `explanation_${letter}`);
      if (!option) {
        if (letter === "a" || letter === "b") errors.push(`option_${letter} is empty`);
        else if (explanation) errors.push(`explanation_${letter} has no option_${letter}`);
        gap = true;
        continue;
      }
      if (gap) errors.push(`option_${letter} is filled but an earlier option is empty`);
      if (!explanation) errors.push(`explanation_${letter} is empty`);
      options.push({ text: option, correct: letter === correctLetter, explanation: { text: explanation } });
    }
    if (correctLetter) {
      const i = LETTERS.indexOf(correctLetter as (typeof LETTERS)[number]);
      if (i === -1) errors.push("correct_option must be one letter: a, b, c or d");
      else if (!col(r, `option_${correctLetter}`)) errors.push(`correct_option is ${correctLetter} but option_${correctLetter} is empty`);
    }

    // Duplicate passages are never allowed — not even with another question.
    if (passageText) {
      const key = normalise(passageText);
      const first = seenPassages.get(key);
      if (first !== undefined) errors.push(`duplicate of the passage in row ${first}`);
      else seenPassages.set(key, row);
    }

    const passagePreview = passageText.length > 60 ? `${passageText.slice(0, 60)}…` : passageText;
    if (errors.length > 0) return { row, passagePreview, errors };
    return {
      row,
      passagePreview,
      errors,
      body: {
        passage: { text: passageText, passage_type: passageType },
        question: { text: questionText, question_type: questionType, send_as_flow: true, options },
        filename,
        row,
      },
    };
  });
  return { ok: true, rows };
}

/** Header + one example row, every column in MANUAL_COLUMNS order. */
export function manualTemplateCsv(): string {
  const line = (cells: string[]) => cells.map(csvCell).join(",");
  return "\uFEFF" + line(MANUAL_COLUMNS.map((c) => c.name)) + "\r\n" + line(MANUAL_COLUMNS.map((c) => c.example)) + "\r\n";
}

// ─── Per-row outcome + results download ─────────────────────────────────────

export type ManualRun =
  | { status: "pending" }
  | { status: "skipped"; reason: string }
  | { status: "running" }
  | { status: "created"; level?: number; passageId?: string; ttsError?: string }
  | {
      // 'rejected' = invalid content, duplicate or failed check (final);
      // retriable only when no verdict was reached ('unverified').
      status: "rejected" | "failed";
      reason: string;
      explanation?: string;
      retriable: boolean;
      level?: number;
    };

/** Maps a pp-sketch LlmGenerateResponse (or HTTP error) to a ManualRun. */
export function toManualRun(
  httpOk: boolean,
  httpStatus: number,
  json: {
    status?: string;
    reason?: string;
    retriable?: boolean;
    passage_id?: string;
    level?: number;
    tts_error?: string;
    question?: { status?: string; reason?: string; explanation?: string };
    message?: string | string[];
  } | null,
): ManualRun {
  if (!httpOk || !json?.status) {
    const message = Array.isArray(json?.message) ? json.message.join("; ") : json?.message;
    // A 4xx is a bad request (won't change on retry); anything else may be transient.
    return { status: "failed", reason: message ?? json?.reason ?? `HTTP ${httpStatus}`, retriable: httpStatus >= 500 || httpStatus === 0 };
  }
  if (json.status === "created") {
    return { status: "created", level: json.level, passageId: json.passage_id, ttsError: json.tts_error };
  }
  return {
    status: json.status === "rejected" ? "rejected" : "failed",
    reason: json.reason ?? "unknown",
    explanation: json.question?.explanation,
    retriable: json.retriable === true,
    level: json.level,
  };
}

function csvCell(v: string | number | undefined): string {
  const s = v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function manualResultsCsv(rows: ParsedRow[], runs: ManualRun[]): string {
  const lines = [["row", "passage", "outcome", "level", "reason", "explanation"].join(",")];
  rows.forEach((r, i) => {
    const run = runs[i] ?? { status: "pending" };
    const reason =
      run.status === "skipped" || run.status === "rejected" || run.status === "failed"
        ? run.reason
        : run.status === "created" && run.ttsError
          ? `audio: ${run.ttsError}`
          : "";
    const explanation = run.status === "rejected" || run.status === "failed" ? run.explanation : "";
    const level = run.status === "created" || run.status === "rejected" || run.status === "failed" ? run.level : undefined;
    lines.push([r.row, r.passagePreview, run.status, level, reason, explanation].map(csvCell).join(","));
  });
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
