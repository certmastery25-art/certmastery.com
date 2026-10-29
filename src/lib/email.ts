type Email = {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
};

/** True when the Resend API key and sender address are configured. */
export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL);
}

/** Sends a plain-text email through the Resend HTTP API, which works from Cloudflare Workers. */
export async function sendEmail(email: Email) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL,
      to: email.to,
      subject: email.subject,
      text: email.text,
      reply_to: email.replyTo,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}
