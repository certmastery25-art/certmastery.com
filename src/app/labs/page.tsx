import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, Network } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { ccnaLabDomains, ccnaLabs, consoleDevices } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hands-on labs" };

export default async function LabsPage() {
  const session = await getServerSession(authOptions);
  const certification = await prisma.certification.findUnique({
    where: { slug: "ccna" },
    select: { acronym: true, examCode: true, domains: { select: { name: true, objective: true } } },
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
        <p>Guided labs run in a browser-based Cisco IOS simulator with multiple routers, switches and hosts. Configure, troubleshoot and verify real networks safely.</p>
      </div>
      <section className="labs-path" aria-labelledby="labs-path-heading">
        <div className="labs-path-heading">
          <div className="labs-path-icon"><Network size={22} /></div>
          <div><p className="eyebrow">{certification?.examCode ?? "200-301"} v1.1 LEARNING PATH</p><h2 id="labs-path-heading">{certification?.acronym ?? "CCNA"} hands-on labs</h2></div>
        </div>
        <p className="labs-path-copy">Start with a single VLAN, then work through multi-device labs covering trunking, EtherChannel, spanning tree, IPv6, OSPF, HSRP, NAT, DHCP, ACLs and Layer 2 security. Each lab is graded on how the network actually behaves, so any valid configuration passes.</p>
        <p className="labs-progress-summary">{completed.size} of {ccnaLabs.length} labs complete</p>
        {ccnaLabDomains.map((domainName) => {
          const labs = ccnaLabs.filter((lab) => lab.domain === domainName);
          const objective = certification?.domains.find((domain) => domain.name === domainName)?.objective;
          return (
            <div className="labs-domain" key={domainName}>
              <h3 className="labs-domain-heading">{objective ? `${objective} ` : ""}{domainName}</h3>
              <div className="lab-card-list">
                {labs.map((lab) => {
                  const isComplete = completed.has(lab.slug);
                  return (
                    <article className="lab-card" key={lab.slug}>
                      <span className="lab-card-number">{String(ccnaLabs.indexOf(lab) + 1).padStart(2, "0")}</span>
                      <div className="lab-card-main">
                        <div className="lab-card-meta"><span>{lab.objective} · {lab.domain}</span><span><Clock3 size={13} /> {lab.durationMinutes} min</span></div>
                        <h3>{lab.title}</h3>
                        <p>{lab.description}</p>
                        <div className="lab-card-tags"><span className={`lab-level lab-level-${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span><span>{consoleDevices(lab).length} devices</span><span>{lab.tasks.length} tasks</span>{isComplete && <span className="lab-complete-tag"><CheckCircle2 size={13} /> Complete</span>}</div>
                      </div>
                      {session?.user
                        ? <Link className="button button-primary" href={`/labs/${lab.slug}`}>{isComplete ? "Practice again" : "Start lab"} <ArrowRight size={16} /></Link>
                        : <Link className="button button-secondary" href="/register?reason=account-required"><LockKeyhole size={15} /> Sign up to start</Link>}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!session?.user && <p className="labs-signin-note">A free account is required to open the labs. <Link href="/login">Sign in</Link> or <Link href="/register">create a free account</Link> to start, and your completed labs will be saved to your progress.</p>}
      </section>
    </main>
  );
}
