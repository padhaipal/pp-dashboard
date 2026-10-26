import { describe, expect, it } from "vitest";
import { manualResultsCsv, parseCsv, parseManualPassagesCsv, toManualRun } from "./manual-passages";

const HEADER =
  "passage_type,passage_text,question_type,question_text,option_a,option_b,option_c,option_d,correct_option,explanation_a,explanation_b,explanation_c,explanation_d";

const row = (cells: Partial<Record<string, string>>) => {
  const base: Record<string, string> = {
    passage_type: "narrative",
    passage_text: "राम ने बाज़ार से आम खरीदे।",
    question_type: "R1.2",
    question_text: "राम ने क्या खरीदा?",
    option_a: "आम",
    option_b: "केले",
    option_c: "",
    option_d: "",
    correct_option: "a",
    explanation_a: "सही!",
    explanation_b: "नहीं।",
    explanation_c: "",
    explanation_d: "",
    ...cells,
  };
  return HEADER.split(",")
    .map((h) => {
      const v = base[h] ?? "";
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    })
    .join(",");
};

describe("parseCsv", () => {
  it("handles BOM, quotes, escaped quotes, embedded newlines, CRLF and blank lines", () => {
    expect(parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n\r\n')).toEqual([
      ["a", "b"],
      ['x, "y"', "line1\nline2"],
    ]);
  });
});

describe("parseManualPassagesCsv", () => {
  it("maps a valid row to a manual-passage body with the spreadsheet row number", () => {
    const r = parseManualPassagesCsv(`${HEADER}\n${row({ correct_option: "B" })}\n`, "tom.csv");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].errors).toEqual([]);
    expect(r.rows[0].body).toEqual({
      passage: { text: "राम ने बाज़ार से आम खरीदे।", passage_type: "narrative" },
      question: {
        text: "राम ने क्या खरीदा?",
        question_type: "R1.2",
        send_as_flow: true,
        options: [
          { text: "आम", correct: false, explanation: { text: "सही!" } },
          { text: "केले", correct: true, explanation: { text: "नहीं।" } },
        ],
      },
      filename: "tom.csv",
      row: 2,
    });
  });

  it("rejects a file missing required columns", () => {
    const r = parseManualPassagesCsv("passage_text,question_text\nx,y\n", "f.csv");
    expect(r).toEqual({ ok: false, error: expect.stringContaining("passage_type") });
  });

  it("flags incomplete rows instead of sending them", () => {
    const r = parseManualPassagesCsv(
      [
        HEADER,
        row({ explanation_b: "" }),
        row({ passage_text: "दूसरी कहानी", question_text: "" }),
        row({ passage_text: "तीसरी कहानी", option_c: "अंगूर" }),
        row({ passage_text: "चौथी कहानी", correct_option: "c" }),
        row({ passage_text: "पाँचवीं कहानी 5 आम" }),
        row({ passage_text: "छठी कहानी", question_type: "R9" }),
      ].join("\n"),
      "f.csv",
    );
    if (!r.ok) throw new Error("expected ok");
    const errs = r.rows.map((x) => x.errors.join(" | "));
    expect(errs[0]).toContain("explanation_b is empty");
    expect(errs[1]).toContain("question_text is empty");
    expect(errs[2]).toContain("explanation_c is empty");
    expect(errs[3]).toContain("option_c is empty");
    expect(errs[4]).toContain("digits");
    expect(errs[5]).toContain("question_type");
    expect(r.rows.every((x) => x.body === undefined)).toBe(true);
  });

  it("flags a passage repeated in the file even with a different question (whitespace-insensitive)", () => {
    const r = parseManualPassagesCsv(
      [HEADER, row({}), row({ passage_text: "  राम ने  बाज़ार से आम खरीदे। ", question_text: "कौन?" })].join("\n"),
      "f.csv",
    );
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows[0].errors).toEqual([]);
    expect(r.rows[1].errors).toEqual(["duplicate of the passage in row 2"]);
  });
});

describe("toManualRun", () => {
  it("maps created, gate failure (with explanation), unverified and HTTP errors", () => {
    expect(toManualRun(true, 200, { status: "created", level: 9, passage_id: "p" })).toEqual({
      status: "created",
      level: 9,
      passageId: "p",
      ttsError: undefined,
    });
    expect(
      toManualRun(true, 200, {
        status: "rejected",
        reason: "passage-quality: 1/5 true",
        retriable: false,
        level: 10,
        question: { status: "discarded", explanation: "Passage quality check failed…" },
      }),
    ).toEqual({
      status: "rejected",
      reason: "passage-quality: 1/5 true",
      explanation: "Passage quality check failed…",
      retriable: false,
      level: 10,
    });
    expect(toManualRun(true, 200, { status: "rejected", reason: "unverified", retriable: true }).status).toBe("rejected");
    expect(toManualRun(false, 400, { message: ["row must be an integer"] })).toEqual({
      status: "failed",
      reason: "row must be an integer",
      retriable: false,
    });
    expect(toManualRun(false, 502, null)).toMatchObject({ status: "failed", retriable: true });
  });
});

describe("manualResultsCsv", () => {
  it("writes one line per row with outcome, reason and explanation", () => {
    const r = parseManualPassagesCsv(`${HEADER}\n${row({})}\n${row({ passage_text: "दूसरी" })}\n`, "f.csv");
    if (!r.ok) throw new Error("expected ok");
    const csv = manualResultsCsv(r.rows, [
      { status: "created", level: 9 },
      { status: "rejected", reason: "judge, failed", explanation: 'picked "B"', retriable: false, level: 8 },
    ]);
    expect(csv.startsWith("﻿row,passage,outcome,level,reason,explanation\r\n")).toBe(true);
    expect(csv).toContain("2,राम ने बाज़ार से आम खरीदे।,created,9,,\r\n");
    expect(csv).toContain('3,दूसरी,rejected,8,"judge, failed","picked ""B"""\r\n');
  });
});
