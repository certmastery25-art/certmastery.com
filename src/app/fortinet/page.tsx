import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, ExternalLink, FlaskConical, Gauge, ShieldCheck, Timer } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { LEVELS, TRACK_LABELS, getStudentProgress, listPublishedPathways, nextActivity } from "@/lib/nse/progress";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fortinet NSE Certification Academy",
  description: "Train for Fortinet NSE 1 to 8 with original practice questions, timed mock exams, readiness tracking and simulated FortiOS labs.",
};

const TRACKS = [
  ["SECURE_NETWORKING", "Firewalls at scale, switching, wireless, SD-WAN and central management."],
  ["SECURITY_OPERATIONS", "Log analysis, detection, automation, threat hunting and response."],
  ["SASE", "Cloud-delivered security, Zero Trust access, endpoints and data protection."],
  ["CLOUD_SECURITY", "Application security, cloud-native protection, email and DDoS defence."],
] as const;

const SEQUENCE = [
  { title: "Build the foundation", text: "NSE 1 and 2 are for newcomers. Skip ahead if you already know firewalls." },
  { title: "Operate FortiGate", text: "NSE 3 adds daily operations, and the labs give you CLI practice." },
  { title: "Earn NSE 4", text: "Fortinet requires an active NSE 4 for every level above it." },
  { title: "Choose a track", text: "Pass NSE 5 or NSE 6 in one track. Fortinet doesn't require both." },
  { title: "Become an architect", text: "NSE 7 requires NSE 4 and an NSE 5 or 6 in the same track." },
  { title: "Reach expert level", text: "NSE 8 adds a practical Core exam and one practical elective, on top of those certifications." },
];

const OFFICIAL = [
  ["NSE certification programme", "https://www.fortinet.com/training-certification"],
  ["Fortinet Training Institute", "https://training.fortinet.com/"],
  ["New certification requirements", "https://helpdesk.training.fortinet.com/support/solutions/articles/73000665753-what-are-the-new-certification-requirements-"],
  ["Fortinet product documentation", "https://docs.fortinet.com/"],
];

