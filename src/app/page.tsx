import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, BarChart3, BookOpenCheck, CheckCircle2, Clock3, ListChecks, Network, SlidersHorizontal, Target, Terminal } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { certificationIcon } from "@/lib/cert-icons";
import { ccnaLabs, initialCcnaLabState, promptForMode, runCcnaLabCommand } from "@/lib/labs/ccna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "CertMastery | IT certification practice tests and hands-on labs" },
  description: "Prepare for Security+, Server+, CCNA, CCNP Enterprise, and Splunk Cloud Admin with focused practice questions, timed exams, and hands-on networking labs.",
};

const studyModes = [
  { icon: BookOpenCheck, title: "Practice", copy: "Answer at your own pace and read the explanation after every question." },
  { icon: Clock3, title: "Timed exam", copy: "Work through a full timed session to rehearse exam-day pacing." },
  { icon: SlidersHorizontal, title: "Custom quiz", copy: "Choose the domain, difficulty, and number of questions to target a gap." },
];

const steps = [
  { icon: ListChecks, title: "Choose a certification", copy: "Every question bank is organised by the official exam domains." },
  { icon: BookOpenCheck, title: "Practise by domain", copy: "Learn from explanations and build understanding one topic at a time." },
  { icon: Clock3, title: "Rehearse under time", copy: "Timed exams show whether your knowledge holds up at exam pace." },
  { icon: Target, title: "Focus on weak areas", copy: "Your progress page highlights the domains that need another session." },
];

// Runs the real simulator so the preview always matches what learners see in the lab.
function labPreview() {
  let state = initialCcnaLabState;
  return ["enable", "configure terminal", "vlan 20", "name SALES"].map((command) => {
    const prompt = promptForMode(state.mode);
    const result = runCcnaLabCommand(state, command);
    state = result.state;
    return { prompt, command, output: result.output };
  });
}

