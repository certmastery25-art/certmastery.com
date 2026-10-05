import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, ShieldCheck, Waypoints } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certifications" };
const icons = [ShieldCheck, BookOpenCheck, Waypoints];

export default async function CertificationsPage() {
  const certifications = await prisma.certification.findMany({ orderBy: { name: "asc" }, include: { domains: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { questions: true } } } } } });
  return <main className="main-content inner-page">
    <div className="page-heading"><p className="eyebrow">THE QUESTION BANK</p><h1>Choose your certification.</h1><p>Objective-aligned practice for the exams that matter to your next step.</p></div>
    <div className="program-list">{certifications.map((certification, index) => {
      const Icon = icons[index % icons.length];
      const total = certification.domains.reduce((sum, domain) => sum + domain._count.questions, 0);
      return <article className="program-row" key={certification.id} style={{ "--cert-color": certification.color } as React.CSSProperties}>
        <div className="program-mark"><Icon size={24} /></div><div className="program-main"><div className="program-kicker">{certification.examCode} <span>·</span> {certification.domains.length} exam domains</div><h2>{certification.name}</h2><p>{certification.description}</p><div className="program-domains">{certification.domains.map((domain) => <span key={domain.id}><small>{domain.objective}</small> {domain.name}</span>)}</div></div>
        <div className="program-action"><span>{total} questions</span><Link className="button button-primary" href={`/practice/${certification.slug}`}>Start practice <ArrowRight size={16} /></Link></div>
      </article>;
    })}</div>
  </main>;
}