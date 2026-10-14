import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ANON_COOKIE, deviceFromUserAgent, isBotUserAgent, normalizeSearch, validAnonId } from "./request-info";

export type AppEventType = "signup" | "login" | "exam_started" | "exam_finished";

type AppEvent = {
  type: AppEventType;
  userId?: string | null;
  certSlug?: string | null;
  mode?: string | null;
  domain?: string | null;
  difficulty?: string | null;
  search?: string | null;
};

let failedWrites = 0;

// Records an app event from a route handler without delaying the response.
// Logging failures are counted and swallowed so they never break a request.
export async function recordEvent(event: AppEvent) {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const userAgent = headerStore.get("user-agent");
    let country: string | null = null;
    let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
    try {
      const context = getCloudflareContext();
      country = (context.cf?.country as string | undefined) ?? null;
      waitUntil = context.ctx.waitUntil.bind(context.ctx);
    } catch {
      // Outside the Workers runtime (next dev); write in the background instead.
    }

    const write = prisma.event.create({
      data: {
        type: event.type,
        userId: event.userId ?? null,
        anonId: validAnonId(cookieStore.get(ANON_COOKIE)?.value) ?? null,
        certSlug: event.certSlug ?? null,
        mode: event.mode ?? null,
        domain: event.domain ?? null,
        difficulty: event.difficulty ?? null,
        search: normalizeSearch(event.search),
        country,
        device: deviceFromUserAgent(userAgent),
        isBot: isBotUserAgent(userAgent),
      },
    }).catch((error: unknown) => {
      failedWrites += 1;
      console.error(`analytics: event write failed (${failedWrites} so far)`, error);
    });

    if (waitUntil) waitUntil(write);
    else void write;
  } catch (error) {
    failedWrites += 1;
    console.error(`analytics: event capture failed (${failedWrites} so far)`, error);
  }
}
