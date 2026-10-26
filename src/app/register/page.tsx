import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create a free account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const reachedQuestionLimit = reason === "question-limit";
  return <main className="auth-page"><section className="auth-aside"><p className="eyebrow">YOUR NEXT MILESTONE</p><h1>{reachedQuestionLimit ? "Keep your momentum going." : "Make your study time count."}</h1><p>{reachedQuestionLimit ? "You’ve completed your 10 free questions. Create an account to continue exploring the question bank, labs, and more." : "Keep your scores, quiz history, and weak areas together in one place."}</p><span className="auth-aside-stamp">02 / CREATE ACCOUNT</span></section><section className="auth-main"><div className="auth-panel"><p className="eyebrow">START FOR FREE</p><h2>Create your account</h2><p className="auth-intro">No credit card. No trial period. Just better prep.</p><AuthForm mode="register" /></div></section></main>;
}