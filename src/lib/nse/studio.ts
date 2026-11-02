import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { labDefinitionSchema } from "./lab-engine";

export async function getEditorSession() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "ADMIN" || session?.user.role === "CONTENT_EDITOR" ? session : null;
}

// Others get a 404, so the area isn't advertised.
export async function requireEditorPage() {
  const session = await getEditorSession();
  if (!session) notFound();
  return session;
}

const status = z.enum(["DRAFT", "REVIEW", "PUBLISHED"]);
const difficulty = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]);
const lines = z.array(z.string().trim().min(1).max(600)).max(60);
const slug = z.string().trim().regex(/^[a-z0-9-]+$/).max(80);

export const pathwaySchema = z.object({
  slug,
  level: z.number().int().min(1).max(8),
  track: z.enum(["SECURE_NETWORKING", "SECURITY_OPERATIONS", "SASE", "CLOUD_SECURITY"]).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(600),
  overview: z.string().trim().min(1).max(4000),
  prerequisites: lines,
  objectives: lines,
  officialExams: lines,
  officialUrl: z.url().max(400),
  officialSpec: z.string().trim().max(1000).nullable().optional(),
  productVersion: z.string().trim().max(120).nullable().optional(),
  mockQuestions: z.number().int().min(1).max(100),
  mockMinutes: z.number().int().min(5).max(300),
  questionTarget: z.number().int().min(0).max(5000),
  sortOrder: z.number().int().min(0).max(1000),
  status,
});

export const moduleSchema = z.object({
  pathwayId: z.string().min(1),
  slug,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(600),
  objectives: lines,
  notes: z.string().min(1).max(60000),
  keyConcepts: lines,
  exercise: z.string().trim().max(1000).nullable().optional(),
  sources: z.array(z.url().max(400)).max(20),
  productVersion: z.string().trim().max(120).nullable().optional(),
  weight: z.number().int().min(1).max(100),
  sortOrder: z.number().int().min(0).max(1000),
  status,
  markReviewed: z.boolean().optional(),
});

const optionSchema = z.object({
  label: z.string().trim().min(1).max(4),
  text: z.string().trim().min(1).max(1000),
  rationale: z.string().trim().min(1).max(1500),
  isCorrect: z.boolean().default(false),
  position: z.number().int().min(1).max(20).nullable().optional(),
  matchTo: z.string().trim().min(1).max(200).nullable().optional(),
});

export const questionSchema = z.object({
  moduleId: z.string().min(1),
  type: z.enum(["SINGLE", "MULTIPLE", "MATCHING", "ORDERING"]),
  difficulty,
  prompt: z.string().trim().min(1).max(4000),
  exhibit: z.string().max(6000).nullable().optional(),
  explanation: z.string().trim().min(1).max(6000),
  technology: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(600).nullable().optional(),
  status,
  reviewNotes: z.string().max(2000).nullable().optional(),
  options: z.array(optionSchema).min(2).max(12),
}).superRefine((question, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if (new Set(question.options.map((option) => option.label)).size !== question.options.length) issue("Option labels must be unique.");
  const correct = question.options.filter((option) => option.isCorrect).length;
  if (question.type === "SINGLE" && correct !== 1) issue("A single-answer question needs exactly one correct option.");
  if (question.type === "MULTIPLE" && correct < 2) issue("A multiple-select question needs at least two correct options.");
  if (question.type === "MATCHING" && question.options.some((option) => !option.matchTo)) issue("Every matching item needs a target.");
  if (question.type === "ORDERING") {
    const positions = question.options.map((option) => option.position);
    if (positions.some((position) => !position) || new Set(positions).size !== positions.length) issue("Every ordering item needs a unique position.");
  }
});

export const labSchema = z.object({
  pathwayId: z.string().min(1),
  slug,
  title: z.string().trim().min(1).max(200),
  difficulty,
  durationMinutes: z.number().int().min(1).max(600),
  summary: z.string().trim().min(1).max(600),
  objectives: lines,
  scenario: z.string().trim().min(1).max(4000),
  topology: z.string().trim().min(1).max(2000),
  equipment: z.string().trim().min(1).max(600),
  definition: labDefinitionSchema,
  troubleshooting: lines,
  sortOrder: z.number().int().min(0).max(1000),
  status,
});

/** Editors prepare content; only administrators can make it visible to students. */
export function mayPublish(role: string, nextStatus: string, currentStatus?: string) {
  return role === "ADMIN" || nextStatus !== "PUBLISHED" || currentStatus === "PUBLISHED";
}
