// End-to-end tests of the Fortinet NSE programme against the local docker-compose database only.
// Requires: docker compose up -d, migrations applied locally, and npm run db:seed-nse run locally.
import assert from "node:assert/strict";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { after, before, test } from "node:test";

const PORT = 3131;
const BASE = `http://localhost:${PORT}`;
Object.assign(process.env, {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@db.localtest.me:5432/main",
  DIRECT_URL: process.env.E2E_DIRECT_URL ?? "postgres://postgres:postgres@localhost:54329/main",
  NEXTAUTH_URL: BASE,
  NEXTAUTH_SECRET: "e2e-only-secret-not-used-anywhere-else",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  RESEND_API_KEY: "",
  CONTACT_FROM_EMAIL: "",
});

const PASSWORD = "Tr4il-Horse-Lamp";
const run = Date.now().toString(36);
let ipCounter = 0;
type Db = typeof import("../../src/lib/prisma").prisma;
let prisma: Db;
let server: ChildProcess;

class Client {
  cookies = new Map<string, string>();
  ip = `10.77.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
  async fetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("cf-connecting-ip", this.ip);
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (pair.slice(index + 1)) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
      else this.cookies.delete(pair.slice(0, index));
    }
    return response;
  }
  post(path: string, body: unknown, method = "POST") {
    return this.fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }
  async login(email: string) {
    const csrfToken = (await (await this.fetch("/api/auth/csrf")).json()).csrfToken;
    const response = await this.fetch("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, email, password: PASSWORD, remember: "true", json: "true" }) });
    assert.doesNotMatch((await response.json()).url, /error=/);
  }
}

async function user(label: string, role: "STUDENT" | "CONTENT_EDITOR" | "ADMIN" = "STUDENT") {
  const { hash } = await import("bcryptjs");
  const email = `nse.${label}.${run}@example.test`;
  const record = await prisma.user.create({ data: { email, name: label, role, passwordHash: await hash(PASSWORD, 6) } });
  const client = new Client();
  await client.login(email);
  return { client, id: record.id };
}

const startExam = async (client: Client, body: object) => {
  const response = await client.post("/api/nse/exams", body);
  assert.equal(response.status, 201, await response.clone().text());
  return (await response.json()).id as string;
};

async function correctAnswer(attemptId: string, index: number) {
  const item = await prisma.nseExamItem.findUniqueOrThrow({ where: { attemptId_sortOrder: { attemptId, sortOrder: index } }, include: { question: { include: { options: true } } } });
  const { type, options } = item.question;
  if (type === "MATCHING") return Object.fromEntries(options.map((option) => [option.label, option.matchTo!]));
  if (type === "ORDERING") return [...options].sort((a, b) => a.position! - b.position!).map((option) => option.label);
  return options.filter((option) => option.isCorrect).map((option) => option.label);
}

async function wrongAnswer(attemptId: string, index: number) {
  const item = await prisma.nseExamItem.findUniqueOrThrow({ where: { attemptId_sortOrder: { attemptId, sortOrder: index } }, include: { question: { include: { options: true } } } });
  const { type, options } = item.question;
  if (type === "MATCHING") return Object.fromEntries(options.map((option) => [option.label, "not a target"]));
  if (type === "ORDERING") return [...options].sort((a, b) => b.position! - a.position!).map((option) => option.label);
  return [options.find((option) => !option.isCorrect)!.label];
}

before(async () => {
  assert.equal(new URL(process.env.DATABASE_URL!).hostname, "db.localtest.me", "refusing to run against a non-local database");
  ({ prisma } = await import("../../src/lib/prisma"));
  assert.ok(await prisma.nseQuestion.count() > 100, "run npm run db:seed-nse locally first");
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], { env: process.env, shell: true, stdio: "ignore" });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const up = await fetch(`${BASE}/api/auth/csrf`).then((response) => response.ok).catch(() => false);
    if (up) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Server didn't start");
}, { timeout: 180_000 });

after(async () => {
  await prisma?.nseQuestion.deleteMany({ where: { prompt: { contains: `e2e-${run}` } } });
  await prisma?.user.deleteMany({ where: { email: { endsWith: `.${run}@example.test` } } });
  if (!server?.pid) return;
  if (process.platform !== "win32") server.kill();
  else {
    try {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } catch {}
  }
});

test("public pages: landing, every pathway and module load, and CompTIA and Cisco still work", { timeout: 300_000 }, async () => {
  const client = new Client();
  const landing = await (await client.fetch("/fortinet")).text();
  assert.match(landing, /Fortinet NSE Certification Academy/);
  assert.match(landing, /Master Fortinet/);
  const pathways = await prisma.nsePathway.findMany({ include: { modules: true } });
  assert.equal(pathways.length, 16);
  for (const track of ["SECURE_NETWORKING", "SECURITY_OPERATIONS", "SASE", "CLOUD_SECURITY"] as const) {
    for (const level of [5, 6, 7]) assert.ok(pathways.some((pathway) => pathway.level === level && pathway.track === track), `NSE ${level} ${track}`);
  }
  for (const pathway of pathways) {
    assert.equal((await client.fetch(`/fortinet/${pathway.slug}`)).status, 200, pathway.slug);
    const module = pathway.modules[0];
    const page = await client.fetch(`/fortinet/${pathway.slug}/${module.slug}`);
    assert.equal(page.status, 200, module.slug);
    assert.match(await page.text(), /Study notes/);
  }
  assert.equal((await client.fetch("/fortinet/labs")).status, 200);
  assert.equal((await client.fetch("/fortinet/no-such-pathway")).status, 404);
  for (const path of ["/", "/certifications", "/practice", "/labs", "/contact"]) assert.equal((await client.fetch(path)).status, 200, path);
  const certifications = await (await client.fetch("/certifications")).text();
  for (const name of ["Security+", "Server+", "CCNA", "CCNP"]) assert.ok(certifications.includes(name), name);
});

test("existing quiz engine still works alongside NSE", async () => {
  const { client } = await user("legacy");
  const certification = await prisma.certification.findFirstOrThrow({ where: { slug: "ccna" } });
  const created = await client.post("/api/quizzes", { certification: certification.slug, mode: "PRACTICE", count: 1 });
  assert.equal(created.status, 201);
  const { quiz, questions } = await created.json();
  assert.equal((await client.post("/api/attempts", { questionId: questions[0].id, selectedLabel: "A", quizSessionId: quiz.id })).status, 200);
  assert.equal((await client.post(`/api/quizzes/${quiz.id}/complete`, {})).status, 200);
});

test("signed-out visitors can't use protected NSE features", async () => {
  const anonymous = new Client();
  assert.equal((await anonymous.post("/api/nse/exams", { pathway: "nse-1", mode: "PRACTICE" })).status, 401);
  assert.match((await anonymous.fetch("/fortinet/dashboard")).headers.get("location")!, /\/register/);
  assert.match((await anonymous.fetch("/fortinet/labs/firewall-policy")).headers.get("location")!, /\/register/);
});

test("mock exam: no answers before submission, server marks it, results are stored", async () => {
  const { client, id: userId } = await user("mock");
  const attemptId = await startExam(client, { pathway: "nse-4", mode: "MOCK" });
  const first = await (await client.fetch(`/api/nse/exams/${attemptId}?index=0`)).json();
  assert.ok(first.attempt.deadlineAt, "mock has a server deadline");
  const total = first.attempt.totalQuestions;
  assert.ok(total >= 20);

  let correctSent = 0;
  for (let index = 0; index < total; index += 1) {
    const raw = await (await client.fetch(`/api/nse/exams/${attemptId}?index=${index}`)).text();
    assert.doesNotMatch(raw, /"(isCorrect|rationale|explanation|matchTo|position)":/, "no answer data before submission");
    const answer = index % 2 === 0 ? await correctAnswer(attemptId, index) : await wrongAnswer(attemptId, index);
    if (index % 2 === 0) correctSent += 1;
    const saved = await client.post(`/api/nse/exams/${attemptId}/answer`, { index, response: answer });
    const savedText = await saved.text();
    assert.ok([200, 400].includes(saved.status), savedText);
    if (saved.status === 400) assert.equal(index % 2, 1, "a correct answer was rejected");
    assert.doesNotMatch(savedText, /isCorrect|rationale|reveal/, "saving reveals nothing");
  }

  // A client-supplied score field does nothing.
  assert.equal((await client.post(`/api/nse/exams/${attemptId}/answer`, { index: 0, response: ["bogus"] })).status, 400);
  assert.equal((await client.post(`/api/nse/exams/${attemptId}/submit`, { correctAnswers: 999, totalQuestions: 1 })).status, 200);
  const results = await (await client.fetch(`/api/nse/exams/${attemptId}`)).json();
  assert.equal(results.attempt.correctAnswers, correctSent);
  assert.equal(results.results.length, total);
  assert.ok(results.results.every((item: { explanation: string; options: { rationale: string }[] }) => item.explanation && item.options.every((option) => option.rationale)));
  const stored = await prisma.nseExamAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  assert.ok(stored.submittedAt);
  assert.equal(stored.userId, userId);

  assert.equal((await client.post(`/api/nse/exams/${attemptId}/answer`, { index: 0, response: ["A"] })).status, 409, "no changes after submission");
  assert.equal((await client.post(`/api/nse/exams/${attemptId}/submit`, {})).status, 200, "submitting twice is harmless");
  assert.equal((await (await client.fetch(`/api/nse/exams/${attemptId}`)).json()).attempt.correctAnswers, correctSent);
});

test("timer is enforced by the server, including auto-submission", async () => {
  const { client } = await user("timer");
  const attemptId = await startExam(client, { pathway: "nse-1", mode: "MOCK" });
  await client.post(`/api/nse/exams/${attemptId}/answer`, { index: 0, response: await correctAnswer(attemptId, 0) });
  await prisma.nseExamAttempt.update({ where: { id: attemptId }, data: { deadlineAt: new Date(Date.now() - 60_000) } });
  const late = await client.post(`/api/nse/exams/${attemptId}/answer`, { index: 1, response: await correctAnswer(attemptId, 1) });
  assert.equal(late.status, 409);
  assert.equal((await late.json()).code, "TIME_UP");
  const results = await (await client.fetch(`/api/nse/exams/${attemptId}`)).json();
  assert.ok(results.attempt.submittedAt, "auto-submitted");
  assert.equal(results.attempt.correctAnswers, 1, "the late answer wasn't counted");
});

test("practice reveals after an answer and first answer is final; all question types grade correctly", async () => {
  const { client } = await user("practice");
  const seen = new Set<string>();
  const attemptId = await startExam(client, { pathway: "nse-4", mode: "PRACTICE", count: 30 });
  const first = await (await client.fetch(`/api/nse/exams/${attemptId}?index=0`)).json();
  for (let index = 0; index < first.attempt.totalQuestions; index += 1) {
    const before = await (await client.fetch(`/api/nse/exams/${attemptId}?index=${index}`)).text();
    assert.doesNotMatch(before, /"(isCorrect|rationale)":/);
    seen.add(JSON.parse(before).question.type);
    const answered = await (await client.post(`/api/nse/exams/${attemptId}/answer`, { index, response: await correctAnswer(attemptId, index) })).json();
    assert.equal(answered.isCorrect, true, `index ${index}`);
    assert.ok(answered.reveal.explanation);
  }
  for (const type of ["SINGLE", "MULTIPLE", "MATCHING", "ORDERING"]) assert.ok(seen.has(type), `${type} covered`);
  assert.equal((await client.post(`/api/nse/exams/${attemptId}/answer`, { index: 0, response: await wrongAnswer(attemptId, 0) })).status, 409);
});

test("a multiple-select answer with only some correct options earns no credit", async () => {
  const { client } = await user("multi");
  const module = await prisma.nseQuestion.findFirstOrThrow({ where: { type: "MULTIPLE" }, include: { module: { include: { pathway: true } } } });
  const attemptId = await startExam(client, { pathway: module.module.pathway.slug, mode: "PRACTICE", module: module.module.slug, count: 50 });
  const item = await prisma.nseExamItem.findFirstOrThrow({ where: { attemptId, question: { type: "MULTIPLE" } }, include: { question: { include: { options: true } } } });
  const oneCorrect = [item.question.options.find((option) => option.isCorrect)!.label];
  const result = await (await client.post(`/api/nse/exams/${attemptId}/answer`, { index: item.sortOrder, response: oneCorrect })).json();
  assert.equal(result.isCorrect, false);
});

test("students can't see each other's exams", async () => {
  const { client: owner } = await user("owner");
  const { client: other } = await user("other");
  const attemptId = await startExam(owner, { pathway: "nse-1", mode: "PRACTICE" });
  assert.equal((await other.fetch(`/api/nse/exams/${attemptId}`)).status, 404);
  assert.equal((await other.post(`/api/nse/exams/${attemptId}/answer`, { index: 0, response: ["A"] })).status, 404);
  assert.equal((await other.post(`/api/nse/exams/${attemptId}/submit`, {})).status, 404);
});

test("unpublished content never reaches students", async () => {
  const { client } = await user("draft");
  const module = await prisma.nseModule.findFirstOrThrow({ where: { slug: "security-principles" }, include: { pathway: true } });
  const draft = await prisma.nseQuestion.create({ data: { moduleId: module.id, type: "SINGLE", difficulty: "BEGINNER", prompt: `e2e-${run} draft question`, explanation: "x", technology: "x", topic: "x", status: "DRAFT", options: { create: [{ label: "A", text: "a", rationale: "a", isCorrect: true }, { label: "B", text: "b", rationale: "b" }] } } });
  const attemptId = await startExam(client, { pathway: module.pathway.slug, mode: "PRACTICE", module: module.slug, count: 50 });
  const items = await prisma.nseExamItem.findMany({ where: { attemptId }, select: { questionId: true } });
  assert.equal(items.some((item) => item.questionId === draft.id), false);

  await prisma.nseModule.update({ where: { id: module.id }, data: { status: "DRAFT" } });
  try {
    assert.equal((await client.fetch(`/fortinet/${module.pathway.slug}/${module.slug}`)).status, 404);
    assert.equal((await client.post("/api/nse/exams", { pathway: module.pathway.slug, mode: "PRACTICE", module: module.slug })).status, 404);
  } finally {
    await prisma.nseModule.update({ where: { id: module.id }, data: { status: "PUBLISHED" } });
  }
});

test("module progress, lab completion and readiness update; readiness needs two exams", async () => {
  const { client, id: userId } = await user("progress");
  const pathway = await prisma.nsePathway.findUniqueOrThrow({ where: { slug: "nse-3" }, include: { modules: true } });
  assert.equal((await client.post(`/api/nse/modules/${pathway.modules[0].id}/complete`, { completed: true })).status, 200);

  const lab = await prisma.nseLab.findUniqueOrThrow({ where: { slug: "firewall-policy" } });
  const definition = lab.definition as { tasks: { commands: string[] }[] };
  assert.equal((await client.post("/api/nse/labs/firewall-policy/complete", { transcript: [] })).status, 422, "a claim without work is refused");
  assert.equal((await client.post("/api/nse/labs/firewall-policy/complete", { transcript: definition.tasks.flatMap((task) => task.commands) })).status, 200);
  assert.ok(await prisma.labCompletion.findUnique({ where: { userId_labSlug: { userId, labSlug: "nse:firewall-policy" } } }));
  assert.equal((await client.fetch("/fortinet/labs/firewall-policy")).status, 200);

  const answerAll = async (attemptId: string) => {
    const { attempt } = await (await client.fetch(`/api/nse/exams/${attemptId}?index=0`)).json();
    for (let index = 0; index < attempt.totalQuestions; index += 1) await client.post(`/api/nse/exams/${attemptId}/answer`, { index, response: await correctAnswer(attemptId, index) });
    await client.post(`/api/nse/exams/${attemptId}/submit`, {});
  };
  await answerAll(await startExam(client, { pathway: "nse-3", mode: "READINESS" }));
  let dashboard = await (await client.fetch("/fortinet/dashboard")).text();
  assert.match(dashboard, /Not enough data/);
  await answerAll(await startExam(client, { pathway: "nse-3", mode: "MOCK" }));
  dashboard = await (await client.fetch("/fortinet/dashboard")).text();
  assert.match(dashboard, /CertMastery readiness/);
  assert.match(dashboard, /How readiness is calculated/);
});

test("studio: students are refused, editors can't publish, admins can", async () => {
  const { client: student } = await user("student");
  assert.equal((await student.fetch("/studio")).status, 404);
  assert.equal((await student.fetch("/api/nse-studio/questions")).status, 404);
  assert.equal((await student.post("/api/nse-studio/import", [])).status, 404);

  const module = await prisma.nseModule.findFirstOrThrow({ where: { slug: "threats" } });
  const question = { moduleId: module.id, type: "SINGLE", difficulty: "BEGINNER", prompt: `e2e-${run} studio question`, explanation: "Because", technology: "Test", topic: "Test", status: "DRAFT", options: [{ label: "A", text: "a", rationale: "ra", isCorrect: true }, { label: "B", text: "b", rationale: "rb", isCorrect: false }] };

  const { client: editor } = await user("editor", "CONTENT_EDITOR");
  assert.equal((await editor.fetch("/studio")).status, 200);
  assert.equal((await editor.fetch("/admin")).status, 404, "editors don't get the analytics area");
  const created = await editor.post("/api/nse-studio/questions", question);
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal((await editor.post(`/api/nse-studio/questions/${id}`, { ...question, status: "PUBLISHED" }, "PUT")).status, 403);
  assert.equal((await editor.post("/api/nse-studio/questions", { ...question, status: "PUBLISHED" })).status, 403);
  assert.equal((await editor.post("/api/nse-studio/questions", { ...question, options: question.options.map((option) => ({ ...option, isCorrect: false })) })).status, 400, "validation");

  const { client: admin } = await user("admin", "ADMIN");
  assert.equal((await admin.post(`/api/nse-studio/questions/${id}`, { ...question, status: "PUBLISHED", prompt: `e2e-${run} edited` }, "PUT")).status, 200);
  assert.equal((await prisma.nseQuestion.findUniqueOrThrow({ where: { id } })).status, "PUBLISHED");

  const bad = await admin.post("/api/nse-studio/import", [question, { ...question, options: [] }]);
  assert.equal(bad.status, 400);
  assert.equal(await prisma.nseQuestion.count({ where: { prompt: `e2e-${run} studio question` } }), 0, "a bad import adds nothing");
  const imported = await admin.post("/api/nse-studio/import", [{ ...question, status: "PUBLISHED", prompt: `e2e-${run} imported` }]);
  assert.equal(imported.status, 201);
  assert.equal((await prisma.nseQuestion.findFirstOrThrow({ where: { prompt: `e2e-${run} imported` } })).status, "DRAFT", "imports always start as drafts");

  const pathway = await prisma.nsePathway.findUniqueOrThrow({ where: { slug: "nse-1" } });
  const { id: _id, createdAt: _c, updatedAt: _u, sourcesCheckedAt: _s, ...fields } = pathway;
  assert.equal((await admin.post(`/api/nse-studio/pathways/${pathway.id}`, { ...fields, mockQuestions: pathway.mockQuestions }, "PUT")).status, 200);
  assert.equal((await admin.fetch("/studio")).status, 200);
});

test("cross-site writes are refused, and exam starts are rate limited", async () => {
  const { client } = await user("limits");
  const cross = await client.fetch("/api/nse/exams", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
  assert.equal(cross.status, 403);
  let status = 0;
  for (let attempt = 0; attempt < 41; attempt += 1) status = (await client.post("/api/nse/exams", { pathway: "nse-1", mode: "PRACTICE", count: 1 })).status;
  assert.equal(status, 429);
});
