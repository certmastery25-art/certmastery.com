"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CornerDownLeft, LoaderCircle, RotateCcw, Terminal } from "lucide-react";
import { CcnaLabState, initialCcnaLabState, isCcnaLabComplete, isCcnaLabTaskComplete, LabTask, promptForMode, runCcnaLabCommand } from "@/lib/labs/ccna";

type TerminalLine = { command?: string; prompt?: string; output: string };

export function CcnaLabRunner({ labSlug, tasks }: { labSlug: string; tasks: readonly LabTask[] }) {
  const [state, setState] = useState<CcnaLabState>(initialCcnaLabState);
  const [history, setHistory] = useState<string[]>([]);
  const [lines, setLines] = useState<TerminalLine[]>([{ output: "Welcome to the SW1 simulator. Type help to see supported commands." }]);
  const [input, setInput] = useState("");
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completionSubmitted, setCompletionSubmitted] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [lines]);

  async function submitCommands(commands: string[]) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/labs/${labSlug}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands }),
      });
      const result = await response.json() as { error?: string; saved?: boolean };
      if (!response.ok) throw new Error(result.error ?? "We couldn't save your lab completion.");
      setCompletionSubmitted(true);
      setSaved(Boolean(result.saved));
      setLines((current) => [...current, { output: result.saved ? "Lab complete. Your progress has been saved." : "Lab complete. Sign in to save your lab progress." }]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't save your lab completion.");
    } finally {
      setSaving(false);
    }
  }

  function executeCommand(rawCommand: string) {
    const command = rawCommand.trim();
    if (!command || saving) return;
    const nextHistory = [...history, command];
    const result = runCcnaLabCommand(state, command);
    setHistory(nextHistory);
    setState(result.state);
    setLines((current) => [...current, { command, prompt: promptForMode(state.mode), output: result.output }]);
    setInput("");
    const completed = isCcnaLabComplete(result.state);
    if (completed && !completionSubmitted) void submitCommands(nextHistory);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    executeCommand(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setInput(history.at(-1) ?? "");
    }
  }

  function resetLab() {
    setState(initialCcnaLabState);
    setHistory([]);
    setLines([{ output: "Lab reset. Type help to see supported commands." }]);
    setInput("");
    setError("");
    setActiveHint(null);
    setSaved(false);
    setCompletionSubmitted(false);
  }

  return (
    <section className="lab-terminal-panel" aria-label="Network device command line">
      <div className="lab-terminal-header"><span><Terminal size={16} /> TERMINAL <i /></span><button type="button" onClick={resetLab} disabled={saving}><RotateCcw size={14} /> Reset</button></div>
      <div className="lab-terminal" ref={terminalRef} role="log" aria-live="polite">
        <div className="terminal-device-label">Connected to SW1 · Cisco IOS simulator</div>
        {lines.map((line, index) => <div className="terminal-entry" key={index}>{line.command !== undefined && <div className="terminal-command"><span>{line.prompt}</span> {line.command}</div>}{line.output && <pre>{line.output}</pre>}</div>)}
        <form className="terminal-input-row" onSubmit={handleSubmit}>
          <label className="terminal-prompt" htmlFor="lab-command">{promptForMode(state.mode)}</label>
          <input ref={inputRef} id="lab-command" autoComplete="off" autoCapitalize="off" spellCheck={false} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} aria-label="Enter a switch command" />
          <button type="submit" aria-label="Run command" disabled={saving || !input.trim()}><CornerDownLeft size={16} /></button>
        </form>
      </div>
      <div className="lab-terminal-footer">
        <span><i /> Simulator ready</span>
        <span>Up arrow · previous command</span>
      </div>
      {error && <p className="form-alert lab-error" role="alert">{error}</p>}
      <div className="lab-progress">
        <div className="lab-progress-heading"><strong>Lab checklist</strong><span>{tasks.filter((task) => isCcnaLabTaskComplete(task.id, state)).length} / {tasks.length} tasks</span></div>
        <ol>{tasks.map((task, index) => {
          const complete = isCcnaLabTaskComplete(task.id, state);
          return <li key={task.id} className={complete ? "lab-task-done" : ""}>
            <button type="button" onClick={() => setActiveHint(activeHint === task.id ? null : task.id)} aria-expanded={activeHint === task.id}>
              <span className="lab-check">{complete ? <CheckCircle2 size={16} /> : String(index + 1).padStart(2, "0")}</span>
              <span>{task.instruction}</span>
            </button>
            {activeHint === task.id && <p>{task.hint}</p>}
          </li>;
        })}</ol>
      </div>
      {isCcnaLabComplete(state) && <div className="lab-complete-banner" role="status"><CheckCircle2 size={20} /><div><strong>Lab complete</strong><p>{saved ? "Your completion is saved to your progress." : saving ? "Saving your completion…" : completionSubmitted ? "Sign in to save this lab to your account." : "Your configuration meets the lab requirements."}</p></div>{saving ? <LoaderCircle className="spin" size={18} /> : <Link href="/labs">All labs <ArrowRight size={15} /></Link>}</div>}
      <p className="lab-domain-link">Build on this skill with <Link href="/practice/ccna">CCNA practice questions <ArrowRight size={13} /></Link></p>
    </section>
  );
}
