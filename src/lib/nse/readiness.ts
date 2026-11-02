export type ReadinessAnswer = { moduleId: string; difficulty: string; isCorrect: boolean };
export type ReadinessExam = { percent: number; submittedAt: Date };
export type ReadinessInput = {
  moduleIds: string[];
  answers: ReadinessAnswer[];
  /** Submitted mock and readiness attempts. */
  exams: ReadinessExam[];
  labsTotal: number;
  labsCompleted: number;
};

export const READINESS_WEIGHTS = { coverage: 0.2, accuracy: 0.3, recentExams: 0.25, consistency: 0.1, labs: 0.15 };
export const MIN_EXAMS = 2;
export const MIN_ANSWERS = 20;
const DIFFICULTY_WEIGHT: Record<string, number> = { BEGINNER: 1, INTERMEDIATE: 1.5, ADVANCED: 2, EXPERT: 3 };

/**
 * The score is a study signal, not a prediction of the official result. It stays null until there are at
 * least two exams and twenty answers, so one good attempt can't produce a score.
 */
export function calculateReadiness(input: ReadinessInput) {
  const answered = new Set(input.answers.map((answer) => answer.moduleId));
  const coverage = input.moduleIds.length ? input.moduleIds.filter((id) => answered.has(id)).length / input.moduleIds.length : 0;

  let earned = 0;
  let possible = 0;
  for (const answer of input.answers) {
    const weight = DIFFICULTY_WEIGHT[answer.difficulty] ?? 1;
    possible += weight;
    if (answer.isCorrect) earned += weight;
  }
  const accuracy = possible ? earned / possible : 0;

  const recent = [...input.exams].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()).slice(0, 3);
  const recentWeights = [3, 2, 1].slice(0, recent.length);
  const weightTotal = recentWeights.reduce((sum, weight) => sum + weight, 0);
  const recentExams = recent.length ? recent.reduce((sum, exam, index) => sum + (exam.percent / 100) * recentWeights[index], 0) / weightTotal : 0;

  // A spread of 25 percentage points or more across recent exams scores zero.
  const mean = recent.length ? recent.reduce((sum, exam) => sum + exam.percent, 0) / recent.length : 0;
  const deviation = recent.length ? Math.sqrt(recent.reduce((sum, exam) => sum + (exam.percent - mean) ** 2, 0) / recent.length) : 25;
  const consistency = recent.length >= 2 ? Math.max(0, 1 - deviation / 25) : 0;

  const labs = input.labsTotal ? Math.min(input.labsCompleted / input.labsTotal, 1) : 0;
  const components = { coverage, accuracy, recentExams, consistency, labs };
  const enough = input.exams.length >= MIN_EXAMS && input.answers.length >= MIN_ANSWERS;
  // A pathway with no labs yet is scored on the other components, rescaled to 100.
  const usable = (Object.keys(READINESS_WEIGHTS) as (keyof typeof READINESS_WEIGHTS)[]).filter((key) => key !== "labs" || input.labsTotal > 0);
  const usableWeight = usable.reduce((sum, key) => sum + READINESS_WEIGHTS[key], 0);
  const score = enough ? Math.round((usable.reduce((sum, key) => sum + components[key] * READINESS_WEIGHTS[key], 0) / usableWeight) * 100) : null;

  return {
    score,
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value * 100)])) as Record<keyof typeof READINESS_WEIGHTS, number>,
    missing: enough ? [] : [
      ...(input.exams.length < MIN_EXAMS ? [`${MIN_EXAMS - input.exams.length} more submitted mock or readiness exam${MIN_EXAMS - input.exams.length === 1 ? "" : "s"}`] : []),
      ...(input.answers.length < MIN_ANSWERS ? [`${MIN_ANSWERS - input.answers.length} more answered questions`] : []),
    ],
  };
}

export function moduleScores(answers: ReadinessAnswer[]) {
  const scores = new Map<string, { correct: number; total: number }>();
  for (const answer of answers) {
    const row = scores.get(answer.moduleId) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (answer.isCorrect) row.correct += 1;
    scores.set(answer.moduleId, row);
  }
  return scores;
}
