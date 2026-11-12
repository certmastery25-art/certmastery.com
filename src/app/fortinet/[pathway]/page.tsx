import type { Metadata } from "next";
import { PathwayView, getPathway } from "@/components/nse/pathway-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ pathway: string }> }): Promise<Metadata> {
  const pathway = await getPathway("FORTINET", (await params).pathway);
  return { title: pathway?.title ?? "Fortinet NSE", description: pathway?.summary };
}

export default async function PathwayPage({ params }: { params: Promise<{ pathway: string }> }) {
  return <PathwayView programme="FORTINET" slug={(await params).pathway} />;
}
