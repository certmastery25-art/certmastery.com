import { neon } from "@neondatabase/serverless";
import { EVENT_RETENTION_DAYS } from "../lib/analytics/constants";
import { configureNeonForLocal } from "../lib/neon-local";

// Each rollup run recomputes at most this many days, which bounds the work after a long gap.
const MAX_DAYS_PER_RUN = 120;

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// Rebuilds DailyStat rows for one UTC day from raw events. Bot traffic is kept only as its own page_views dimension.
const ROLLUP_DAY_SQL = `
INSERT INTO "DailyStat" ("day", "metric", "dimension", "value")
SELECT $1::date, metric, dimension, value FROM (
  SELECT 'page_views' AS metric,
         CASE WHEN "isBot" THEN 'bot' WHEN "userId" IS NULL THEN 'anonymous' ELSE 'signed_in' END AS dimension,
         count(*)::int AS value
    FROM "Event" WHERE "type" = 'page_view' AND "ts" >= $1::date AND "ts" < $1::date + 1 GROUP BY 2
  UNION ALL
  SELECT 'visitors', '', count(DISTINCT "anonId")::int
    FROM "Event" WHERE "type" = 'page_view' AND NOT "isBot" AND "ts" >= $1::date AND "ts" < $1::date + 1
  UNION ALL
  SELECT 'sessions', '', count(*)::int
    FROM "Event" WHERE "type" = 'session_start' AND NOT "isBot" AND "ts" >= $1::date AND "ts" < $1::date + 1
  UNION ALL
  SELECT 'errors', '', count(*)::int
    FROM "Event" WHERE ("type" = 'error' OR "status" >= 500) AND "ts" >= $1::date AND "ts" < $1::date + 1
  UNION ALL
  SELECT 'page', "path", count(*)::int
    FROM "Event" WHERE "type" = 'page_view' AND NOT "isBot" AND "path" IS NOT NULL AND "ts" >= $1::date AND "ts" < $1::date + 1 GROUP BY 2
  UNION ALL
  SELECT 'referrer', "referrerHost", count(*)::int
    FROM "Event" WHERE "type" = 'page_view' AND NOT "isBot" AND "referrerHost" IS NOT NULL AND "ts" >= $1::date AND "ts" < $1::date + 1 GROUP BY 2
  UNION ALL
  SELECT 'country', "country", count(*)::int
    FROM "Event" WHERE "type" = 'page_view' AND NOT "isBot" AND "country" IS NOT NULL AND "ts" >= $1::date AND "ts" < $1::date + 1 GROUP BY 2
  UNION ALL
  SELECT 'device', "device", count(*)::int
    FROM "Event" WHERE "type" = 'page_view' AND NOT "isBot" AND "device" IS NOT NULL AND "ts" >= $1::date AND "ts" < $1::date + 1 GROUP BY 2
  UNION ALL
  SELECT 'difficulty', "difficulty", count(*)::int
    FROM "Event" WHERE "type" = 'exam_started' AND NOT "isBot" AND "difficulty" IS NOT NULL AND "ts" >= $1::date AND "ts" < $1::date + 1 GROUP BY 2
  UNION ALL
  SELECT 'search', "search", count(*)::int
    FROM "Event" WHERE "type" = 'exam_started' AND NOT "isBot" AND "search" IS NOT NULL AND "ts" >= $1::date AND "ts" < $1::date + 1 GROUP BY 2
) AS stats
WHERE value > 0`;

// Rolls raw events up into DailyStat through yesterday (UTC), then deletes raw events past retention.
// Runs from the daily cron trigger; safe to re-run because each day is rebuilt from scratch.
export async function runDailyMaintenance(databaseUrl: string | undefined, now = new Date()) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  configureNeonForLocal(databaseUrl);
  const sql = neon(databaseUrl);

  const [bounds] = await sql.query(
    `SELECT (SELECT max("day") FROM "DailyStat")::text AS last_rolled, (SELECT min("ts") FROM "Event")::date::text AS first_event`,
  ) as { last_rolled: string | null; first_event: string | null }[];

  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY_MS);
  // Re-roll the last rolled day too, so events written just after midnight are included.
  const startDay = bounds.last_rolled ?? bounds.first_event;
  const rolled: string[] = [];
  if (startDay) {
    let day = new Date(`${startDay}T00:00:00Z`);
    const earliest = new Date(yesterday.getTime() - (MAX_DAYS_PER_RUN - 1) * DAY_MS);
    if (day < earliest) day = earliest;
    for (; day <= yesterday; day = new Date(day.getTime() + DAY_MS)) {
      const value = isoDay(day);
      await sql.transaction([
        sql.query(`DELETE FROM "DailyStat" WHERE "day" = $1::date`, [value]),
        sql.query(ROLLUP_DAY_SQL, [value]),
      ]);
      rolled.push(value);
    }
  }

  const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * DAY_MS);
  const [deleted] = await sql.query(
    `WITH removed AS (DELETE FROM "Event" WHERE "ts" < $1::timestamp RETURNING 1) SELECT count(*)::int AS count FROM removed`,
    [cutoff.toISOString()],
  ) as { count: number }[];

  return { rolledDays: rolled, deletedEvents: deleted.count };
}
