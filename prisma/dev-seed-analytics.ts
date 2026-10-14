// Fills a LOCAL database with fake users, quiz activity, and analytics events for testing /admin.
// Refuses to run against anything except the docker-compose database. Run with `npm run db:seed-dev`.
import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient, type QuizMode } from "@prisma/client";
import { hash } from "bcryptjs";
import { configureNeonForLocal } from "../src/lib/neon-local";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/@(db\.localtest\.me|localhost|127\.0\.0\.1)[:/]/.test(databaseUrl)) {
  console.error("Refusing to seed fake analytics: DATABASE_URL is not the local docker-compose database.");
  process.exit(1);
}
configureNeonForLocal(databaseUrl);
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

const DAY_MS = 24 * 60 * 60 * 1000;
let seed = 42;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS - Math.floor(random() * DAY_MS));

const PAGES = ["/", "/certifications", "/history", "/login", "/register", "/practice/ccna", "/practice/security-plus", "/practice/server-plus", "/practice/splunk-cloud-admin", "/quiz/demo"];
const COUNTRIES = ["US", "GB", "IN", "NG", "DE", "CA", "AU", "KE", "BR", "FR"];
const DEVICES = ["desktop", "desktop", "mobile", "mobile", "tablet"];
const REFERRERS = [null, null, null, "www.google.com", "www.bing.com", "www.reddit.com", "duckduckgo.com", "t.co"];
const SEARCHES = ["ospf", "raid", "subnet", "phishing", "vlan", "hec token", "props.conf", "dhcp", "zero trust", "backup"];
const MODES: QuizMode[] = ["PRACTICE", "PRACTICE", "TIMED", "CUSTOM"];

