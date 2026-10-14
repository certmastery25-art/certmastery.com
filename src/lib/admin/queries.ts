import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isoDay, type DateRange } from "./range";

// Every list endpoint caps its rows; CSV exports allow more but are still bounded.
export const MAX_ROWS = 500;
export const MAX_EXPORT_ROWS = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;
const minDate = (a: Date, b: Date) => (a < b ? a : b);
const maxDate = (a: Date, b: Date) => (a > b ? a : b);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

const botFilter = (range: DateRange) => (range.includeBots ? Prisma.empty : Prisma.sql`AND NOT e."isBot"`);

async function lastRolledDayEnd() {
  const [row] = await prisma.$queryRaw<{ day: Date | null }[]>`SELECT max("day") AS day FROM "DailyStat"`;
  return row?.day ? new Date(row.day.getTime() + DAY_MS) : null;
}

// For ranges over 7 days, whole days already rolled up are read from DailyStat and the rest from raw events.
async function eventSources(range: DateRange, start: Date, end: Date) {
  if (range.days <= 7) return { rollupStart: start, rollupEnd: start, rawStart: start };
  const rolledEnd = await lastRolledDayEnd();
  const rollupEnd = rolledEnd ? maxDate(start, minDate(minDate(end, rolledEnd), range.todayStart)) : start;
  return { rollupStart: start, rollupEnd, rawStart: rollupEnd };
}

// ---------- Overview ----------

async function periodKpis(range: DateRange, start: Date, end: Date) {
  const sources = await eventSources(range, start, end);
  const pageViewDimensions = range.includeBots ? ["signed_in", "anonymous", "bot"] : ["signed_in", "anonymous"];

  const [rolled] = sources.rollupEnd > sources.rollupStart
    ? await prisma.$queryRaw<{ views: number; visitors: number }[]>`
        SELECT coalesce(sum("value") FILTER (WHERE "metric" = 'page_views' AND "dimension" IN (${Prisma.join(pageViewDimensions)})), 0)::int AS views,
               coalesce(sum("value") FILTER (WHERE "metric" = 'visitors'), 0)::int AS visitors
          FROM "DailyStat" WHERE "day" >= ${sources.rollupStart}::date AND "day" < ${sources.rollupEnd}::date`
    : [{ views: 0, visitors: 0 }];

  const [raw] = await prisma.$queryRaw<{ views: number; visitors: number }[]>`
    SELECT count(*) FILTER (WHERE e."type" = 'page_view')::int AS views,
           count(DISTINCT e."anonId") FILTER (WHERE e."type" = 'page_view' AND NOT e."isBot")::int AS visitors
      FROM "Event" e WHERE e."ts" >= ${sources.rawStart} AND e."ts" < ${end} ${botFilter(range)}`;

  // Unique visitors are exact when the whole period has raw events; otherwise daily uniques are summed.
  const visitorsExact = start >= range.retentionStart || sources.rollupEnd <= sources.rollupStart;
  const [exactVisitors] = visitorsExact && sources.rollupEnd > sources.rollupStart
    ? await prisma.$queryRaw<{ visitors: number }[]>`
        SELECT count(DISTINCT e."anonId")::int AS visitors FROM "Event" e
         WHERE e."type" = 'page_view' AND NOT e."isBot" AND e."ts" >= ${start} AND e."ts" < ${end}`
    : [{ visitors: raw.visitors + rolled.visitors }];

  const [persistent] = await prisma.$queryRaw<{ active_users: number; signups: number; answered: number; correct: number; completed: number }[]>`
    SELECT
      (SELECT count(DISTINCT uid)::int FROM (
         SELECT "userId" AS uid FROM "Attempt" WHERE "userId" IS NOT NULL AND "answeredAt" >= ${start} AND "answeredAt" < ${end}
         UNION SELECT "userId" FROM "QuizSession" WHERE "userId" IS NOT NULL AND "startedAt" >= ${start} AND "startedAt" < ${end}
         UNION SELECT e."userId" FROM "Event" e WHERE e."userId" IS NOT NULL AND NOT e."isBot" AND e."ts" >= ${start} AND e."ts" < ${end}
       ) AS active) AS active_users,
      (SELECT count(*)::int FROM "User" WHERE "createdAt" >= ${start} AND "createdAt" < ${end}) AS signups,
      (SELECT count(*)::int FROM "Attempt" WHERE "answeredAt" >= ${start} AND "answeredAt" < ${end}) AS answered,
      (SELECT count(*)::int FROM "Attempt" WHERE "isCorrect" AND "answeredAt" >= ${start} AND "answeredAt" < ${end}) AS correct,
      (SELECT count(*)::int FROM "QuizSession" WHERE "completedAt" >= ${start} AND "completedAt" < ${end}) AS completed`;

  return {
    visitors: exactVisitors.visitors,
    visitorsApproximate: !visitorsExact,
    activeUsers: persistent.active_users,
    signups: persistent.signups,
    pageViews: rolled.views + raw.views,
    questionsAnswered: persistent.answered,
    accuracy: pct(persistent.correct, persistent.answered),
    quizzesCompleted: persistent.completed,
  };
}

