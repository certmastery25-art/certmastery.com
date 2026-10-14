import { neon } from "@neondatabase/serverless";
import { decode } from "next-auth/jwt";
import { configureNeonForLocal } from "../lib/neon-local";
import {
  ANON_COOKIE,
  ANON_COOKIE_MAX_AGE,
  SESSION_COOKIE,
  classifyRequest,
  deviceFromUserAgent,
  isBotUserAgent,
  readCookie,
  referrerHost,
  validAnonId,
} from "../lib/analytics/request-info";
import { runDailyMaintenance } from "./maintenance";

type Env = { DATABASE_URL?: string; NEXTAUTH_SECRET?: string } & Record<string, unknown>;
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };
type FetchHandler = { fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> };
type RequestCf = { country?: string };

type EventRow = {
  type: "page_view" | "session_start" | "error";
  path: string;
  method: string;
  status: number | null;
  durationMs: number | null;
  anonId: string | null;
  certSlug: string | null;
  country: string | null;
  device: string;
  referrerHost: string | null;
  isBot: boolean;
};

const EVENT_COLUMNS = ["type", "path", "method", "status", "durationMs", "userId", "anonId", "certSlug", "country", "device", "referrerHost", "isBot"] as const;
const SESSION_COOKIE_NAMES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

let failedWrites = 0;

// Reads the signed-in user's ID from the NextAuth session cookie, or null for anonymous visitors.
async function userIdFromSession(cookieHeader: string | null, secret: string | undefined) {
  if (!cookieHeader || !secret) return null;
  for (const name of SESSION_COOKIE_NAMES) {
    let token = readCookie(cookieHeader, name);
    if (!token) {
      // Large session tokens are split into numbered chunks.
      const chunks: string[] = [];
      for (let index = 0; ; index += 1) {
        const chunk = readCookie(cookieHeader, `${name}.${index}`);
        if (!chunk) break;
        chunks.push(chunk);
      }
      token = chunks.join("") || undefined;
    }
    if (!token) continue;
    try {
      const payload = await decode({ token, secret });
      const id = payload?.id ?? payload?.sub;
      return typeof id === "string" ? id : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function writeEvents(env: Env, events: EventRow[], cookieHeader: string | null) {
  try {
    if (!env.DATABASE_URL) return;
    configureNeonForLocal(env.DATABASE_URL);
    const userId = await userIdFromSession(cookieHeader, env.NEXTAUTH_SECRET);
    const values: unknown[] = [];
    const rows = events.map((event) => {
      const row = { ...event, userId };
      const placeholders = EVENT_COLUMNS.map((column) => {
        values.push(row[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const columns = EVENT_COLUMNS.map((column) => `"${column}"`).join(", ");
    await neon(env.DATABASE_URL).query(`INSERT INTO "Event" (${columns}) VALUES ${rows.join(", ")}`, values);
  } catch (error) {
    failedWrites += 1;
    console.error(`analytics: event write failed (${failedWrites} so far)`, error);
  }
}

function cookieAttributes(url: URL) {
  return `Path=/; SameSite=Lax; HttpOnly${url.protocol === "https:" ? "; Secure" : ""}`;
}

// Wraps the OpenNext handler to log page views and server errors, and adds the daily maintenance cron.
export function createWorker(next: FetchHandler) {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
      const url = new URL(request.url);
      const kind = classifyRequest(request.method, url.pathname, request.headers);
      if (kind === "skip") return next.fetch(request, env, ctx);

      const started = Date.now();
      const cookieHeader = request.headers.get("cookie");
      const userAgent = request.headers.get("user-agent");
      const isBot = isBotUserAgent(userAgent);
      const existingAnonId = validAnonId(readCookie(cookieHeader, ANON_COOKIE));
      const anonId = existingAnonId ?? (isBot ? null : crypto.randomUUID());
      const base = {
        path: url.pathname.slice(0, 300),
        method: request.method,
        anonId,
        certSlug: url.pathname.match(/^\/practice\/([a-z0-9-]+)/)?.[1] ?? null,
        country: (request as Request & { cf?: RequestCf }).cf?.country ?? null,
        device: deviceFromUserAgent(userAgent),
        referrerHost: referrerHost(request.headers.get("referer"), url.hostname),
        isBot,
      };

      let response: Response;
      try {
        response = await next.fetch(request, env, ctx);
      } catch (error) {
        ctx.waitUntil(writeEvents(env, [{ ...base, type: "error", status: 500, durationMs: Date.now() - started }], cookieHeader));
        throw error;
      }
      const durationMs = Date.now() - started;

      if (kind === "api") {
        if (response.status >= 500) ctx.waitUntil(writeEvents(env, [{ ...base, type: "error", status: response.status, durationMs }], cookieHeader));
        return response;
      }

      const newSession = !isBot && !readCookie(cookieHeader, SESSION_COOKIE);
      const events: EventRow[] = [{ ...base, type: "page_view", status: response.status, durationMs }];
      if (newSession) events.unshift({ ...base, type: "session_start", status: null, durationMs: null });
      ctx.waitUntil(writeEvents(env, events, cookieHeader));

      if (isBot || (existingAnonId && !newSession)) return response;
      const withCookies = new Response(response.body, response);
      if (!existingAnonId && anonId) withCookies.headers.append("Set-Cookie", `${ANON_COOKIE}=${anonId}; Max-Age=${ANON_COOKIE_MAX_AGE}; ${cookieAttributes(url)}`);
      if (newSession) withCookies.headers.append("Set-Cookie", `${SESSION_COOKIE}=1; ${cookieAttributes(url)}`);
      return withCookies;
    },

    async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext) {
      ctx.waitUntil(runDailyMaintenance(env.DATABASE_URL).then(
        (result) => console.log(`analytics: rolled up ${result.rolledDays.length} day(s), deleted ${result.deletedEvents} old event(s)`),
        (error: unknown) => console.error("analytics: daily maintenance failed", error),
      ));
    },
  };
}