async function main() {
  const [adminHash, studentHash] = await Promise.all([hash("admin-pass-123", 6), hash("student-pass-123", 6)]);
  const admin = await prisma.user.upsert({ where: { email: "admin@example.test" }, update: { role: "ADMIN" }, create: { email: "admin@example.test", name: "Local Admin", role: "ADMIN", passwordHash: adminHash } });
  await prisma.user.upsert({ where: { email: "student@example.test" }, update: {}, create: { email: "student@example.test", name: "Local Student", passwordHash: studentHash } });

  const users: { id: string; createdAt: Date }[] = [];
  for (let index = 1; index <= 40; index += 1) {
    const email = `learner${String(index).padStart(2, "0")}@example.test`;
    users.push(await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: `Learner ${index}`, passwordHash: studentHash, createdAt: daysAgo(Math.floor(random() * 110)) } }));
  }

  const certifications = await prisma.certification.findMany({ include: { domains: { include: { questions: { include: { options: true } } } } } });
  if (!certifications.length) throw new Error("Run npm run db:seed first so questions exist.");

  // Quiz sessions and attempts, including a few deliberately hard questions and some skipped ones.
  let sessions = 0;
  let attempts = 0;
  for (const user of users) {
    const sessionCount = 2 + Math.floor(random() * 8);
    for (let index = 0; index < sessionCount; index += 1) {
      const certification = pick(certifications);
      const questions = certification.domains.flatMap((domain) => domain.questions).sort(() => random() - 0.5).slice(0, 10);
      const startedAt = daysAgo(Math.floor(random() * 100));
      const mode = pick(MODES);
      const finished = random() > 0.2;
      const answered = finished ? questions.filter(() => random() > 0.08) : questions.slice(0, Math.floor(random() * 5));
      const results = answered.map((question) => {
        const hard = question.id.endsWith("-q-01") || question.id.endsWith("-q-02");
        const correctOption = question.options.find((option) => option.isCorrect)!;
        const isCorrect = random() < (hard ? 0.25 : 0.7);
        const selected = isCorrect ? correctOption : pick(question.options.filter((option) => !option.isCorrect));
        return { questionId: question.id, selectedLabel: selected.label, isCorrect };
      });
      await prisma.quizSession.create({
        data: {
          userId: user.id, certificationId: certification.id, mode, totalQuestions: questions.length,
          correctAnswers: results.filter((result) => result.isCorrect).length, startedAt,
          completedAt: finished ? new Date(startedAt.getTime() + 15 * 60 * 1000) : null,
          questions: { create: questions.map((question, sortOrder) => ({ questionId: question.id, sortOrder })) },
          attempts: { create: results.map((result, order) => ({ ...result, userId: user.id, answeredAt: new Date(startedAt.getTime() + order * 60 * 1000) })) },
        },
      });
      sessions += 1;
      attempts += results.length;
    }
  }

  // Extra attempts so a few questions pass the 20-attempt threshold for "hardest questions".
  const hardQuestions = certifications.flatMap((certification) => certification.domains.flatMap((domain) => domain.questions)).filter((question) => question.id.endsWith("-q-01"));
  for (const question of hardQuestions) {
    const correctLabel = question.options.find((option) => option.isCorrect)!.label;
    await prisma.attempt.createMany({ data: Array.from({ length: 30 }, () => {
      const isCorrect = random() < 0.2;
      return { questionId: question.id, userId: pick(users).id, selectedLabel: isCorrect ? correctLabel : pick(["A", "B", "C", "D"].filter((label) => label !== correctLabel)), isCorrect, answeredAt: daysAgo(Math.floor(random() * 60)) };
    }) });
    attempts += 30;
  }

  // Analytics events over the last 100 days, so a few fall outside the 90-day retention window.
  const events: Prisma.EventCreateManyInput[] = [];
  for (let day = 0; day < 100; day += 1) {
    const visitors = 15 + Math.floor(random() * 25);
    for (let visitor = 0; visitor < visitors; visitor += 1) {
      const anonId = `00000000-0000-4000-8000-${String(day * 100 + visitor).padStart(12, "0")}`;
      const user = random() < 0.35 ? pick(users) : null;
      const base = { anonId, userId: user?.id ?? null, country: pick(COUNTRIES), device: pick(DEVICES), isBot: false };
      const start = daysAgo(day);
      events.push({ ...base, type: "session_start", path: "/", ts: start });
      const views = 1 + Math.floor(random() * 6);
      for (let view = 0; view < views; view += 1) {
        const path = pick(PAGES);
        const status = random() < 0.03 ? 404 : random() < 0.01 ? 500 : 200;
        events.push({ ...base, type: "page_view", path, method: "GET", status, durationMs: Math.floor(40 + random() * (random() < 0.05 ? 2500 : 400)), referrerHost: view === 0 ? pick(REFERRERS) : null, certSlug: path.match(/^\/practice\/(.+)/)?.[1] ?? null, ts: new Date(start.getTime() + view * 45_000) });
      }
      if (random() < 0.3) {
        const certification = pick(certifications);
        events.push({ ...base, type: "exam_started", certSlug: certification.slug, mode: pick(MODES), difficulty: pick(["ANY", "ANY", "ANY", "EASY", "MEDIUM", "HARD"]), search: random() < 0.25 ? pick(SEARCHES) : null, ts: new Date(start.getTime() + 300_000) });
      }
      if (user && random() < 0.2) events.push({ ...base, type: "login", ts: new Date(start.getTime() + 10_000) });
    }
    for (let bot = 0; bot < 8; bot += 1) events.push({ type: "page_view", path: pick(PAGES), method: "GET", status: 200, durationMs: 30, anonId: null, device: "desktop", isBot: true, ts: daysAgo(day) });
    if (random() < 0.3) events.push({ type: "error", path: "/api/quizzes", method: "POST", status: 500, durationMs: 1200, device: "desktop", ts: daysAgo(day) });
  }
  for (const user of users) events.push({ type: "signup", userId: user.id, device: "desktop", ts: user.createdAt });
  events.push({ type: "login", userId: admin.id, device: "desktop", ts: new Date() });
  for (let index = 0; index < events.length; index += 1000) await prisma.event.createMany({ data: events.slice(index, index + 1000) });

  console.log(`Seeded ${users.length} learners, ${sessions} quiz sessions, ${attempts} attempts, and ${events.length} events.`);
  console.log("Sign in at /login as admin@example.test / admin-pass-123 (admin) or student@example.test / student-pass-123.");
}

main().finally(() => prisma.$disconnect());