export async function getOverview(range: DateRange) {
  const [current, previous, sources] = await Promise.all([
    periodKpis(range, range.start, range.end),
    periodKpis(range, range.previousStart, range.previousEnd),
    eventSources(range, range.start, range.end),
  ]);

  const [rolledDays, rawDays, activeDays] = await Promise.all([
    sources.rollupEnd > sources.rollupStart
      ? prisma.$queryRaw<{ day: Date; metric: string; dimension: string; value: number }[]>`
          SELECT "day", "metric", "dimension", "value" FROM "DailyStat"
           WHERE "metric" IN ('page_views', 'visitors') AND "day" >= ${sources.rollupStart}::date AND "day" < ${sources.rollupEnd}::date`
      : Promise.resolve([]),
    prisma.$queryRaw<{ day: Date; visitors: number; signed_in: number; anonymous: number; bot: number }[]>`
      SELECT date_trunc('day', e."ts")::date AS day,
             count(DISTINCT e."anonId") FILTER (WHERE e."type" = 'page_view' AND NOT e."isBot")::int AS visitors,
             count(*) FILTER (WHERE e."type" = 'page_view' AND NOT e."isBot" AND e."userId" IS NOT NULL)::int AS signed_in,
             count(*) FILTER (WHERE e."type" = 'page_view' AND NOT e."isBot" AND e."userId" IS NULL)::int AS anonymous,
             count(*) FILTER (WHERE e."type" = 'page_view' AND e."isBot")::int AS bot
        FROM "Event" e WHERE e."ts" >= ${sources.rawStart} AND e."ts" < ${range.end} GROUP BY 1`,
    prisma.$queryRaw<{ day: Date; users: number }[]>`
      SELECT day, count(DISTINCT uid)::int AS users FROM (
        SELECT date_trunc('day', "answeredAt")::date AS day, "userId" AS uid FROM "Attempt" WHERE "userId" IS NOT NULL AND "answeredAt" >= ${range.start} AND "answeredAt" < ${range.end}
        UNION SELECT date_trunc('day', "startedAt")::date, "userId" FROM "QuizSession" WHERE "userId" IS NOT NULL AND "startedAt" >= ${range.start} AND "startedAt" < ${range.end}
        UNION SELECT date_trunc('day', e."ts")::date, e."userId" FROM "Event" e WHERE e."userId" IS NOT NULL AND NOT e."isBot" AND e."ts" >= ${range.start} AND e."ts" < ${range.end}
      ) AS active GROUP BY day`,
  ]);

  const series = new Map<string, { day: string; visitors: number; activeUsers: number; signedIn: number; anonymous: number; bot: number }>();
  for (let time = range.start.getTime(); time < range.end.getTime(); time += DAY_MS) {
    const day = isoDay(new Date(time));
    series.set(day, { day, visitors: 0, activeUsers: 0, signedIn: 0, anonymous: 0, bot: 0 });
  }
  for (const row of rolledDays) {
    const entry = series.get(isoDay(row.day));
    if (!entry) continue;
    if (row.metric === "visitors") entry.visitors = row.value;
    else if (row.dimension === "signed_in") entry.signedIn = row.value;
    else if (row.dimension === "anonymous") entry.anonymous = row.value;
    else if (row.dimension === "bot") entry.bot = row.value;
  }
  for (const row of rawDays) {
    const entry = series.get(isoDay(row.day));
    if (!entry) continue;
    entry.visitors = row.visitors;
    entry.signedIn = row.signed_in;
    entry.anonymous = row.anonymous;
    entry.bot = row.bot;
  }
  for (const row of activeDays) {
    const entry = series.get(isoDay(row.day));
    if (entry) entry.activeUsers = row.users;
  }

  return {
    current,
    previous,
    series: [...series.values()].map((entry) => (range.includeBots ? entry : { ...entry, bot: 0 })),
    source: sources.rollupEnd > sources.rollupStart ? "daily_stats+events" : "events",
  };
}

