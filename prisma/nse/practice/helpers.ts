import type { SeedDifficulty, SeedQuestion } from "../types";

export type Bank = Record<string, SeedQuestion[]>;
type Choice = [text: string, why: string];

const hash = (text: string) => {
  let value = [...text].reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 16777619), 2166136261);
  value = Math.imul(value ^ (value >>> 15), 2246822519);
  value = Math.imul(value ^ (value >>> 13), 3266489917);
  return (value ^ (value >>> 16)) >>> 0;
};

/** A stable shuffle, so the correct answer isn't always option A and reseeding gives the same labels. */
function arrange(prompt: string, right: Choice[], wrong: Choice[]) {
  const rows = [...right.map((choice) => ({ choice, correct: true })), ...wrong.map((choice) => ({ choice, correct: false }))]
    .map((row, index) => ({ row, order: hash(`${prompt}|${index}`) }))
    .sort((a, b) => a.order - b.order)
    .map(({ row }) => row);
  return { a: rows.map((row) => row.choice as string[]), c: rows.flatMap((row, index) => (row.correct ? [index] : [])) };
}

/** Single answer. */
export const q = (d: SeedDifficulty, topic: string, tech: string, p: string, e: string, right: Choice, ...wrong: Choice[]): SeedQuestion => ({ d, topic, tech, p, e, ...arrange(p, [right], wrong) });

/** Multiple answers. The prompt must say how many to choose. */
export const m = (d: SeedDifficulty, topic: string, tech: string, p: string, e: string, right: Choice[], wrong: Choice[]): SeedQuestion => ({ type: "MULTIPLE", d, topic, tech, p, e, ...arrange(p, right, wrong) });

/** Steps in the correct order. */
export const o = (d: SeedDifficulty, topic: string, tech: string, p: string, e: string, steps: Choice[]): SeedQuestion => ({ type: "ORDERING", d, topic, tech, p, e, a: steps });

/** Rows of [item, target, why]. */
export const x = (d: SeedDifficulty, topic: string, tech: string, p: string, e: string, rows: [string, string, string][]): SeedQuestion => ({ type: "MATCHING", d, topic, tech, p, e, a: rows });

/** Adds a scenario exhibit to a question. */
export const withExhibit = (question: SeedQuestion, exhibit: string): SeedQuestion => ({ ...question, x: exhibit });
