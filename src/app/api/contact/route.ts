import { NextResponse } from "next/server";
import { z } from "zod";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { CONTACT_EMAIL, CONTACT_FORM_RECIPIENTS } from "@/lib/site";

// Newlines are stripped from single-line fields so they can't break the email subject or headers.
const singleLine = (max: number) => z.string().trim().max(max).transform((value) => value.replace(/[\r\n]+/g, " "));

const contactSchema = z.object({
  name: singleLine(80).pipe(z.string().min(2)),
  email: z.string().trim().email().max(254),
  subject: singleLine(120).pipe(z.string().min(3)),
  message: z.string().trim().min(10).max(5000),
  // Honeypot: hidden from people, so only bots fill it in.
  website: z.string().max(0).optional(),
});

const fallback = `Please email us at ${CONTACT_EMAIL} instead.`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your name, a valid email, a subject, and a message of at least 10 characters." }, { status: 400 });
  }

  if (!isEmailConfigured()) {
    console.error("Contact form submitted but RESEND_API_KEY or CONTACT_FROM_EMAIL is not set.");
    return NextResponse.json({ error: `Our contact form is temporarily unavailable. ${fallback}` }, { status: 503 });
  }

  const { name, email, subject, message } = parsed.data;
  try {
    await sendEmail({
      to: CONTACT_FORM_RECIPIENTS,
      subject: `CertMastery contact: ${subject}`,
      replyTo: email,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}\n`,
    });
  } catch (error) {
    console.error("Contact form email failed", error);
    return NextResponse.json({ error: `We couldn't send your message. ${fallback}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