export default async function Home() {
  const [session, certifications] = await Promise.all([
    getServerSession(authOptions),
    prisma.certification.findMany({
      orderBy: { name: "asc" },
      include: { domains: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, _count: { select: { questions: true } } } } },
    }),
  ]);
  const attempts = session?.user.id
    ? await prisma.attempt.findMany({ where: { userId: session.user.id }, select: { isCorrect: true } })
    : [];
  const answered = attempts.length;
  const accuracy = answered ? Math.round((attempts.filter((attempt) => attempt.isCorrect).length / answered) * 100) : 0;
  const displayName = session?.user.name?.split(" ")[0];
  const questionCount = (certification: (typeof certifications)[number]) => certification.domains.reduce((sum, domain) => sum + domain._count.questions, 0);
  const totalQuestions = certifications.reduce((sum, certification) => sum + questionCount(certification), 0);
  const previewCert = certifications.find((certification) => certification.slug === "security-plus") ?? certifications[0];
  const firstLab = ccnaLabs[0];

  return (
    <main className="home">
      <section className="band band-mint hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{displayName ? `Welcome back, ${displayName}` : "IT certification preparation"}</p>
            <h1>Prepare with Purpose. Practise with Confidence.</h1>
            <p className="hero-lead">Build certification-ready skills with focused practice questions, practical technical labs, and structured learning experiences.</p>
            <div className="hero-actions">
              <Link href="/certifications" className="button button-primary button-large">Explore Certifications <ArrowRight size={17} /></Link>
              <Link href="/labs" className="button button-secondary button-large">Explore Hands-on Labs</Link>
            </div>
            {session?.user ? (
              <dl className="hero-stats">
                <div><dt>Questions answered</dt><dd>{answered}</dd></div>
                <div><dt>Accuracy</dt><dd>{answered ? `${accuracy}%` : "—"}</dd></div>
                <div><dt>Your record</dt><dd><Link href="/history" className="text-link">View progress <ArrowRight size={14} /></Link></dd></div>
              </dl>
            ) : (
              <p className="hero-note"><CheckCircle2 size={16} /> Free account. {totalQuestions.toLocaleString("en-US")} original questions across {certifications.length} certifications.</p>
            )}
          </div>

          <div className="hero-preview" aria-label="Product preview">
            {previewCert && (
              <div className="preview-card">
                <div className="preview-card-head">
                  <span className="cert-symbol">{(() => { const Icon = certificationIcon(previewCert.slug); return <Icon size={18} />; })()}</span>
                  <div><strong>{previewCert.acronym}</strong><span>{previewCert.examCode} · {questionCount(previewCert)} questions</span></div>
                </div>
                <p className="preview-label">Choose a study mode</p>
                <ul className="preview-modes">
                  {studyModes.map((mode, index) => <li key={mode.title} className={index === 0 ? "preview-mode-selected" : undefined}><mode.icon size={16} /> {mode.title}</li>)}
                </ul>
                <p className="preview-label">Exam domains</p>
                <ul className="preview-domains">
                  {previewCert.domains.slice(0, 4).map((domain) => <li key={domain.id}><span>{domain.name}</span><span>{domain._count.questions}</span></li>)}
                </ul>
              </div>
            )}
            <div className="preview-terminal" aria-label={`Lab preview: ${firstLab.title}`}>
              <div className="preview-terminal-head"><Terminal size={14} /> {firstLab.device} · CCNA lab</div>
              <pre>{labPreview().map((line) => `${line.prompt} ${line.command}${line.output ? `\n${line.output}` : ""}`).join("\n")}</pre>
            </div>
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="pathways-heading">
        <div className="container">
          <div className="section-head">
            <div><p className="eyebrow">Certification pathways</p><h2 id="pathways-heading">Choose where to start</h2><p className="section-lead">Each question bank follows the official exam domains, so you can see exactly what you have covered.</p></div>
            <Link className="text-link" href="/certifications">All certifications <ArrowRight size={16} /></Link>
          </div>
          <div className="cert-grid">
            {certifications.map((certification) => {
              const Icon = certificationIcon(certification.slug);
              const count = questionCount(certification);
              return (
                <article className="cert-card" key={certification.id}>
                  <div className="cert-card-top"><span className="cert-symbol"><Icon size={19} /></span><span className="exam-code">{certification.examCode}</span></div>
                  <h3>{certification.acronym}</h3>
                  <p className="cert-name">{certification.name}</p>
                  <div className="cert-card-footer">
                    <span>{count} questions · {certification.domains.length} domains</span>
                    {certification.slug === "ccna" && <span className="tag tag-mint"><Network size={13} /> Labs</span>}
                  </div>
                  <Link className="cert-card-cta" href={`/practice/${certification.slug}`}>Start practice <ArrowRight size={16} /><span className="sr-only"> for {certification.acronym}</span></Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="band band-alt" aria-labelledby="practice-heading">
        <div className="container split">
          <div>
            <p className="eyebrow">Practice tests</p>
            <h2 id="practice-heading">Three ways to practise</h2>
            <p className="section-lead">Start with untimed practice, then move to timed exams as your accuracy improves. Every answer is saved to your progress.</p>
            <Link className="button button-primary" href="/practice">Browse practice tests <ArrowRight size={16} /></Link>
          </div>
          <div className="feature-list">
            {studyModes.map((mode) => <div className="feature-item" key={mode.title}><span className="feature-icon"><mode.icon size={18} /></span><div><h3>{mode.title}</h3><p>{mode.copy}</p></div></div>)}
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="labs-heading">
        <div className="container split split-reverse">
          <div>
            <p className="eyebrow">Hands-on labs</p>
            <h2 id="labs-heading">Configure it yourself</h2>
            <p className="section-lead">Guided labs run in a browser-based Cisco IOS simulator. Type the commands, verify the result, and see each task checked off as you go. Completed labs are saved to your progress.</p>
            <Link className="button button-primary" href="/labs">Open the labs <ArrowRight size={16} /></Link>
          </div>
          <div className="lab-feature">
            {ccnaLabs.map((lab) => (
              <Link className="lab-feature-card" href={`/labs/${lab.slug}`} key={lab.slug}>
                <span className="tag tag-mint">{lab.difficulty} · {lab.durationMinutes} min</span>
                <h3>{lab.title}</h3>
                <p>{lab.description}</p>
                <ol>{lab.tasks.map((task) => <li key={task.id}><CheckCircle2 size={15} /> {task.title}</li>)}</ol>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-mint" aria-labelledby="how-heading">
        <div className="container">
          <div className="section-head"><div><p className="eyebrow">How CertMastery helps</p><h2 id="how-heading">A clear route to exam day</h2></div></div>
          <ol className="steps">
            {steps.map((step, index) => <li className="step" key={step.title}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><step.icon size={20} /><h3>{step.title}</h3><p>{step.copy}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="band" aria-labelledby="cta-heading">
        <div className="container cta">
          <div><h2 id="cta-heading">{session?.user ? "Pick up where you left off" : "Start preparing today"}</h2><p>{session?.user ? "Review your weak areas, then take another session." : "Create a free account to practise questions and save your progress."}</p></div>
          <div className="cta-actions">
            {session?.user
              ? <Link className="button button-primary button-large" href="/history"><BarChart3 size={17} /> View my progress</Link>
              : <Link className="button button-primary button-large" href="/register">Create free account <ArrowRight size={17} /></Link>}
            <Link className="button button-secondary button-large" href="/certifications">Explore Certifications</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
