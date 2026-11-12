-- CreateEnum
CREATE TYPE "NseProgramme" AS ENUM ('FORTINET', 'AZURE');

-- CreateEnum
CREATE TYPE "NseProvenance" AS ENUM ('VERIFIED', 'ORIGINAL', 'AI_DRAFT');

-- CreateEnum
CREATE TYPE "NsePrerequisiteKind" AS ENUM ('REQUIRED', 'RECOMMENDED');

-- DropIndex
DROP INDEX "NsePathway_level_track_key";

-- DropIndex
DROP INDEX "NsePathway_status_sortOrder_idx";

-- AlterTable
ALTER TABLE "NseModule" ADD COLUMN     "weightMax" INTEGER,
ADD COLUMN     "weightMin" INTEGER;

-- AlterTable
ALTER TABLE "NsePathway" ADD COLUMN     "programme" "NseProgramme" NOT NULL DEFAULT 'FORTINET',
ADD COLUMN     "skillsAsOf" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NseQuestion" ADD COLUMN     "objectiveId" TEXT,
ADD COLUMN     "provenance" "NseProvenance" NOT NULL DEFAULT 'AI_DRAFT';

-- CreateTable
CREATE TABLE "NsePathwayPrerequisite" (
    "pathwayId" TEXT NOT NULL,
    "requiredPathwayId" TEXT NOT NULL,
    "kind" "NsePrerequisiteKind" NOT NULL,
    "note" TEXT,

    CONSTRAINT "NsePathwayPrerequisite_pkey" PRIMARY KEY ("pathwayId","requiredPathwayId")
);

-- CreateTable
CREATE TABLE "NseObjective" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "skills" TEXT[],
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "NseObjective_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NseObjective_moduleId_slug_key" ON "NseObjective"("moduleId", "slug");

-- CreateIndex
CREATE INDEX "NsePathway_programme_status_sortOrder_idx" ON "NsePathway"("programme", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NsePathway_programme_level_track_key" ON "NsePathway"("programme", "level", "track");

-- CreateIndex
CREATE INDEX "NseQuestion_objectiveId_idx" ON "NseQuestion"("objectiveId");

-- AddForeignKey
ALTER TABLE "NsePathwayPrerequisite" ADD CONSTRAINT "NsePathwayPrerequisite_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "NsePathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NsePathwayPrerequisite" ADD CONSTRAINT "NsePathwayPrerequisite_requiredPathwayId_fkey" FOREIGN KEY ("requiredPathwayId") REFERENCES "NsePathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseObjective" ADD CONSTRAINT "NseObjective_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "NseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseQuestion" ADD CONSTRAINT "NseQuestion_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "NseObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

