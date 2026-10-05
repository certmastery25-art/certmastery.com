import type { Metadata } from "next";
import { QuizRunner } from "@/components/quiz-runner";

export const metadata: Metadata = { title: "Quiz session" };

export default function QuizPage({ params }: { params: { id: string } }) {
  return <main className="main-content inner-page quiz-page"><QuizRunner quizId={params.id} /></main>;
}