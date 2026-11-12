import type { Metadata } from "next";
import { NseExamRunner } from "@/components/nse/exam-runner";

export const metadata: Metadata = { title: "Azure practice exam", robots: { index: false, follow: false } };

export default async function AzureExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="main-content inner-page nse-page"><NseExamRunner attemptId={id} /></main>;
}
