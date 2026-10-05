"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Name must be under 80 characters.").optional(),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(72, "Password must be 72 characters or fewer."),
});

type AuthValues = z.infer<typeof schema>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const isRegister = mode === "register";
  const { register, handleSubmit, formState: { errors } } = useForm<AuthValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: AuthValues) {
    setFormError("");
    setPending(true);
    try {
      if (isRegister) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "We couldn't create your account.");
      }

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!result?.ok) throw new Error("That email and password don't match.");
      router.push("/");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {isRegister && <label className="field-label">Your name
        <input className="text-input" autoComplete="name" placeholder="Alex Morgan" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <span className="field-error">{errors.name.message}</span>}
      </label>}
      <label className="field-label">Email address
        <span className="input-icon"><Mail size={17} aria-hidden="true" /><input className="text-input" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} aria-invalid={!!errors.email} /></span>
        {errors.email && <span className="field-error">{errors.email.message}</span>}
      </label>
      <label className="field-label">Password
        <span className="input-icon"><LockKeyhole size={17} aria-hidden="true" /><input className="text-input" type="password" autoComplete={isRegister ? "new-password" : "current-password"} placeholder="At least 8 characters" {...register("password")} aria-invalid={!!errors.password} /></span>
        {errors.password && <span className="field-error">{errors.password.message}</span>}
      </label>
      {formError && <p className="form-alert" role="alert">{formError}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" size={17} /> : isRegister ? <Check size={17} /> : <ArrowRight size={17} />}
        {pending ? "One moment..." : isRegister ? "Create free account" : "Sign in"}
      </button>
      {googleEnabled && <>
        <div className="auth-divider"><span>or continue with</span></div>
        <button className="button button-secondary google-button" type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>
          <span className="google-g" aria-hidden="true">G</span> Google
        </button>
      </>}
      <p className="auth-switch">
        {isRegister ? "Already have an account? " : "New to Certmaster? "}
        <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
      </p>
      <Link href="/" className="back-link"><ArrowLeft size={15} /> Back to overview</Link>
    </form>
  );
}