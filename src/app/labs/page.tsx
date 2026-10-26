import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, Network } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { ccnaLabs } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hands-on labs" };

export default async function LabsPage() {
  const session = await getServerSession(authOptions);
  const certification = await prisma.certification.findUnique({
    where: { slug: "ccna" },
    select: { name: true, acronym: true, examCode: true, color: true, domains: { select: { name: true, objective: true, _count: { select: { questions: true } } } } },
  });
  const completions = session?.user.id
    ? await prisma.labCompletion.findMany({ where: { userId: session.user.id }, select: { labSlug: true } })
    : [];
  const completed = new Set(completions.map((item) => item.labSlug));

  return (
    <main className="main-content inner-page labs-page">
      <div className="page-heading">
        <p className="eyebrow">LEARN BY DOING</p>
        <h1>Practice the work, not just the answers.</h1>
        <p>Short, guided labs let you build and verify real networking skills in a safe browser-based simulator.</p>
      </div>
      <section className="labs-path" aria-labelledby="labs-path-heading">
        <div className="labs-path-heading">
          <div className="labs-path-icon"><Network size={22} /></div>
          <div><p className="eyebrow">{certification?.examCode ?? "CCNA"} LEARNING PATH</p><h2 id="labs-path-heading">{certification?.acronym ?? "CCNA"} Network Access</h2></div>
        </div>
        <p className="labs-path-copy">Start with switch fundamentals and work toward configuring and troubleshooting a small campus network. These first labs align with Network Access objectives.</p>
        <div className="lab-card-list">
          {ccnaLabs.map((lab, index) => {
            const isComplete = completed.has(lab.slug);
            return (
              <article className="lab-card" key={lab.slug}>
                <span className="lab-card-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="lab-card-main">
                  <div className="lab-card-meta"><span>{lab.objective} · {lab.domain}</span><span><Clock3 size={13} /> {lab.durationMinutes} min</span></div>
                  <h3>{lab.title}</h3>
                  <p>{lab.description}</p>
                  <div className="lab-card-tags"><span>{lab.difficulty}</span><span>{lab.device}</span>{isComplete && <span className="lab-complete-tag"><CheckCircle2 size={13} /> Complete</span>}</div>
                </div>
                {session?.user
                  ? <Link className="button button-primary" href={`/labs/${lab.slug}`}>{isComplete ? "Practice again" : "Start lab"} <ArrowRight size={16} /></Link>
                  : <Link className="button button-secondary" href="/register?reason=account-required"><LockKeyhole size={15} /> Sign up to start</Link>}
              </article>
            );
          })}
        </div>
        {!session?.user && <p className="labs-signin-note">A free account is required to open the labs. <Link href="/login">Sign in</Link> or <Link href="/register">create a free account</Link> to start, and your completed labs will be saved to your progress.</p>}
        <p className="labs-coming-soon">More guided labs for switching, routing, and troubleshooting are in development.</p>
      </section>
    </main>
  );
}
