"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Chart,
  LinearScale,
  PointElement,
  ScatterController,
  Tooltip,
} from "chart.js";
import {
  fmtCompact,
  fmtFull,
  formatQuestionAnswer,
  QUESTIONS_DATA,
  type QuestionData,
} from "./questions";

Chart.register(ScatterController, PointElement, LinearScale, Tooltip);

const BRAND_BLUE = "#1D9EDF";
const BRAND_BLUE_DARK = "#1683BC";
const BRAND_BLUE_PALE = "#D3EBF7";

interface Question extends QuestionData {
  useMultipliers: boolean; // true for Q1/Q3/Q4/Q5 — show thousands/millions/billions/trillions submit boxes
  formatAnswer: (n: number) => string;
  correctText: React.ReactNode;
}

const CORRECT_TEXT_OVERRIDES: Record<number, React.ReactNode> = {
  1: (
    <>
      <span className="font-bold text-emerald-700">47%</span> higher
    </>
  ),
  2: (
    <>
      <span className="font-bold text-emerald-700">44,000,000</span>
      {" — that's roughly 1.6× Australia's population!"}
    </>
  ),
};

const QUESTIONS: Question[] = QUESTIONS_DATA.map((q, i) => ({
  ...q,
  useMultipliers: q.suffix !== "%",
  formatAnswer: (n: number) => formatQuestionAnswer(q, n),
  correctText:
    CORRECT_TEXT_OVERRIDES[i] ??
    (
      <span className="font-bold text-emerald-700">
        {`${q.prefix}${fmtFull(q.correct)}${q.suffix}`}
      </span>
    ),
}));

const MULTIPLIERS: { label: string; factor: number }[] = [
  { label: "thousands", factor: 1_000 },
  { label: "millions", factor: 1_000_000 },
  { label: "billions", factor: 1_000_000_000 },
  { label: "trillions", factor: 1_000_000_000_000 },
];

const PREMISE = (
  <>
    If <strong style={{ color: BRAND_BLUE_DARK }}>90% of 10-year-olds</strong> in India became
    literate every year, then by{" "}
    <strong style={{ color: BRAND_BLUE_DARK }}>2050</strong>…
  </>
);

const PADHAIPAL_PITCH = (
  <>
    PadhaiPal is aiming to teach a child to read for less than{" "}
    <strong>$10</strong>. That&apos;s cheaper than everyone else out there. Here is our website for
    more information{" "}
    <a
      href="https://www.padhaipal.com"
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
      style={{ color: BRAND_BLUE_DARK }}
    >
      www.padhaipal.com
    </a>
  </>
);

const PDF_URL =
  "https://www.wwhge.org/wp-content/uploads/2026/02/WWHGE_Universal-Foundational-Learning-Insight-Note.pdf";

type Phase = "intro" | "question" | "reveal" | "summary";

