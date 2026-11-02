-- CreateEnum
CREATE TYPE "NseContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "NseTrack" AS ENUM ('SECURE_NETWORKING', 'SECURITY_OPERATIONS', 'SASE', 'CLOUD_SECURITY');

-- CreateEnum
CREATE TYPE "NseDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "NseQuestionType" AS ENUM ('SINGLE', 'MULTIPLE', 'MATCHING', 'ORDERING');

-- CreateEnum
CREATE TYPE "NseExamMode" AS ENUM ('PRACTICE', 'MOCK', 'READINESS');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CONTENT_EDITOR';

-- CreateTable
CREATE TABLE "NsePathway" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "track" "NseTrack",
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "prerequisites" TEXT[],
    "objectives" TEXT[],
    "officialExams" TEXT[],
    "officialUrl" TEXT NOT NULL,
    "officialSpec" TEXT,
    "productVersion" TEXT,
    "mockQuestions" INTEGER NOT NULL DEFAULT 40,
    "mockMinutes" INTEGER NOT NULL DEFAULT 60,
    "questionTarget" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL,
    "status" "NseContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sourcesCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NsePathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NseModule" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "objectives" TEXT[],
    "notes" TEXT NOT NULL,
    "keyConcepts" TEXT[],
    "exercise" TEXT,
    "sources" TEXT[],
    "productVersion" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL,
    "status" "NseContentStatus" NOT NULL DEFAULT 'DRAFT',
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NseQuestion" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT,
    "moduleId" TEXT NOT NULL,
    "type" "NseQuestionType" NOT NULL DEFAULT 'SINGLE',
    "difficulty" "NseDifficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "prompt" TEXT NOT NULL,
    "exhibit" TEXT,
    "explanation" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "reference" TEXT,
    "status" "NseContentStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NseQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NseOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER,
    "matchTo" TEXT,

    CONSTRAINT "NseOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NseExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "moduleId" TEXT,
    "mode" "NseExamMode" NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "NseExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NseExamItem" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "optionOrder" TEXT[],
    "response" JSONB,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "NseExamItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NseModuleProgress" (
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NseModuleProgress_pkey" PRIMARY KEY ("userId","moduleId")
);

-- CreateTable
CREATE TABLE "NseLab" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "NseDifficulty" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "objectives" TEXT[],
    "scenario" TEXT NOT NULL,
    "topology" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "troubleshooting" TEXT[],
    "sortOrder" INTEGER NOT NULL,
    "status" "NseContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NseLab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NsePathway_slug_key" ON "NsePathway"("slug");

-- CreateIndex
CREATE INDEX "NsePathway_status_sortOrder_idx" ON "NsePathway"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NsePathway_level_track_key" ON "NsePathway"("level", "track");

-- CreateIndex
CREATE INDEX "NseModule_pathwayId_status_sortOrder_idx" ON "NseModule"("pathwayId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NseModule_pathwayId_slug_key" ON "NseModule"("pathwayId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "NseQuestion_sourceKey_key" ON "NseQuestion"("sourceKey");

-- CreateIndex
CREATE INDEX "NseQuestion_moduleId_status_difficulty_idx" ON "NseQuestion"("moduleId", "status", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "NseOption_questionId_label_key" ON "NseOption"("questionId", "label");

-- CreateIndex
CREATE INDEX "NseExamAttempt_userId_pathwayId_submittedAt_idx" ON "NseExamAttempt"("userId", "pathwayId", "submittedAt");

-- CreateIndex
CREATE INDEX "NseExamItem_questionId_isCorrect_idx" ON "NseExamItem"("questionId", "isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "NseExamItem_attemptId_questionId_key" ON "NseExamItem"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "NseExamItem_attemptId_sortOrder_key" ON "NseExamItem"("attemptId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NseLab_slug_key" ON "NseLab"("slug");

-- CreateIndex
CREATE INDEX "NseLab_status_sortOrder_idx" ON "NseLab"("status", "sortOrder");

-- AddForeignKey
ALTER TABLE "NseModule" ADD CONSTRAINT "NseModule_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "NsePathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseQuestion" ADD CONSTRAINT "NseQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "NseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseOption" ADD CONSTRAINT "NseOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "NseQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseExamAttempt" ADD CONSTRAINT "NseExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseExamAttempt" ADD CONSTRAINT "NseExamAttempt_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "NsePathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseExamItem" ADD CONSTRAINT "NseExamItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "NseExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseExamItem" ADD CONSTRAINT "NseExamItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "NseQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseModuleProgress" ADD CONSTRAINT "NseModuleProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseModuleProgress" ADD CONSTRAINT "NseModuleProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "NseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NseLab" ADD CONSTRAINT "NseLab_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "NsePathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

