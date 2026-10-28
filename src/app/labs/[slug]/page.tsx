import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, CheckCircle2, Clock3, Gauge, Lightbulb, Network } from "lucide-react";
import { CcnaLabRunner } from "@/components/labs/ccna-lab-runner";
import { LabTopology } from "@/components/labs/lab-topology";
import { authOptions } from "@/lib/auth";
import { consoleDevices, findCcnaLab } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lab = findCcnaLab(slug);
  return { title: lab ? lab.title : "Lab" };
}

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = findCcnaLab(slug);
  if (!lab) notFound();

  const [session, certification] = await Promise.all([
    getServerSession(authOptions),
    prisma.certification.findUnique({ where: { slug: "ccna" }, select: { id: true, acronym: true } }),
  ]);
  if (!certification) notFound();
  const completion = session?.user.id
    ? await prisma.labCompletion.findUnique({ where: { userId_labSlug: { userId: session.user.id, labSlug: lab.slug } }, select: { completedAt: true } })
    : null;
  const consoles = consoleDevices(lab);

  return (
    <main className="main-content inner-page lab-runner-page">
      <Link href="/labs" className="back-link"><ArrowLeft size={15} /> All labs</Link>
      <div className="lab-runner-heading">
        <div className="lab-runner-kicker"><span><Network size={14} /> {certification.acronym} LAB</span><span><Clock3 size={14} /> {lab.durationMinutes} min</span><span><Gauge size={14} /> {lab.difficulty}</span><span>{lab.objective} · {lab.domain}</span></div>
        <h1>{lab.title}</h1>
        <p>{lab.description}</p>
        {completion && <p className="lab-previous-completion"><CheckCircle2 size={15} /> Completed {completion.completedAt.toLocaleDateString()}</p>}
      </div>
      <div className="lab-workspace">
        <aside className="lab-instructions" aria-label="Lab instructions">
          <div className="lab-task-heading"><div><p className="eyebrow">SCENARIO</p><h2>Your objective</h2></div><span className="lab-device-pill">{consoles.length} {consoles.length === 1 ? "device" : "devices"}</span></div>
          <p className="lab-scenario">{lab.scenario}</p>
          <LabTopology lab={lab} />
          <ol className="lab-task-list">
            {lab.tasks.map((task, index) => <li key={task.id} data-task-id={task.id}><span className="lab-task-number">{String(index + 1).padStart(2, "0")}</span><span>{task.title}</span></li>)}
          </ol>
          <div className="lab-hint"><Lightbulb size={16} /><div><strong>Working the lab</strong><p>Use the device tabs or type <code>connect R2</code> to move between consoles. IOS abbreviations, <code>?</code> help, <code>do</code> and <code>| include</code> all work. Choose a checklist item to reveal a hint. Your session is kept in this browser if you leave the page.</p></div></div>
        </aside>
        <CcnaLabRunner labSlug={lab.slug} />
      </div>
    </main>
  );
}
