import { converge, snapshot } from "./converge";
import { ospfAdjacency } from "./l3";
import { createDevice, type DeviceSpec } from "./device";
import { executeLine, promptFor, type CommandResult } from "./cli";
import type { CliContext, LabState, Link } from "./types";

export type CommandInfo = { device: string; id?: string; args: (string | undefined)[]; result?: CommandResult };

export type LabTask = {
  id: string;
  title: string;
  instruction: string;
  hint: string;
  /** Configuration or behaviour that must hold in the current state. */
  check?: (state: LabState) => boolean;
  /** A command the learner has to run, on a given device, while a condition holds. */
  verify?: { device: string; command: string | string[]; when?: (state: LabState, info: CommandInfo) => boolean };
};

export type TopologyKind = "router" | "switch" | "l3switch" | "pc" | "server" | "hub" | "cloud";
export type LabDefinition = {
  slug: string;
  title: string;
  description: string;
  domain: string;
  objective: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  durationMinutes: number;
  device: string;
  scenario: string;
  devices: DeviceSpec[];
  links: Link[];
  layout: Record<string, { x: number; y: number; kind: TopologyKind; label?: string }>;
  bootstrap: Record<string, string[]>;
  tasks: LabTask[];
};

const freshCli = (host: boolean): CliContext => ({ mode: host ? "host" : "user", ifaces: [], enteredConfig: false });

const initialCache = new Map<string, LabState>();

/** Builds the starting network by running each device's bootstrap through the real CLI. */
export function createLabState(lab: LabDefinition): LabState {
  const cached = initialCache.get(lab.slug);
  if (cached) return structuredClone(cached);
  const state: LabState = { active: lab.device, devices: {}, cli: {}, links: lab.links, verified: [], tick: 0 };
  for (const spec of lab.devices) {
    state.devices[spec.name] = createDevice(spec);
    state.cli[spec.name] = freshCli(spec.kind === "host");
  }
  for (const [name, lines] of Object.entries(lab.bootstrap)) {
    const device = state.devices[name];
    const cli: CliContext = { mode: "privileged", ifaces: [], enteredConfig: false };
    for (const line of ["configure terminal", ...lines, "end"]) {
      if (!line.trim() || line.trim().startsWith("!")) continue;
      const result = executeLine({ state, dev: device, cli, promptLength: 0 }, line);
      const informational = /^(% Access VLAN does not exist|% OSPF: Reference bandwidth|%Warning: portfast|Creating a port-channel|Enter configuration)/;
      if (/Invalid input|Incomplete command|Ambiguous command|Unrecognized|Bad mask|overlaps|rejected|^%/m.test(result.output) && !informational.test(result.output)) {
        throw new Error(`Lab ${lab.slug}: bootstrap command "${line}" on ${name} failed: ${result.output}`);
      }
    }
    converge(state);
  }
  converge(state);
  for (const device of Object.values(state.devices)) {
    // Faults present from the start still show up in the log buffer, as they would on a real router.
    device.logs = device.ospf ? ospfAdjacency(state, device.name).problems.map((problem) => problem.message) : [];
    device.pending = [];
  }
  initialCache.set(lab.slug, structuredClone(state));
  return structuredClone(state);
}

export function promptForState(state: LabState) {
  return promptFor(state.devices[state.active], state.cli[state.active]);
}

export function activeEnteredConfig(state: LabState, device: string) {
  return state.cli[device]?.enteredConfig ?? false;
}

export type RunResult = { state: LabState; output: string; info: CommandInfo };

/**
 * Runs one line typed at the terminal. `connect <device>` switches consoles; anything else goes to
 * the active device's CLI. Set `fast` when replaying on the server: no copies and no console logs.
 */
export function runLabCommand(lab: LabDefinition, current: LabState, input: string, options: { fast?: boolean } = {}): RunResult {
  const state = options.fast ? current : structuredClone(current);
  state.tick += 1;
  const line = input.trim();
  const deviceName = state.active;
  const info: CommandInfo = { device: deviceName, args: [] };
  const connect = line.match(/^(?:connect|console)\s+(\S+)$/i);
  if (connect) {
    const target = Object.keys(state.devices).find((name) => name.toLowerCase() === connect[1].toLowerCase());
    if (!target) return { state, output: `% Unknown device ${connect[1]}. Devices: ${Object.keys(state.devices).filter((name) => !state.devices[name].locked && state.devices[name].kind !== "hub").join(", ")}`, info };
    if (state.devices[target].locked || state.devices[target].kind === "hub") return { state, output: `% ${target} is not managed in this lab.`, info };
    state.active = target;
    state.devices[target].pending = [];
    return { state, output: `Connected to ${target} console.`, info: { ...info, id: "connect" } };
  }
  if (!line) return { state, output: "", info };

  const device = state.devices[deviceName];
  const cli = state.cli[deviceName];
  const before = options.fast ? undefined : snapshot(state);
  const executed = executeLine({ state, dev: device, cli, promptLength: promptFor(device, cli).length }, line);
  Object.assign(info, { id: executed.id, args: executed.args });
  if (executed.result) info.result = executed.result;
  if (!executed.id?.startsWith("show")) converge(state, before);

  for (const task of lab.tasks) {
    if (!task.verify || state.verified.includes(task.id) || task.verify.device !== deviceName) continue;
    const wanted = Array.isArray(task.verify.command) ? task.verify.command : [task.verify.command];
    if (!executed.id || !wanted.includes(executed.id)) continue;
    if (task.verify.when && !task.verify.when(state, info)) continue;
    state.verified.push(task.id);
  }

  const logs = options.fast ? [] : device.pending;
  for (const item of Object.values(state.devices)) item.pending = [];
  return { state, output: [executed.output, ...logs].filter(Boolean).join("\n"), info };
}

export function isLabTaskComplete(lab: LabDefinition, taskId: string, state: LabState) {
  const task = lab.tasks.find((item) => item.id === taskId);
  if (!task) return false;
  if (task.verify && !state.verified.includes(task.id)) return false;
  return task.check ? task.check(state) : true;
}

export function isLabComplete(lab: LabDefinition, state: LabState) {
  return lab.tasks.every((task) => isLabTaskComplete(lab, task.id, state));
}
