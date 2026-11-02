import type { Metadata } from "next";
import { NseStudio } from "@/components/nse/studio";
import { requireEditorPage } from "@/lib/nse/studio";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NSE Studio", robots: { index: false, follow: false, nocache: true } };

export default async function StudioPage() {
  const session = await requireEditorPage();
  const [pathways, labs, attempts, students] = await Promise.all([
    prisma.nsePathway.findMany({ orderBy: { sortOrder: "asc" }, include: { modules: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { questions: true } } } }, _count: { select: { attempts: true } } } }),
    prisma.nseLab.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.nseExamAttempt.aggregate({ where: { submittedAt: { not: null } }, _count: true, _sum: { correctAnswers: true, totalQuestions: true } }),
    prisma.nseExamAttempt.groupBy({ by: ["userId"], _count: true }),
  ]);
  const totalQuestions = attempts._sum.totalQuestions ?? 0;
  return (
    <main className="main-content inner-page nse-page">
      <div className="page-heading"><p className="eyebrow">Fortinet NSE</p><h1>NSE Studio</h1><p>Create, review and publish the programme. Students only ever see published content. {session.user.role === "ADMIN" ? "" : "An administrator publishes what you prepare."}</p></div>
      <dl className="nse-hero-stats nse-dash-stats">
        <div><dt>Submitted exams</dt><dd>{attempts._count}</dd></div>
        <div><dt>Students with attempts</dt><dd>{students.length}</dd></div>
        <div><dt>Average score</dt><dd>{totalQuestions ? `${Math.round(((attempts._sum.correctAnswers ?? 0) / totalQuestions) * 100)}%` : "None yet"}</dd></div>
        <div><dt>Questions</dt><dd>{pathways.reduce((sum, pathway) => sum + pathway.modules.reduce((moduleSum, module) => moduleSum + module._count.questions, 0), 0)}</dd></div>
      </dl>
      <NseStudio pathways={JSON.parse(JSON.stringify(pathways))} labs={JSON.parse(JSON.stringify(labs))} isAdmin={session.user.role === "ADMIN"} />
    </main>
  );
}
