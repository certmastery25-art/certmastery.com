"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Clock3, Flag, GripVertical, LoaderCircle, X } from "lucide-react";

type Mode = "PRACTICE" | "MOCK" | "READINESS";
type Answer = string[] | Record<string, string>;
type RevealOption = { label: string; text: string; rationale: string; isCorrect: boolean; position: number | null; matchTo: string | null };
type Reveal = { explanation: string; technology: string; topic: string; reference: string | null; options: RevealOption[] };
type Question = { type: "SINGLE" | "MULTIPLE" | "MATCHING" | "ORDERING"; prompt: string; exhibit: string | null; difficulty: string; options: { label: string; text: string }[]; selectCount: number | null; targets: string[] | null };
type Attempt = { id: string; mode: Mode; totalQuestions: number; correctAnswers: number; deadlineAt: string | null; submittedAt: string | null; serverNow: string; pathway: { slug: string; title: string } };
type Result = Reveal & { response: Answer | null; isCorrect: boolean | null; flagged: boolean; type: Question["type"]; prompt: string; exhibit: string | null; difficulty: string; module: { title: string; slug: string } };
type Loaded = { attempt: Attempt; results?: Result[]; statuses?: { answered: boolean; flagged: boolean }[]; index?: number; question?: Question; response?: Answer | null; flagged?: boolean; isCorrect?: boolean | null; reveal?: Reveal };