// ---------- Content & usage ----------

export const CONTENT_TABLES = ["pages", "certifications", "modes", "domains", "difficulty", "hardest", "skipped", "search", "referrers", "countries", "devices"] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];

// Event-based lists read raw events, so they cover at most the retention window.
function eventWindow(range: DateRange) {
  return { start: maxDate(range.start, range.retentionStart), end: range.end, clipped: range.start < range.retentionStart };
}

async function topEventDimension(range: DateRange, column: "referrerHost" | "country" | "device", limit: number) {
  const window = eventWindow(range);
  const field = Prisma.raw(`e."${column}"`);
  return prisma.$queryRaw<{ value: string; views: number; visitors: number }[]>`
    SELECT ${field} AS value, count(*)::int AS views, count(DISTINCT e."anonId")::int AS visitors
      FROM "Event" e
     WHERE e."type" = 'page_view' AND ${field} IS NOT NULL AND e."ts" >= ${window.start} AND e."ts" < ${window.end} ${botFilter(range)}
     GROUP BY 1 ORDER BY views DESC LIMIT ${limit}`;
}

export async function getContentTable(range: DateRange, table: ContentTable, limit = 50) {
  const window = eventWindow(range);
  switch (table) {
    case "pages":
      return prisma.$queryRaw<{ path: string; views: number; visitors: number }[]>`
        SELECT e."path", count(*)::int AS views, count(DISTINCT e."anonId")::int AS visitors
          FROM "Event" e
         WHERE e."type" = 'page_view' AND e."ts" >= ${window.start} AND e."ts" < ${window.end} ${botFilter(range)}
         GROUP BY 1 ORDER BY views DESC LIMIT ${limit}`;
    case "certifications":
      return prisma.$queryRaw<{ slug: string; certification: string; sessions: number; answered: number; accuracy: number | null }[]>`
        SELECT c."slug", c."acronym" AS certification,
               coalesce(s.sessions, 0)::int AS sessions, coalesce(a.answered, 0)::int AS answered,
               round(100.0 * a.correct / nullif(a.answered, 0), 1)::float AS accuracy
          FROM "Certification" c
          LEFT JOIN (SELECT "certificationId", count(*) AS sessions FROM "QuizSession"
                      WHERE "startedAt" >= ${range.start} AND "startedAt" < ${range.end} GROUP BY 1) s ON s."certificationId" = c."id"
          LEFT JOIN (SELECT d."certificationId", count(*) AS answered, count(*) FILTER (WHERE a."isCorrect") AS correct
                       FROM "Attempt" a JOIN "Question" q ON q."id" = a."questionId" JOIN "Domain" d ON d."id" = q."domainId"
                      WHERE a."answeredAt" >= ${range.start} AND a."answeredAt" < ${range.end} GROUP BY 1) a ON a."certificationId" = c."id"
         ORDER BY sessions DESC, answered DESC`;
    case "modes":
      return prisma.$queryRaw<{ mode: string; sessions: number; completed: number; share: number | null; completion_rate: number | null }[]>`
        SELECT "mode"::text AS mode, count(*)::int AS sessions, count("completedAt")::int AS completed,
               round(100.0 * count(*) / nullif(sum(count(*)) OVER (), 0), 1)::float AS share,
               round(100.0 * count("completedAt") / nullif(count(*), 0), 1)::float AS completion_rate
          FROM "QuizSession" WHERE "startedAt" >= ${range.start} AND "startedAt" < ${range.end}
         GROUP BY 1 ORDER BY sessions DESC`;
    case "domains":
      return prisma.$queryRaw<{ certification: string; objective: string; domain: string; answered: number; accuracy: number | null }[]>`
        SELECT c."acronym" AS certification, d."objective", d."name" AS domain, count(*)::int AS answered,
               round(100.0 * count(*) FILTER (WHERE a."isCorrect") / count(*), 1)::float AS accuracy
          FROM "Attempt" a JOIN "Question" q ON q."id" = a."questionId" JOIN "Domain" d ON d."id" = q."domainId" JOIN "Certification" c ON c."id" = d."certificationId"
         WHERE a."answeredAt" >= ${range.start} AND a."answeredAt" < ${range.end}
         GROUP BY c."acronym", d."objective", d."name", d."sortOrder" ORDER BY answered DESC LIMIT ${limit}`;
    case "difficulty":
      return prisma.$queryRaw<{ difficulty: string; sessions: number; share: number | null }[]>`
        SELECT e."difficulty", count(*)::int AS sessions, round(100.0 * count(*) / nullif(sum(count(*)) OVER (), 0), 1)::float AS share
          FROM "Event" e
         WHERE e."type" = 'exam_started' AND e."difficulty" IS NOT NULL AND e."ts" >= ${window.start} AND e."ts" < ${window.end} ${botFilter(range)}
         GROUP BY 1 ORDER BY sessions DESC`;
    case "hardest":
      return prisma.$queryRaw<{ question_id: string; certification: string; domain: string; prompt: string; attempts: number; correct_rate: number }[]>`
        SELECT q."id" AS question_id, c."acronym" AS certification, d."name" AS domain, left(q."prompt", 160) AS prompt,
               count(*)::int AS attempts, round(100.0 * count(*) FILTER (WHERE a."isCorrect") / count(*), 1)::float AS correct_rate
          FROM "Attempt" a JOIN "Question" q ON q."id" = a."questionId" JOIN "Domain" d ON d."id" = q."domainId" JOIN "Certification" c ON c."id" = d."certificationId"
         WHERE a."answeredAt" >= ${range.start} AND a."answeredAt" < ${range.end}
         GROUP BY q."id", c."acronym", d."name" HAVING count(*) >= 20
         ORDER BY correct_rate ASC, attempts DESC LIMIT ${limit}`;
    case "skipped":
      // A skip is a question that was part of a finished session but never answered in it.
      return prisma.$queryRaw<{ question_id: string; certification: string; domain: string; prompt: string; skips: number; shown: number }[]>`
        SELECT q."id" AS question_id, c."acronym" AS certification, d."name" AS domain, left(q."prompt", 160) AS prompt,
               count(*) FILTER (WHERE a."id" IS NULL)::int AS skips, count(*)::int AS shown
          FROM "QuizQuestion" qq
          JOIN "QuizSession" s ON s."id" = qq."quizSessionId"
          JOIN "Question" q ON q."id" = qq."questionId" JOIN "Domain" d ON d."id" = q."domainId" JOIN "Certification" c ON c."id" = d."certificationId"
          LEFT JOIN "Attempt" a ON a."quizSessionId" = s."id" AND a."questionId" = qq."questionId"
         WHERE s."completedAt" >= ${range.start} AND s."completedAt" < ${range.end}
         GROUP BY q."id", c."acronym", d."name" HAVING count(*) FILTER (WHERE a."id" IS NULL) > 0
         ORDER BY skips DESC, shown DESC LIMIT ${limit}`;
    case "search":
      return prisma.$queryRaw<{ term: string; searches: number }[]>`
        SELECT e."search" AS term, count(*)::int AS searches
          FROM "Event" e
         WHERE e."type" = 'exam_started' AND e."search" IS NOT NULL AND e."ts" >= ${window.start} AND e."ts" < ${window.end} ${botFilter(range)}
         GROUP BY 1 ORDER BY searches DESC LIMIT ${limit}`;
    case "referrers":
      return topEventDimension(range, "referrerHost", limit);
    case "countries":
      return topEventDimension(range, "country", limit);
    case "devices":
      return topEventDimension(range, "device", limit);
  }
}

