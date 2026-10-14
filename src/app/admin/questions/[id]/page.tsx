import type { Metadata } from "next";
import { QuestionView } from "@/components/admin/question-view";

export const metadata: Metadata = { title: "Admin · Question" };

export default async function AdminQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionView id={id} />;
}
