// Prints what the seed content actually contains: node --import tsx prisma/nse/count.ts
import { nsePathways } from "./content";
import { nseLabs } from "./labs";

let total = 0;
let target = 0;
const types: Record<string, number> = {};
const difficulties: Record<string, number> = {};
for (const pathway of nsePathways) {
  const count = pathway.modules.reduce((sum, module) => sum + module.questions.length, 0);
  total += count;
  target += pathway.target;
  for (const question of pathway.modules.flatMap((module) => module.questions)) {
    const type = question.type ?? (question.c && question.c.length > 1 ? "MULTIPLE" : "SINGLE");
    types[type] = (types[type] ?? 0) + 1;
    difficulties[question.d] = (difficulties[question.d] ?? 0) + 1;
  }
  console.log(`${pathway.slug}: ${pathway.modules.length} modules, ${count} of ${pathway.target} questions`);
}
console.log(`Total: ${nsePathways.reduce((sum, pathway) => sum + pathway.modules.length, 0)} modules, ${total} of ${target} questions, ${nseLabs.length} labs`);
console.log(types, difficulties);
