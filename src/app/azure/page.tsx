import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Cloud, ExternalLink, Gauge, Timer } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getStudentProgress, listPublishedPathways, nextActivity, pathwayQuestionCount } from "@/lib/nse/progress";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Microsoft Azure certification practice",
  description: "Practise for Microsoft Azure certifications with original questions organised by Microsoft's exam domains, timed mock exams and readiness tracking. Starting with AZ-104: Microsoft Azure Administrator.",
  alternates: { canonical: "/azure" },
};

const OFFICIAL = [
  ["Browse Azure credentials", "https://learn.microsoft.com/en-us/credentials/browse/?products=azure"],
  ["AZ-104 study guide", "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104"],
  ["Exam scoring and score reports", "https://learn.microsoft.com/en-us/credentials/certifications/exam-scoring-reports"],
  ["Azure documentation", "https://learn.microsoft.com/en-us/azure/"],
];

export default async function AzurePage() {
  const [session, published, all] = await Promise.all([
    getServerSession(authOptions),
    listPublishedPathways("AZURE"),
    // Every Azure pathway, so the full route can be shown with the ones still in preparation.
    prisma.nsePathway.findMany({ where: { programme: "AZURE" }, orderBy: { level: "asc" }, select: { slug: true, title: true, summary: true, status: true, requires: { select: { kind: true, requiredPathway: { select: { slug: true } } } } } }),
  ]);
  const questionCount = published.reduce((sum, pathway) => sum + pathwayQuestionCount(pathway), 0);
  const progress = session?.user.id ? await getStudentProgress(session.user.id, published) : null;
  const active = progress?.byPathway.filter((row) => row.answered > 0).at(-1);
  const first = published[0];

  return (
    <main className="main-content inner-page nse-page azure-page">
      <section className="nse-hero">
        <div>
          <p className="eyebrow"><Cloud size={14} /> Microsoft Azure</p>
          <h1>Microsoft Azure certification practice</h1>
          <p className="nse-tagline">Practise against Microsoft&apos;s exam domains, one certification at a time.</p>
          <p>Original practice questions organised by Microsoft&apos;s published skills outline, with an explanation for every option, timed mock exams and readiness tracking. We&apos;re starting with AZ-104: Microsoft Azure Administrator.</p>
          {first && <div className="result-actions"><Link className="button button-primary" href={`/azure/${first.slug}`}>Start {first.slug.toUpperCase()} <ArrowRight size={16} /></Link></div>}
        </div>
        <dl className="nse-hero-stats">
          <div><dt>Exams available</dt><dd>{published.length}<small>/{all.length}</small></dd></div>
          <div><dt>Practice questions</dt><dd>{questionCount}</dd></div>
          <div><dt>Exam domains</dt><dd>{published.reduce((sum, pathway) => sum + pathway.modules.length, 0)}</dd></div>
          <div><dt>Pass mark</dt><dd>700<small> on Microsoft&apos;s scale</small></dd></div>
        </dl>
      </section>

      <p className="nse-independent"><strong>Independent practice resource.</strong> CertMastery isn&apos;t affiliated with or endorsed by Microsoft. Questions are original, not real exam questions, and practising here doesn&apos;t guarantee a pass. They&apos;re drafted with AI help and awaiting expert review, so check details against Microsoft Learn.</p>

      {progress && (
        <section className="nse-dash-strip" aria-labelledby="azure-progress">
          <div><p className="eyebrow">Your progress</p><h2 id="azure-progress">{active ? `Working on ${active.pathway.slug.toUpperCase()}` : "You haven't started yet"}</h2></div>
          {active ? <Link className="text-link" href={nextActivity(active).href}>Next: {nextActivity(active).label}</Link> : first && <Link className="text-link" href={`/azure/${first.slug}`}>Next: begin {first.slug.toUpperCase()}</Link>}
          <Link className="button button-secondary" href="/azure/dashboard"><Gauge size={16} /> Open dashboard</Link>
        </section>
      )}

      <section aria-labelledby="azure-route">
        <div className="nse-section-head"><p className="eyebrow">Certification route</p><h2 id="azure-route">From fundamentals to Solutions Architect Expert</h2></div>
        <ol className="nse-core-steps">
          {all.map((pathway) => {
            const required = pathway.requires.filter((item) => item.kind === "REQUIRED").map((item) => item.requiredPathway.slug.toUpperCase());
            const body = <><span className="nse-level-badge">{pathway.slug.toUpperCase()}</span><strong>{pathway.title.split(": ")[1]}</strong><small>{pathway.status === "PUBLISHED" ? "Available now" : "In preparation"}{required.length ? ` · requires ${required.join(", ")}` : ""}</small></>;
            return <li key={pathway.slug}>{pathway.status === "PUBLISHED" ? <Link href={`/azure/${pathway.slug}`}>{body}</Link> : <div className="nse-step-soon">{body}</div>}</li>;
          })}
        </ol>
        <p className="nse-out-of-scope">Microsoft requires the Azure Administrator Associate certification (AZ-104) before it awards Azure Solutions Architect Expert (AZ-305). AZ-700 is an optional networking specialisation. Only AZ-104 has practice questions so far.</p>
      </section>

      <section className="nse-feature-row" aria-label="What's included">
        <article><Timer size={20} /><h3>Three exam modes</h3><p>Practice with instant explanations, timed mocks at Microsoft&apos;s published exam length, and full-syllabus readiness checks, all marked on the server.</p></article>
        <article><Cloud size={20} /><h3>Microsoft&apos;s domains</h3><p>Every question is tagged to a domain and objective from Microsoft&apos;s current skills outline, weighted like the exam.</p></article>
        <article><Gauge size={20} /><h3>Readiness tracking</h3><p>See strengths and gaps by domain, with a score that needs more than one exam and shows how it&apos;s calculated.</p><Link className="text-link" href="/azure/dashboard">Open dashboard</Link></article>
      </section>

      <section aria-labelledby="azure-official">
        <div className="nse-section-head"><p className="eyebrow">Official resources</p><h2 id="azure-official">Always confirm with Microsoft</h2></div>
        <ul className="nse-official">{OFFICIAL.map(([label, href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer">{label} <ExternalLink size={14} /></a></li>)}</ul>
      </section>
    </main>
  );
}
