import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FlaskConical } from "lucide-react";
import { StartExam } from "@/components/nse/start-exam";
import { authOptions } from "@/lib/auth";
import { TRACK_LABELS } from "@/lib/nse/progress";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const getPathway = (slug: string) => prisma.nsePathway.findFirst({
  where: { slug, status: "PUBLISHED" },
  include: {
    modules: { where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { questions: { where: { status: "PUBLISHED" } } } } } },
    labs: { where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, select: { slug: true, title: true, difficulty: true, durationMinutes: true } },
  },
});

export async function generateMetadata({ params }: { params: Promise<{ pathway: string }> }): Promise<Metadata> {
  const pathway = await getPathway((await params).pathway);
  return { title: pathway?.title ?? "Fortinet NSE", description: pathway?.summary };
}

export default async function PathwayPage({ params }: { params: Promise<{ pathway: string }> }) {
  const pathway = await getPathway((await params).pathway);
  if (!pathway) notFound();
  const session = await getServerSession(authOptions);
  const userId = session?.user.id;
  const [practised, attempts] = userId ? await Promise.all([
    prisma.nseExamItem.findMany({ where: { attempt: { userId }, answeredAt: { not: null }, question: { moduleId: { in: pathway.modules.map((module) => module.id) } } }, distinct: ["questionId"], select: { question: { select: { moduleId: true } } } }),
    prisma.nseExamAttempt.findMany({ where: { userId, pathwayId: pathway.id, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 5, select: { id: true, mode: true, correctAnswers: true, totalQuestions: true, submittedAt: true } }),
  ]) : [[], []];
  const done = new Set(practised.map((row) => row.question.moduleId));
  const total = pathway.modules.reduce((sum, module) => sum + module._count.questions, 0);
  const reviewed = pathway.modules.filter((module) => module.lastReviewedAt).length;

  return (
    <main className="main-content inner-page nse-page">
      <Link href="/fortinet" className="back-link"><ArrowLeft size={15} /> Fortinet NSE Academy</Link>
      <div className="page-heading nse-pathway-heading">
        <p className="eyebrow">NSE {pathway.level}{pathway.track ? ` · ${TRACK_LABELS[pathway.track]}` : ""}</p>
        <h1>{pathway.title}</h1>
        <p>{pathway.summary}</p>
      </div>

      <div className="nse-pathway-grid">
        <div>
          <section><h2>Overview</h2><p>{pathway.overview}</p></section>
          <section><h2>Learning objectives</h2><ul className="nse-check-list">{pathway.objectives.map((objective) => <li key={objective}><CheckCircle2 size={16} /> {objective}</li>)}</ul></section>
          <section aria-labelledby="modules">
            <h2 id="modules">Practise by topic</h2>
            <ol className="nse-module-list">
              {pathway.modules.map((module, index) => (
                <li key={module.id}>
                  <span className="lab-card-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3><Link href={`/fortinet/${pathway.slug}/${module.slug}`}>{module.title}</Link></h3>
                    <p>{module.summary}</p>
                    <div className="lab-card-tags"><span>{module._count.questions} questions</span><span>Weight {module.weight}</span>{module.productVersion && <span>{module.productVersion}</span>}{done.has(module.id) && <span className="lab-complete-tag"><CheckCircle2 size={13} /> Practised</span>}</div>
                  </div>
                  <ArrowRight size={16} aria-hidden="true" />
                </li>
              ))}
            </ol>
          </section>
          {pathway.labs.length > 0 && (
            <section>
              <h2>Practical labs</h2>
              <ul className="nse-lab-links">{pathway.labs.map((lab) => <li key={lab.slug}><FlaskConical size={15} /><Link className="text-link" href={`/fortinet/labs/${lab.slug}`}>{lab.title}</Link><span>{lab.difficulty.toLowerCase()} · {lab.durationMinutes} min</span></li>)}</ul>
            </section>
          )}
        </div>

        <aside className="nse-pathway-side">
          <section id="exams" className="nse-card">
            <h2>Practise</h2>
            <div className="nse-exam-option"><h3>Practice</h3><p>Untimed, with the answer and explanation after each question.</p><StartExam pathway={pathway.slug} mode="PRACTICE" count={10} label="10 questions" signedIn={Boolean(userId)} />{total > 10 && <StartExam pathway={pathway.slug} mode="PRACTICE" count={25} label="25 questions" secondary signedIn={Boolean(userId)} />}{total > 25 && <StartExam pathway={pathway.slug} mode="PRACTICE" count={50} label="50 questions" secondary signedIn={Boolean(userId)} />}</div>
            <div className="nse-exam-option"><h3>Timed mock exam</h3><p>Up to {pathway.mockQuestions} questions at the pace of {pathway.mockMinutes} minutes for a full paper. Answers appear only after you submit. Time is scaled to the questions available.</p><StartExam pathway={pathway.slug} mode="MOCK" label="Start mock" secondary signedIn={Boolean(userId)} /></div>
            <div className="nse-exam-option"><h3>Readiness assessment</h3><p>Untimed, across the whole syllabus. It identifies your weak topics.</p><StartExam pathway={pathway.slug} mode="READINESS" label="Assess readiness" secondary signedIn={Boolean(userId)} /></div>
            <p className="nse-disclaimer">Mock settings and scores are CertMastery&apos;s own, not Fortinet&apos;s.</p>
          </section>

          <section className="nse-card">
            <h2>Official exam</h2>
            <ul className="nse-plain-list">{pathway.officialExams.map((exam) => <li key={exam}>{exam}</li>)}</ul>
            {pathway.officialSpec ? <p>{pathway.officialSpec}</p> : <p className="nse-flagged-note">We couldn&apos;t verify the duration, question count or pass mark from Fortinet&apos;s public pages, so none are shown. Check the official page.</p>}
            <a className="text-link" href={pathway.officialUrl} target="_blank" rel="noreferrer">Fortinet&apos;s page <ExternalLink size={13} /></a>
            <h3>Prerequisites</h3>
            <ul className="nse-plain-list">{pathway.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>

          <section className="nse-card">
            <h2>Content status</h2>
            <p><strong>{total}</strong> original questions so far. Initial target: {pathway.questionTarget}.</p>
            <p>{reviewed === pathway.modules.length && reviewed > 0 ? "All modules have been expert reviewed." : `${pathway.modules.length - reviewed} of ${pathway.modules.length} modules are awaiting expert review.`}</p>
            {pathway.sourcesCheckedAt && <p>Programme details last checked against Fortinet&apos;s site on {pathway.sourcesCheckedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.</p>}
          </section>

          {attempts.length > 0 && (
            <section className="nse-card">
              <h2>Recent results</h2>
              <ul className="nse-plain-list">{attempts.map((attempt) => <li key={attempt.id}><Link className="text-link" href={`/fortinet/exam/${attempt.id}`}>{attempt.mode.toLowerCase()}: {attempt.totalQuestions ? Math.round((attempt.correctAnswers / attempt.totalQuestions) * 100) : 0}%</Link></li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
