import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FlaskConical } from "lucide-react";
import { ModuleComplete } from "@/components/nse/module-complete";
import { StartExam } from "@/components/nse/start-exam";
import { StudyNotes } from "@/components/nse/study-notes";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const getModule = (pathwaySlug: string, slug: string) => prisma.nseModule.findFirst({
  where: { slug, status: "PUBLISHED", pathway: { slug: pathwaySlug, status: "PUBLISHED" } },
  include: {
    pathway: { select: { slug: true, title: true, modules: { where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, select: { slug: true, title: true } } } },
    _count: { select: { questions: { where: { status: "PUBLISHED" } } } },
  },
});

export async function generateMetadata({ params }: { params: Promise<{ pathway: string; module: string }> }): Promise<Metadata> {
  const { pathway, module } = await params;
  const found = await getModule(pathway, module);
  return { title: found?.title ?? "Study module", description: found?.summary };
}

export default async function ModulePage({ params }: { params: Promise<{ pathway: string; module: string }> }) {
  const { pathway: pathwaySlug, module: slug } = await params;
  const current = await getModule(pathwaySlug, slug);
  if (!current) notFound();
  const session = await getServerSession(authOptions);
  const completed = session?.user.id ? await prisma.nseModuleProgress.findUnique({ where: { userId_moduleId: { userId: session.user.id, moduleId: current.id } } }) : null;
  const siblings = current.pathway.modules;
  const next = siblings[siblings.findIndex((item) => item.slug === current.slug) + 1];

  return (
    <main className="main-content inner-page nse-page">
      <Link href={`/fortinet/${current.pathway.slug}`} className="back-link"><ArrowLeft size={15} /> {current.pathway.title}</Link>
      <div className="page-heading">
        <p className="eyebrow">{current.pathway.title}</p>
        <h1>{current.title}</h1>
        <p>{current.summary}</p>
      </div>
      <div className="nse-pathway-grid">
        <article>
          <section><h2>Learning objectives</h2><ul className="nse-check-list">{current.objectives.map((objective) => <li key={objective}><CheckCircle2 size={16} /> {objective}</li>)}</ul></section>
          <section><h2>Study notes</h2><StudyNotes source={current.notes} /></section>
          {current.exercise && <section className="nse-card nse-exercise"><h2><FlaskConical size={17} /> Practical exercise</h2><p>{current.exercise}</p><Link className="text-link" href="/fortinet/labs">Open the labs</Link></section>}
        </article>
        <aside className="nse-pathway-side">
          <section className="nse-card">
            <h2>Knowledge check</h2>
            <p>{current._count.questions} original questions on this current. You see explanations after each answer.</p>
            <StartExam pathway={current.pathway.slug} module={current.slug} mode="PRACTICE" count={Math.min(50, Math.max(1, current._count.questions))} label="Check your knowledge" signedIn={Boolean(session?.user.id)} />
            {session?.user.id && <ModuleComplete moduleId={current.id} initial={Boolean(completed)} />}
          </section>
          <section className="nse-card"><h2>Key concepts</h2><div className="lab-card-tags">{current.keyConcepts.map((concept) => <span key={concept}>{concept}</span>)}</div></section>
          <section className="nse-card">
            <h2>Sources and review</h2>
            <ul className="nse-plain-list">{current.sources.map((source) => <li key={source}><a className="text-link" href={source} target="_blank" rel="noreferrer">{new URL(source).hostname.replace("www.", "")}{new URL(source).pathname.slice(0, 32)} <ExternalLink size={12} /></a></li>)}</ul>
            {current.productVersion && <p><strong>Version:</strong> {current.productVersion}. Commands and features can change between releases.</p>}
            <p>{current.lastReviewedAt ? `Expert reviewed on ${current.lastReviewedAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}.` : "Awaiting expert review. Check details against Fortinet's documentation."}</p>
          </section>
          {next && <Link className="button button-secondary nse-next" href={`/fortinet/${current.pathway.slug}/${next.slug}`}>Next: {next.title} <ArrowRight size={16} /></Link>}
        </aside>
      </div>
    </main>
  );
}
