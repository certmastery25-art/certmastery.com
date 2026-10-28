"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Compass, LoaderCircle, LockKeyhole, Network, Target } from "lucide-react";

type ProgressRecord = {
  id: string;
  slug: string;
  acronym: string;
  name: string;
  examCode: string;
  questionsAnswered: number;
  uniqueQuestionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  domains: { id: string; name: string; objective: string; questionsAnswered: number; accuracy: number }[];
  history: { id: string; mode: "PRACTICE" | "TIMED" | "CUSTOM"; totalQuestions: number; correctAnswers: number; startedAt: string; completedAt: string | null }[];
};

export type LabProgress = { slug: string; title: string; durationMinutes: number; completedAt: string | null };

type NextStep = { title: string; copy: string; href: string; action: string };

const MODE_LABELS = { PRACTICE: "Practice", TIMED: "Timed exam", CUSTOM: "Custom quiz" } as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Suggests one next action from the learner's own records, in order of usefulness.
function nextStep(records: ProgressRecord[], labs: LabProgress[]): NextStep {
  const active = records.filter((record) => record.questionsAnswered > 0).sort((left, right) => right.questionsAnswered - left.questionsAnswered);
  if (!active.length) return { title: "Start your first practice session", copy: "Pick a certification and answer a short set of questions to establish your baseline.", href: "/certifications", action: "Choose a certification" };

  const weakest = active.flatMap((record) => record.domains.filter((domain) => domain.questionsAnswered > 0 && domain.accuracy < 70).map((domain) => ({ ...domain, record }))).sort((left, right) => left.accuracy - right.accuracy)[0];
  if (weakest) return { title: `Review ${weakest.name}`, copy: `${weakest.record.acronym} · ${weakest.accuracy}% accuracy over ${weakest.questionsAnswered} answers. A custom quiz on this domain is the quickest way to close the gap.`, href: `/practice/${weakest.record.slug}`, action: "Build a custom quiz" };

  const untimed = active.find((record) => !record.history.some((item) => item.mode === "TIMED"));
  if (untimed) return { title: `Try a timed ${untimed.acronym} exam`, copy: `Your ${untimed.acronym} accuracy is ${untimed.accuracy}%. A timed session will show how it holds up at exam pace.`, href: `/practice/${untimed.slug}`, action: "Set up a timed exam" };

  const openLab = labs.find((lab) => !lab.completedAt);
  if (openLab) return { title: `Complete the lab: ${openLab.title}`, copy: `A ${openLab.durationMinutes}-minute hands-on exercise in the CCNA network simulator.`, href: `/labs/${openLab.slug}`, action: "Start lab" };

  return { title: `Keep ${active[0].acronym} sharp`, copy: `You are at ${active[0].accuracy}% accuracy with no domain below 70%. Another timed session keeps your pacing consistent.`, href: `/practice/${active[0].slug}`, action: "Start a session" };
}

