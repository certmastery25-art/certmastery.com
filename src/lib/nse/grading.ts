import { z } from "zod";

export type QuestionType = "SINGLE" | "MULTIPLE" | "MATCHING" | "ORDERING";

export type GradableOption = { label: string; text: string; rationale: string; isCorrect: boolean; position: number | null; matchTo: string | null };

// SINGLE and MULTIPLE answer with labels, ORDERING with labels in sequence, MATCHING with { label: target }.
export const responseSchema = z.union([
  z.array(z.string().max(8)).max(12),
  z.record(z.string().max(8), z.string().max(200)),
]);
export type ExamResponse = z.infer<typeof responseSchema>;

/** Fortinet states that exam answers must be fully correct for credit, so there is no partial credit here either. */
export function gradeResponse(type: QuestionType, options: GradableOption[], response: unknown): boolean {
  if (type === "SINGLE" || type === "MULTIPLE") {
    if (!Array.isArray(response)) return false;
    const chosen = new Set(response);
    const correct = options.filter((option) => option.isCorrect).map((option) => option.label);
    if (type === "SINGLE" && response.length !== 1) return false;
    return chosen.size === response.length && chosen.size === correct.length && correct.every((label) => chosen.has(label));
  }
  if (type === "ORDERING") {
    if (!Array.isArray(response) || response.length !== options.length) return false;
    const sequence = [...options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((option) => option.label);
    return sequence.every((label, index) => response[index] === label);
  }
  if (!response || typeof response !== "object" || Array.isArray(response)) return false;
  const answers = response as Record<string, unknown>;
  return Object.keys(answers).length === options.length && options.every((option) => answers[option.label] === option.matchTo);
}

export function isResponseShapeValid(type: QuestionType, options: { label: string }[], response: ExamResponse) {
  const labels = new Set(options.map((option) => option.label));
  const keys = Array.isArray(response) ? response : Object.keys(response);
  if (type === "MATCHING" ? Array.isArray(response) : !Array.isArray(response)) return false;
  return new Set(keys).size === keys.length && keys.every((key) => labels.has(key));
}

type PublicSource = { type: QuestionType; prompt: string; exhibit: string | null; difficulty: string; options: GradableOption[] };

/**
 * What the browser sees before an answer is revealed. Built field by field so nothing that identifies the
 * correct answer (isCorrect, position, matchTo, rationale, explanation) can reach it by accident.
 */
export function toPublicQuestion(question: PublicSource, optionOrder: string[]) {
  const byLabel = new Map(question.options.map((option) => [option.label, option]));
  const ordered = optionOrder.map((label) => byLabel.get(label)).filter((option): option is GradableOption => Boolean(option));
  return {
    type: question.type,
    prompt: question.prompt,
    exhibit: question.exhibit,
    difficulty: question.difficulty,
    options: ordered.map((option) => ({ label: option.label, text: option.text })),
    // The number to choose doesn't reveal which ones.
    selectCount: question.type === "MULTIPLE" ? question.options.filter((option) => option.isCorrect).length : question.type === "SINGLE" ? 1 : null,
    // Sorted so the list order says nothing about the pairing.
    targets: question.type === "MATCHING" ? [...new Set(question.options.map((option) => option.matchTo ?? ""))].sort() : null,
  };
}

export function toReveal(question: { explanation: string; technology: string; topic: string; reference: string | null; options: GradableOption[] }) {
  return {
    explanation: question.explanation,
    technology: question.technology,
    topic: question.topic,
    reference: question.reference,
    options: question.options.map((option) => ({ label: option.label, text: option.text, rationale: option.rationale, isCorrect: option.isCorrect, position: option.position, matchTo: option.matchTo })),
  };
}