export default async function FortinetPage() {
  const [session, pathways, labCount] = await Promise.all([
    getServerSession(authOptions),
    listPublishedPathways(),
    prisma.nseLab.count({ where: { status: "PUBLISHED", pathway: { programme: "FORTINET" } } }),
  ]);
  const questionCount = pathways.reduce((sum, pathway) => sum + pathway.modules.reduce((moduleSum, module) => moduleSum + module._count.questions, 0), 0);
  const moduleCount = pathways.reduce((sum, pathway) => sum + pathway.modules.length, 0);
  const progress = session?.user.id ? await getStudentProgress(session.user.id, pathways) : null;
  const rowFor = (slug: string) => progress?.byPathway.find((row) => row.pathway.slug === slug);
  const pathwayPercent = (slug: string) => {
    const row = rowFor(slug);
    return row?.topics.length ? Math.round((row.modulesCompleted / row.topics.length) * 100) : 0;
  };
  const inProgress = progress?.byPathway.filter((row) => row.modulesCompleted > 0 || row.answered > 0) ?? [];
  const activeRow = inProgress.at(-1);

  return (
    <main className="main-content inner-page nse-page">
      <section className="nse-hero">
        <div>
          <p className="eyebrow"><ShieldCheck size={14} /> Fortinet NSE</p>
          <h1>Fortinet NSE Certification Academy</h1>
          <p className="nse-tagline">Master Fortinet. Build Real-World Security Skills. Pass With Confidence.</p>
          <p>Train from NSE 1 to NSE 8 with practice questions, timed mocks and hands-on CLI practice. It&apos;s built around the eight-level programme Fortinet introduced on 15 July 2026.</p>
          <div className="result-actions"><Link className="button button-primary" href="/fortinet/nse-1">Start at NSE 1 <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/fortinet/nse-4">Go to NSE 4</Link></div>
        </div>
        <dl className="nse-hero-stats">
          <div><dt>Pathways</dt><dd>{pathways.length}</dd></div>
          <div><dt>Topics</dt><dd>{moduleCount}</dd></div>
          <div><dt>Practice questions</dt><dd>{questionCount}</dd></div>
          <div><dt>Simulated labs</dt><dd>{labCount}</dd></div>
        </dl>
      </section>

      <p className="nse-independent"><strong>Independent practice resource.</strong> CertMastery isn&apos;t affiliated with or endorsed by Fortinet. Questions are original, not real exam questions, and completing them doesn&apos;t guarantee a pass. The question bank is growing and content is awaiting specialist review, so check details against official documentation.</p>

      {progress && (
        <section className="nse-dash-strip" aria-labelledby="your-progress">
          <div><p className="eyebrow">Your progress</p><h2 id="your-progress">{inProgress.length ? `${inProgress.length} pathway${inProgress.length === 1 ? "" : "s"} in progress` : "You haven't started yet"}</h2></div>
          {activeRow ? <Link className="text-link" href={nextActivity(activeRow).href}>Next: {nextActivity(activeRow).label}</Link> : <Link className="text-link" href="/fortinet/nse-1">Next: begin NSE 1</Link>}
          <Link className="button button-secondary" href="/fortinet/dashboard"><Gauge size={16} /> Open dashboard</Link>
        </section>
      )}

      <section aria-labelledby="progression">
        <div className="nse-section-head"><p className="eyebrow">Certification progression</p><h2 id="progression">From first principles to architect</h2></div>
        <div className="nse-ladder">
          <ol className="nse-core-steps">
            {LEVELS.filter((level) => level.level <= 4).map((level) => {
              const slug = `nse-${level.level}`;
              const percent = pathwayPercent(slug);
              return <li key={level.level}><Link href={`/fortinet/${slug}`}><span className="nse-level-badge">NSE {level.level}</span><strong>{level.name}</strong>{progress && <span className="nse-mini-track" role="progressbar" aria-label={`NSE ${level.level} topics practised`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></span>}</Link></li>;
            })}
          </ol>
          <div className="nse-track-grid" role="table" aria-label="NSE 5 to 7 by track">
            {TRACKS.map(([track, description]) => (
              <div className="nse-track" role="row" key={track}>
                <h3>{TRACK_LABELS[track]}</h3>
                <p>{description}</p>
                <div className="nse-track-levels">
                  {[5, 6, 7].map((level) => {
                    const pathway = pathways.find((item) => item.level === level && item.track === track);
                    if (!pathway) return null;
                    const percent = pathwayPercent(pathway.slug);
                    return <Link key={level} href={`/fortinet/${pathway.slug}`}><span className="nse-level-badge">NSE {level}</span><span>{LEVELS[level - 1].name}</span>{progress && percent > 0 && <small>{percent}%</small>}</Link>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <ol className="nse-core-steps nse-expert-step"><li><Link href="/fortinet/nse-8"><span className="nse-level-badge">NSE 8</span><strong>Cybersecurity Expert: Core practical</strong></Link></li></ol>
          <p className="nse-out-of-scope">We cover the NSE 8 Core topics. The NSE 8 electives and the OT Security and MSSP Security certifications aren&apos;t covered here yet.</p>
        </div>
      </section>

      <section aria-labelledby="sequence">
        <div className="nse-section-head"><p className="eyebrow">Recommended sequence</p><h2 id="sequence">A sensible route</h2></div>
        <ol className="nse-sequence">{SEQUENCE.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
      </section>

      <section className="nse-feature-row" aria-label="What's included">
        <article><Timer size={20} /><h3>Three exam modes</h3><p>Practice with instant explanations, timed mocks and full-syllabus readiness checks, all marked on the server.</p></article>
        <article><FlaskConical size={20} /><h3>Practical labs</h3><p>Configure a clearly labelled FortiOS CLI simulator in your browser, graded on what you&apos;ve configured.</p><Link className="text-link" href="/fortinet/labs">Browse labs</Link></article>
        <article><Gauge size={20} /><h3>Readiness tracking</h3><p>See topic strengths and gaps, with a score that needs more than one exam and shows how it&apos;s calculated.</p><Link className="text-link" href="/fortinet/dashboard">Open dashboard</Link></article>
      </section>

      <section aria-labelledby="official">
        <div className="nse-section-head"><p className="eyebrow">Official resources</p><h2 id="official">Always confirm with Fortinet</h2></div>
        <ul className="nse-official">{OFFICIAL.map(([label, href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer">{label} <ExternalLink size={14} /></a></li>)}</ul>
      </section>
    </main>
  );
}
