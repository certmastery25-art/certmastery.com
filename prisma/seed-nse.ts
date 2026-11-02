// Adds the Fortinet NSE programme. It only inserts what's missing and never edits existing rows,
// so running it again can't overwrite an editor's changes or touch other certifications.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { configureNeonForLocal } from "../src/lib/neon-local";
import { labDefinitionSchema } from "../src/lib/nse/lab-engine";
import { nsePathways, toOptions } from "./nse/content";
import { nseLabs } from "./nse/labs";

configureNeonForLocal(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const CHECKED = new Date("2026-10-31T00:00:00Z");

async function main() {
  let questionsAdded = 0;
  for (const [pathwayIndex, seed] of nsePathways.entries()) {
    const pathway = await prisma.nsePathway.findUnique({ where: { slug: seed.slug } }) ?? await prisma.nsePathway.create({
      data: {
        slug: seed.slug,
        level: seed.level,
        track: seed.track,
        title: seed.title,
        summary: seed.summary,
        overview: seed.overview,
        prerequisites: seed.prerequisites,
        objectives: seed.objectives,
        officialExams: seed.officialExams,
        officialUrl: `https://training.fortinet.com/local/staticpage/view.php?page=${seed.officialPage}`,
        officialSpec: seed.officialSpec,
        productVersion: seed.version,
        mockQuestions: seed.mock[0],
        mockMinutes: seed.mock[1],
        questionTarget: seed.target,
        sortOrder: pathwayIndex + 1,
        status: "PUBLISHED",
        sourcesCheckedAt: CHECKED,
      },
    });
    for (const [moduleIndex, seedModule] of seed.modules.entries()) {
      const existing = await prisma.nseModule.findUnique({ where: { pathwayId_slug: { pathwayId: pathway.id, slug: seedModule.slug } } });
      const module = existing ?? await prisma.nseModule.create({
        data: {
          pathwayId: pathway.id,
          slug: seedModule.slug,
          title: seedModule.title,
          summary: seedModule.summary,
          objectives: seedModule.objectives,
          notes: "",
          keyConcepts: seedModule.concepts,
          exercise: seedModule.exercise,
          sources: seedModule.sources,
          productVersion: seedModule.version ?? seed.version,
          weight: seedModule.weight,
          sortOrder: moduleIndex + 1,
          status: "PUBLISHED",
        },
      });
      const known = new Set((await prisma.nseQuestion.findMany({ where: { moduleId: module.id }, select: { sourceKey: true } })).map((row) => row.sourceKey));
      for (const [questionIndex, question] of seedModule.questions.entries()) {
        const sourceKey = `${seed.slug}/${seedModule.slug}/${questionIndex + 1}`;
        if (known.has(sourceKey)) continue;
        await prisma.nseQuestion.create({
          data: {
            sourceKey,
            moduleId: module.id,
            type: question.type ?? (question.c && question.c.length > 1 ? "MULTIPLE" : "SINGLE"),
            difficulty: question.d,
            prompt: question.p,
            exhibit: question.x,
            explanation: question.e,
            technology: question.tech,
            topic: question.topic,
            reference: seedModule.sources[0],
            status: "PUBLISHED",
            options: { create: toOptions(question) },
          },
        });
        questionsAdded += 1;
      }
    }
  }

  let labsAdded = 0;
  for (const [index, lab] of nseLabs.entries()) {
    if (await prisma.nseLab.findUnique({ where: { slug: lab.slug }, select: { id: true } })) continue;
    const pathway = await prisma.nsePathway.findUniqueOrThrow({ where: { slug: lab.pathway } });
    const definition = labDefinitionSchema.parse({ hostname: "FGT-SIM", initial: lab.initial ?? [], outputs: lab.outputs ?? [], tasks: lab.tasks.map((task) => ({ ...task, checks: task.checks ?? [] })) });
    await prisma.nseLab.create({
      data: {
        slug: lab.slug,
        pathwayId: pathway.id,
        title: lab.title,
        difficulty: lab.difficulty,
        durationMinutes: lab.durationMinutes,
        summary: lab.summary,
        objectives: lab.objectives,
        scenario: lab.scenario,
        topology: lab.topology,
        equipment: "CertMastery's simulated FortiOS CLI, in your browser. No FortiGate or licence is needed. It isn't a real device.",
        definition,
        troubleshooting: lab.troubleshooting,
        sortOrder: index + 1,
        status: "PUBLISHED",
      },
    });
    labsAdded += 1;
  }
  console.log(`NSE seed complete: ${questionsAdded} questions and ${labsAdded} labs added.`);
}

main().finally(() => prisma.$disconnect());
