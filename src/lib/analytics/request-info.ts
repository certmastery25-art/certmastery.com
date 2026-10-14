// Request classification shared by the Worker wrapper and route handlers.
// Uses relative imports only, because cloudflare-worker.ts is bundled outside Next.js.

export const ANON_COOKIE = "cm_aid";
export const SESSION_COOKIE = "cm_sid";
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const BOT_PATTERN = /bot|crawl|spider|slurp|scrap|preview|monitor|uptime|headless|lighthouse|facebookexternalhit|embedly|quora link|whatsapp|curl|wget|python-requests|python-urllib|httpx|aiohttp|go-http-client|okhttp|java\/|axios|node-fetch|undici|postman|insomnia|libwww|httpclient/i;

export function isBotUserAgent(userAgent: string | null | undefined) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export function deviceFromUserAgent(userAgent: string | null | undefined): "desktop" | "mobile" | "tablet" {
  if (!userAgent) return "desktop";
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

// Returns the referring host only, or null for direct visits and internal navigation.
export function referrerHost(referrer: string | null | undefined, ownHost: string) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host === ownHost.toLowerCase() ? null : host.slice(0, 120);
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

// Accepts only the IDs this site issues, so a forged cookie cannot inject arbitrary text.
export function validAnonId(value: string | undefined) {
  return value && /^[a-f0-9-]{36}$/.test(value) ? value : undefined;
}

const STATIC_EXTENSION = /\.(?:css|js|mjs|map|json|txt|xml|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|mp4|webm|pdf|webmanifest)$/i;

export type RequestKind = "page" | "api" | "skip";

// Decides whether a request is a page view, an API call, or something not worth logging.
export function classifyRequest(method: string, pathname: string, headers: Headers): RequestKind {
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) return "skip";
  if (pathname.startsWith("/_next") || pathname.startsWith("/__") || STATIC_EXTENSION.test(pathname)) return "skip";
  if (pathname.startsWith("/api/")) return "api";
  if (method !== "GET") return "skip";
  // Client-side navigations fetch React Server Component payloads; count them, but not prefetches.
  if (headers.get("next-router-prefetch") || headers.get("purpose") === "prefetch" || headers.get("sec-purpose")?.includes("prefetch")) return "skip";
  return "page";
}

// Lowercased, trimmed search text with a length cap; empty strings become null.
export function normalizeSearch(search: string | null | undefined) {
  const value = search?.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
  return value ? value : null;
}
