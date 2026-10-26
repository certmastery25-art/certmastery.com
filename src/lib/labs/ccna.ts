export type LabCliMode = "user" | "privileged" | "config" | "vlan" | "interface";

export type CcnaLabState = {
  mode: LabCliMode;
  enteredConfig: boolean;
  currentInterface: string | null;
  currentVlanId: number | null;
  vlans: { id: number; name: string }[];
  interfaces: Record<string, { mode: "access" | "trunk" | "dynamic"; accessVlan: number }>;
  verified: boolean;
};

export type LabTask = {
  id: string;
  title: string;
  instruction: string;
  hint: string;
};

export const ccnaLabs = [{
  slug: "create-a-vlan",
  title: "Create a VLAN and configure an access port",
  description: "Segment a small office network by creating the Sales VLAN and assigning a switch port to it.",
  domain: "Network Access",
  objective: "2.0",
  difficulty: "Beginner",
  durationMinutes: 8,
  device: "SW1",
  tasks: [
    { id: "configure-mode", title: "Enter configuration mode", instruction: "Move from the user prompt into global configuration mode.", hint: "Use enable, then configure terminal." },
    { id: "create-vlan", title: "Create VLAN 20", instruction: "Create VLAN 20 and name it SALES.", hint: "From global configuration mode, enter vlan 20, then name SALES." },
    { id: "assign-port", title: "Assign the access port", instruction: "Configure GigabitEthernet0/1 as an access port in VLAN 20.", hint: "Enter interface Gi0/1, then set its mode and access VLAN." },
    { id: "verify", title: "Verify the configuration", instruction: "Run show vlan brief and confirm VLAN 20 includes Gi0/1.", hint: "Return to privileged EXEC mode with end, then run show vlan brief." },
  ] satisfies LabTask[],
}] as const;

export type CcnaLabSlug = typeof ccnaLabs[number]["slug"];

export const initialCcnaLabState: CcnaLabState = {
  mode: "user",
  enteredConfig: false,
  currentInterface: null,
  currentVlanId: null,
  vlans: [{ id: 1, name: "default" }],
  interfaces: {},
  verified: false,
};

const requiredInterface = "GigabitEthernet0/1";