export function ProgressDashboard({ labs }: { labs: LabProgress[] }) {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/progress")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Progress could not be loaded.");
        if (!cancelled) setRecords(data as ProgressRecord[]);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Progress could not be loaded.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session?.user, status]);

  if (status === "loading" || loading) return <div className="progress-loading" role="status"><LoaderCircle className="spin" size={22} /> Loading your progress</div>;

  if (!session?.user) return <section className="history-signin"><span className="history-lock"><LockKeyhole size={22} /></span><p className="eyebrow">Your study record</p><h2>Progress that stays with you.</h2><p>Sign in to see your accuracy, spot weak domains, and pick up from your recent sessions.</p><Link className="button button-primary" href="/login">Sign in <ArrowRight size={16} /></Link><span className="history-create">New here? <Link href="/register">Create a free account</Link></span></section>;

  const totalAnswered = records.reduce((sum, record) => sum + record.questionsAnswered, 0);
  const totalCorrect = records.reduce((sum, record) => sum + record.correctAnswers, 0);
  const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const completedLabs = labs.filter((lab) => lab.completedAt).length;
  const sessions = records.flatMap((record) => record.history.map((item) => ({ ...item, certification: record.acronym }))).sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()).slice(0, 8);
  const weakAreas = records.flatMap((record) => record.domains.filter((domain) => domain.questionsAnswered > 0 && domain.accuracy < 70).map((domain) => ({ ...domain, certification: record.acronym, slug: record.slug }))).sort((left, right) => left.accuracy - right.accuracy).slice(0, 5);
  const orderedRecords = [...records].sort((left, right) => right.questionsAnswered - left.questionsAnswered);
  const step = nextStep(records, labs);

  return <div className="progress-dashboard">
    {error && <p className="form-alert" role="alert">{error}</p>}
    <section className="progress-overview" aria-label="Summary">
      <div className="progress-metrics">
        <div><span>Questions answered</span><strong>{totalAnswered}</strong></div>
        <div><span>Correct</span><strong>{totalCorrect}</strong></div>
        <div><span>Accuracy</span><strong>{totalAnswered ? <>{overallAccuracy}<small>%</small></> : "—"}</strong></div>
        <div><span>Labs completed</span><strong>{completedLabs}<small> / {labs.length}</small></strong></div>
      </div>
      <div className="next-step">
        <span className="next-step-icon"><Compass size={20} /></span>
        <div><p className="eyebrow">Recommended next step</p><h2>{step.title}</h2><p>{step.copy}</p></div>
        <Link className="button button-primary" href={step.href}>{step.action} <ArrowRight size={16} /></Link>
      </div>
    </section>

    <section className="progress-section" aria-labelledby="cert-progress-heading">
      <div className="section-heading-row"><div><p className="eyebrow">By certification</p><h2 id="cert-progress-heading">Certification progress</h2></div></div>
      <div className="progress-cert-list">{orderedRecords.map((record) => <article className={record.questionsAnswered ? "progress-cert" : "progress-cert progress-cert-idle"} key={record.id}>
        <div className="progress-cert-head"><div><span className="progress-cert-code">{record.examCode}</span><h3>{record.acronym}</h3></div><Link className="text-link" href={`/practice/${record.slug}`}>{record.questionsAnswered ? "Practise" : "Start"} <ArrowRight size={15} /><span className="sr-only"> {record.acronym}</span></Link></div>
        {record.questionsAnswered ? <>
          <div className="progress-cert-stats"><span>{record.questionsAnswered} answers · {record.uniqueQuestionsAnswered} unique</span><span>{record.accuracy}% accuracy</span></div>
          <div className="accuracy-track" role="progressbar" aria-label={`${record.acronym} accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={record.accuracy}><span style={{ width: `${record.accuracy}%` }} /></div>
          <div className="domain-progress">{record.domains.map((domain) => <div className="domain-progress-row" key={domain.id}><span className="domain-progress-name"><span>{domain.objective}</span> {domain.name}</span><span className={domain.questionsAnswered ? "domain-progress-score" : "domain-progress-score domain-progress-empty"}>{domain.questionsAnswered ? `${domain.accuracy}%` : "Not started"}</span></div>)}</div>
        </> : <p className="progress-cert-empty">Not started yet. {record.domains.length} domains to cover.</p>}
      </article>)}</div>
    </section>

    <div className="history-columns">
      <section className="history-panel" aria-labelledby="weak-areas-heading"><div className="history-panel-heading"><div><p className="eyebrow">Focus next</p><h2 id="weak-areas-heading">Weak areas</h2></div><Target size={18} /></div>
        {weakAreas.length ? <div className="weak-area-list">{weakAreas.map((domain) => <Link href={`/practice/${domain.slug}`} className="weak-area-row" key={domain.id}><div className="weak-area-name"><strong>{domain.name}</strong><span>{domain.certification} · {domain.questionsAnswered} answers</span></div><strong className="weak-area-score">{domain.accuracy}%</strong></Link>)}</div> : <div className="history-empty"><CheckCircle2 size={19} /><p>{totalAnswered ? "No domain is below 70% accuracy. Keep building your coverage." : "Complete a quiz to surface the domains to focus on."}</p></div>}
      </section>
      <section className="history-panel" aria-labelledby="session-history-heading"><div className="history-panel-heading"><div><p className="eyebrow">Practice tests</p><h2 id="session-history-heading">Recent sessions</h2></div><Clock3 size={18} /></div>
        {sessions.length ? <div className="session-list">{sessions.map((item) => <div className="session-row" key={item.id}><div className="session-info"><strong>{item.certification} · {MODE_LABELS[item.mode]}</strong><span>{formatDate(item.startedAt)}</span></div><span className="session-score">{item.correctAnswers}/{item.totalQuestions}</span></div>)}</div> : <div className="history-empty"><BookOpenCheck size={19} /><p>Your completed sessions will show up here.</p></div>}
      </section>
      <section className="history-panel" aria-labelledby="labs-progress-heading"><div className="history-panel-heading"><div><p className="eyebrow">Hands-on labs</p><h2 id="labs-progress-heading">Your labs</h2></div><Network size={18} /></div>
        <div className="session-list">{labs.map((lab) => <Link href={`/labs/${lab.slug}`} className="session-row" key={lab.slug}><div className="session-info"><strong>{lab.title}</strong><span>{lab.completedAt ? `Completed ${formatDate(lab.completedAt)}` : `Not completed · ${lab.durationMinutes} min`}</span></div>{lab.completedAt ? <CheckCircle2 className="session-done" size={18} aria-label="Completed" /> : <ArrowRight size={16} aria-hidden="true" />}</Link>)}</div>
      </section>
    </div>
  </div>;
}
