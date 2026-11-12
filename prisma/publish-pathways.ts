// Publishes pathways that were seeded as drafts: node --env-file=.env --import tsx prisma/publish-pathways.ts az-900 az-700
// The seed never edits existing rows, so a draft pathway that later gets content is published with this instead.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { configureNeonForLocal } from "../src/lib/neon-local";

configureNeonForLocal(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const slugs = process.argv.slice(2);
  if (!slugs.length) throw new Error("Name the pathway slugs to publish.");
  for (const slug of slugs) {
    const pathway = await prisma.nsePathway.findUniqueOrThrow({ where: { slug }, select: { id: true } });
    const questions = await prisma.nseQuestion.count({ where: { module: { pathwayId: pathway.id } } });
    if (!questions) throw new Error(`${slug} has no questions, so it stays a draft.`);
    const [modules, published] = await prisma.$transaction([
      prisma.nseModule.updateMany({ where: { pathwayId: pathway.id }, data: { status: "PUBLISHED" } }),
      prisma.nseQuestion.updateMany({ where: { module: { pathwayId: pathway.id } }, data: { status: "PUBLISHED" } }),
      prisma.nsePathway.update({ where: { id: pathway.id }, data: { status: "PUBLISHED" } }),
    ]);
    console.log(`${slug}: published with ${modules.count} modules and ${published.count} questions.`);
  }
}

main().finally(() => prisma.$disconnect());
