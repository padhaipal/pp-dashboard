import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatQuestionAnswer,
  formatResearchAnswer,
  QUESTIONS_DATA,
  SITE_URL,
} from "../../questions";

export const dynamic = "force-dynamic";

interface ShareData {
  answers: { question_index: number; answer: number }[];
  completed: number;
}

async function fetchShare(token: string): Promise<ShareData | null> {
  const baseUrl = process.env.PP_SKETCH_INTERNAL_URL;
  if (!baseUrl) {
    throw new Error("PP_SKETCH_INTERNAL_URL is not set");
  }
  const res = await fetch(
    `${baseUrl}/quiz/share/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`share fetch failed ${res.status}`);
  return res.json();
}

const TITLE = "Take the PadhaiPal quiz — what if every Indian child could read?";
const DESCRIPTION =
  "Compare your guesses to the research on what universal foundational literacy could mean for India by 2050.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    metadataBase: new URL(SITE_URL),
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: `/quiz/share/${token}`,
      siteName: "PadhaiPal",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

const BRAND_BLUE_DARK = "#1683BC";
const BRAND_BLUE_PALE = "#D3EBF7";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShare(token);
  if (!data) notFound();

  const answersByIndex = new Map<number, number>(
    data.answers.map((a) => [a.question_index, a.answer]),
  );
  const completedLine =
    data.completed === 0
      ? "Be one of the first to take the quiz."
      : data.completed === 1
        ? "Joined by 1 person so far."
        : `Joined by ${data.completed.toLocaleString()} people so far.`;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
        <h1 className="text-center text-3xl leading-tight font-semibold">
          What if every Indian child could read?
        </h1>
        <p className="mt-2 mb-6 text-center text-zinc-600">
          A friend just took the PadhaiPal quiz. Here&apos;s how their guesses compared.
        </p>

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
          <p className="text-center text-zinc-700 sm:text-left">
            PadhaiPal is aiming to teach a child to read for less than{" "}
            <strong>$10</strong>. That&apos;s cheaper than everyone else out there. Here is our
            website for more information{" "}
            <a
              href="https://www.padhaipal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: BRAND_BLUE_DARK }}
            >
              www.padhaipal.com
            </a>
          </p>
        </div>

        <div
          className="mb-4 rounded-2xl border bg-white p-6 shadow-sm"
          style={{ borderColor: BRAND_BLUE_PALE }}
        >
          <h2 className="mb-1 text-xl font-semibold">Their guesses vs. the research</h2>
          <p className="text-sm text-zinc-600">{completedLine}</p>
          <div className="mt-4 flex flex-col gap-4">
            {QUESTIONS_DATA.map((q, i) => {
              const guess = answersByIndex.get(i);
              return (
                <div
                  key={i}
                  className="border-t border-dashed pt-4 first:border-t-0 first:pt-0"
                  style={{ borderColor: BRAND_BLUE_PALE }}
                >
                  <div className="text-xs tracking-widest text-zinc-500 uppercase">
                    Question {i + 1}
                  </div>
                  <h3 className="mt-0.5 text-base font-semibold">{q.prompt}</h3>
                  <p className="mt-1 text-sm">
                    <span className="text-zinc-600">Their guess:</span>{" "}
                    <span className="font-bold" style={{ color: BRAND_BLUE_DARK }}>
                      {guess === undefined ? "—" : formatQuestionAnswer(q, guess)}
                    </span>
                    <br />
                    <span className="text-zinc-600">Research:</span>{" "}
                    <span className="font-bold text-emerald-700">
                      {formatResearchAnswer(q)}
                    </span>
                    {q.researchAnnotation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="mb-4 rounded-2xl border bg-white p-6 shadow-sm"
          style={{ borderColor: BRAND_BLUE_PALE }}
        >
          <h2 className="text-xl font-semibold">Your turn</h2>
          <p className="mt-2 text-zinc-700">
            Take the 5-question quiz yourself — guess, then see what the research says.
          </p>
          <div className="mt-4">
            <Link
              href="/quiz"
              className="inline-block rounded-lg px-5 py-3 font-semibold text-white"
              style={{ backgroundColor: BRAND_BLUE_DARK }}
            >
              Take the quiz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}