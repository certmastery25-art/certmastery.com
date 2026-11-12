import type { NseProgramme } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { programmeOf } from "./programmes";
import { calculateReadiness, moduleScores } from "./readiness";

export const LEVELS = [
  { level: 1, name: "Cybersecurity and Cloud Fundamentals", kind: "Foundation" },
  { level: 2, name: "Introduction to the Next Generation Firewall", kind: "Foundation" },
  { level: 3, name: "FortiGate Operator", kind: "Foundation" },
  { level: 4, name: "FortiOS Administrator", kind: "Core" },
  { level: 5, name: "Technical specialisation", kind: "Track" },
  { level: 6, name: "Advanced specialisation", kind: "Track" },
  { level: 7, name: "Architect", kind: "Track" },
  { level: 8, name: "Cybersecurity Expert", kind: "Expert" },
] as const;

export const TRACK_LABELS: Record<string, string> = {
  SECURE_NETWORKING: "Secure Networking",
  SECURITY_OPERATIONS: "Security Operations",
  SASE: "SASE",
  CLOUD_SECURITY: "Cloud Security",
};

export function listPublishedPathways(programme: NseProgramme = "FORTINET") {
  return prisma.nsePathway.findMany({
    where: { status: "PUBLISHED", programme },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, slug: true, programme: true, level: true, track: true, title: true, summary: true, questionTarget: true, mockQuestions: true, mockMinutes: true,
      modules: { where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, title: true, _count: { select: { questions: { where: { status: "PUBLISHED" } } } } } },
      labs: { where: { status: "PUBLISHED" }, select: { slug: true } },
    },
  });
}

export const pathwayQuestionCount = (pathway: PublishedPathway) => pathway.modules.reduce((sum, module) => sum + module._count.questions, 0);

export type PublishedPathway = Awaited<ReturnType<typeof listPublishedPathways>>[number];

/** Everything here is filtered by userId, which only ever comes from the session. */
export async function getStudentProgress(userId: string, pathways: PublishedPathway[]) {
  const [items, exams, labs] = await Promise.all([
    prisma.nseExamItem.findMany({
      where: { attempt: { userId }, answeredAt: { not: null }, isCorrect: { not: null } },
      orderBy: { answeredAt: "desc" },
      take: 3000,
      select: { isCorrect: true, question: { select: { moduleId: true, difficulty: true } } },
    }),
    prisma.nseExamAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 200,
      select: { id: true, pathwayId: true, mode: true, totalQuestions: true, correctAnswers: true, submittedAt: true, moduleId: true },
    }),
    prisma.labCompletion.findMany({ where: { userId, labSlug: { startsWith: "nse:" } }, select: { labSlug: true } }),
  ]);
  const completedLabs = new Set(labs.map((row) => row.labSlug.slice(4)));
  const answers = items.map((item) => ({ moduleId: item.question.moduleId, difficulty: item.question.difficulty, isCorrect: Boolean(item.isCorrect) }));
  const scores = moduleScores(answers);

  const byPathway = pathways.map((pathway) => {
    const moduleIds = pathway.modules.map((module) => module.id);
    const moduleIdSet = new Set(moduleIds);
    const pathwayExams = exams.filter((exam) => exam.pathwayId === pathway.id && exam.mode !== "PRACTICE" && exam.totalQuestions > 0);
    const readiness = calculateReadiness({
      moduleIds,
      answers: answers.filter((answer) => moduleIdSet.has(answer.moduleId)),
      exams: pathwayExams.map((exam) => ({ percent: (exam.correctAnswers / exam.totalQuestions) * 100, submittedAt: exam.submittedAt! })),
      labsTotal: pathway.labs.length,
      labsCompleted: pathway.labs.filter((lab) => completedLabs.has(lab.slug)).length,
    });
    const topics = pathway.modules.map((module) => {
      const score = scores.get(module.id);
      return { id: module.id, slug: module.slug, title: module.title, completed: Boolean(score?.total), correct: score?.correct ?? 0, total: score?.total ?? 0, percent: score?.total ? Math.round((score.correct / score.total) * 100) : null };
    });
    return {
      pathway,
      readiness,
      topics,
      modulesCompleted: topics.filter((topic) => topic.completed).length,
      labsCompleted: pathway.labs.filter((lab) => completedLabs.has(lab.slug)).length,
      recentExams: pathwayExams.slice(0, 5),
      answered: topics.reduce((sum, topic) => sum + topic.total, 0),
    };
  });
  return { byPathway, completedLabs, attempts: exams };
}

export function nextActivity(row: Awaited<ReturnType<typeof getStudentProgress>>["byPathway"][number]) {
  const base = programmeOf(row.pathway.programme).base;
  const weak = row.topics.filter((topic) => topic.percent !== null && topic.total >= 3).sort((a, b) => a.percent! - b.percent!)[0];
  if (weak && weak.percent! < 70) return { label: `Practise ${weak.title}: you're on ${weak.percent}%`, href: `${base}/${row.pathway.slug}/${weak.slug}` };
  const untried = row.topics.find((topic) => !topic.completed);
  if (untried) return { label: `Practise ${untried.title}`, href: `${base}/${row.pathway.slug}/${untried.slug}` };
  if (row.labsCompleted < row.pathway.labs.length) return { label: "Finish the practical labs", href: `${base}/labs` };
  return { label: "Take a timed mock exam", href: `${base}/${row.pathway.slug}#exams` };
}
