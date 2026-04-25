import type { Metadata } from "next";
import { QuizApp } from "./quiz-app";

export const metadata: Metadata = {
  title: "PadhaiPal Quiz — What if every Indian child could read?",
  description:
    "A 5-question quiz about the impact of universal foundational literacy in India.",
};

export default function QuizPage() {
  return <QuizApp />;
}