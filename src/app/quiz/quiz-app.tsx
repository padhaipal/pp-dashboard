"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Chart,
  LinearScale,
  PointElement,
  ScatterController,
  Tooltip,
} from "chart.js";

Chart.register(ScatterController, PointElement, LinearScale, Tooltip);

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
    unit: "$ trillion",
    placeholder: "e.g. 5",
    correct: 37,
    formatAnswer: (n) => `$${fmtNum(n)} trillion`,
    correctText: (
      <>
        <span className="font-bold text-emerald-700">$37 trillion</span>
      </>
    ),
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
        <span className="font-bold text-emerald-700">47% higher</span>
      </>
    ),
    min: 0,
    max: 300,
    step: 0.1,
  },
  {
    prompt: "How many more Indian children would have gone to secondary school?",
    unit: "million",
    placeholder: "e.g. 10",
    correct: 44,
    formatAnswer: (n) => `${fmtNum(n)} million`,
    correctText: (
      <>
        <span className="font-bold text-emerald-700">44 million</span>
        {" — that's roughly 1.6× Australia's population!"}
      </>
    ),
    min: 0,
    max: 300,
    step: 0.1,
  },
  {
    prompt: "How many Indian child marriages would have been averted?",
    unit: "million",
    placeholder: "e.g. 0.5",
    correct: 1,
    formatAnswer: (n) => `${fmtNum(n)} million`,
    correctText: (
      <>
        <span className="font-bold text-emerald-700">1 million</span>
      </>
    ),
    min: 0,
    max: 20,
    step: 0.05,
  },
  {
    prompt:
      "How many children's lives would be saved (because their mums can now read)?",
    unit: "thousand",
    placeholder: "e.g. 50",
    correct: 400,
    formatAnswer: (n) => `${fmtNum(n)} thousand`,
    correctText: (
      <>
        <span className="font-bold text-emerald-700">400,000</span>
      </>
    ),
    min: 0,
    max: 5000,
    step: 10,
  },
];

const PREMISE = (
  <>
    If <strong className="text-amber-700">90% of 10-year-olds</strong> in India became literate every
    year, then by <strong className="text-amber-700">2050</strong>…
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

  const fetchAnswers = useCallback(async (idx: number): Promise<number[]> => {
    const res = await fetch(`/api/quiz/answers?question=${idx}`);
    if (!res.ok) return [];
    const j = (await res.json()) as { answers: number[] };
    return j.answers ?? [];
  }, []);

  const handleSubmit = useCallback(
    async (value: number) => {
      setSubmitting(true);
      try {
        await submit(qIndex, value);
        const all = await fetchAnswers(qIndex);
        setAnswers((prev) => {
          const next = prev.slice();
          next[qIndex] = value;
          return next;
        });
        setRevealAnswers(all);
        setPhase("reveal");
      } catch {
        alert("Something went wrong saving your answer. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [qIndex, submit, fetchAnswers],
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
    <div className="min-h-screen bg-amber-50 text-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
        <div className="text-xs font-bold tracking-widest text-amber-700">
          PADHAIPAL · SUPPORTER UPDATE
        </div>
        <h1 className="mt-2 text-3xl leading-tight font-semibold">
          What if every Indian child could read?
        </h1>
        <p className="mt-1 mb-6 text-zinc-600">
          A 5-question quiz. Take a guess — then see what the research says.
        </p>

        {phase === "intro" && (
          <Intro onStart={() => setPhase("question")} />
        )}

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
            allAnswers={revealAnswers}
            isLast={qIndex === QUESTIONS.length - 1}
            onNext={handleNext}
          />
        )}

        {phase === "summary" && (
          <Summary
            answers={answers}
            completed={completed}
            fetchAnswers={fetchAnswers}
          />
        )}
      </div>
    </div>
  );
}

function ProgressBar({ idx }: { idx: number }) {
  return (
    <div className="mb-5 flex gap-1.5">
      {QUESTIONS.map((_, i) => (
        <span
          key={i}
          className={
            "h-1.5 flex-1 rounded " +
            (i < idx ? "bg-amber-500" : i === idx ? "bg-amber-700" : "bg-amber-200")
          }
        />
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      {children}
    </div>
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
        <button
          onClick={onStart}
          className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600"
        >
          Start the quiz
        </button>
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
          className={
            "flex-1 rounded-lg border-2 px-3 py-3 text-lg outline-none " +
            (error ? "border-rose-500" : "border-amber-200 focus:border-amber-500")
          }
        />
        <div className="flex items-center rounded-lg border-2 border-amber-200 bg-amber-100/60 px-3 text-zinc-600">
          {question.unit}
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={handleClick}
          disabled={submitting}
          className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Submit guess"}
        </button>
      </div>
    </Card>
  );
}

function RevealCard({
  qIndex,
  question,
  userAnswer,
  allAnswers,
  isLast,
  onNext,
}: {
  qIndex: number;
  question: Question;
  userAnswer: number;
  allAnswers: number[];
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
        allAnswers={allAnswers}
      />
      <div className="mt-5">
        <button
          onClick={onNext}
          className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600"
        >
          {isLast ? "See the summary" : "Next question"}
        </button>
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
  allAnswers,
}: {
  question: Question;
  userAnswer: number;
  allAnswers: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const all = allAnswers.slice();
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
            title: { display: true, text: question.unit },
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
  }, [question, userAnswer, allAnswers]);

  return (
    <div className="relative mt-2 h-36">
      <canvas ref={canvasRef} />
    </div>
  );
}

function Summary({
  answers,
  completed,
  fetchAnswers,
}: {
  answers: (number | null)[];
  completed: number | null;
  fetchAnswers: (idx: number) => Promise<number[]>;
}) {
  const [allByQ, setAllByQ] = useState<Record<number, number[]>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(QUESTIONS.map((_, i) => fetchAnswers(i))).then((results) => {
      if (cancelled) return;
      const map: Record<number, number[]> = {};
      results.forEach((r, i) => (map[i] = r));
      setAllByQ(map);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAnswers]);

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
              <span className="font-bold text-amber-700">1</span> person has completed this quiz so
              far.
            </>
          ) : (
            <>
              <span className="font-bold text-amber-700">
                {completed.toLocaleString()}
              </span>{" "}
              people have completed this quiz so far.
            </>
          )}
        </p>
        <p className="mt-2 text-zinc-700">
          Here&apos;s how everyone has answered. Your guesses are highlighted.
        </p>
      </Card>

      <Card>
        {QUESTIONS.map((q, i) => {
          const userAnswer = answers[i];
          const all = allByQ[i] ?? [];
          return (
            <div
              key={i}
              className="border-t border-dashed border-amber-200 py-4 first:border-t-0 first:pt-0"
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
              <ScatterChart question={q} userAnswer={userAnswer ?? 0} allAnswers={all} />
            </div>
          );
        })}
      </Card>

      <Card>
        <p>
          Want the full picture? Read the original insight note from the{" "}
          What Works Hub for Global Education:
        </p>
        <p className="mt-2">
          <a
            href={PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 underline hover:text-amber-800"
          >
            WWHGE — Universal Foundational Learning Insight Note (PDF)
          </a>
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          Thank you for supporting PadhaiPal — we&apos;re building WhatsApp-based literacy tools so
          every child gets a real shot at reading.
        </p>
      </Card>
    </>
  );
}