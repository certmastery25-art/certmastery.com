import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ProgressDashboard, type LabProgress } from "@/components/progress-dashboard";
import { authOptions } from "@/lib/auth";
import { ccnaLabs } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My progress" };

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  const completions = session?.user.id
    ? await prisma.labCompletion.findMany({ where: { userId: session.user.id }, select: { labSlug: true, completedAt: true } })
    : [];
  const labs: LabProgress[] = ccnaLabs.map((lab) => {
    const completion = completions.find((item) => item.labSlug === lab.slug);
    return { slug: lab.slug, title: lab.title, durationMinutes: lab.durationMinutes, completedAt: completion?.completedAt.toISOString() ?? null };
  });

  return <main className="main-content inner-page history-page"><div className="page-heading"><p className="eyebrow">My progress</p><h1>Your progress, in focus.</h1><p>See what is sticking, spot the gaps, and decide where to put your next study block.</p></div><p className="nse-history-link"><Link className="text-link" href="/fortinet/dashboard">See your Fortinet NSE progress and readiness</Link></p><ProgressDashboard labs={labs} /></main>;
}
