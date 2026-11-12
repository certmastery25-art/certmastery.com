import type { NseProgramme } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight, Gauge } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { LEVELS, getStudentProgress, listPublishedPathways, nextActivity } from "@/lib/nse/progress";
import { PROGRAMMES } from "@/lib/nse/programmes";
import { READINESS_WEIGHTS } from "@/lib/nse/readiness";


const COMPONENT_LABELS: Record<keyof typeof READINESS_WEIGHTS, [string, string]> = {
  coverage: ["Topic coverage", "Share of modules with at least one answered question."],
  accuracy: ["Practice accuracy", "All answers, with harder questions counting more."],
  recentExams: ["Recent exams", "Your last three mock or readiness exams, newest counting most."],
  consistency: ["Consistency", "How close those exam scores are to each other."],
  labs: ["Labs", "Share of this pathway's labs completed. Left out when a pathway has none."],
};

export async function DashboardView({ programme: key }: { programme: NseProgramme }) {
  const programme = PROGRAMMES[key];
  const session = await getServerSession(authOptions);
  if (!session?.user.id) redirect(`/login?reason=account-required&callbackUrl=${programme.base}/dashboard`);
  const pathways = await listPublishedPathways(key);
  const { byPathway, completedLabs, attempts } = await getStudentProgress(session.user.id, pathways);
  const active = byPathway.filter((row) => row.modulesCompleted > 0 || row.answered > 0 || row.labsCompleted > 0);
  const modulesTotal = byPathway.reduce((sum, row) => sum + row.topics.length, 0);
  const modulesDone = byPathway.reduce((sum, row) => sum + row.modulesCompleted, 0);
  const labsTotal = byPathway.reduce((sum, row) => sum + row.pathway.labs.length, 0);
  const answered = byPathway.reduce((sum, row) => sum + row.answered, 0);
  const correct = byPathway.reduce((sum, row) => sum + row.topics.reduce((topicSum, topic) => topicSum + topic.correct, 0), 0);
  const currentLevel = Math.max(0, ...active.map((row) => row.pathway.level));
  const levelName = key === "FORTINET" ? LEVELS.find((level) => level.level === currentLevel) : undefined;
  const working = key === "FORTINET"
    ? (levelName ? `You're working at NSE ${currentLevel}: ${levelName.name}.` : "You haven't started yet. Choose a pathway to begin.")
    : (active.length ? `You're working on ${active.map((row) => row.pathway.slug.toUpperCase()).join(", ")}.` : "You haven't started yet. Choose an exam to begin.");
  const mocks = attempts.filter((attempt) => attempt.mode !== "PRACTICE").slice(0, 8);
  const titleById = new Map(pathways.map((pathway) => [pathway.id, pathway]));

  return (
    <main className={`main-content inner-page nse-page${key === "AZURE" ? " azure-page" : ""}`}>
      <Link href={programme.base} className="back-link"><ArrowLeft size={15} /> {programme.name}</Link>
      <div className="page-heading"><p className="eyebrow">{programme.name} dashboard</p><h1>{`Your ${key === "AZURE" ? "Azure" : "Fortinet"} progress`}</h1><p>{working}</p></div>

      <dl className="nse-hero-stats nse-dash-stats">
        <div><dt>Topics practised</dt><dd>{modulesDone}<small>/{modulesTotal}</small></dd></div>
        <div><dt>Questions answered</dt><dd>{answered}</dd></div>
        <div><dt>Overall accuracy</dt><dd>{answered ? `${Math.round((correct / answered) * 100)}%` : "None yet"}</dd></div>
        {labsTotal > 0 && <div><dt>Labs complete</dt><dd>{pathways.flatMap((pathway) => pathway.labs).filter((lab) => completedLabs.has(lab.slug)).length}<small>/{labsTotal}</small></dd></div>}
      </dl>

      {!active.length && <div className="empty-state nse-empty"><Gauge size={26} /><p>Your readiness and topic scores will appear here after you start practising.</p><Link className="button button-primary" href={programme.start}>{key === "AZURE" ? "Start AZ-104" : "Start at NSE 1"} <ArrowRight size={16} /></Link></div>}

      {active.map((row) => {
        const strengths = row.topics.filter((topic) => topic.percent !== null && topic.total >= 3 && topic.percent >= 80);
        const weaknesses = row.topics.filter((topic) => topic.percent !== null && topic.total >= 3 && topic.percent < 70);
        const outstanding = row.topics.filter((topic) => !topic.completed);
        const next = nextActivity(row);
        return (
          <section className="nse-card nse-dash-card" key={row.pathway.id} aria-labelledby={`dash-${row.pathway.slug}`}>
            <div className="nse-dash-head">
              <div><h2 id={`dash-${row.pathway.slug}`}><Link href={`${programme.base}/${row.pathway.slug}`}>{row.pathway.title}</Link></h2><p>{row.modulesCompleted} of {row.topics.length} topics practised{row.pathway.labs.length ? ` · ${row.labsCompleted} of ${row.pathway.labs.length} labs` : ""} · {row.answered} answers</p></div>
              <div className="nse-readiness">{row.readiness.score === null ? <><strong className="nse-readiness-empty">Not enough data</strong><span>Needs {row.readiness.missing.join(" and ")}</span></> : <><strong>{row.readiness.score}</strong><span>CertMastery readiness</span></>}</div>
            </div>
            <div className="nse-dash-columns">
              <div>
                <h3>Topic scores</h3>
                <div className="nse-topic-scores">{row.topics.map((topic) => <div key={topic.id}><Link className="text-link" href={`${programme.base}/${row.pathway.slug}/${topic.slug}`}>{topic.title}</Link><span>{topic.percent === null ? "Not attempted" : `${topic.percent}% of ${topic.total}`}</span><div className="accuracy-track"><span style={{ width: `${topic.percent ?? 0}%` }} /></div></div>)}</div>
              </div>
              <div>
                <h3>Readiness breakdown</h3>
                <dl className="nse-breakdown">{(Object.keys(READINESS_WEIGHTS) as (keyof typeof READINESS_WEIGHTS)[]).filter((part) => part !== "labs" || row.pathway.labs.length > 0).map((key) => <div key={key}><dt>{COMPONENT_LABELS[key][0]} <small>{Math.round(READINESS_WEIGHTS[key] * 100)}% of score</small></dt><dd>{row.readiness.components[key]}%</dd></div>)}</dl>
                <h3>Strengths</h3><p>{strengths.map((topic) => topic.title).join(", ") || "None yet. Strengths need 80% or more on at least three answers."}</p>
                <h3>Needs work</h3><p>{weaknesses.map((topic) => topic.title).join(", ") || "Nothing flagged yet."}</p>
                <h3>Topics left to practise</h3><p>{outstanding.map((topic) => topic.title).join(", ") || "All topics practised."}</p>
                <Link className="button button-primary" href={next.href}>{next.label} <ArrowRight size={16} /></Link>
              </div>
            </div>
          </section>
        );
      })}

      {mocks.length > 0 && (
        <section className="nse-card">
          <h2>Mock and readiness results</h2>
          <div className="nse-table-wrap" tabIndex={0}><table><thead><tr><th>Pathway</th><th>Type</th><th>Score</th><th>Date</th></tr></thead><tbody>{mocks.map((exam) => <tr key={exam.id}><td><Link className="text-link" href={`${programme.base}/exam/${exam.id}`}>{titleById.get(exam.pathwayId)?.title ?? "Pathway"}</Link></td><td>{exam.mode === "MOCK" ? "Timed mock" : "Readiness"}</td><td>{exam.correctAnswers}/{exam.totalQuestions}</td><td>{exam.submittedAt?.toLocaleDateString("en-GB", { timeZone: "UTC" })}</td></tr>)}</tbody></table></div>
        </section>
      )}

      <section className="nse-card" aria-labelledby="how-readiness">
        <h2 id="how-readiness">How readiness is calculated</h2>
        <p>The score appears after at least two submitted mock or readiness exams and 20 answers in a pathway. It is a weighted average of:</p>
        <ul className="nse-plain-list">{(Object.keys(READINESS_WEIGHTS) as (keyof typeof READINESS_WEIGHTS)[]).map((key) => <li key={key}><strong>{COMPONENT_LABELS[key][0]} ({Math.round(READINESS_WEIGHTS[key] * 100)}%):</strong> {COMPONENT_LABELS[key][1]}</li>)}</ul>
        <p className="nse-disclaimer">It&apos;s a study guide, not a prediction. It hasn&apos;t been calibrated against official results, and {key === "AZURE" ? "Microsoft reports exam results on its own scale, where 700 passes, and this score isn't on that scale." : "Fortinet doesn't publish pass marks on the exam pages we checked."}</p>
      </section>
    </main>
  );
}
