"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

type Props = { base: string; pathway: string; mode: "PRACTICE" | "MOCK" | "READINESS"; module?: string; count?: number; label: string; secondary?: boolean; signedIn: boolean };

export function StartExam({ base, pathway, mode, module, count, label, secondary, signedIn }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (!signedIn) {
      router.push(`/login?reason=account-required&callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/nse/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pathway, mode, module, count }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "We couldn't start this exam.");
      router.push(`${base}/exam/${data.id}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "We couldn't start this exam.");
      setPending(false);
    }
  }

  return (
    <div className="nse-start">
      <button className={`button ${secondary ? "button-secondary" : "button-primary"}`} type="button" onClick={() => void start()} disabled={pending}>
        {pending ? <LoaderCircle className="spin" size={16} /> : null}{label} <ArrowRight size={16} />
      </button>
      {error && <p className="form-alert" role="alert">{error}</p>}
    </div>
  );
}
