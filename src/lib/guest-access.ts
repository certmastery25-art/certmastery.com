export const GUEST_QUESTION_LIMIT = 10;
export const GUEST_QUESTION_COOKIE = "certmaster_guest_questions";

function getSigningKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be configured to track guest question access.");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export async function signGuestQuestionCount(count: number) {
  const normalizedCount = Math.max(0, Math.min(GUEST_QUESTION_LIMIT, Math.floor(count)));
  const payload = String(normalizedCount);
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function readGuestQuestionCount(value: string | null | undefined) {
  if (!value) return 0;
  const [payload, signature, ...extra] = value.split(".");
  if (extra.length || !/^(0|[1-9]\d*)$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return 0;

  const key = await getSigningKey();
  const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload));
  if (!valid) return 0;
  return Math.min(Number(payload), GUEST_QUESTION_LIMIT);
}

export function getGuestQuestionCookie(cookieHeader: string | null) {
  const prefix = `${GUEST_QUESTION_COOKIE}=`;
  const cookie = cookieHeader?.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return cookie?.slice(prefix.length);
}
