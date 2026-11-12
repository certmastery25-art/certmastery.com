import type { NseProgramme } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FlaskConical } from "lucide-react";
import { StartExam } from "@/components/nse/start-exam";
import { authOptions } from "@/lib/auth";
import { PROGRAMMES } from "@/lib/nse/programmes";
import { prisma } from "@/lib/prisma";

export const getModule = (programme: NseProgramme, pathwaySlug: string, slug: string) => prisma.nseModule.findFirst({
  where: { slug, status: "PUBLISHED", pathway: { slug: pathwaySlug, status: "PUBLISHED", programme } },
  include: {
    pathway: { select: { slug: true, title: true, modules: { where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, select: { slug: true, title: true } } } },
    examObjectives: { orderBy: { sortOrder: "asc" }, select: { slug: true, title: true, skills: true } },
    _count: { select: { questions: { where: { status: "PUBLISHED" } } } },
  },
});

export async function ModuleView({ programme: key, pathway: pathwaySlug, slug }: { programme: NseProgramme; pathway: string; slug: string }) {
  const programme = PROGRAMMES[key];
  const current = await getModule(key, pathwaySlug, slug);
  if (!current) notFound();
  const session = await getServerSession(authOptions);
  const siblings = current.pathway.modules;
  const next = siblings[siblings.findIndex((item) => item.slug === current.slug) + 1];
  const available = current._count.questions;
  const signedIn = Boolean(session?.user.id);

  return (
    <main className={`main-content inner-page nse-page${key === "AZURE" ? " azure-page" : ""}`}>
      <Link href={`${programme.base}/${current.pathway.slug}`} className="back-link"><ArrowLeft size={15} /> {current.pathway.title}</Link>
      <div className="page-heading">
        <p className="eyebrow">{current.pathway.title}</p>
        <h1>{current.title}</h1>
        <p>{current.summary}{current.weightMin && current.weightMax ? ` ${current.weightMin}–${current.weightMax}% of the exam.` : ""}</p>
      </div>
      <div className="nse-pathway-grid">
        <article>
          <section className="nse-card">
            <h2>Practise this topic</h2>
            <p>{available} original questions. You see the answer and explanation after each one.</p>
            {available > 0 && <StartExam base={programme.base} pathway={current.pathway.slug} module={current.slug} mode="PRACTICE" count={Math.min(10, available)} label={`${Math.min(10, available)} questions`} signedIn={signedIn} />}
            {available > 10 && <StartExam base={programme.base} pathway={current.pathway.slug} module={current.slug} mode="PRACTICE" count={Math.min(50, available)} label={`${Math.min(50, available)} questions`} secondary signedIn={signedIn} />}
          </section>
          {current.examObjectives.length > 0 ? (
            <section>
              <h2>{programme.vendor}&apos;s objectives for this domain</h2>
              <ol className="nse-objective-list">{current.examObjectives.map((objective) => <li key={objective.slug}><h3>{objective.title}</h3><ul>{objective.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul></li>)}</ol>
            </section>
          ) : (
            <section><h2>Skills you&apos;ll train</h2><ul className="nse-check-list">{current.objectives.map((objective) => <li key={objective}><CheckCircle2 size={16} /> {objective}</li>)}</ul></section>
          )}
          {current.exercise && <section className="nse-card nse-exercise"><h2><FlaskConical size={17} /> Practical exercise</h2><p>{current.exercise}</p><Link className="text-link" href={`${programme.base}/labs`}>Open the labs</Link></section>}
        </article>
        <aside className="nse-pathway-side">
          {current.keyConcepts.length > 0 && <section className="nse-card"><h2>Key concepts</h2><div className="lab-card-tags">{current.keyConcepts.map((concept) => <span key={concept}>{concept}</span>)}</div></section>}
          <section className="nse-card">
            <h2>Sources and review</h2>
            <ul className="nse-plain-list">{current.sources.map((source) => <li key={source}><a className="text-link" href={source} target="_blank" rel="noreferrer">{new URL(source).hostname.replace("www.", "")}{new URL(source).pathname.slice(0, 32)} <ExternalLink size={12} /></a></li>)}</ul>
            {current.productVersion && <p><strong>Version:</strong> {current.productVersion}. Commands and features can change between releases.</p>}
            <p>{current.lastReviewedAt ? `Expert reviewed on ${current.lastReviewedAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}.` : `Awaiting expert review. Check details against ${programme.docs}.`}</p>
          </section>
          {next && <Link className="button button-secondary nse-next" href={`${programme.base}/${current.pathway.slug}/${next.slug}`}>Next: {next.title} <ArrowRight size={16} /></Link>}
        </aside>
      </div>
    </main>
  );
}
