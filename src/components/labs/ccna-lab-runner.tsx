"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CornerDownLeft, LoaderCircle, Monitor, Network, RotateCcw, Server, Terminal } from "lucide-react";
import { consoleDevices, createLabState, findCcnaLab, isLabComplete, isLabTaskComplete, promptForState, runLabCommand } from "@/lib/labs/ccna";
import type { LabState } from "@/lib/labs/engine/types";

type TerminalLine = { command?: string; prompt?: string; output: string };

const storageKey = (slug: string) => `certmastery:lab:${slug}`;

function readSaved(slug: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(slug: string, commands: string[]) {
  try {
    if (commands.length) window.localStorage.setItem(storageKey(slug), JSON.stringify(commands));
    else window.localStorage.removeItem(storageKey(slug));
  } catch {
    // Storage can be unavailable (private mode); the lab still works without it.
  }
}

export function CcnaLabRunner({ labSlug }: { labSlug: string }) {
  const lab = findCcnaLab(labSlug)!;
  const devices = useMemo(() => consoleDevices(lab), [lab]);
  const [state, setState] = useState<LabState>(() => createLabState(lab));
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [lines, setLines] = useState<TerminalLine[]>([{ output: `Connected to ${lab.device}. Type ? for help, or connect <device> to switch consoles.` }]);
  const [input, setInput] = useState("");
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completionSubmitted, setCompletionSubmitted] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const taskStatus = useMemo(() => Object.fromEntries(lab.tasks.map((task) => [task.id, isLabTaskComplete(lab, task.id, state)])), [lab, state]);
  const complete = useMemo(() => isLabComplete(lab, state), [lab, state]);
  const doneCount = Object.values(taskStatus).filter(Boolean).length;
  const activeKind = devices.find((device) => device.name === state.active)?.kind;

  useEffect(() => {
    const restored = readSaved(lab.slug);
    if (!restored.length) return;
    let next = createLabState(lab);
    for (const command of restored) next = runLabCommand(lab, next, command, { fast: true }).state;
    setState(next);
    setHistory(restored);
    setLines((current) => [...current, { output: `Restored your previous session (${restored.length} commands). Use Reset to start over.` }]);
    if (isLabComplete(lab, next)) setCompletionSubmitted(true);
  }, [lab]);

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
    const prompt = promptForState(state);
    const result = runLabCommand(lab, state, command);
    setHistory(nextHistory);
    setCursor(null);
    setState(result.state);
    setLines((current) => [...current, { command, prompt, output: result.output }].slice(-400));
    setInput("");
    writeSaved(lab.slug, nextHistory);
    if (isLabComplete(lab, result.state) && !completionSubmitted) void submitCommands(nextHistory);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    executeCommand(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const typed = history.filter((command) => !/^connect\s/i.test(command));
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = cursor === null ? typed.length - 1 : Math.max(0, cursor - 1);
      if (next >= 0) { setCursor(next); setInput(typed[next] ?? ""); }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (cursor === null) return;
      const next = cursor + 1;
      if (next >= typed.length) { setCursor(null); setInput(""); } else { setCursor(next); setInput(typed[next]); }
    }
  }

  function resetLab() {
    setState(createLabState(lab));
    setHistory([]);
    setCursor(null);
    setLines([{ output: `Lab reset. Connected to ${lab.device}. Type ? for help.` }]);
    setInput("");
    setError("");
    setActiveHint(null);
    setSaved(false);
    setCompletionSubmitted(false);
    writeSaved(lab.slug, []);
  }

  function switchDevice(name: string) {
    if (name === state.active) return;
    executeCommand(`connect ${name}`);
    inputRef.current?.focus();
  }

  const deviceIcon = (kind: string) => (kind === "host" ? <Monitor size={13} /> : kind === "router" ? <Network size={13} /> : <Server size={13} />);

  return (
    <section className="lab-terminal-panel" aria-label="Network device command line">
      <div className="lab-terminal-header"><span><Terminal size={16} /> TERMINAL <i /></span><button type="button" onClick={resetLab} disabled={saving}><RotateCcw size={14} /> Reset</button></div>
      {devices.length > 1 && (
        <div className="lab-device-tabs" role="tablist" aria-label="Device consoles">
          {devices.map((device) => (
            <button key={device.name} type="button" role="tab" aria-selected={state.active === device.name} className={state.active === device.name ? "lab-device-tab-active" : ""} onClick={() => switchDevice(device.name)} disabled={saving}>
              {deviceIcon(device.kind)} {device.name}
            </button>
          ))}
        </div>
      )}
      <div className="lab-terminal" ref={terminalRef} role="log" aria-live="polite" onClick={() => inputRef.current?.focus()}>
        <div className="terminal-device-label">{activeKind === "host" ? `${state.active} · Command Prompt` : `Connected to ${state.active} · Cisco IOS simulator`}</div>
        {lines.map((line, index) => <div className="terminal-entry" key={index}>{line.command !== undefined && <div className="terminal-command"><span>{line.prompt}</span> {line.command}</div>}{line.output && <pre>{line.output}</pre>}</div>)}
        <form className="terminal-input-row" onSubmit={handleSubmit}>
          <label className="terminal-prompt" htmlFor="lab-command">{promptForState(state)}</label>
          <input ref={inputRef} id="lab-command" autoComplete="off" autoCapitalize="off" spellCheck={false} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} aria-label={`Enter a command on ${state.active}`} />
          <button type="submit" aria-label="Run command" disabled={saving || !input.trim()}><CornerDownLeft size={16} /></button>
        </form>
      </div>
      <div className="lab-terminal-footer">
        <span><i /> {state.active} ready</span>
        <span>↑ ↓ history · ? help · connect &lt;device&gt;</span>
      </div>
      {error && <p className="form-alert lab-error" role="alert">{error}</p>}
      <div className="lab-progress">
        <div className="lab-progress-heading"><strong>Lab checklist</strong><span>{doneCount} / {lab.tasks.length} tasks</span></div>
        <ol>{lab.tasks.map((task, index) => {
          const done = taskStatus[task.id];
          return <li key={task.id} className={done ? "lab-task-done" : ""}>
            <button type="button" onClick={() => setActiveHint(activeHint === task.id ? null : task.id)} aria-expanded={activeHint === task.id}>
              <span className="lab-check">{done ? <CheckCircle2 size={16} /> : String(index + 1).padStart(2, "0")}</span>
              <span>{task.instruction}</span>
            </button>
            {activeHint === task.id && <p>{task.hint}</p>}
          </li>;
        })}</ol>
      </div>
      {complete && <div className="lab-complete-banner" role="status"><CheckCircle2 size={20} /><div><strong>Lab complete</strong><p>{saved ? "Your completion is saved to your progress." : saving ? "Saving your completion…" : completionSubmitted ? "Sign in to save this lab to your account." : "Your configuration meets the lab requirements."}</p></div>{saving ? <LoaderCircle className="spin" size={18} /> : <Link href="/labs">All labs <ArrowRight size={15} /></Link>}</div>}
      <p className="lab-domain-link">Build on this skill with <Link href="/practice/ccna">CCNA practice questions <ArrowRight size={13} /></Link></p>
    </section>
  );
}
