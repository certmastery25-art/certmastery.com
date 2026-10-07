import type { Metadata } from "next";
import { QuizRunner } from "@/components/quiz-runner";

export const metadata: Metadata = { title: "Quiz session" };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="main-content inner-page quiz-page"><QuizRunner quizId={id} /></main>;
}