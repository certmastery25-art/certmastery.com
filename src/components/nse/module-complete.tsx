"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

export function ModuleComplete({ moduleId, initial }: { moduleId: string; initial: boolean }) {
  const [completed, setCompleted] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/nse/modules/${moduleId}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completed: !completed }) }).catch(() => null);
    if (response?.ok) setCompleted(!completed);
    else setError("We couldn't save that. Try again.");
    setPending(false);
  }

  return (
    <div>
      <button className="button button-secondary" type="button" onClick={() => void toggle()} disabled={pending} aria-pressed={completed}>
        {completed ? <CheckCircle2 size={16} /> : <Circle size={16} />} {completed ? "Studied" : "Mark as studied"}
      </button>
      {error && <p className="form-alert" role="alert">{error}</p>}
    </div>
  );
}
