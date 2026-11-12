import type { Metadata } from "next";
import { PathwayView, getPathway } from "@/components/nse/pathway-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ pathway: string }> }): Promise<Metadata> {
  const pathway = await getPathway("AZURE", (await params).pathway);
  if (!pathway) return { title: "Microsoft Azure" };
  return {
    title: `${pathway.slug.toUpperCase()} practice questions and mock exams`,
    description: `Prepare for ${pathway.title} with original practice questions by exam domain, timed mock exams and readiness tracking.`,
    alternates: { canonical: `/azure/${pathway.slug}` },
  };
}

export default async function AzurePathwayPage({ params }: { params: Promise<{ pathway: string }> }) {
  return <PathwayView programme="AZURE" slug={(await params).pathway} />;
}
