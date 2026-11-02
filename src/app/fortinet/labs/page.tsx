import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, LockKeyhole, TriangleAlert } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fortinet NSE labs", description: "Practise FortiOS configuration and troubleshooting in a clearly labelled browser simulator." };

export default async function NseLabsPage() {
  const [session, labs] = await Promise.all([
    getServerSession(authOptions),
    prisma.nseLab.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ pathway: { sortOrder: "asc" } }, { sortOrder: "asc" }], select: { slug: true, title: true, summary: true, difficulty: true, durationMinutes: true, pathway: { select: { title: true, level: true } } } }),
  ]);
  const completions = session?.user.id ? await prisma.labCompletion.findMany({ where: { userId: session.user.id, labSlug: { startsWith: "nse:" } }, select: { labSlug: true } }) : [];
  const completed = new Set(completions.map((row) => row.labSlug.slice(4)));

  return (
    <main className="main-content inner-page nse-page">
      <Link href="/fortinet" className="back-link"><ArrowLeft size={15} /> Fortinet NSE Academy</Link>
      <div className="page-heading"><p className="eyebrow">Fortinet NSE labs</p><h1>Practise FortiOS, safely.</h1><p>{completed.size} of {labs.length} labs complete.</p></div>
      <p className="nse-sim-banner nse-sim-page"><TriangleAlert size={16} /> <span><strong>These labs use a simulator, not a FortiGate.</strong> It teaches FortiOS CLI structure and checks your configuration. It doesn&apos;t pass traffic or validate everything a real device would, and diagnostic output is scripted. No Fortinet firmware or images are used. For experience on a real device, use licensed Fortinet appliances or authorised lab environments.</span></p>
      <div className="lab-card-list">
        {labs.map((lab, index) => (
          <article className="lab-card" key={lab.slug}>
            <span className="lab-card-number">{String(index + 1).padStart(2, "0")}</span>
            <div className="lab-card-main">
              <div className="lab-card-meta"><span>NSE {lab.pathway.level}</span><span><Clock3 size={13} /> {lab.durationMinutes} min</span></div>
              <h3>{lab.title}</h3>
              <p>{lab.summary}</p>
              <div className="lab-card-tags"><span>{lab.difficulty.toLowerCase()}</span>{completed.has(lab.slug) && <span className="lab-complete-tag"><CheckCircle2 size={13} /> Complete</span>}</div>
            </div>
            {session?.user
              ? <Link className="button button-primary" href={`/fortinet/labs/${lab.slug}`}>{completed.has(lab.slug) ? "Practise again" : "Start lab"} <ArrowRight size={16} /></Link>
              : <Link className="button button-secondary" href={`/login?reason=account-required&callbackUrl=${encodeURIComponent(`/fortinet/labs/${lab.slug}`)}`}><LockKeyhole size={15} /> Sign in to start</Link>}
          </article>
        ))}
      </div>
    </main>
  );
}
