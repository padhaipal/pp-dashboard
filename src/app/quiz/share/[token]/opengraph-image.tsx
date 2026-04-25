import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  formatQuestionAnswer,
  formatResearchAnswer,
  QUESTIONS_DATA,
} from "../../questions";

export const alt =
  "Compare your guesses to the research on universal foundational literacy in India.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ShareData {
  answers: { question_index: number; answer: number }[];
  completed: number;
}

async function fetchShare(token: string): Promise<ShareData | null> {
  const baseUrl = process.env.PP_SKETCH_INTERNAL_URL;
  if (!baseUrl) return null;
  const res = await fetch(
    `${baseUrl}/quiz/share/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}

const BRAND_BLUE_DARK = "#1683BC";
const BRAND_BLUE_PALE = "#D3EBF7";
const EMERALD = "#047857";
const INK = "#21243d";
const MUTED = "#52525b";

// Truncate question prompt for compact display in the image.
const SHORT_PROMPTS: string[] = [
  "Riches added to India by 2050",
  "Lift in India's per-capita GDP",
  "Extra kids reaching secondary school",
  "Child marriages averted",
  "Children's lives saved",
];

export default async function Image({
  params,
}: {
  params: { token: string };
}) {
  const logoSvg = await readFile(
    join(process.cwd(), "public/padhaipal-logo.svg"),
  );
  const logoSrc = `data:image/svg+xml;base64,${logoSvg.toString("base64")}`;

  const data = await fetchShare(params.token);
  const answersByIndex = new Map<number, number>(
    data?.answers.map((a) => [a.question_index, a.answer]) ?? [],
  );
  const completed = data?.completed ?? 0;

  const completedLine =
    completed === 0
      ? "Be one of the first to take the quiz"
      : completed === 1
        ? "Joined by 1 person so far"
        : `Joined by ${completed.toLocaleString()} people so far`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "white",
          display: "flex",
          flexDirection: "column",
          padding: "40px 56px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="PadhaiPal" width={96} height={96} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                color: BRAND_BLUE_DARK,
                letterSpacing: 3,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              PadhaiPal Quiz
            </div>
            <div
              style={{
                fontSize: 36,
                color: INK,
                fontWeight: 700,
                lineHeight: 1.1,
                marginTop: 4,
              }}
            >
              How does my guess compare to the research?
            </div>
          </div>
        </div>

        {/* Rows: one per question */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 28,
            gap: 8,
          }}
        >
          {QUESTIONS_DATA.map((q, i) => {
            const guess = answersByIndex.get(i);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  borderTop: `1px dashed ${BRAND_BLUE_PALE}`,
                  paddingTop: 8,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ fontSize: 20, color: MUTED, fontWeight: 600 }}>
                    Q{i + 1}. {SHORT_PROMPTS[i]}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    minWidth: 280,
                  }}
                >
                  <div style={{ fontSize: 18, color: MUTED }}>
                    Their guess
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: BRAND_BLUE_DARK,
                      fontWeight: 700,
                    }}
                  >
                    {guess === undefined ? "—" : formatQuestionAnswer(q, guess)}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    marginLeft: 32,
                    minWidth: 240,
                  }}
                >
                  <div style={{ fontSize: 18, color: MUTED }}>Research</div>
                  <div
                    style={{ fontSize: 22, color: EMERALD, fontWeight: 700 }}
                  >
                    {formatResearchAnswer(q)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: social proof + CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 20,
          }}
        >
          <div style={{ fontSize: 22, color: MUTED }}>{completedLine}</div>
          <div
            style={{
              fontSize: 22,
              color: BRAND_BLUE_DARK,
              fontWeight: 700,
            }}
          >
            dashboard.padhaipal.com/quiz
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}