export function runCcnaLabCommand(state: CcnaLabState, input: string): { state: CcnaLabState; output: string } {
  const command = input.trim().replace(/\s+/g, " ");
  const lower = command.toLowerCase();
  const next: CcnaLabState = {
    ...state,
    vlans: state.vlans.map((vlan) => ({ ...vlan })),
    interfaces: Object.fromEntries(Object.entries(state.interfaces).map(([name, config]) => [name, { ...config }])),
  };

  if (!command) return { state: next, output: "" };
  if (lower === "help" || lower === "?") {
    return { state: next, output: "Supported commands: enable, configure terminal, vlan <1-4094>, name <name>, interface Gi0/1, switchport mode access, switchport access vlan <id>, exit, end, show vlan brief, show running-config." };
  }
  if (lower === "enable" || lower === "en") {
    if (state.mode !== "user") return { state: next, output: "% Invalid command in this mode." };
    next.mode = "privileged";
    return { state: next, output: "" };
  }
  if (["configure terminal", "configure t", "conf t"].includes(lower)) {
    if (state.mode !== "privileged") return { state: next, output: "% Enter privileged EXEC mode first." };
    next.mode = "config";
    next.enteredConfig = true;
    return { state: next, output: "Enter configuration commands, one per line. End with CNTL/Z." };
  }
  if (lower === "end") {
    if (state.mode === "user") return { state: next, output: "% Invalid command in this mode." };
    next.mode = "privileged";
    next.currentInterface = null;
    next.currentVlanId = null;
    return { state: next, output: "" };
  }
  if (lower === "exit") {
    if (state.mode === "interface" || state.mode === "vlan") {
      next.mode = "config";
      next.currentInterface = null;
      next.currentVlanId = null;
    } else if (state.mode === "config") {
      next.mode = "privileged";
    } else if (state.mode === "privileged") {
      next.mode = "user";
    }
    return { state: next, output: "" };
  }
  const vlanMatch = lower.match(/^vlan\s+(\d{1,4})$/);
  if (vlanMatch) {
    if (state.mode !== "config") return { state: next, output: "% Configure VLANs from global configuration mode." };
    const id = Number(vlanMatch[1]);
    if (id < 1 || id > 4094) return { state: next, output: "% VLAN ID must be between 1 and 4094." };
    if (!next.vlans.some((vlan) => vlan.id === id)) next.vlans.push({ id, name: `VLAN${String(id).padStart(4, "0")}` });
    next.mode = "vlan";
    next.currentVlanId = id;
    return { state: next, output: "" };
  }
  const nameMatch = command.match(/^name\s+(.+)$/i);
  if (nameMatch) {
    if (state.mode !== "vlan") return { state: next, output: "% Enter a VLAN first." };
    const activeVlan = next.vlans.find((item) => item.id === state.currentVlanId);
    if (!activeVlan || activeVlan.id === 1) return { state: next, output: "% Select a user VLAN first." };
    activeVlan.name = nameMatch[1].toUpperCase();
    return { state: next, output: "" };
  }
  const interfaceMatch = lower.match(/^interface\s+(?:gigabitethernet|gi)\s*0\/1$/);
  if (interfaceMatch) {
    if (state.mode !== "config") return { state: next, output: "% Configure interfaces from global configuration mode." };
    next.mode = "interface";
    next.currentInterface = requiredInterface;
    next.interfaces[requiredInterface] ??= { mode: "dynamic", accessVlan: 1 };
    return { state: next, output: "" };
  }
  if (lower === "switchport mode access") {
    if (state.mode !== "interface" || !state.currentInterface) return { state: next, output: "% Enter interface configuration mode first." };
    next.interfaces[state.currentInterface] = { ...next.interfaces[state.currentInterface], mode: "access" };
    return { state: next, output: "" };
  }
  const accessVlanMatch = lower.match(/^switchport access vlan\s+(\d{1,4})$/);
  if (accessVlanMatch) {
    if (state.mode !== "interface" || !state.currentInterface) return { state: next, output: "% Enter interface configuration mode first." };
    const id = Number(accessVlanMatch[1]);
    if (!next.vlans.some((vlan) => vlan.id === id)) return { state: next, output: `% VLAN ${id} does not exist.` };
    next.interfaces[state.currentInterface] = { ...next.interfaces[state.currentInterface], accessVlan: id };
    return { state: next, output: "" };
  }
  if (lower === "show vlan brief" || lower === "sh vlan brief") {
    if (state.mode === "user" || state.mode === "vlan" || state.mode === "interface") return { state: next, output: "% Run show commands from EXEC mode." };
    const correct = next.vlans.some((vlan) => vlan.id === 20 && vlan.name === "SALES")
      && next.interfaces[requiredInterface]?.mode === "access"
      && next.interfaces[requiredInterface]?.accessVlan === 20;
    next.verified = next.verified || correct;
    const rows = next.vlans.sort((a, b) => a.id - b.id).map((vlan) => {
      const ports = Object.entries(next.interfaces).filter(([, config]) => config.mode === "access" && config.accessVlan === vlan.id).map(([name]) => name);
      return `${String(vlan.id).padEnd(8)} ${vlan.name.padEnd(16)} active    ${ports.join(",")}`;
    });
    return { state: next, output: `VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n${rows.join("\n")}` };
  }
  if (lower === "show running-config" || lower === "sh running-config") {
    if (state.mode === "user" || state.mode === "vlan" || state.mode === "interface") return { state: next, output: "% Run show commands from EXEC mode." };
    const lines = ["Current configuration:"];
    for (const vlan of next.vlans.filter((item) => item.id !== 1)) lines.push(`vlan ${vlan.id}`, ` name ${vlan.name}`);
    for (const [name, config] of Object.entries(next.interfaces)) lines.push(`interface ${name}`, ` switchport mode ${config.mode}`, ` switchport access vlan ${config.accessVlan}`);
    return { state: next, output: lines.join("\n") };
  }
  return { state: next, output: "% Invalid input detected. Type help for supported commands." };
}

export function isCcnaLabTaskComplete(taskId: string, state: CcnaLabState) {
  if (taskId === "configure-mode") return state.enteredConfig;
  if (taskId === "create-vlan") return state.vlans.some((vlan) => vlan.id === 20 && vlan.name === "SALES");
  if (taskId === "assign-port") return state.interfaces[requiredInterface]?.mode === "access" && state.interfaces[requiredInterface]?.accessVlan === 20;
  if (taskId === "verify") return state.verified;
  return false;
}

export function isCcnaLabComplete(state: CcnaLabState) {
  return ccnaLabs[0].tasks.every((task) => isCcnaLabTaskComplete(task.id, state));
}

export function promptForMode(mode: LabCliMode) {
  if (mode === "user") return "SW1>";
  if (mode === "privileged") return "SW1#";
  if (mode === "config") return "SW1(config)#";
  if (mode === "vlan") return "SW1(config-vlan)#";
  return "SW1(config-if)#";
}