export async function getContent(range: DateRange) {
  const entries = await Promise.all(CONTENT_TABLES.map(async (table) => [table, await getContentTable(range, table, table === "domains" ? 200 : 25)] as const));
  return { tables: Object.fromEntries(entries), eventsClipped: eventWindow(range).clipped };
}

// ---------- Users ----------

const USER_SORTS = {
  joined: Prisma.sql`u."createdAt"`,
  lastActive: Prisma.sql`last_active`,
  answered: Prisma.sql`answered`,
  accuracy: Prisma.sql`accuracy`,
  exams: Prisma.sql`exams`,
  name: Prisma.sql`lower(coalesce(u."name", u."email"))`,
} as const;
export type UserSort = keyof typeof USER_SORTS;

const likePattern = (value: string) => `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;

export async function getUsers(range: DateRange, options: { search: string; sort: string; direction: string; page: number; pageSize: number }) {
  const sort = USER_SORTS[options.sort as UserSort] ?? USER_SORTS.lastActive;
  const direction = options.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const search = options.search.trim();
  const where = search ? Prisma.sql`WHERE u."name" ILIKE ${likePattern(search)} OR u."email" ILIKE ${likePattern(search)}` : Prisma.empty;

  const [rows, [count]] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string | null; email: string | null; role: string; joined: Date; last_active: Date | null; answered: number; accuracy: number | null; favourite_cert: string | null; exams: number }[]>`
      WITH att AS (
        SELECT "userId", count(*) AS answered, count(*) FILTER (WHERE "isCorrect") AS correct
          FROM "Attempt" WHERE "userId" IS NOT NULL AND "answeredAt" >= ${range.start} AND "answeredAt" < ${range.end} GROUP BY 1
      ), ses AS (
        SELECT "userId", count("completedAt") AS exams FROM "QuizSession"
         WHERE "userId" IS NOT NULL AND "startedAt" >= ${range.start} AND "startedAt" < ${range.end} GROUP BY 1
      ), seen AS (
        SELECT uid, max(at) AS last_active FROM (
          SELECT "userId" AS uid, max("answeredAt") AS at FROM "Attempt" WHERE "userId" IS NOT NULL GROUP BY 1
          UNION ALL SELECT "userId", max("startedAt") FROM "QuizSession" WHERE "userId" IS NOT NULL GROUP BY 1
          UNION ALL SELECT "userId", max("ts") FROM "Event" WHERE "userId" IS NOT NULL GROUP BY 1
        ) AS activity GROUP BY uid
      ), fav AS (
        SELECT DISTINCT ON (a."userId") a."userId", c."acronym"
          FROM "Attempt" a JOIN "Question" q ON q."id" = a."questionId" JOIN "Domain" d ON d."id" = q."domainId" JOIN "Certification" c ON c."id" = d."certificationId"
         WHERE a."userId" IS NOT NULL AND a."answeredAt" >= ${range.start} AND a."answeredAt" < ${range.end}
         GROUP BY a."userId", c."acronym" ORDER BY a."userId", count(*) DESC
      )
      SELECT u."id", u."name", u."email", u."role"::text AS role, u."createdAt" AS joined, seen.last_active,
             coalesce(att.answered, 0)::int AS answered, round(100.0 * att.correct / nullif(att.answered, 0), 1)::float AS accuracy,
             fav."acronym" AS favourite_cert, coalesce(ses.exams, 0)::int AS exams
        FROM "User" u
        LEFT JOIN att ON att."userId" = u."id"
        LEFT JOIN ses ON ses."userId" = u."id"
        LEFT JOIN seen ON seen.uid = u."id"
        LEFT JOIN fav ON fav."userId" = u."id"
        ${where}
       ORDER BY ${sort} ${direction} NULLS LAST, u."id"
       LIMIT ${options.pageSize} OFFSET ${(options.page - 1) * options.pageSize}`,
    prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM "User" u ${where}`,
  ]);
  return { rows, total: count.total };
}

