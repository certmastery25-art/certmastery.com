import type { Difficulty } from "@prisma/client";

// [domain, difficulty, prompt, correct answer, distractor, distractor, distractor, explanation]
export type AdditionalQuestion = [string, Difficulty, string, string, string, string, string, string];
