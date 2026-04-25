import type { Metadata } from "next";
import { QuizApp } from "./quiz-app";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashboard.padhaipal.com";
const TITLE = "PadhaiPal Quiz — What if every Indian child could read?";
const DESCRIPTION =
  "Take the 5-question quiz on what universal foundational literacy could mean for India by 2050. Guess, then see what the research says.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/quiz",
    siteName: "PadhaiPal",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function QuizPage() {
  return <QuizApp />;
}