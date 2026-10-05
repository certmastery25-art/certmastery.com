import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, Clock3, ShieldCheck, Waypoints } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "IT certification exam practice",
  description: "Build confidence with focused Security+, Server+, and CCNA practice questions and timed exams.",
};

const symbols = [ShieldCheck, Waypoints, BookOpenCheck];

export default async function Home() {
  const [session, certifications] = await Promise.all([
    getServerSession(authOptions),
    prisma.certification.findMany({
      orderBy: { name: "asc" },
      include: { domains: { select: { id: true, name: true, _count: { select: { questions: true } } } } },
    }),
  ]);
  const [attempts, sessions] = session?.user.id
    ? await Promise.all([
      prisma.attempt.findMany({ where: { userId: session.user.id }, select: { isCorrect: true } }),
      prisma.quizSession.findMany({
        where: { userId: session.user.id, completedAt: { not: null } },
        select: { certificationId: true, totalQuestions: true, correctAnswers: true },
      }),
    ])
    : [[], []];
  const answered = attempts.length;
  const correct = attempts.filter((attempt) => attempt.isCorrect).length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const displayName = session?.user.name?.split(" ")[0];

  return (
    <main className="main-content">
      <section className="welcome-strip">
        <div>
          <p className="eyebrow"><span className="status-dot" /> CERTMASTERY / EXAM PREP</p>
          <h1>{displayName ? `Welcome back, ${displayName}.` : "Make your next cert a sure thing."}</h1>
          <p className="welcome-copy">Focused practice for the certifications that move your IT career forward.</p>
        </div>
        <div className="welcome-actions">
          <Link href="/certifications" className="button button-primary"><BookOpenCheck size={17} /> Choose a certification</Link>
          {!session?.user && <Link href="/register" className="welcome-signup">Create free account <ArrowUpRight size={14} /></Link>}
        </div>
      </section>

      <section className="overview-grid" aria-label="Study overview">
        <div className="overview-cell overview-cell-feature"><div className="overview-icon overview-icon-green"><BookOpenCheck size={18} /></div><div><span className="overview-label">QUESTION BANK</span><strong>{certifications.reduce((total, item) => total + item.domains.reduce((sum, domain) => sum + domain._count.questions, 0), 0)}</strong><span className="overview-note">original practice questions</span></div></div>
        <div className="overview-cell"><div className="overview-icon overview-icon-coral"><CheckCircle2 size={18} /></div><div><span className="overview-label">QUESTIONS ANSWERED</span><strong>{answered}</strong><span className="overview-note">{session?.user ? "across completed sessions" : "sign in to save your progress"}</span></div></div>
        <div className="overview-cell"><div className="overview-icon overview-icon-blue"><Clock3 size={18} /></div><div><span className="overview-label">ACCURACY</span><strong>{session?.user ? `${accuracy}%` : "—"}</strong><span className="overview-note">{session?.user ? "across completed quizzes" : "build a measurable streak"}</span></div></div>
        <div className="overview-cell overview-cell-access"><span className="free-pill"><CheckCircle2 size={14} /> Free, always</span><span className="overview-note">Every practice mode is open to everyone.</span></div>
      </section>

      <section className="section-block" aria-labelledby="certifications-heading">
        <div className="section-heading-row"><div><p className="eyebrow">PICK YOUR PATH</p><h2 id="certifications-heading">Choose a certification</h2></div><Link className="text-link" href="/certifications">All certifications <ArrowRight size={16} /></Link></div>
        <div className="cert-grid">
          {certifications.map((certification, index) => {
            const Icon = symbols[index % symbols.length];
            const certSessions = sessions.filter((item) => item.certificationId === certification.id);
            const certTotal = certSessions.reduce((total, item) => total + item.totalQuestions, 0);
            const certCorrect = certSessions.reduce((total, item) => total + item.correctAnswers, 0);
            const certAccuracy = certTotal ? Math.round((certCorrect / certTotal) * 100) : 0;
            const questionCount = certification.domains.reduce((total, domain) => total + domain._count.questions, 0);
            return (
              <article className="cert-card" key={certification.id} style={{ "--cert-color": certification.color } as React.CSSProperties}>
                <div className="cert-card-top"><span className="cert-symbol"><Icon size={19} /></span><span className="exam-code">{certification.examCode}</span></div>
                <h3>{certification.acronym}</h3><p className="cert-name">{certification.name}</p>
                <div className="cert-domains" aria-label="Exam domains">{certification.domains.slice(0, 3).map((domain) => <span key={domain.id}>{domain.name}</span>)}{certification.domains.length > 3 && <span>+{certification.domains.length - 3} more</span>}</div>
                <div className="cert-card-footer"><span>{questionCount} questions <span className="footer-dot">·</span> {certification.domains.length} domains</span>{certTotal > 0 && <span className="cert-accuracy">{certAccuracy}% accuracy</span>}</div>
                <Link className="cert-card-link" href={`/practice/${certification.slug}`} aria-label={`Practice ${certification.acronym}`}><ArrowRight size={18} /></Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="study-method" aria-label="Study modes">
        <div className="study-method-intro"><p className="eyebrow">BUILT AROUND HOW YOU LEARN</p><h2>One goal.<br />Three ways to get there.</h2><p>Build your foundation, find the gaps, then walk into exam day ready.</p></div>
        <div className="method-list">
          <div className="method-item"><span className="method-number">01</span><BookOpenCheck size={20} /><div><strong>Practice</strong><p>Answer at your pace. Learn from every explanation.</p></div><ArrowRight size={16} /></div>
          <div className="method-item"><span className="method-number">02</span><Clock3 size={20} /><div><strong>Timed exams</strong><p>Build your confidence under exam-day conditions.</p></div><ArrowRight size={16} /></div>
          <div className="method-item"><span className="method-number">03</span><Waypoints size={20} /><div><strong>Custom quizzes</strong><p>Focus on the domains and difficulty you choose.</p></div><ArrowRight size={16} /></div>
        </div>
      </section>

      <footer className="page-footer"><span>© {new Date().getFullYear()} Certmaster</span><span>Independent exam preparation. Not affiliated with CompTIA or Cisco.</span><Link href="/register">Save your progress <ArrowRight size={14} /></Link></footer>
    </main>
  );
}