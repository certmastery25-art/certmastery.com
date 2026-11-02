// A learning simulator for the FortiOS configuration syntax. It is not FortiOS: it stores what is typed in a tree
// and doesn't validate values the way a FortiGate does. The same code grades in the browser and on the server.
import { z } from "zod";

export const labCheckSchema = z.object({
  /** Config and edit levels, for example ["system interface", "port1"]. */
  path: z.array(z.string().min(1).max(80)).min(1).max(8),
  key: z.string().max(60).optional(),
  /** Case-insensitive; every listed word must appear in the value. */
  includes: z.array(z.string().max(80)).max(8).optional(),
});

export const labDefinitionSchema = z.object({
  hostname: z.string().min(1).max(40),
  /** Commands run before the learner starts. */
  initial: z.array(z.string().max(300)).max(200),
  /** Scripted diagnostic output, matched by command prefix, longest first. */
  outputs: z.array(z.object({ command: z.string().min(1).max(160), output: z.string().max(4000) })).max(30),
  tasks: z.array(z.object({
    id: z.string().min(1).max(40),
    title: z.string().min(1).max(200),
    instruction: z.string().min(1).max(1200),
    commands: z.array(z.string().max(200)).max(40),
    expected: z.string().min(1).max(800),
    hint: z.string().min(1).max(600),
    checks: z.array(labCheckSchema).max(20).default([]),
    /** The learner must also run this command, typed from the start of the line. */
    verify: z.string().max(160).optional(),
  })).min(1).max(20),
});
export type LabDefinition = z.infer<typeof labDefinitionSchema>;
export type LabCheck = z.infer<typeof labCheckSchema>;

type Node = { kind: "config" | "edit"; settings: Record<string, string>; children: Record<string, Node> };
export type LabState = { root: Node; stack: { name: string; kind: "config" | "edit" }[]; ran: string[] };

const emptyNode = (kind: Node["kind"]): Node => ({ kind, settings: {}, children: {} });
const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const MAX_TRANSCRIPT = 500;

function nodeAt(state: LabState) {
  let node = state.root;
  for (const level of state.stack) node = node.children[level.name];
  return node;
}

function promptFor(definition: LabDefinition, state: LabState) {
  const names = state.stack.map((level) => level.kind === "edit" ? `(${level.name})` : `(${level.name.split(" ").at(-1)})`);
  return `${definition.hostname} ${names.join(" ")}${names.length ? " " : ""}# `;
}

function render(node: Node, indent: string): string[] {
  const lines = Object.entries(node.settings).map(([key, value]) => `${indent}set ${key} ${value}`);
  for (const [name, child] of Object.entries(node.children)) {
    const isEdit = child.kind === "edit";
    lines.push(`${indent}${isEdit ? `edit "${name}"` : `config ${name}`}`, ...render(child, `${indent}    `), `${indent}${isEdit ? "next" : "end"}`);
  }
  return lines;
}

/** Splits on spaces, keeping quoted strings together and removing the quotes. */
function tokenise(line: string) {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3]);
}

export function createLabState(definition: LabDefinition): LabState {
  const state: LabState = { root: emptyNode("config"), stack: [], ran: [] };
  for (const line of definition.initial) executeLabLine(definition, state, line);
  state.ran = [];
  return state;
}

