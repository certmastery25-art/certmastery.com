import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { QuizSetupForm } from "@/components/quiz-setup-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const certification = await prisma.certification.findUnique({ where: { slug }, select: { name: true, examCode: true } });
  return { title: certification ? `Practice ${certification.name} ${certification.examCode}` : "Practice" };
}

export default async function PracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const certification = await prisma.certification.findUnique({ where: { slug }, include: { domains: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, objective: true } } } });
  if (!certification) notFound();
  const questionCount = await prisma.question.count({ where: { domain: { certificationId: certification.id } } });
  return <main className="main-content inner-page practice-page">
    <Link href="/certifications" className="back-link"><ArrowLeft size={15} /> All certifications</Link>
    <div className="practice-layout"><section className="practice-intro" style={{ "--cert-color": certification.color } as React.CSSProperties}><div className="practice-marker"><BadgeCheck size={19} /> {certification.examCode}</div><p className="eyebrow">YOUR STUDY SESSION</p><h1>{certification.acronym}<br /><span>{certification.name}</span></h1><p>{certification.description}</p><div className="practice-statline"><span>{questionCount} questions</span><i /> <span>{certification.domains.length} domains</span><i /> <span>Always free</span></div></section>
      <section className="setup-panel" aria-labelledby="setup-heading"><div className="setup-panel-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h2 id="setup-heading">Set up a session</h2></div><span className="setup-step">01 <i /> 02</span></div><QuizSetupForm certification={{ slug: certification.slug, name: certification.name, examCode: certification.examCode }} domains={certification.domains} questionCount={questionCount} /></section>
    </div>
  </main>;
}