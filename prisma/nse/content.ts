import { foundationPathways } from "./foundation";
import { nse4Pathway } from "./nse4";
import { nse5Pathways } from "./nse5";
import { nse6Pathways } from "./nse6";
import { nse7Pathways } from "./nse7";
import { nse8Pathway } from "./nse8";
import { foundationBank } from "./practice/foundation";
import { nse45Bank } from "./practice/nse4-5";
import { nse67Bank } from "./practice/nse6-7";
import type { SeedPathway, SeedQuestion } from "./types";

const practiceBank = { ...foundationBank, ...nse45Bank, ...nse67Bank };

// Practice questions go after the originals, because a question's seed key comes from its position.
export const nsePathways: SeedPathway[] = [...foundationPathways, nse4Pathway, ...nse5Pathways, ...nse6Pathways, ...nse7Pathways].map((pathway) => ({
  ...pathway,
  modules: pathway.modules.map((module) => ({ ...module, questions: [...module.questions, ...(practiceBank[`${pathway.slug}/${module.slug}`] ?? [])] })),
})).concat(nse8Pathway);

const LETTERS = "ABCDEFGHIJKL";

/** Turns the compact seed form into option rows. */
export function toOptions(question: SeedQuestion) {
  return question.a.map((entry, index) => {
    const label = LETTERS[index];
    if (question.type === "MATCHING") return { label, text: entry[0], matchTo: entry[1], rationale: entry[2], isCorrect: false, position: null };
    if (question.type === "ORDERING") return { label, text: entry[0], rationale: entry[1], position: index + 1, isCorrect: false, matchTo: null };
    return { label, text: entry[0], rationale: entry[1], isCorrect: (question.c ?? []).includes(index), position: null, matchTo: null };
  });
}
