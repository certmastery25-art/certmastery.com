import assert from "node:assert/strict";
import test from "node:test";
import { GUEST_QUESTION_LIMIT, getGuestQuestionCookie, readGuestQuestionCount, signGuestQuestionCount } from "./guest-access";

test("signed guest question counts verify and cannot be increased by editing the cookie", async () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = "test-secret-for-guest-access";

  try {
    const signedCount = await signGuestQuestionCount(GUEST_QUESTION_LIMIT);
    assert.equal(await readGuestQuestionCount(signedCount), GUEST_QUESTION_LIMIT);
    assert.equal(await readGuestQuestionCount(`9.${signedCount.split(".")[1]}`), 0);
    assert.equal(await readGuestQuestionCount("invalid"), 0);
    assert.equal(await readGuestQuestionCount(await signGuestQuestionCount(GUEST_QUESTION_LIMIT + 1)), GUEST_QUESTION_LIMIT);
  } finally {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
  }
});

test("guest question cookie is extracted from the request cookie header", () => {
  assert.equal(
    getGuestQuestionCookie("session=abc; certmaster_guest_questions=10.signature; other=xyz"),
    "10.signature",
  );
  assert.equal(getGuestQuestionCookie(null), undefined);
});
