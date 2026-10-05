"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, Flag, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useQuizStore, type AnswerState, type QuizQuestion } from "@/stores/quiz-store";

type LoadedQuiz = {
  quiz: { id: string; mode: "PRACTICE" | "TIMED" | "CUSTOM"; startedAt: string; completedAt: string | null; totalQuestions: number; correctAnswers: number };
  questions: QuizQuestion[];
  answers: AnswerState[];
  certification: { name: string; examCode: string; slug: string };
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function QuizRunner({ quizId }: { quizId: string }) {
  const { quiz, certification, mode, questions, answers, setSession, setAnswer, setCompleted } = useQuizStore();
  const [ready, setReady] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (quiz?.id === quizId && questions.length) {
        setReady(true);
        setFinished(Boolean(quiz.completedAt));
        return;
      }
      try {
        const response = await fetch(`/api/quizzes/${quizId}`);
        const data = await response.json() as LoadedQuiz & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "We couldn't load this quiz.");
        if (cancelled) return;
        setSession(data.quiz, data.questions, data.certification, data.quiz.mode, data.answers);
        setFinished(Boolean(data.quiz.completedAt));
        setReady(true);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "We couldn't load this quiz.");
          setReady(true);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [quiz?.id, quiz?.completedAt, quizId, questions.length, setSession]);

  const finishQuiz = useCallback(async () => {
    if (!quiz || finished || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/quizzes/${quiz.id}/complete`, { method: "POST" });
      const completed = await response.json();
      if (!response.ok) throw new Error(completed.error ?? "We couldn't save this result.");
      const refreshed = await fetch(`/api/quizzes/${quiz.id}`);
      const details = await refreshed.json() as LoadedQuiz;
      setSession(details.quiz, details.questions, details.certification, details.quiz.mode, details.answers);
      setCompleted(completed.completedAt);
      setFinished(true);
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "We couldn't save this result.");
    } finally {
      setPending(false);
    }
  }, [finished, pending, quiz, setCompleted, setSession]);

  useEffect(() => {
    if (mode !== "TIMED" || !quiz || finished || !ready) return;
    const duration = Math.max(60, questions.length * 90);
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(quiz.startedAt).getTime()) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setRemainingSeconds(remaining);
      if (remaining === 0) void finishQuiz();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [finishQuiz, finished, mode, questions.length, quiz, ready]);

  const currentQuestion = questions[questionIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  async function submitAnswer(label: string) {
    if (!quiz || !currentQuestion || currentAnswer || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQuestion.id, selectedLabel: label, quizSessionId: quiz.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't save your answer.");
      setAnswer({ questionId: currentQuestion.id, selectedLabel: label, ...result });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't save your answer.");
    } finally {
      setPending(false);
    }
  }

  function nextQuestion() {
    if (questionIndex + 1 < questions.length) setQuestionIndex((index) => index + 1);
    else void finishQuiz();
  }

  if (!ready) return <div className="quiz-loading" role="status"><LoaderCircle className="spin" size={22} /> Loading your quiz</div>;
  if (error && !questions.length) return <div className="empty-state"><CircleHelp size={26} /><p>{error}</p><Link className="button button-secondary" href="/certifications">Browse certifications</Link></div>;
  if (!quiz || !certification || !questions.length) return <div className="empty-state"><CircleHelp size={26} /><p>This quiz is unavailable or has no questions.</p><Link className="button button-secondary" href="/certifications">Browse certifications</Link></div>;

  const correctCount = Object.values(answers).filter((answer) => answer.isCorrect).length;
  const percent = Math.round((correctCount / questions.length) * 100);

  if (finished) {
    return (
      <section className="result-screen" aria-labelledby="result-heading">
        <div className="result-icon"><Flag size={24} /></div>
        <p className="eyebrow">SESSION COMPLETE</p>
        <h1 id="result-heading">Good work. Keep the momentum.</h1>
        <p className="result-subtitle">Your {certification.name} session is in the books.</p>
        <div className="result-score-row">
          <div className="result-score"><strong>{percent}<small>%</small></strong><span>Score</span></div>
          <div className="result-divider" />
          <div className="result-score"><strong>{correctCount}<small>/{questions.length}</small></strong><span>Correct</span></div>
          <div className="result-divider" />
          <div className="result-score"><strong>{Object.keys(answers).length}</strong><span>Answered</span></div>
        </div>
        <div className="result-actions">
          <Link className="button button-primary" href={`/practice/${certification.slug}`}><RotateCcw size={16} /> Practice again</Link>
          <Link className="button button-secondary" href="/history">View progress <ArrowRight size={16} /></Link>
        </div>
      </section>
    );
  }

  return (
    <section className="quiz-panel" aria-labelledby="question-heading">
      <div className="quiz-topline">
        <Link href={`/practice/${certification.slug}`} className="quiz-back"><ArrowLeft size={16} /> Exit quiz</Link>
        <div className="quiz-mode-label">{mode === "TIMED" ? "Timed exam" : mode === "CUSTOM" ? "Custom quiz" : "Practice mode"}</div>
        {mode === "TIMED" ? <div className={`quiz-timer ${remainingSeconds < 60 ? "timer-urgent" : ""}`} aria-label={`Time remaining ${formatTime(remainingSeconds)}`}><Clock3 size={16} />{formatTime(remainingSeconds)}</div> : <span className="quiz-timer-space" />}
      </div>

      <div className="quiz-progress-meta">
        <span>Question <strong>{questionIndex + 1}</strong> of {questions.length}</span>
        <span>{questionIndex ? Math.round((questionIndex / questions.length) * 100) : 0}% complete</span>
      </div>
      <div className="quiz-progress-track" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={questionIndex + 1}>
        <span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <div className="question-meta">
        <span className="domain-chip">{currentQuestion.domain.objective} · {currentQuestion.domain.name}</span>
        <span className={`difficulty-tag difficulty-${currentQuestion.difficulty.toLowerCase()}`}>{currentQuestion.difficulty.toLowerCase()}</span>
      </div>
      <h1 id="question-heading" className="question-prompt">{currentQuestion.prompt}</h1>
      {currentQuestion.imageUrl && <Image className="question-image" src={currentQuestion.imageUrl} alt="Question reference" width={720} height={405} unoptimized />}

      <fieldset className="answer-fieldset" disabled={Boolean(currentAnswer) || pending}>
        <legend className="sr-only">Choose one answer</legend>
        <div className="answer-options">
          {currentQuestion.options.map((option) => {
            const selected = currentAnswer?.selectedLabel === option.label;
            const correct = currentAnswer?.correctLabel === option.label;
            const showFeedback = mode !== "TIMED" && currentAnswer?.isCorrect !== undefined;
            return (
              <label key={option.label} className={`answer-option ${selected ? "answer-selected" : ""} ${showFeedback && selected && currentAnswer?.isCorrect ? "answer-correct" : ""} ${showFeedback && selected && !currentAnswer?.isCorrect ? "answer-incorrect" : ""} ${showFeedback && correct && !selected ? "answer-reveal-correct" : ""}`}>
                <input type="radio" name={`answer-${currentQuestion.id}`} value={option.label} checked={selected} onChange={() => void submitAnswer(option.label)} />
                <span className="answer-letter">{option.label}</span>
                <span className="answer-text">{option.text}</span>
                {showFeedback && selected && currentAnswer?.isCorrect && <Check className="answer-mark" size={17} aria-label="Correct" />}
                {showFeedback && selected && !currentAnswer?.isCorrect && <X className="answer-mark" size={17} aria-label="Incorrect" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      {currentAnswer && mode !== "TIMED" && currentAnswer.explanation && (
        <div className={`explanation-box ${currentAnswer.isCorrect ? "explanation-correct" : "explanation-review"}`} aria-live="polite">
          <div className="explanation-title">{currentAnswer.isCorrect ? <Check size={16} /> : <CircleHelp size={16} />}{currentAnswer.isCorrect ? "That's right" : `The correct answer is ${currentAnswer.correctLabel}`}</div>
          <p>{currentAnswer.explanation}</p>
        </div>
      )}
      {currentAnswer && mode === "TIMED" && <p className="timed-saved"><Check size={15} /> Answer saved. Results are shown when the exam ends.</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}

      <div className="quiz-footer">
        <span className="quiz-footnote"><CircleHelp size={15} /> One answer per question</span>
        {currentAnswer && <button className="button button-primary" type="button" onClick={nextQuestion} disabled={pending}>
          {pending ? <LoaderCircle className="spin" size={16} /> : null}
          {questionIndex + 1 === questions.length ? "Finish session" : "Next question"}<ArrowRight size={16} />
        </button>}
      </div>
    </section>
  );
}