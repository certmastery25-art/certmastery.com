import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <main className="auth-page"><section className="auth-aside"><p className="eyebrow">YOUR NEXT MILESTONE</p><h1>Build confidence, one question at a time.</h1><p>Pick up your saved progress and get back to focused practice.</p><span className="auth-aside-stamp">01 / SIGN IN</span></section><section className="auth-main"><div className="auth-panel"><p className="eyebrow">WELCOME BACK</p><h2>Sign in</h2><p className="auth-intro">Your progress will be right where you left it.</p><AuthForm mode="login" /></div></section></main>;
}