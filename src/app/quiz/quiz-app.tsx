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

Chart.register(ScatterController, PointElement, LinearScale, Tooltip);

const BRAND_BLUE = "#1D9EDF";
const BRAND_BLUE_DARK = "#1683BC";
const BRAND_BLUE_PALE = "#D3EBF7";

interface Question {
  prompt: string;
  unit: string;
  placeholder: string;
  correct: number;
  formatAnswer: (n: number) => string;
  correctText: React.ReactNode;
  min: number;
  max: number;
  step: number;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const QUESTIONS: Question[] = [
  {
    prompt: "How much richer would the country be?",
    unit: "$",
    placeholder: "e.g. 5",
    correct: 37,
    formatAnswer: (n) => `$${fmtNum(n)}`,
    correctText: <span className="font-bold text-emerald-700">$37</span>,
    min: 0,
    max: 200,
    step: 0.1,
  },
  {
    prompt: "How much higher would India's per capita GDP be?",
    unit: "%",
    placeholder: "e.g. 20",
    correct: 47,
    formatAnswer: (n) => `${fmtNum(n)}%`,
    correctText: (
      <>
        <span className="font-bold text-emerald-700">47%</span> higher
      </>
    ),
    min: 0,
    max: 300,
    step: 0.1,
  },
  {
    prompt: "How many more Indian children would have gone to secondary school?",
    unit: "",
    placeholder: "e.g. 10",
    correct: 44,
    formatAnswer: (n) => fmtNum(n),
    correctText: (
      <>
        <span className="font-bold text-emerald-700">44</span>
        {" — that's roughly 1.6× Australia's population!"}
      </>
    ),
    min: 0,
    max: 300,
    step: 0.1,
  },
  {
    prompt: "How many Indian child marriages would have been averted?",
    unit: "",
    placeholder: "e.g. 0.5",
    correct: 1.2,
    formatAnswer: (n) => fmtNum(n),
    correctText: <span className="font-bold text-emerald-700">1.2</span>,
    min: 0,
    max: 20,
    step: 0.05,
  },
  {
    prompt:
      "How many children's lives would be saved (because their mums can now read)?",
    unit: "",
    placeholder: "e.g. 50",
    correct: 420,
    formatAnswer: (n) => fmtNum(n),
    correctText: <span className="font-bold text-emerald-700">420,000</span>,
    min: 0,
    max: 5000,
    step: 10,
  },
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

export function QuizApp() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    new Array(QUESTIONS.length).fill(null),
  );
  const [revealAnswers, setRevealAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
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
        await submit(qIndex, value);
        const others = await fetchOthersAnswers(qIndex);
        setAnswers((prev) => {
          const next = prev.slice();
          next[qIndex] = value;
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
    [qIndex, submit, fetchOthersAnswers],
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
    if (phase !== "summary") return;
    fetch("/api/quiz/stats")
      .then((r) => (r.ok ? r.json() : { completed: 0 }))
      .then((j: { completed: number }) => setCompleted(j.completed ?? 0))
      .catch(() => setCompleted(0));
  }, [phase]);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
        <h1 className="text-center text-3xl leading-tight font-semibold">
          What if every Indian child could read?
        </h1>
        <p className="mt-2 mb-6 text-center text-zinc-600">
          A 5-question quiz. Take a guess — then see what the research says.
        </p>

        <BrandCard />

        {phase === "intro" && <Intro onStart={() => setPhase("question")} />}

        {phase === "question" && (
          <QuestionCard
            qIndex={qIndex}
            question={QUESTIONS[qIndex]}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}

        {phase === "reveal" && (
          <RevealCard
            qIndex={qIndex}
            question={QUESTIONS[qIndex]}
            userAnswer={answers[qIndex] ?? 0}
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

  function handleClick() {
    const n = parseFloat(value);
    if (value === "" || Number.isNaN(n)) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    onSubmit(n);
  }

  const inputBorder = error ? "#e11d48" : BRAND_BLUE_PALE;
  return (
    <Card>
      <ProgressBar idx={qIndex} />
      <div className="text-xs tracking-widest text-zinc-500 uppercase">
        Question {qIndex + 1} of {QUESTIONS.length}
      </div>
      <p className="mt-1 text-base">{PREMISE}</p>
      <h2 className="mt-3 mb-3 text-xl leading-snug font-semibold">{question.prompt}</h2>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          min={question.min}
          max={question.max}
          step={question.step}
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleClick();
          }}
          className="flex-1 rounded-lg border-2 px-3 py-3 text-lg outline-none focus:outline-none"
          style={{ borderColor: inputBorder }}
          onFocus={(e) => {
            if (!error) e.currentTarget.style.borderColor = BRAND_BLUE;
          }}
          onBlur={(e) => {
            if (!error) e.currentTarget.style.borderColor = BRAND_BLUE_PALE;
          }}
        />
        {question.unit && (
          <div
            className="flex items-center rounded-lg border-2 px-3 text-zinc-700"
            style={{
              borderColor: BRAND_BLUE_PALE,
              backgroundColor: `${BRAND_BLUE_PALE}80`,
            }}
          >
            {question.unit}
          </div>
        )}
      </div>
      <div className="mt-4">
        <PrimaryButton onClick={handleClick} disabled={submitting}>
          {submitting ? "Saving…" : "Submit guess"}
        </PrimaryButton>
      </div>
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
        <span className="font-bold text-rose-600">{question.formatAnswer(userAnswer)}</span>. The
        research says {question.correctText}.
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
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
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
            backgroundColor: "#e11d48",
            borderColor: "#e11d48",
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
            pointRadius: 11,
            pointHoverRadius: 11,
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
            title: { display: !!question.unit, text: question.unit },
            ticks: { callback: (v) => fmtNum(Number(v)) },
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

function Summary({
  answers,
  completed,
  fetchOthersAnswers,
}: {
  answers: (number | null)[];
  completed: number | null;
  fetchOthersAnswers: (idx: number) => Promise<number[]>;
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
                <span className="font-bold text-rose-600">
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
        <p className="mt-4 text-zinc-700">{PADHAIPAL_PITCH}</p>
      </Card>
    </>
  );
}