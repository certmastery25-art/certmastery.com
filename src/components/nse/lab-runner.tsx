"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { executeLabLine, isTaskComplete, promptForLab, replayTranscript, type LabDefinition } from "@/lib/nse/lab-engine";

const storageKey = (slug: string) => `nse-lab:${slug}`;

function readSaved(slug: string): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(slug)) ?? "[]");
    return Array.isArray(saved) ? saved.filter((line) => typeof line === "string") : [];
  } catch {
    return [];
  }
}

export function NseLabRunner({ slug, definition, initiallyComplete }: { slug: string; definition: LabDefinition; initiallyComplete: boolean }) {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [output, setOutput] = useState<string[]>(["Simulated FortiOS CLI. This is a learning tool, not a FortiGate. Type help to begin."]);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState(initiallyComplete);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const history = useRef(0);
  const screen = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = readSaved(slug);
    if (previous.length) {
      setTranscript(previous);
      setOutput((lines) => [...lines, `Restored ${previous.length} commands from your last session.`]);
    }
  }, [slug]);

  const { state, complete } = useMemo(() => replayTranscript(definition, transcript), [definition, transcript]);

  useEffect(() => { screen.current?.scrollTo({ top: screen.current.scrollHeight }); }, [output]);
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(slug), JSON.stringify(transcript));
    } catch {
      // The session still works; it just won't survive a reload.
    }
  }, [slug, transcript]);

  useEffect(() => {
    if (!complete || saved || saving) return;
    setSaving(true);
    fetch(`/api/nse/labs/${slug}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transcript }) })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error);
        setSaved(true);
      })
      .catch((saveError) => setError(saveError instanceof Error && saveError.message ? saveError.message : "We couldn't save your completion."))
      .finally(() => setSaving(false));
  }, [complete, saved, saving, slug, transcript]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const line = input;
    setInput("");
    history.current = 0;
    const prompt = promptForLab(definition, state);
    if (transcript.length >= 500) {
      setOutput((lines) => [...lines, "This session has reached its 500-command limit. Reset the lab to continue."]);
      return;
    }
    const result = executeLabLine(definition, structuredClone(state), line);
    setOutput((lines) => [...lines, `${prompt}${line}`, ...(result ? [result] : [])].slice(-400));
    if (line.trim()) setTranscript((lines) => [...lines, line]);
  }

  function reset() {
    setTranscript([]);
    setOutput(["Lab reset. Simulated FortiOS CLI."]);
    setError("");
  }

  const done = definition.tasks.filter((task) => isTaskComplete(definition, state, task.id)).length;

  return (
    <div className="nse-lab-workspace">
      <div className="nse-lab-tasks">
        <div className="nse-lab-progress"><strong>{done} of {definition.tasks.length} tasks complete</strong>{saving ? <span><LoaderCircle className="spin" size={14} /> Saving</span> : saved ? <span className="nse-right"><CheckCircle2 size={14} /> Lab completed</span> : null}</div>
        <ol className="nse-task-list">
          {definition.tasks.map((task) => {
            const finished = isTaskComplete(definition, state, task.id);
            return (
              <li key={task.id} className={finished ? "nse-task-done" : ""}>
                <div className="nse-task-head">{finished ? <CheckCircle2 size={17} className="nse-right" aria-label="Complete" /> : <Circle size={17} aria-label="Not complete" />}<h3>{task.title}</h3></div>
                <p>{task.instruction}</p>
                <details><summary>Hint</summary><p>{task.hint}</p></details>
                <details><summary>Show commands</summary><pre tabIndex={0}><code>{task.commands.join("\n")}</code></pre></details>
                <p className="nse-expected"><strong>Expected:</strong> {task.expected}</p>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="nse-terminal-panel">
        <div className="nse-sim-banner"><TriangleAlert size={15} /> Simulated FortiOS CLI. Not a real FortiGate. Outputs marked (simulated) are scripted.</div>
        <div className="nse-terminal" ref={screen} role="log" aria-label="Terminal output" tabIndex={0}>
          {output.map((line, index) => <pre key={index}>{line}</pre>)}
        </div>
        <form className="nse-terminal-input" onSubmit={submit}>
          <label htmlFor="nse-cli"><code>{promptForLab(definition, state)}</code></label>
          <input
            id="nse-cli"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={300}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              history.current = Math.min(transcript.length, Math.max(0, history.current + (event.key === "ArrowUp" ? 1 : -1)));
              setInput(history.current ? transcript[transcript.length - history.current] : "");
            }}
          />
        </form>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <div className="nse-lab-actions">
          <button className="button button-secondary button-small" type="button" onClick={reset}><RotateCcw size={14} /> Reset lab</button>
          <Link className="text-link" href="/fortinet/labs">All labs</Link>
        </div>
      </div>
    </div>
  );
}
