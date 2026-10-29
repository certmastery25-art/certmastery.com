"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CircleCheck, LoaderCircle, Send } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Name must be under 80 characters."),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  subject: z.string().trim().min(3, "Enter a subject.").max(120, "Subject must be under 120 characters."),
  message: z.string().trim().min(10, "Write at least 10 characters.").max(5000, "Message must be 5,000 characters or fewer."),
  website: z.string().optional(),
});

type ContactValues = z.infer<typeof schema>;

export function ContactForm() {
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: ContactValues) {
    setFormError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "We couldn't send your message. Please try again.");
      reset();
      setSent(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  if (sent) {
    return (
      <div className="contact-sent" role="status">
        <CircleCheck size={28} aria-hidden="true" />
        <h2>Message sent</h2>
        <p>Thanks for getting in touch. We&apos;ll reply to the email address you gave us.</p>
        <button className="button button-secondary" type="button" onClick={() => setSent(false)}>Send another message</button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="contact-form-row">
        <label className="field-label">Your name
          <input className="text-input" autoComplete="name" placeholder="Alex Morgan" {...register("name")} aria-invalid={!!errors.name} />
          {errors.name && <span className="field-error">{errors.name.message}</span>}
        </label>
        <label className="field-label">Email address
          <input className="text-input" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </label>
      </div>
      <label className="field-label">Subject
        <input className="text-input" placeholder="How can we help?" {...register("subject")} aria-invalid={!!errors.subject} />
        {errors.subject && <span className="field-error">{errors.subject.message}</span>}
      </label>
      <label className="field-label">Message
        <textarea className="text-input text-area" rows={6} placeholder="Tell us a little more..." {...register("message")} aria-invalid={!!errors.message} />
        {errors.message && <span className="field-error">{errors.message.message}</span>}
      </label>
      <label className="contact-honeypot" aria-hidden="true">Website
        <input tabIndex={-1} autoComplete="off" {...register("website")} />
      </label>
      {formError && <p className="form-alert" role="alert">{formError}</p>}
      <button className="button button-primary contact-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
        {isSubmitting ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