const MODE_LABEL: Record<Mode, string> = { PRACTICE: "Practice", MOCK: "Timed mock exam", READINESS: "Readiness assessment" };
const DISCLAIMER = "This is CertMastery's own assessment with original questions. It isn't a Fortinet exam, and its score doesn't predict or guarantee an official result.";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function RevealPanel({ reveal, isCorrect, type }: { reveal: Reveal; isCorrect: boolean | null; type: Question["type"] }) {
  const options = type === "ORDERING" ? [...reveal.options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : reveal.options;
  return (
    <div className={`explanation-box ${isCorrect ? "explanation-correct" : "explanation-review"}`} aria-live="polite">
      <div className="explanation-title">{isCorrect ? <Check size={16} /> : <X size={16} />}{isCorrect ? "Correct" : "Not quite"}</div>
      <p>{reveal.explanation}</p>
      <ul className="nse-rationales">
        {options.map((option) => (
          <li key={option.label} className={option.isCorrect || type === "MATCHING" || type === "ORDERING" ? "nse-rationale-right" : ""}>
            <strong>{type === "ORDERING" ? `${option.position}. ` : option.isCorrect ? "Correct: " : type === "MATCHING" ? "" : "Incorrect: "}{option.text}{type === "MATCHING" ? ` → ${option.matchTo}` : ""}</strong>
            <span>{option.rationale}</span>
          </li>
        ))}
      </ul>
      <p className="nse-reveal-meta">{reveal.technology === reveal.topic ? reveal.topic : `${reveal.technology} · ${reveal.topic}`}{reveal.reference ? <> · <a className="text-link" href={reveal.reference} target="_blank" rel="noreferrer">Reference</a></> : null}</p>
    </div>
  );
}

function Exhibit({ text }: { text: string | null }) {
  return text ? <pre className="nse-exhibit" tabIndex={0}><code>{text}</code></pre> : null;
}

function AnswerInput({ question, answer, onChange, disabled }: { question: Question; answer: Answer | null; onChange: (next: Answer) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const name = question.prompt.slice(0, 24);

  if (question.type === "SINGLE" || question.type === "MULTIPLE") {
    const chosen = Array.isArray(answer) ? answer : [];
    return (
      <fieldset className="answer-fieldset" disabled={disabled}>
        <legend className="nse-select-note">{question.type === "MULTIPLE" ? `Choose ${question.selectCount}` : "Choose one"}</legend>
        <div className="answer-options">
          {question.options.map((option, index) => (
            <label key={option.label} className={`answer-option ${chosen.includes(option.label) ? "answer-selected" : ""}`}>
              <input
                type={question.type === "SINGLE" ? "radio" : "checkbox"}
                name={name}
                checked={chosen.includes(option.label)}
                onChange={(event) => onChange(question.type === "SINGLE" ? [option.label] : event.target.checked ? [...chosen, option.label] : chosen.filter((label) => label !== option.label))}
              />
              <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
              <span className="answer-text">{option.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === "ORDERING") {
    const order = Array.isArray(answer) && answer.length === question.options.length ? answer : question.options.map((option) => option.label);
    const text = (label: string) => question.options.find((option) => option.label === label)?.text;
    const move = (from: number, to: number) => {
      if (to < 0 || to >= order.length) return;
      const next = [...order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
    };
    return (
      <div>
        <p className="nse-select-note">Drag into the correct order, or use the arrows.</p>
        <ol className="nse-order-list">
          {order.map((label, index) => (
            <li key={label} draggable={!disabled} onDragStart={() => setDragging(label)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging) move(order.indexOf(dragging), index); setDragging(null); }}>
              <GripVertical size={16} aria-hidden="true" />
              <span className="nse-order-number">{index + 1}</span>
              <span className="nse-order-text">{text(label)}</span>
              <button type="button" className="icon-button" aria-label={`Move "${text(label)}" up`} disabled={disabled || index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={15} /></button>
              <button type="button" className="icon-button" aria-label={`Move "${text(label)}" down`} disabled={disabled || index === order.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={15} /></button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const pairs = answer && !Array.isArray(answer) ? answer : {};
  const assign = (label: string, target: string) => {
    const next = { ...pairs };
    if (target) next[label] = target;
    else delete next[label];
    onChange(next);
  };
  return (
    <div>
      <p className="nse-select-note">Drag a target onto each item, or choose from the list.</p>
      <div className="nse-targets" aria-hidden="true">
        {question.targets?.map((target) => <span key={target} draggable={!disabled} onDragStart={() => setDragging(target)} className="nse-target-chip">{target}</span>)}
      </div>
      <div className="nse-match-list">
        {question.options.map((option) => (
          <div className="nse-match-row" key={option.label} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging) assign(option.label, dragging); setDragging(null); }}>
            <label htmlFor={`match-${option.label}`}>{option.text}</label>
            <select id={`match-${option.label}`} className="text-input" disabled={disabled} value={pairs[option.label] ?? ""} onChange={(event) => assign(option.label, event.target.value)}>
              <option value="">Choose a match</option>
              {question.targets?.map((target) => <option key={target} value={target}>{target}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function Results({ attempt, results }: { attempt: Attempt; results: Result[] }) {
  const percent = attempt.totalQuestions ? Math.round((attempt.correctAnswers / attempt.totalQuestions) * 100) : 0;
  const topics = new Map<string, { title: string; slug: string; correct: number; total: number }>();
  for (const result of results) {
    const row = topics.get(result.module.slug) ?? { ...result.module, correct: 0, total: 0 };
    row.total += 1;
    if (result.isCorrect) row.correct += 1;
    topics.set(result.module.slug, row);
  }
  const rows = [...topics.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);
  const weak = rows.filter((row) => row.correct / row.total < 0.7);
  return (
    <section className="nse-results" aria-labelledby="nse-result-heading">
      <p className="eyebrow">{MODE_LABEL[attempt.mode]} complete</p>
      <h1 id="nse-result-heading">{attempt.pathway.title}</h1>
      <div className="result-score-row nse-score-row">
        <div className="result-score"><strong>{percent}<small>%</small></strong><span>Score</span></div>
        <div className="result-divider" />
        <div className="result-score"><strong>{attempt.correctAnswers}<small>/{attempt.totalQuestions}</small></strong><span>Fully correct</span></div>
      </div>
      <p className="nse-disclaimer">{DISCLAIMER} Answers count only when fully correct, which matches Fortinet&apos;s stated marking for its exams.</p>

      <h2>Scores by topic</h2>
      <div className="nse-topic-scores">
        {rows.map((row) => {
          const value = Math.round((row.correct / row.total) * 100);
          return <div key={row.slug}><Link className="text-link" href={`/fortinet/${attempt.pathway.slug}/${row.slug}`}>{row.title}</Link><span>{row.correct}/{row.total} ({value}%)</span><div className="accuracy-track"><span style={{ width: `${value}%` }} /></div></div>;
        })}
      </div>
      {weak.length > 0 && <div className="nse-recommend"><h2>Practise these next</h2><ul>{weak.map((row) => <li key={row.slug}><Link className="text-link" href={`/fortinet/${attempt.pathway.slug}/${row.slug}`}>{row.title}</Link></li>)}</ul></div>}

      <h2>Review your answers</h2>
      <div className="nse-review-list">
        {results.map((result, index) => (
          <details key={index} className="nse-review-item">
            <summary>{result.isCorrect ? <Check size={16} className="nse-right" aria-label="Correct" /> : <X size={16} className="nse-wrong" aria-label="Incorrect" />}<span>Question {index + 1}: {result.prompt}</span></summary>
            <Exhibit text={result.exhibit} />
            <p className="nse-your-answer">Your answer: {result.response === null ? "not answered" : Array.isArray(result.response) ? result.response.map((label) => result.options.find((option) => option.label === label)?.text).join(result.type === "ORDERING" ? " → " : "; ") : Object.entries(result.response).map(([label, target]) => `${result.options.find((option) => option.label === label)?.text} → ${target}`).join("; ")}</p>
            <RevealPanel reveal={result} isCorrect={result.isCorrect} type={result.type} />
          </details>
        ))}
      </div>
      <div className="result-actions"><Link className="button button-primary" href={`/fortinet/${attempt.pathway.slug}`}>Back to pathway <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/fortinet/dashboard">View dashboard</Link></div>
    </section>
  );
}

export function NseExamRunner({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const clockOffset = useRef(0);

  const load = useCallback(async (index: number) => {
    setError("");
    setLoading(true);
    const response = await fetch(`/api/nse/exams/${attemptId}?index=${index}`).catch(() => null);
    setLoading(false);
    const next = await response?.json().catch(() => null);
    if (!response?.ok || !next) {
      setError(next?.error ?? "We couldn't load this exam.");
      return;
    }
    clockOffset.current = new Date(next.attempt.serverNow).getTime() - Date.now();
    setData(next);
    setAnswer(next.response ?? null);
    setSaved(Boolean(next.statuses?.[index]?.answered));
    setConfirming(false);
    window.scrollTo?.({ top: 0 });
  }, [attemptId]);

  useEffect(() => { void load(0); }, [load]);

  const submit = useCallback(async () => {
    setPending(true);
    const response = await fetch(`/api/nse/exams/${attemptId}/submit`, { method: "POST" }).catch(() => null);
    if (!response?.ok) setError("We couldn't submit your exam. Try again.");
    else await load(0);
    setPending(false);
  }, [attemptId, load]);

  const deadline = data?.attempt.submittedAt ? null : data?.attempt.deadlineAt;
  useEffect(() => {
    if (!deadline) { setRemaining(null); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(deadline).getTime() - (Date.now() + clockOffset.current)) / 1000));
      setRemaining(left);
      if (left === 0) void submit();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, submit]);

  if (error && !data) return <div className="empty-state"><p>{error}</p><Link className="button button-secondary" href="/fortinet">Back to the academy</Link></div>;
  if (!data) return <div className="quiz-loading" role="status"><LoaderCircle className="spin" size={22} /> Loading your exam</div>;
  if (data.results) return <Results attempt={data.attempt} results={data.results} />;

  const { attempt, question, statuses = [], index = 0 } = data;
  if (!question) return null;
  const practice = attempt.mode === "PRACTICE";
  const revealed = practice && Boolean(data.reveal);

  async function save(next: Answer, reveal = false) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/nse/exams/${attemptId}/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ index, response: next }) }).catch(() => null);
    const result = await response?.json().catch(() => null);
    setPending(false);
    if (result?.code === "TIME_UP") { await load(0); return; }
    if (!response?.ok) { setError(result?.error ?? "We couldn't save your answer."); return; }
    setSaved(true);
    setData((current) => current && ({ ...current, statuses: current.statuses?.map((item, position) => position === index ? { ...item, answered: true } : item), ...(reveal ? { reveal: result.reveal, isCorrect: result.isCorrect } : {}) }));
  }

  function change(next: Answer) {
    setAnswer(next);
    setSaved(false);
    if (!practice) void save(next);
  }

  async function toggleFlag() {
    const flagged = !data?.flagged;
    setData((current) => current && ({ ...current, flagged, statuses: current.statuses?.map((item, position) => position === index ? { ...item, flagged } : item) }));
    await fetch(`/api/nse/exams/${attemptId}/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ index, flagged }) }).catch(() => null);
  }

  const orderingDefault = question.type === "ORDERING" && !answer ? question.options.map((option) => option.label) : null;
  const unanswered = statuses.filter((item) => !item.answered).length;
  const flaggedCount = statuses.filter((item) => item.flagged).length;

  return (
    <section className="nse-exam" aria-labelledby="question-heading">
      <div className="quiz-topline">
        <Link href={`/fortinet/${attempt.pathway.slug}`} className="quiz-back"><ArrowLeft size={16} /> {attempt.pathway.title}</Link>
        <div className="quiz-mode-label">{MODE_LABEL[attempt.mode]}</div>
        {remaining !== null ? <div className={`quiz-timer ${remaining < 60 ? "timer-urgent" : ""}`} role="timer" aria-label={`Time remaining ${formatTime(remaining)}`}><Clock3 size={16} />{formatTime(remaining)}</div> : <span className="quiz-timer-space" />}
      </div>

      <div className="nse-exam-layout">
        <div className="nse-exam-main" aria-busy={loading}>
          <div className="question-meta">
            <span className="domain-chip">Question {index + 1} of {attempt.totalQuestions}</span>
            <span className="nse-difficulty">{question.difficulty.toLowerCase()}</span>
            <button type="button" className={`nse-flag ${data.flagged ? "nse-flag-on" : ""}`} aria-pressed={Boolean(data.flagged)} onClick={() => void toggleFlag()}><Flag size={14} /> {data.flagged ? "Marked for review" : "Mark for review"}</button>
          </div>
          <Exhibit text={question.exhibit} />
          <h1 id="question-heading" className="nse-question">{question.prompt}</h1>
          <AnswerInput question={question} answer={answer} onChange={change} disabled={loading || revealed || pending && practice} />

          {revealed && data.reveal && <RevealPanel reveal={data.reveal} isCorrect={data.isCorrect ?? false} type={question.type} />}
          {error && <p className="form-alert" role="alert">{error}</p>}

          <div className="quiz-footer nse-exam-footer">
            <button className="button button-secondary" type="button" onClick={() => void load(index - 1)} disabled={loading || index === 0}><ArrowLeft size={16} /> Previous</button>
            {practice && !revealed && <button className="button button-primary" type="button" disabled={loading || pending || !(answer ?? orderingDefault)} onClick={() => void save((answer ?? orderingDefault)!, true)}>Check answer</button>}
            {!practice && question.type === "ORDERING" && !saved && <button className="button button-primary" type="button" disabled={pending} onClick={() => void save((answer ?? orderingDefault)!)}>Keep this order</button>}
            {!practice && <span className="nse-saved" aria-live="polite">{pending ? "Saving" : saved ? "Saved" : ""}</span>}
            {index + 1 < attempt.totalQuestions
              ? <button className="button button-secondary" type="button" disabled={loading} onClick={() => void load(index + 1)}>{loading ? <LoaderCircle className="spin" size={16} /> : null}Next <ArrowRight size={16} /></button>
              : <button className="button button-primary" type="button" onClick={() => setConfirming(true)}>Finish</button>}
          </div>
        </div>

        <aside className="nse-exam-nav" aria-label="Question navigation">
          <h2>Questions</h2>
          <div className="nse-question-grid">
            {statuses.map((item, position) => (
              <button key={position} type="button" className={`${position === index ? "nse-current" : ""} ${item.answered ? "nse-answered" : ""} ${item.flagged ? "nse-flagged" : ""}`} aria-current={position === index ? "true" : undefined} aria-label={`Question ${position + 1}${item.answered ? ", answered" : ""}${item.flagged ? ", marked for review" : ""}`} onClick={() => void load(position)}>{position + 1}</button>
            ))}
          </div>
          <p className="nse-nav-summary">{unanswered} unanswered · {flaggedCount} marked</p>
          <button className="button button-secondary" type="button" onClick={() => setConfirming(true)}>Submit exam</button>
          {confirming && (
            <div className="nse-confirm" role="alertdialog" aria-label="Confirm submission">
              <p>{unanswered ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered and will be marked incorrect. ` : ""}Submit now? You can&apos;t change answers afterwards.</p>
              <button className="button button-primary" type="button" disabled={pending} onClick={() => void submit()}>{pending ? <LoaderCircle className="spin" size={16} /> : null} Submit</button>
              <button className="button button-secondary" type="button" onClick={() => setConfirming(false)}>Keep working</button>
            </div>
          )}
          {!practice && <p className="nse-disclaimer">{DISCLAIMER}</p>}
        </aside>
      </div>
    </section>
  );
}
