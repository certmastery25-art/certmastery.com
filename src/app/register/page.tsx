import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create a free account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const requiresAccount = reason === "account-required";
  return <main className="auth-page"><section className="auth-aside"><p className="eyebrow">YOUR NEXT MILESTONE</p><h1>{requiresAccount ? "Your practice starts here." : "Make your study time count."}</h1><p>{requiresAccount ? "Create a free account or sign in to access practice questions and hands-on labs, and to track your progress." : "Keep your scores, quiz history, and weak areas together in one place."}</p></section><section className="auth-main"><div className="auth-panel"><p className="eyebrow">START FOR FREE</p><h2>Create your account</h2><p className="auth-intro">No credit card. No trial period. Just better prep.</p><AuthForm mode="register" /></div></section></main>;
}