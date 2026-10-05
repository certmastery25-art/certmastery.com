"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowRight, BookOpen, Clock3, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useQuizStore, type QuizMode, type QuizQuestion } from "@/stores/quiz-store";

const setupSchema = z.object({
  mode: z.enum(["PRACTICE", "TIMED", "CUSTOM"]),
  count: z.number().int().min(1).max(100),
  domain: z.string().optional(),
  difficulty: z.enum(["ANY", "EASY", "MEDIUM", "HARD"]),
  search: z.string().trim().max(120),
});

type SetupValues = z.infer<typeof setupSchema>;
type DomainOption = { id: string; name: string; objective: string };

export function QuizSetupForm({
  certification,
  domains,
  questionCount,
}: {
  certification: { slug: string; name: string; examCode: string };
  domains: DomainOption[];
  questionCount: number;
}) {
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const setSession = useQuizStore((state) => state.setSession);
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { mode: "PRACTICE", count: Math.min(10, Math.max(questionCount, 1)), domain: "", difficulty: "ANY", search: "" },
  });
  const selectedMode = watch("mode");

  async function onSubmit(values: SetupValues) {
    setPending(true);
    setFormError("");
    try {
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification: certification.slug,
          mode: values.mode,
          count: values.count,
          ...(values.domain ? { domain: values.domain } : {}),
          ...(values.difficulty !== "ANY" ? { difficulty: values.difficulty } : {}),
          ...(values.search ? { search: values.search } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't start this quiz.");
      setSession(result.quiz, result.questions as QuizQuestion[], { ...result.certification, slug: certification.slug }, values.mode as QuizMode);
      router.push(`/quiz/${result.quiz.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn't start this quiz.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="setup-form" onSubmit={handleSubmit(onSubmit)}>
      <fieldset className="mode-fieldset">
        <legend className="field-heading">Choose a mode</legend>
        <div className="mode-options">
          {([
            { value: "PRACTICE", label: "Practice", detail: "Instant feedback", icon: BookOpen },
            { value: "TIMED", label: "Timed exam", detail: "Exam-day conditions", icon: Clock3 },
            { value: "CUSTOM", label: "Custom quiz", detail: "Your settings", icon: SlidersHorizontal },
          ] as const).map(({ value, label, detail, icon: Icon }) => (
            <button key={value} className={`mode-option ${selectedMode === value ? "mode-option-selected" : ""}`} type="button" aria-pressed={selectedMode === value} onClick={() => setValue("mode", value)}>
              <span className="mode-icon"><Icon size={18} /></span>
              <span className="mode-copy"><strong>{label}</strong><small>{detail}</small></span>
              <span className="mode-radio" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="setup-fields">
        <label className="field-label">Question count
          <input className="text-input" type="number" min={1} max={100} inputMode="numeric" {...register("count", { valueAsNumber: true })} aria-invalid={!!errors.count} />
          <span className="field-hint">Up to {questionCount} available in this question bank.</span>
        </label>
        <label className="field-label">Difficulty
          <select className="text-input select-input" {...register("difficulty")}>
            <option value="ANY">Any difficulty</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </label>
        <label className="field-label setup-domain">Domain / objective
          <select className="text-input select-input" {...register("domain")}>
            <option value="">All domains</option>
            {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.objective} · {domain.name}</option>)}
          </select>
        </label>
        <label className="field-label setup-search">Search question text
          <input className="text-input" type="search" placeholder="Try a topic or keyword" {...register("search")} />
        </label>
      </div>
      {errors.count && <p className="field-error" role="alert">Enter a number between 1 and 100.</p>}
      {formError && <p className="form-alert" role="alert">{formError}</p>}
      <button className="button button-primary setup-submit" type="submit" disabled={pending || questionCount === 0}>
        {pending ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
        {pending ? "Preparing your questions..." : selectedMode === "TIMED" ? "Begin timed exam" : selectedMode === "CUSTOM" ? "Build my quiz" : "Start practicing"}
      </button>
    </form>
  );
}