export async function getUserDetail(range: DateRange, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  if (!user) return null;

  const [certs, domains, scores, events, sessions] = await Promise.all([
    prisma.$queryRaw<{ certification: string; answered: number; accuracy: number }[]>`
      SELECT c."acronym" AS certification, count(*)::int AS answered, round(100.0 * count(*) FILTER (WHERE a."isCorrect") / count(*), 1)::float AS accuracy
        FROM "Attempt" a JOIN "Question" q ON q."id" = a."questionId" JOIN "Domain" d ON d."id" = q."domainId" JOIN "Certification" c ON c."id" = d."certificationId"
       WHERE a."userId" = ${userId} AND a."answeredAt" >= ${range.start} AND a."answeredAt" < ${range.end}
       GROUP BY 1 ORDER BY answered DESC`,
    prisma.$queryRaw<{ certification: string; objective: string; domain: string; answered: number; accuracy: number }[]>`
      SELECT c."acronym" AS certification, d."objective", d."name" AS domain, count(*)::int AS answered,
             round(100.0 * count(*) FILTER (WHERE a."isCorrect") / count(*), 1)::float AS accuracy
        FROM "Attempt" a JOIN "Question" q ON q."id" = a."questionId" JOIN "Domain" d ON d."id" = q."domainId" JOIN "Certification" c ON c."id" = d."certificationId"
       WHERE a."userId" = ${userId} AND a."answeredAt" >= ${range.start} AND a."answeredAt" < ${range.end}
       GROUP BY c."acronym", d."objective", d."name", d."sortOrder" ORDER BY c."acronym", d."sortOrder"`,
    prisma.$queryRaw<{ completed_at: Date; certification: string; mode: string; total: number; correct: number; score: number }[]>`
      SELECT s."completedAt" AS completed_at, c."acronym" AS certification, s."mode"::text AS mode, s."totalQuestions" AS total, s."correctAnswers" AS correct,
             round(100.0 * s."correctAnswers" / nullif(s."totalQuestions", 0), 1)::float AS score
        FROM "QuizSession" s JOIN "Certification" c ON c."id" = s."certificationId"
       WHERE s."userId" = ${userId} AND s."completedAt" >= ${range.start} AND s."completedAt" < ${range.end}
       ORDER BY s."completedAt" ASC LIMIT ${MAX_ROWS}`,
    prisma.$queryRaw<{ ts: Date; type: string; path: string | null; cert_slug: string | null; mode: string | null; status: number | null }[]>`
      SELECT e."ts", e."type", e."path", e."certSlug" AS cert_slug, e."mode", e."status"
        FROM "Event" e WHERE e."userId" = ${userId} AND e."ts" >= ${range.start} AND e."ts" < ${range.end}
       ORDER BY e."ts" DESC LIMIT 200`,
    prisma.$queryRaw<{ ts: Date; certification: string; mode: string; total: number; correct: number; completed: boolean }[]>`
      SELECT s."startedAt" AS ts, c."acronym" AS certification, s."mode"::text AS mode, s."totalQuestions" AS total, s."correctAnswers" AS correct,
             (s."completedAt" IS NOT NULL) AS completed
        FROM "QuizSession" s JOIN "Certification" c ON c."id" = s."certificationId"
       WHERE s."userId" = ${userId} AND s."startedAt" >= ${range.start} AND s."startedAt" < ${range.end}
       ORDER BY s."startedAt" DESC LIMIT 200`,
  ]);

  const timeline = [
    ...events.map((event) => ({ ts: event.ts, kind: event.type, detail: [event.path, event.cert_slug && event.path?.includes(event.cert_slug) ? null : event.cert_slug, event.mode, event.status && event.status >= 400 ? `status ${event.status}` : null].filter(Boolean).join(" · ") })),
    ...sessions.map((session) => ({ ts: session.ts, kind: "quiz_session", detail: `${session.certification} · ${session.mode.toLowerCase()} · ${session.completed ? `${session.correct}/${session.total} correct` : `${session.total} questions, not finished`}` })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime()).slice(0, 200);

  return { user, certs, domains, scores, timeline };
}

// ---------- Logs ----------

export type LogFilters = {
  type?: string;
  path?: string;
  status?: string;
  user?: string;
  cert?: string;
  country?: string;
  cursor?: string;
  limit: number;
};

export async function getLogs(range: DateRange, filters: LogFilters) {
  const conditions: Prisma.Sql[] = [Prisma.sql`e."ts" >= ${range.start}`, Prisma.sql`e."ts" < ${range.end}`];
  if (!range.includeBots) conditions.push(Prisma.sql`NOT e."isBot"`);
  if (filters.type) conditions.push(Prisma.sql`e."type" = ${filters.type}`);
  if (filters.path) conditions.push(Prisma.sql`e."path" ILIKE ${likePattern(filters.path)}`);
  if (filters.cert) conditions.push(Prisma.sql`e."certSlug" = ${filters.cert}`);
  if (filters.country) conditions.push(Prisma.sql`e."country" = ${filters.country.toUpperCase()}`);
  const statusClass = filters.status?.match(/^([1-5])xx$/)?.[1];
  if (statusClass) conditions.push(Prisma.sql`e."status" >= ${Number(statusClass) * 100} AND e."status" < ${Number(statusClass) * 100 + 100}`);
  if (filters.user) {
    conditions.push(filters.user.includes("@")
      ? Prisma.sql`e."userId" IN (SELECT "id" FROM "User" WHERE "email" ILIKE ${likePattern(filters.user)})`
      : Prisma.sql`e."userId" = ${filters.user}`);
  }
  // Keyset pagination on the autoincrement id, which follows insertion order.
  if (filters.cursor && /^\d+$/.test(filters.cursor)) conditions.push(Prisma.sql`e."id" < ${BigInt(filters.cursor)}`);

  const rows = await prisma.$queryRaw<{ id: string; ts: Date; type: string; path: string | null; method: string | null; status: number | null; duration_ms: number | null; user_id: string | null; user_email: string | null; user_name: string | null; cert_slug: string | null; mode: string | null; country: string | null; device: string | null; referrer_host: string | null; is_bot: boolean }[]>`
    SELECT e."id"::text AS id, e."ts", e."type", e."path", e."method", e."status", e."durationMs" AS duration_ms,
           e."userId" AS user_id, u."email" AS user_email, u."name" AS user_name, e."certSlug" AS cert_slug, e."mode",
           e."country", e."device", e."referrerHost" AS referrer_host, e."isBot" AS is_bot
      FROM "Event" e LEFT JOIN "User" u ON u."id" = e."userId"
     WHERE ${Prisma.join(conditions, " AND ")}
     ORDER BY e."id" DESC LIMIT ${filters.limit}`;
  return { rows, nextCursor: rows.length === filters.limit ? rows[rows.length - 1].id : null };
}

export async function getErrors(range: DateRange, limit: number) {
  return prisma.$queryRaw<{ path: string | null; status: number | null; count: number; last_seen: Date }[]>`
    SELECT e."path", e."status", count(*)::int AS count, max(e."ts") AS last_seen
      FROM "Event" e
     WHERE (e."status" >= 400 OR e."type" = 'error') AND e."ts" >= ${range.start} AND e."ts" < ${range.end} ${botFilter(range)}
     GROUP BY 1, 2 ORDER BY count DESC, last_seen DESC LIMIT ${limit}`;
}

// ---------- Questions ----------

export async function getQuestionDetail(range: DateRange, questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true, prompt: true, explanation: true, difficulty: true,
      domain: { select: { name: true, objective: true, certification: { select: { acronym: true, slug: true } } } },
      options: { orderBy: { label: "asc" }, select: { label: true, text: true, isCorrect: true } },
    },
  });
  if (!question) return null;

  const [picks, [skips]] = await Promise.all([
    prisma.$queryRaw<{ label: string; picks: number }[]>`
      SELECT "selectedLabel" AS label, count(*)::int AS picks FROM "Attempt"
       WHERE "questionId" = ${questionId} AND "answeredAt" >= ${range.start} AND "answeredAt" < ${range.end} GROUP BY 1`,
    prisma.$queryRaw<{ skips: number }[]>`
      SELECT count(*)::int AS skips FROM "QuizQuestion" qq JOIN "QuizSession" s ON s."id" = qq."quizSessionId"
       WHERE qq."questionId" = ${questionId} AND s."completedAt" >= ${range.start} AND s."completedAt" < ${range.end}
         AND NOT EXISTS (SELECT 1 FROM "Attempt" a WHERE a."quizSessionId" = s."id" AND a."questionId" = qq."questionId")`,
  ]);
  const attempts = picks.reduce((total, row) => total + row.picks, 0);
  const correctLabel = question.options.find((option) => option.isCorrect)?.label;
  const correct = picks.find((row) => row.label === correctLabel)?.picks ?? 0;
  return { question, attempts, correctRate: pct(correct, attempts), skips: skips.skips, picks };
}