function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuizApp() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIndex, setQIndex] = useState(0);
  // Display order: position-in-display → original question index. Shuffled on mount.
  // Defaults to identity order for SSR consistency before useEffect runs (no question is
  // rendered before the user clicks Start, which happens after mount).
  const [displayOrder, setDisplayOrder] = useState<number[]>(() =>
    Array.from({ length: QUESTIONS.length }, (_, i) => i),
  );
  // Keyed by ORIGINAL question index, not display position.
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    new Array(QUESTIONS.length).fill(null),
  );
  const [revealAnswers, setRevealAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<number | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    setDisplayOrder(shuffleIndices(QUESTIONS.length));

    let sid: string | null = null;
    try {
      sid = localStorage.getItem("padhaipal_quiz_session");
    } catch {}
    if (!sid || !/^[0-9a-f-]{36}$/i.test(sid)) {
      sid = crypto.randomUUID();
      try {
        localStorage.setItem("padhaipal_quiz_session", sid);
      } catch {}
    }
    sessionIdRef.current = sid;
  }, []);

  const origIndex = displayOrder[qIndex];

  const submit = useCallback(async (idx: number, value: number) => {
    const sid = sessionIdRef.current;
    if (!sid) throw new Error("session not ready");
    const res = await fetch("/api/quiz/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sid,
        question_index: idx,
        answer: value,
      }),
    });
    if (!res.ok) throw new Error(`submit failed ${res.status}`);
  }, []);

  const fetchOthersAnswers = useCallback(
    async (idx: number): Promise<number[]> => {
      const sid = sessionIdRef.current;
      const qs = new URLSearchParams({ question: String(idx) });
      if (sid) qs.set("exclude_session", sid);
      const res = await fetch(`/api/quiz/answers?${qs.toString()}`);
      if (!res.ok) return [];
      const j = (await res.json()) as { answers: number[] };
      return j.answers ?? [];
    },
    [],
  );

  const handleSubmit = useCallback(
    async (value: number) => {
      setSubmitting(true);
      try {
        await submit(origIndex, value);
        const others = await fetchOthersAnswers(origIndex);
        setAnswers((prev) => {
          const next = prev.slice();
          next[origIndex] = value;
          return next;
        });
        setRevealAnswers(others);
        setPhase("reveal");
      } catch {
        alert("Something went wrong saving your answer. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [origIndex, submit, fetchOthersAnswers],
  );

  const handleNext = useCallback(() => {
    if (qIndex === QUESTIONS.length - 1) {
      setPhase("summary");
    } else {
      setQIndex((i) => i + 1);
      setPhase("question");
    }
  }, [qIndex]);

  useEffect(() => {
    fetch("/api/quiz/stats")
      .then((r) => (r.ok ? r.json() : { completed: 0 }))
      .then((j: { completed: number }) => setCompleted(j.completed ?? 0))
      .catch(() => setCompleted(0));
  }, []);

  useEffect(() => {
    if (phase !== "summary") return;
    const sid = sessionIdRef.current;
    if (!sid) return;
    if (shareToken) return;
    fetch("/api/quiz/share-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { token: string } | null) => {
        if (j?.token) setShareToken(j.token);
      })
      .catch(() => {});
  }, [phase, shareToken]);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
        <h1 className="text-center text-3xl leading-tight font-semibold">
          What if every Indian child could read?
        </h1>
        <p className="mt-2 mb-6 text-center text-zinc-600">
          {completed === null
            ? "Loading…"
            : completed === 0
              ? "Be the first to take this 5-question quiz. Take a guess — then see what the research says."
              : completed === 1
                ? "Join the 1 person who has taken this 5-question quiz. Take a guess — then see what the research says."
                : `Join the ${completed.toLocaleString()} people who have taken this 5-question quiz. Take a guess — then see what the research says.`}
        </p>

        <BrandCard />

        {phase === "intro" && <Intro onStart={() => setPhase("question")} />}

        {phase === "question" && (
          <QuestionCard
            qIndex={qIndex}
            question={QUESTIONS[origIndex]}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}

        {phase === "reveal" && (
          <RevealCard
            qIndex={qIndex}
            question={QUESTIONS[origIndex]}
            userAnswer={answers[origIndex] ?? 0}
            othersAnswers={revealAnswers}
            isLast={qIndex === QUESTIONS.length - 1}
            onNext={handleNext}
          />
        )}

        {phase === "summary" && (
          <Summary
            answers={answers}
            completed={completed}
            fetchOthersAnswers={fetchOthersAnswers}
            shareToken={shareToken}
          />
        )}
      </div>
    </div>
  );
}

function BrandCard() {
  return (
    <div
      className="mb-4 flex flex-col items-center gap-4 rounded-2xl border bg-white p-6 shadow-sm sm:flex-row sm:gap-5"
      style={{ borderColor: BRAND_BLUE_PALE }}
    >
      <Image
        src="/padhaipal-logo.svg"
        alt="PadhaiPal"
        width={96}
        height={96}
        className="shrink-0"
        priority
      />
      <p className="text-center text-zinc-700 sm:text-left">{PADHAIPAL_PITCH}</p>
    </div>
  );
}

function ProgressBar({ idx }: { idx: number }) {
  return (
    <div className="mb-5 flex gap-1.5">
      {QUESTIONS.map((_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded"
          style={{
            backgroundColor:
              i < idx ? BRAND_BLUE : i === idx ? BRAND_BLUE_DARK : BRAND_BLUE_PALE,
          }}
        />
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 rounded-2xl border bg-white p-6 shadow-sm"
      style={{ borderColor: BRAND_BLUE_PALE }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-5 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: BRAND_BLUE }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BRAND_BLUE_DARK)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BRAND_BLUE)
      }
    >
      {children}
    </button>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <Card>
      <p className="text-lg">{PREMISE}</p>
      <p className="mt-3 text-zinc-700">
        Five quick questions. Make a guess for each — then see what the research found and where
        your guess sits.
      </p>
      <div className="mt-5">
        <PrimaryButton onClick={onStart}>Start the quiz</PrimaryButton>
      </div>
    </Card>
  );
}

const NO_SPINNER_CLASSES =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none";

function QuestionCard({
  qIndex,
  question,
  submitting,
  onSubmit,
}: {
  qIndex: number;
  question: Question;
  submitting: boolean;
  onSubmit: (value: number) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    setError(false);
    inputRef.current?.focus();
  }, [qIndex]);

  function parseInput(): number | null {
    const n = parseFloat(value);
    if (value === "" || Number.isNaN(n)) {
      setError(true);
      inputRef.current?.focus();
      return null;
    }
    return n;
  }

  function submitDirect() {
    const n = parseInput();
    if (n === null) return;
    onSubmit(n);
  }

  function submitWithFactor(factor: number) {
    const n = parseInput();
    if (n === null) return;
    onSubmit(n * factor);
  }

  return (
    <Card>
      <ProgressBar idx={qIndex} />
      <div className="text-xs tracking-widest text-zinc-500 uppercase">
        Question {qIndex + 1} of {QUESTIONS.length}
      </div>
      <p className="mt-1 text-base">{PREMISE}</p>
      <h2 className="mt-3 mb-3 text-xl leading-snug font-semibold">{question.prompt}</h2>
      <div className="flex gap-2">
        {question.prefix && (
          <div
            className="flex items-center rounded-lg border-2 px-3 text-zinc-700"
            style={{
              borderColor: BRAND_BLUE_PALE,
              backgroundColor: `${BRAND_BLUE_PALE}80`,
            }}
          >
            {question.prefix}
          </div>
        )}
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !question.useMultipliers) submitDirect();
          }}
          className={`flex-1 rounded-lg border-2 px-3 py-3 text-lg outline-none focus:outline-none ${NO_SPINNER_CLASSES}`}
          style={{ borderColor: error ? "#e11d48" : BRAND_BLUE_PALE }}
          onFocus={(e) => {
            if (!error) e.currentTarget.style.borderColor = BRAND_BLUE;
          }}
          onBlur={(e) => {
            if (!error) e.currentTarget.style.borderColor = BRAND_BLUE_PALE;
          }}
        />
        {question.suffix && (
          <div
            className="flex items-center rounded-lg border-2 px-3 text-zinc-700"
            style={{
              borderColor: BRAND_BLUE_PALE,
              backgroundColor: `${BRAND_BLUE_PALE}80`,
            }}
          >
            {question.suffix}
          </div>
        )}
      </div>
      {question.useMultipliers ? (
        <>
          <p className="mt-3 text-xs text-zinc-500">
            Type a number, then tap the unit to submit.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MULTIPLIERS.map((m) => (
              <button
                key={m.label}
                type="button"
                disabled={submitting}
                onClick={() => submitWithFactor(m.factor)}
                className="rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: BRAND_BLUE_PALE,
                  color: BRAND_BLUE_DARK,
                  backgroundColor: "white",
                }}
                onMouseEnter={(e) => {
                  if (submitting) return;
                  e.currentTarget.style.backgroundColor = BRAND_BLUE_PALE;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "white";
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4">
          <PrimaryButton onClick={submitDirect} disabled={submitting}>
            {submitting ? "Saving…" : "Submit guess"}
          </PrimaryButton>
        </div>
      )}
    </Card>
  );
}