/** Runs one line and changes `state` in place. Returns the terminal output. */
export function executeLabLine(definition: LabDefinition, state: LabState, input: string): string {
  const line = input.trim();
  if (!line || line.startsWith("#")) return "";
  if (state.ran.length < MAX_TRANSCRIPT) state.ran.push(normalise(line));
  const [command, ...args] = tokenise(line);
  const verb = command.toLowerCase();
  const node = nodeAt(state);
  const top = state.stack.at(-1);

  switch (verb) {
    case "config": {
      if (!args.length) return "command parse error: config needs a table name";
      const name = args.join(" ").toLowerCase();
      node.children[name] ??= emptyNode("config");
      state.stack.push({ name, kind: "config" });
      return "";
    }
    case "edit": {
      if (top?.kind !== "config") return "command parse error: edit is only valid inside a config table";
      if (args.length !== 1) return "command parse error: edit takes one name";
      node.children[args[0]] ??= emptyNode("edit");
      state.stack.push({ name: args[0], kind: "edit" });
      return "";
    }
    case "set":
    case "append": {
      if (!top) return "command parse error: set is only valid inside a config table";
      if (args.length < 2) return `command parse error: value required for ${args[0] ?? "this setting"}`;
      const [key, ...values] = args;
      const value = values.join(" ");
      node.settings[key] = verb === "append" && node.settings[key] ? `${node.settings[key]} ${value}` : value;
      return "";
    }
    case "unset": {
      if (!top || !args[0]) return "command parse error: unset needs a setting name";
      delete node.settings[args[0]];
      return "";
    }
    case "delete": {
      if (top?.kind !== "config" || !args[0]) return "command parse error: delete is only valid inside a config table";
      delete node.children[args[0]];
      return "";
    }
    case "next": {
      if (top?.kind !== "edit") return "command parse error: next closes an edit";
      state.stack.pop();
      return "";
    }
    case "end": {
      if (!top) return "";
      // As on a FortiGate, end from inside an edit also closes the table around it.
      if (top.kind === "edit") state.stack.pop();
      state.stack.pop();
      return "";
    }
    case "abort": {
      state.stack.length = 0;
      return "(simulator) Left configuration mode. Saved values are kept in this simulator.";
    }
    case "show": {
      if (state.stack.length) return render(node, "").join("\n") || "(nothing configured here)";
      const name = args.filter((arg) => !arg.startsWith("|")).join(" ").toLowerCase();
      const child = state.root.children[name];
      if (!name) return render(state.root, "").join("\n");
      return child ? [`config ${name}`, ...render(child, "    "), "end"].join("\n") : `(simulator) Nothing configured under "${name}".`;
    }
    case "help":
    case "?":
      return "Simulated FortiOS syntax: config, edit, set, append, unset, delete, next, end, show.\nThis lab also has scripted output for: " + (definition.outputs.map((item) => item.command).join("; ") || "no diagnostic commands");
    default: {
      const wanted = normalise(line);
      const scripted = [...definition.outputs].sort((a, b) => b.command.length - a.command.length).find((item) => wanted.startsWith(normalise(item.command)));
      if (scripted) return scripted.output;
      if (["get", "diagnose", "diag", "execute", "exec"].includes(verb)) return `(simulator) This lab has no scripted output for "${line}". Type help to see what it covers.`;
      return "Unknown action 0\nCommand fail. Return code -1";
    }
  }
}

function checkPasses(root: Node, check: LabCheck) {
  let node: Node | undefined = root;
  for (const level of check.path) {
    node = Object.entries(node.children).find(([name]) => name.toLowerCase() === level.toLowerCase())?.[1];
    if (!node) return false;
  }
  if (!check.key) return true;
  const value = node.settings[check.key];
  if (value === undefined) return false;
  const lower = value.toLowerCase();
  return (check.includes ?? []).every((word) => lower.includes(word.toLowerCase()));
}

export function isTaskComplete(definition: LabDefinition, state: LabState, taskId: string) {
  const task = definition.tasks.find((item) => item.id === taskId);
  if (!task) return false;
  if (task.verify && !state.ran.some((line) => line.startsWith(normalise(task.verify!)))) return false;
  return task.checks.every((check) => checkPasses(state.root, check));
}

/** Rebuilds the lab from what was typed, so a client can't simply claim completion. */
export function replayTranscript(definition: LabDefinition, transcript: string[]) {
  const state = createLabState(definition);
  for (const line of transcript.slice(0, MAX_TRANSCRIPT)) executeLabLine(definition, state, line);
  return { state, complete: definition.tasks.every((task) => isTaskComplete(definition, state, task.id)) };
}

export function promptForLab(definition: LabDefinition, state: LabState) {
  return promptFor(definition, state);
}
