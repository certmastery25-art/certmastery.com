import { prisma } from "@/lib/prisma";
import { gradeResponse, type GradableOption } from "./grading";

export const PUBLISHED_QUESTION = { status: "PUBLISHED", module: { status: "PUBLISHED", pathway: { status: "PUBLISHED" } } } as const;
// A little allowance for network delay on the last answer.
export const DEADLINE_GRACE_MS = 10_000;

export function isPastDeadline(deadlineAt: Date | null, now = Date.now()) {
  return Boolean(deadlineAt && now > deadlineAt.getTime() + DEADLINE_GRACE_MS);
}

/** Grades from stored responses only, whatever the browser says. Safe to call more than once. */
export async function finalizeAttempt(attemptId: string) {
  const items = await prisma.nseExamItem.findMany({
    where: { attemptId },
    select: { id: true, response: true, question: { select: { type: true, options: true } } },
  });
  const correct: string[] = [];
  const incorrect: string[] = [];
  for (const item of items) {
    const passed = item.response !== null && gradeResponse(item.question.type, item.question.options as GradableOption[], item.response);
    (passed ? correct : incorrect).push(item.id);
  }
  await prisma.$transaction([
    prisma.nseExamItem.updateMany({ where: { id: { in: correct } }, data: { isCorrect: true } }),
    prisma.nseExamItem.updateMany({ where: { id: { in: incorrect } }, data: { isCorrect: false } }),
    prisma.nseExamAttempt.updateMany({ where: { id: attemptId, submittedAt: null }, data: { submittedAt: new Date(), correctAnswers: correct.length } }),
  ]);
}

/** Students can only ever load their own attempts; anyone else gets the same answer as a missing one. */
export function findOwnAttempt(id: string, userId: string) {
  return prisma.nseExamAttempt.findFirst({ where: { id, userId } });
}
