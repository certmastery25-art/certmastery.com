import { EVENT_RETENTION_DAYS } from "@/lib/analytics/constants";

export const RANGE_PRESETS = ["today", "7d", "30d", "90d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type DateRange = {
  preset: RangePreset;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  days: number;
  includeBots: boolean;
  // Raw events exist only for the retention window; earlier days come from DailyStat.
  retentionStart: Date;
  todayStart: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_DAYS = 3 * 366;

const utcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

function parseDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Parses range, from, to, and bots query parameters into a [start, end) window of whole UTC days,
// plus the equally long window immediately before it for period-over-period comparison.
export function parseRange(params: URLSearchParams, now = new Date()): DateRange {
  const todayStart = utcDay(now);
  const tomorrow = new Date(todayStart.getTime() + DAY_MS);
  const requested = params.get("range");
  let preset: RangePreset = RANGE_PRESETS.includes(requested as RangePreset) ? (requested as RangePreset) : "7d";
  let start: Date;
  let end = tomorrow;

  if (preset === "custom") {
    const from = parseDay(params.get("from"));
    const to = parseDay(params.get("to"));
    if (from && to && from <= to && to < tomorrow && (to.getTime() - from.getTime()) / DAY_MS < MAX_CUSTOM_DAYS) {
      start = from;
      end = new Date(to.getTime() + DAY_MS);
    } else {
      preset = "7d";
      start = new Date(tomorrow.getTime() - 7 * DAY_MS);
    }
  } else {
    const days = preset === "today" ? 1 : Number.parseInt(preset, 10);
    start = new Date(tomorrow.getTime() - days * DAY_MS);
  }

  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return {
    preset,
    start,
    end,
    previousStart: new Date(start.getTime() - days * DAY_MS),
    previousEnd: start,
    days,
    includeBots: params.get("bots") === "1",
    retentionStart: new Date(todayStart.getTime() - (EVENT_RETENTION_DAYS - 1) * DAY_MS),
    todayStart,
  };
}

export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Serializable summary of the range for API responses; `to` is the last included day.
export function describeRange(range: DateRange) {
  return {
    preset: range.preset,
    from: isoDay(range.start),
    to: isoDay(new Date(range.end.getTime() - 24 * 60 * 60 * 1000)),
    days: range.days,
    includeBots: range.includeBots,
    retentionStart: isoDay(range.retentionStart),
  };
}
