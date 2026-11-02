import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical, Network, ShieldCheck } from "lucide-react";
import { certificationIcon } from "@/lib/cert-icons";
import { listPublishedPathways, pathwayQuestionCount } from "@/lib/nse/progress";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certifications" };

export default async function CertificationsPage() {
  const [certifications, pathways] = await Promise.all([
    prisma.certification.findMany({ orderBy: { name: "asc" }, include: { domains: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { questions: true } } } } } }),
    listPublishedPathways(),
  ]);
  // Fortinet takes its alphabetical place among the other vendors.
  const beforeFortinet = certifications.filter((certification) => certification.name < "Fortinet");
  const afterFortinet = certifications.filter((certification) => certification.name >= "Fortinet");
  const renderCertification = (certification: (typeof certifications)[number]) => {
      const Icon = certificationIcon(certification.slug);
      const total = certification.domains.reduce((sum, domain) => sum + domain._count.questions, 0);
      return <article className="program-row" key={certification.id}>
        <div className="program-mark"><Icon size={24} /></div><div className="program-main"><div className="program-kicker">{certification.examCode} <span>·</span> {certification.domains.length} exam domains</div><h2>{certification.name}</h2><p>{certification.description}</p><div className="program-domains">{certification.domains.map((domain) => <span key={domain.id}><small>{domain.objective}</small> {domain.name}</span>)}</div></div>
        <div className="program-action"><span>{total} questions</span><Link className="button button-primary" href={`/practice/${certification.slug}`}>Start practice <ArrowRight size={16} /></Link>{certification.slug === "ccna" && <Link className="program-labs-link" href="/labs"><Network size={14} /> Hands-on labs</Link>}</div>
      </article>;
  };
  return <main className="main-content inner-page">
    <div className="page-heading"><p className="eyebrow">Certifications</p><h1>Choose your certification.</h1><p>Every question bank is organised by the official exam domains, so you always know what you have covered.</p></div>
    <div className="program-list">
      {beforeFortinet.map(renderCertification)}
      {pathways.map((pathway) => (
        <article className="program-row" key={pathway.id}>
          <div className="program-mark"><ShieldCheck size={24} /></div>
          <div className="program-main"><div className="program-kicker">Fortinet NSE {pathway.level} <span>·</span> {pathway.modules.length} study modules</div><h2>Fortinet {pathway.title}</h2><p>{pathway.summary}</p><div className="program-domains">{pathway.modules.map((module, index) => <span key={module.id}><small>{index + 1}</small> {module.title}</span>)}</div></div>
          <div className="program-action"><span>{pathwayQuestionCount(pathway)} questions</span><Link className="button button-primary" href={`/fortinet/${pathway.slug}`}>Start studying <ArrowRight size={16} /></Link>{pathway.labs.length > 0 && <Link className="program-labs-link" href="/fortinet/labs"><FlaskConical size={14} /> Simulated labs</Link>}</div>
        </article>
      ))}
      {afterFortinet.map(renderCertification)}
    </div>
  </main>;
}