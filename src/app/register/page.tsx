import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create a free account" };

export default function RegisterPage() {
  return <main className="auth-page"><section className="auth-aside"><p className="eyebrow">YOUR NEXT MILESTONE</p><h1>Make your study time count.</h1><p>Keep your scores, quiz history, and weak areas together in one place.</p><span className="auth-aside-stamp">02 / CREATE ACCOUNT</span></section><section className="auth-main"><div className="auth-panel"><p className="eyebrow">START FOR FREE</p><h2>Create your account</h2><p className="auth-intro">No credit card. No trial period. Just better prep.</p><AuthForm mode="register" /></div></section></main>;
}