CREATE TABLE "LabCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labSlug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LabCompletion_userId_labSlug_key" ON "LabCompletion"("userId", "labSlug");
CREATE INDEX "LabCompletion_userId_completedAt_idx" ON "LabCompletion"("userId", "completedAt");

ALTER TABLE "LabCompletion" ADD CONSTRAINT "LabCompletion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
