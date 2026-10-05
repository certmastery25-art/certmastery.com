"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, BookOpenCheck, CheckCircle2, CircleHelp, Clock3, LoaderCircle, LockKeyhole, Target } from "lucide-react";

type ProgressRecord = {
  id: string;
  slug: string;
  acronym: string;
  name: string;
  examCode: string;
  color: string;
  questionsAnswered: number;
  uniqueQuestionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  domains: { id: string; name: string; objective: string; questionsAnswered: number; accuracy: number }[];
  history: { id: string; mode: "PRACTICE" | "TIMED" | "CUSTOM"; totalQuestions: number; correctAnswers: number; startedAt: string; completedAt: string | null }[];
};

export function ProgressDashboard() {
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

  if (!session?.user) return <section className="history-signin"><span className="history-lock"><LockKeyhole size={22} /></span><p className="eyebrow">YOUR STUDY RECORD</p><h2>Progress that stays with you.</h2><p>Sign in to see your accuracy, spot weak domains, and pick up from your recent sessions.</p><Link className="button button-primary" href="/login">Sign in <ArrowRight size={16} /></Link><span className="history-create">New here? <Link href="/register">Create a free account</Link></span></section>;

  const totalAnswered = records.reduce((sum, record) => sum + record.questionsAnswered, 0);
  const totalCorrect = records.reduce((sum, record) => sum + record.correctAnswers, 0);
  const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const sessions = records.flatMap((record) => record.history.map((item) => ({ ...item, certification: record.acronym, color: record.color }))).sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()).slice(0, 8);
  const weakAreas = records.flatMap((record) => record.domains.filter((domain) => domain.questionsAnswered > 0 && domain.accuracy < 70).map((domain) => ({ ...domain, certification: record.acronym, color: record.color }))).sort((left, right) => left.accuracy - right.accuracy).slice(0, 5);

  return <div className="progress-dashboard">
    {error && <p className="form-alert" role="alert">{error}</p>}
    <section className="progress-summary">
      <div className="progress-summary-main"><span className="progress-summary-icon"><Target size={20} /></span><div><p className="eyebrow">YOUR PREP AT A GLANCE</p><h2>Every question moves you forward.</h2><p>Keep showing up. The confidence follows.</p></div></div>
      <div className="progress-metrics"><div><span>Answered</span><strong>{totalAnswered}</strong></div><div><span>Correct</span><strong>{totalCorrect}</strong></div><div><span>Accuracy</span><strong>{overallAccuracy}<small>%</small></strong></div></div>
    </section>

    <section className="progress-section" aria-labelledby="cert-progress-heading">
      <div className="section-heading-row"><div><p className="eyebrow">BY CERTIFICATION</p><h2 id="cert-progress-heading">Your progress</h2></div></div>
      <div className="progress-cert-list">{records.map((record) => <article className="progress-cert" key={record.id} style={{ "--cert-color": record.color } as React.CSSProperties}>
        <div className="progress-cert-head"><div><span className="progress-cert-code">{record.examCode}</span><h3>{record.acronym}</h3></div><Link className="text-link" href={`/practice/${record.slug}`}>Practice <ArrowRight size={15} /></Link></div>
        <div className="progress-cert-stats"><span>{record.questionsAnswered} answers</span><span>{record.accuracy}% accuracy</span></div>
        <div className="accuracy-track" role="progressbar" aria-label={`${record.acronym} accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={record.accuracy}><span style={{ width: `${record.accuracy}%` }} /></div>
        <div className="domain-progress">{record.domains.map((domain) => <div className="domain-progress-row" key={domain.id}><span className="domain-progress-name"><span>{domain.objective}</span> {domain.name}</span><span className="domain-progress-score">{domain.questionsAnswered ? `${domain.accuracy}%` : "Not started"}</span></div>)}</div>
      </article>)}</div>
    </section>

    <div className="history-columns">
      <section className="history-panel" aria-labelledby="weak-areas-heading"><div className="history-panel-heading"><div><p className="eyebrow">FOCUS NEXT</p><h2 id="weak-areas-heading">Weak areas</h2></div><CircleHelp size={18} /></div>
        {weakAreas.length ? <div className="weak-area-list">{weakAreas.map((domain) => <div className="weak-area-row" key={domain.id}><span className="weak-area-mark" style={{ color: domain.color }}><Target size={16} /></span><div className="weak-area-name"><strong>{domain.name}</strong><span>{domain.certification} · {domain.questionsAnswered} answers</span></div><strong className="weak-area-score">{domain.accuracy}%</strong></div>)}</div> : <div className="history-empty"><CheckCircle2 size={19} /><p>{totalAnswered ? "No weak areas yet. Keep building your coverage." : "Complete a quiz to surface the domains to focus on."}</p></div>}
      </section>
      <section className="history-panel" aria-labelledby="session-history-heading"><div className="history-panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2 id="session-history-heading">Session history</h2></div><Clock3 size={18} /></div>
        {sessions.length ? <div className="session-list">{sessions.map((item) => <div className="session-row" key={item.id}><span className="session-cert-mark" style={{ backgroundColor: item.color }} aria-hidden="true" /><div className="session-info"><strong>{item.certification} · {item.mode === "TIMED" ? "Timed exam" : item.mode === "CUSTOM" ? "Custom quiz" : "Practice"}</strong><span>{new Date(item.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div><span className="session-score">{item.correctAnswers}/{item.totalQuestions}</span></div>)}</div> : <div className="history-empty"><BookOpenCheck size={19} /><p>Your completed sessions will show up here.</p></div>}
      </section>
    </div>
  </div>;
}