function RevealCard({
  qIndex,
  question,
  userAnswer,
  othersAnswers,
  isLast,
  onNext,
}: {
  qIndex: number;
  question: Question;
  userAnswer: number;
  othersAnswers: number[];
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <Card>
      <ProgressBar idx={qIndex} />
      <div className="text-xs tracking-widest text-zinc-500 uppercase">
        Question {qIndex + 1} of {QUESTIONS.length}
      </div>
      <h2 className="mt-1 mb-3 text-xl leading-snug font-semibold">{question.prompt}</h2>
      <p className="text-base">
        You guessed{" "}
        <span className="font-bold" style={{ color: BRAND_BLUE_DARK }}>
          {question.formatAnswer(userAnswer)}
        </span>
        . The research says {question.correctText}.
      </p>
      <Legend />
      <ScatterChart
        question={question}
        userAnswer={userAnswer}
        othersAnswers={othersAnswers}
      />
      <div className="mt-5">
        <PrimaryButton onClick={onNext}>
          {isLast ? "See the summary" : "Next question"}
        </PrimaryButton>
      </div>
    </Card>
  );
}

function Legend() {
  return (
    <div className="my-2 flex flex-wrap gap-4 text-xs text-zinc-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-400" />
        Other guesses
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: BRAND_BLUE }}
        />
        You
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
        Research answer
      </span>
    </div>
  );
}

