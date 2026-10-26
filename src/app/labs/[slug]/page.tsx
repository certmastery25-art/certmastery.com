import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, CheckCircle2, Clock3, Lightbulb, Network } from "lucide-react";
import { CcnaLabRunner } from "@/components/labs/ccna-lab-runner";
import { authOptions } from "@/lib/auth";
import { ccnaLabs } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lab = ccnaLabs.find((item) => item.slug === slug);
  return { title: lab ? lab.title : "Lab" };
}

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = ccnaLabs.find((item) => item.slug === slug);
  if (!lab) notFound();

  const [session, certification] = await Promise.all([
    getServerSession(authOptions),
    prisma.certification.findUnique({ where: { slug: "ccna" }, select: { id: true, acronym: true } }),
  ]);
  if (!certification) notFound();
  const domain = await prisma.domain.findUnique({
    where: { certificationId_name: { certificationId: certification.id, name: lab.domain } },
    select: { objective: true },
  });
  const completion = session?.user.id
    ? await prisma.labCompletion.findUnique({ where: { userId_labSlug: { userId: session.user.id, labSlug: lab.slug } }, select: { completedAt: true } })
    : null;

  return (
    <main className="main-content inner-page lab-runner-page">
      <Link href="/labs" className="back-link"><ArrowLeft size={15} /> All labs</Link>
      <div className="lab-runner-heading">
        <div className="lab-runner-kicker"><span><Network size={14} /> {certification.acronym} LAB</span><span><Clock3 size={14} /> {lab.durationMinutes} min</span><span>{domain?.objective ?? lab.objective} · {lab.domain}</span></div>
        <h1>{lab.title}</h1>
        <p>{lab.description}</p>
        {completion && <p className="lab-previous-completion"><CheckCircle2 size={15} /> Completed {completion.completedAt.toLocaleDateString()}</p>}
      </div>
      <div className="lab-workspace">
        <aside className="lab-instructions" aria-label="Lab instructions">
          <div className="lab-task-heading"><div><p className="eyebrow">YOUR OBJECTIVE</p><h2>Configure SW1</h2></div><span className="lab-device-pill">Cisco IOS · SW1</span></div>
          <div className="lab-topology" aria-label="Topology: PC-A connected to switch SW1 on GigabitEthernet0/1">
            <span className="lab-topology-device"><span>PC</span>PC-A</span><span className="lab-topology-link"><i />Gi0/1<i /></span><span className="lab-topology-device"><span><Network size={17} /></span>SW1</span>
          </div>
          <ol className="lab-task-list">
            {lab.tasks.map((task, index) => <li key={task.id} data-task-id={task.id}><span className="lab-task-number">{String(index + 1).padStart(2, "0")}</span><span>{task.title}</span></li>)}
          </ol>
          <div className="lab-hint"><Lightbulb size={16} /><div><strong>Need a hint?</strong><p>Choose a task in the list to reveal a command hint. You can also type <code>help</code> in the terminal.</p></div></div>
        </aside>
        <CcnaLabRunner labSlug={lab.slug} tasks={lab.tasks} />
      </div>
    </main>
  );
}
