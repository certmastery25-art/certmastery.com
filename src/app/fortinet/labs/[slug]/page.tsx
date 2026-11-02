import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, CheckCircle2, Clock3, Gauge, Lightbulb } from "lucide-react";
import { NseLabRunner } from "@/components/nse/lab-runner";
import { authOptions } from "@/lib/auth";
import { labDefinitionSchema } from "@/lib/nse/lab-engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fortinet NSE lab" };

export default async function NseLabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user.id) redirect(`/login?reason=account-required&callbackUrl=${encodeURIComponent(`/fortinet/labs/${slug}`)}`);
  const lab = await prisma.nseLab.findFirst({ where: { slug, status: "PUBLISHED" }, include: { pathway: { select: { title: true, slug: true } } } });
  if (!lab) notFound();
  const completion = await prisma.labCompletion.findUnique({ where: { userId_labSlug: { userId: session.user.id, labSlug: `nse:${lab.slug}` } } });
  const definition = labDefinitionSchema.parse(lab.definition);

  return (
    <main className="main-content inner-page nse-page">
      <Link href="/fortinet/labs" className="back-link"><ArrowLeft size={15} /> All Fortinet labs</Link>
      <div className="page-heading">
        <div className="lab-runner-kicker"><span>{lab.pathway.title}</span><span><Clock3 size={14} /> {lab.durationMinutes} min</span><span><Gauge size={14} /> {lab.difficulty.toLowerCase()}</span></div>
        <h1>{lab.title}</h1>
        <p>{lab.summary}</p>
        {completion && <p className="lab-previous-completion"><CheckCircle2 size={15} /> Completed {completion.completedAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>}
      </div>
      <div className="nse-lab-brief">
        <section><h2>Scenario</h2><p>{lab.scenario}</p><h2>Objectives</h2><ul className="nse-plain-list">{lab.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></section>
        <section><h2>Topology</h2><pre className="nse-exhibit" tabIndex={0}><code>{lab.topology}</code></pre><h2>Environment</h2><p>{lab.equipment}</p></section>
      </div>
      <NseLabRunner slug={lab.slug} definition={definition} initiallyComplete={Boolean(completion)} />
      <section className="nse-card nse-lab-trouble">
        <h2><Lightbulb size={17} /> Troubleshooting guidance</h2>
        <ul className="nse-plain-list">{lab.troubleshooting.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </main>
  );
}