function ScatterChart({
  question,
  userAnswer,
  othersAnswers,
}: {
  question: Question;
  userAnswer: number;
  othersAnswers: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const all = othersAnswers.slice();
    const maxVal = Math.max(...all, question.correct, userAnswer);
    const minVal = Math.min(...all, question.correct, userAnswer, 0);
    const span = Math.max(1, maxVal - minVal);
    const pad = span * 0.08;
    const xMin = Math.max(0, minVal - pad);
    const xMax = maxVal + pad;

    const others = all.map((v) => ({ x: v, y: (Math.random() - 0.5) * 0.6 }));

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Other guesses",
            data: others,
            backgroundColor: "rgba(120, 130, 150, 0.55)",
            borderColor: "rgba(120, 130, 150, 0.7)",
            pointRadius: 4,
            pointHoverRadius: 5,
            order: 2,
          },
          {
            label: "Your guess",
            data: [{ x: userAnswer, y: 0 }],
            backgroundColor: BRAND_BLUE,
            borderColor: BRAND_BLUE,
            pointRadius: 9,
            pointHoverRadius: 9,
            pointStyle: "circle",
            order: 1,
          },
          {
            label: "Research answer",
            data: [{ x: question.correct, y: 0 }],
            backgroundColor: "#047857",
            borderColor: "#047857",
            pointRadius: 8,
            pointHoverRadius: 8,
            pointStyle: "rectRot",
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${question.formatAnswer(ctx.parsed.x ?? 0)}`,
              title: () => "",
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            min: xMin,
            max: xMax,
            title: { display: false },
            ticks: { callback: (v) => fmtCompact(Number(v)) },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          y: {
            min: -1,
            max: 1,
            display: false,
            grid: { display: false },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [question, userAnswer, othersAnswers]);

  return (
    <div className="relative mt-2 h-36">
      <canvas ref={canvasRef} />
    </div>
  );
}

const SHARE_PROMPT =
  "I just took the fun PadhaiPal quiz on what universal foundational literacy could mean for India by 2050. Take a guess yourself:";

function ShareAndSubscribeCard({ shareToken }: { shareToken: string | null }) {
  const [origin, setOrigin] = useState("");
  const [textCopied, setTextCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = origin
    ? shareToken
      ? `${origin}/quiz/share/${shareToken}`
      : `${origin}/quiz`
    : "";
  const fullShareText = `${SHARE_PROMPT} ${shareUrl}`;

  const encodedText = encodeURIComponent(SHARE_PROMPT);
  const encodedUrl = encodeURIComponent(shareUrl);
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(fullShareText);
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    } catch {}
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "PadhaiPal Quiz",
          text: SHARE_PROMPT,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled — fall through
      }
    }
    copyText();
  }

  const buttonStyle = "rounded-lg border-2 px-3 py-2 text-sm font-medium transition hover:bg-zinc-50";
  const buttonInline = { borderColor: BRAND_BLUE_PALE, color: BRAND_BLUE_DARK };

  return (
    <Card>
      <h3 className="text-lg font-semibold">Share your results</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Copy the message below, or send straight to a friend.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div
          className="rounded-lg border p-3 text-sm leading-relaxed"
          style={{ borderColor: BRAND_BLUE_PALE, backgroundColor: `${BRAND_BLUE_PALE}40` }}
        >
          {SHARE_PROMPT}{" "}
          {shareUrl ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: BRAND_BLUE_DARK }}
            >
              {shareUrl}
            </a>
          ) : (
            <span className="text-zinc-400">loading link…</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyText}
            disabled={!shareUrl}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: BRAND_BLUE }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BRAND_BLUE_DARK)
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BRAND_BLUE)
            }
          >
            {textCopied ? "Text copied!" : "Copy text"}
          </button>
          <button
            onClick={handleNativeShare}
            disabled={!shareUrl}
            className={buttonStyle}
            style={buttonInline}
          >
            Share…
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a href={twitterHref} target="_blank" rel="noopener noreferrer" className={buttonStyle} style={buttonInline}>
          Share on X
        </a>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={buttonStyle} style={buttonInline}>
          WhatsApp
        </a>
        <a href={linkedinHref} target="_blank" rel="noopener noreferrer" className={buttonStyle} style={buttonInline}>
          LinkedIn
        </a>
        <a href={facebookHref} target="_blank" rel="noopener noreferrer" className={buttonStyle} style={buttonInline}>
          Facebook
        </a>
      </div>

      <div
        className="my-5 border-t border-dashed"
        style={{ borderColor: BRAND_BLUE_PALE }}
      />

      <SubscribeForm />
    </Card>
  );
}

function SubscribeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);
    const trimmedName = name.trim();
    try {
      const res = await fetch("/api/quiz/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          ...(trimmedName ? { name: trimmedName } : {}),
        }),
      });
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(
          res.status === 400
            ? "That email doesn't look right. Please check and try again."
            : "Something went wrong. Please try again.",
        );
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div>
        <h3 className="text-lg font-semibold">You&apos;re on the list 🎉</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Thanks{name.trim() ? `, ${name.trim()}` : ""} — we&apos;ll send the occasional update on
          PadhaiPal&apos;s progress.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border-2 px-3 py-2.5 text-base outline-none focus:outline-none";

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-lg font-semibold">Stay in the loop</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Pop your details in to get occasional updates from PadhaiPal.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          className={inputClass}
          style={{ borderColor: BRAND_BLUE_PALE }}
          onFocus={(e) => (e.currentTarget.style.borderColor = BRAND_BLUE)}
          onBlur={(e) => (e.currentTarget.style.borderColor = BRAND_BLUE_PALE)}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            className={`flex-1 ${inputClass}`}
            style={{ borderColor: BRAND_BLUE_PALE }}
            onFocus={(e) => (e.currentTarget.style.borderColor = BRAND_BLUE)}
            onBlur={(e) => (e.currentTarget.style.borderColor = BRAND_BLUE_PALE)}
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="rounded-lg px-5 py-2.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: BRAND_BLUE }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BRAND_BLUE_DARK)
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BRAND_BLUE)
            }
          >
            {status === "submitting" ? "Saving…" : "Sign up"}
          </button>
        </div>
      </div>
      {errorMsg && <p className="mt-2 text-sm text-rose-600">{errorMsg}</p>}
      <p className="mt-3 text-xs text-zinc-500">
        We&apos;ll only email you about PadhaiPal updates. We won&apos;t share your details with
        anyone, and you can unsubscribe at any time.
      </p>
    </form>
  );
}

function Summary({
  answers,
  completed,
  fetchOthersAnswers,
  shareToken,
}: {
  answers: (number | null)[];
  completed: number | null;
  fetchOthersAnswers: (idx: number) => Promise<number[]>;
  shareToken: string | null;
}) {
  const [allByQ, setAllByQ] = useState<Record<number, number[]>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(QUESTIONS.map((_, i) => fetchOthersAnswers(i))).then((results) => {
      if (cancelled) return;
      const map: Record<number, number[]> = {};
      results.forEach((r, i) => (map[i] = r));
      setAllByQ(map);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchOthersAnswers]);

  return (
    <>
      <Card>
        <h2 className="mb-1 text-xl font-semibold">Quiz complete</h2>
        <p className="text-base">{PREMISE}</p>
        <p className="mt-3 text-base">
          {completed === null ? (
            <span className="text-zinc-500">Loading…</span>
          ) : completed === 1 ? (
            <>
              <span className="font-bold" style={{ color: BRAND_BLUE_DARK }}>
                1
              </span>{" "}
              person has completed this quiz so far.
            </>
          ) : (
            <>
              <span className="font-bold" style={{ color: BRAND_BLUE_DARK }}>
                {completed.toLocaleString()}
              </span>{" "}
              people have completed this quiz so far.
            </>
          )}
        </p>
      </Card>

      <ShareAndSubscribeCard shareToken={shareToken} />

      <Card>
        {QUESTIONS.map((q, i) => {
          const userAnswer = answers[i];
          const others = allByQ[i] ?? [];
          return (
            <div
              key={i}
              className="border-t border-dashed py-4 first:border-t-0 first:pt-0"
              style={{ borderColor: BRAND_BLUE_PALE }}
            >
              <div className="text-xs tracking-widest text-zinc-500 uppercase">
                Question {i + 1}
              </div>
              <h3 className="mt-0.5 text-base font-semibold">{q.prompt}</h3>
              <p className="mt-1 text-sm text-zinc-600">
                You:{" "}
                <span className="font-bold" style={{ color: BRAND_BLUE_DARK }}>
                  {userAnswer === null ? "—" : q.formatAnswer(userAnswer)}
                </span>{" "}
                · Research: {q.correctText}
              </p>
              <ScatterChart question={q} userAnswer={userAnswer ?? 0} othersAnswers={others} />
            </div>
          );
        })}
      </Card>

      <Card>
        <p>
          Want the full picture? Read the original article from the What Works Hub for Global
          Education:{" "}
          <a
            href={PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: BRAND_BLUE_DARK }}
          >
            Universal Foundational Learning Insight Note (PDF)
          </a>
        </p>
      </Card>
    </>
  );
}