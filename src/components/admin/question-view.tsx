"use client";

import Link from "next/link";
import { QuestionPrompt } from "@/components/question-prompt";
import { cn } from "@/lib/utils";
import { AdminToolbar, LoadState, Panel, formatNumber, formatPercent, useAdminData, useAdminFilters } from "./admin-kit";

type QuestionDetail = {
  question: {
    id: string;
    prompt: string;
    explanation: string;
    difficulty: string;
    domain: { name: string; objective: string; certification: { acronym: string; slug: string } };
    options: { label: string; text: string; isCorrect: boolean }[];
  };
  attempts: number;
  correctRate: number | null;
  skips: number;
  picks: { label: string; picks: number }[];
};

// Read-only view of one question with how learners answered it, to spot confusing or wrong items.
export function QuestionView({ id }: { id: string }) {
  const { rangeQuery } = useAdminFilters();
  const { data, error, loading } = useAdminData<QuestionDetail>(`/api/admin/questions/${id}?${rangeQuery}`);

  return (
    <>
      <Link className="back-link" href={`/admin/content?${rangeQuery}`}>← Content & usage</Link>
      <AdminToolbar showBots={false} />
      <LoadState loading={loading && !data} error={error} />
      {data && (
        <div className="admin-stack">
          <Panel title={`${data.question.domain.certification.acronym} · ${data.question.domain.objective} ${data.question.domain.name}`} note={`Question ${data.question.id} · ${data.question.difficulty.toLowerCase()} · edit it in prisma/questions/ or prisma/seed.ts, then re-run the seed.`}>
            <QuestionPrompt prompt={data.question.prompt} as="p" className="admin-question-prompt" />
            <ul className="admin-options">
              {data.question.options.map((option) => {
                const picks = data.picks.find((pick) => pick.label === option.label)?.picks ?? 0;
                return (
                  <li key={option.label} className={cn(option.isCorrect && "admin-option-correct")}>
                    <span className="answer-letter">{option.label}</span>
                    <span className="admin-option-text">{option.text}</span>
                    <span className="admin-option-picks">{formatNumber(picks)} picks{data.attempts ? ` · ${Math.round((picks / data.attempts) * 100)}%` : ""}</span>
                  </li>
                );
              })}
            </ul>
            <p className="admin-question-explanation"><strong>Explanation:</strong> {data.question.explanation}</p>
          </Panel>
          <div className="admin-kpi-grid admin-kpi-grid-3">
            <div className="admin-kpi"><span className="overview-label">ATTEMPTS</span><strong>{formatNumber(data.attempts)}</strong></div>
            <div className="admin-kpi"><span className="overview-label">ANSWERED CORRECTLY</span><strong>{formatPercent(data.correctRate)}</strong></div>
            <div className="admin-kpi"><span className="overview-label">SKIPPED</span><strong>{formatNumber(data.skips)}</strong></div>
          </div>
        </div>
      )}
    </>
  );
}
