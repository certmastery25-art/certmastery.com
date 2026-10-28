import { formatAddr, formatIpv4, lenToMask, maskBits, maskToLen, network, parseAddr, parseIpv4, parseIpv6, parseIpv6Prefix, sameSubnet, isLinkLocal } from "./addr";
import { expandRange, newIface, parentIf, parseIfName, shortIf } from "./device";
import { spanningTree } from "./l2";
import { dhcpRenew, forward, hostV6, logTo, ospfAdjacency, probe, remoteLogin, hostNic, type Trace } from "./l3";
import * as show from "./show";
import type { AclEntry, ChannelMode, CliContext, Device, DeviceKind, Iface, LabState, Mode, PortMatch } from "./types";

export type CommandResult = { ok: boolean; target?: string };
export type Ctx = { state: LabState; dev: Device; cli: CliContext; result?: CommandResult; promptLength: number };
export type Executed = { output: string; id?: string; args: (string | undefined)[]; result?: CommandResult };

type ArgKind = "word" | "num" | "ipv4" | "ipv6" | "v6prefix" | "addr" | "if" | "rest" | "list";
type PNode = { t: "kw"; words: string[]; capture: boolean } | { t: "arg"; kind: ArgKind; label: string } | { t: "opt"; nodes: PNode[] };
type Handler = (c: Ctx, args: (string | undefined)[]) => string | void;
type Command = { id: string; modes: Mode[]; nodes: PNode[]; help: string; kinds?: DeviceKind[]; run: Handler };

const EXEC: Mode[] = ["user", "privileged"];
const PRIV: Mode[] = ["privileged"];
const CONF: Mode[] = ["config"];
const IFM: Mode[] = ["interface", "subif"];
const SUBMODES: Mode[] = ["interface", "subif", "vlan", "router-ospf", "line", "dhcp", "std-acl", "ext-acl"];
const CONFIG_MODES: Mode[] = ["config", ...SUBMODES];
const SWITCHES: DeviceKind[] = ["switch", "l3switch"];
const ROUTERS: DeviceKind[] = ["router", "l3switch"];
const NET: DeviceKind[] = ["router", "switch", "l3switch"];

function parsePattern(pattern: string): PNode[] {
  const tokens = pattern.split(" ");
  let index = 0;
  const parseSeq = (): PNode[] => {
    const nodes: PNode[] = [];
    while (index < tokens.length) {
      const token = tokens[index];
      index += 1;
      if (token === "]") return nodes;
      if (token === "[") nodes.push({ t: "opt", nodes: parseSeq() });
      else if (token.startsWith("<")) nodes.push({ t: "arg", kind: token.slice(1, -1).split(":")[0] as ArgKind, label: token });
      else if (token.startsWith("{")) nodes.push({ t: "kw", words: token.slice(1, -1).split("|"), capture: true });
      else nodes.push({ t: "kw", words: [token], capture: false });
    }
    return nodes;
  };
  return parseSeq();
}

const countCaptures = (nodes: PNode[]): number => nodes.reduce((sum, node) => sum + (node.t === "opt" ? countCaptures(node.nodes) : node.t === "arg" || node.capture ? 1 : 0), 0);

function argValue(kind: ArgKind, tokens: string[], index: number): { value: string; used: number } | null {
  const token = tokens[index];
  if (token === undefined) return null;
  switch (kind) {
    case "word": return { value: token, used: 1 };
    case "num": return /^\d+$/.test(token) ? { value: token, used: 1 } : null;
    case "ipv4": return parseIpv4(token) !== null ? { value: token, used: 1 } : null;
    case "ipv6": return parseIpv6(token) !== null ? { value: token, used: 1 } : null;
    case "v6prefix": return parseIpv6Prefix(token) ? { value: token, used: 1 } : null;
    case "addr": return parseAddr(token) ? { value: token, used: 1 } : null;
    case "list": return /^[\d,-]+$/.test(token) ? { value: token, used: 1 } : null;
    case "rest": return { value: tokens.slice(index).join(" "), used: tokens.length - index };
    case "if": {
      const single = parseIfName(token);
      if (single) return { value: single, used: 1 };
      const double = tokens[index + 1] !== undefined ? parseIfName(token + tokens[index + 1]) : null;
      return double ? { value: double, used: 2 } : null;
    }
  }
}

type MatchOutcome = { caps: (string | undefined)[]; exact: number } | null;
type Progress = { furthest: number; incomplete: boolean };

function matchNodes(nodes: PNode[], tokens: string[], ti: number, caps: (string | undefined)[], exact: number, progress: Progress): MatchOutcome {
  if (!nodes.length) {
    if (ti === tokens.length) return { caps, exact };
    progress.furthest = Math.max(progress.furthest, ti);
    return null;
  }
  const [node, ...rest] = nodes;
  if (node.t === "opt") {
    return matchNodes([...node.nodes, ...rest], tokens, ti, caps, exact, progress)
      ?? matchNodes(rest, tokens, ti, [...caps, ...Array<undefined>(countCaptures(node.nodes)).fill(undefined)], exact, progress);
  }
  if (ti >= tokens.length) {
    progress.incomplete = true;
    progress.furthest = Math.max(progress.furthest, ti);
    return null;
  }
  if (node.t === "kw") {
    const typed = tokens[ti].toLowerCase();
    const word = node.words.find((item) => item === typed) ?? node.words.find((item) => item.startsWith(typed));
    if (!word) { progress.furthest = Math.max(progress.furthest, ti); return null; }
    return matchNodes(rest, tokens, ti + 1, node.capture ? [...caps, word] : caps, exact + (word === typed ? 1 : 0), progress);
  }
  const value = argValue(node.kind, tokens, ti);
  if (!value) { progress.furthest = Math.max(progress.furthest, ti); return null; }
  return matchNodes(rest, tokens, ti + value.used, [...caps, value.value], exact + 1, progress);
}

const commands: Command[] = [];
function cmd(modes: Mode[], pattern: string, help: string, run: Handler, kinds?: DeviceKind[], id?: string) {
  commands.push({ id: id ?? pattern.replace(/\s*\[.*$/, "").replace(/<[^>]+>/g, "").replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim(), modes, nodes: parsePattern(pattern), help, kinds, run });
}

// ---------- helpers ----------

const invalid = "% Invalid input detected at '^' marker.";
const selected = (c: Ctx) => c.cli.ifaces.map((name) => c.dev.interfaces[name]).filter(Boolean);
const isSwitchDevice = (device: Device) => device.kind === "switch" || device.kind === "l3switch";

function parseVlans(text: string): number[] | null {
  const vlans: number[] = [];
  for (const part of text.split(",")) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return null;
    const first = Number(match[1]);
    const last = match[2] ? Number(match[2]) : first;
    if (first < 1 || last > 4094 || last < first) return null;
    for (let vlan = first; vlan <= last; vlan += 1) vlans.push(vlan);
  }
  return vlans;
}

/** Applies a change to every selected interface, and to members of a selected port-channel. */
function eachL2(c: Ctx, change: (iface: Iface) => void) {
  for (const iface of selected(c)) {
    change(iface);
    if (iface.name.startsWith("Port-channel")) {
      const id = Number(iface.name.slice("Port-channel".length));
      for (const member of Object.values(c.dev.interfaces)) if (member.channelGroup?.id === id) change(member);
    }
  }
}

function ipv4Of(text: string) { return parseIpv4(text)!; }

function wildcardOrMask(value: bigint) {
  // IOS accepts a subnet mask where a wildcard is expected and inverts it.
  return value >> BigInt(24) === BigInt(255) ? value ^ BigInt(0xffffffff) : value;
}

function exitToConfig(c: Ctx) {
  c.cli.mode = "config";
  c.cli.ifaces = [];
  c.cli.vlan = undefined;
  c.cli.pool = undefined;
  c.cli.acl = undefined;
  c.cli.line = undefined;
}

function leaveConfig(c: Ctx) {
  exitToConfig(c);
  c.cli.mode = "privileged";
  logTo(c.state, c.dev.name, "%SYS-5-CONFIG_I: Configured from console by console");
}

// ---------- ACL parsing ----------

const PORTS: Record<string, number> = { www: 80, http: 80, https: 443, telnet: 23, ssh: 22, domain: 53, ntp: 123, bootps: 67, bootpc: 68, ftp: 21, smtp: 25, tftp: 69, snmp: 161, syslog: 514 };

function parseAclAddress(tokens: string[], index: number, standard: boolean): { spec: { addr: bigint; wildcard: bigint }; next: number } | null {
  const token = tokens[index]?.toLowerCase();
  if (token === undefined) return null;
  if (token === "any") return { spec: { addr: BigInt(0), wildcard: BigInt(0xffffffff) }, next: index + 1 };
  if (token === "host") {
    const addr = parseIpv4(tokens[index + 1] ?? "");
    return addr === null ? null : { spec: { addr, wildcard: BigInt(0) }, next: index + 2 };
  }
  const addr = parseIpv4(token);
  if (addr === null) return null;
  const wildcard = parseIpv4(tokens[index + 1] ?? "");
  if (wildcard === null) return standard ? { spec: { addr, wildcard: BigInt(0) }, next: index + 1 } : null;
  return { spec: { addr: addr & ~wildcard & BigInt(0xffffffff), wildcard }, next: index + 2 };
}

function parsePortMatch(tokens: string[], index: number): { match?: PortMatch; next: number } | null {
  const op = tokens[index]?.toLowerCase();
  if (!op || !["eq", "neq", "gt", "lt", "range"].includes(op)) return { next: index };
  const ports: number[] = [];
  let cursor = index + 1;
  const portValue = (token: string | undefined) => token === undefined ? undefined : /^\d+$/.test(token) ? Number(token) : PORTS[token.toLowerCase()];
  const limit = op === "range" ? 2 : op === "eq" || op === "neq" ? 10 : 1;
  while (ports.length < limit) {
    const value = portValue(tokens[cursor]);
    if (value === undefined || value > 65535) break;
    ports.push(value);
    cursor += 1;
  }
  if (!ports.length || (op === "range" && ports.length !== 2)) return null;
  return { match: { op: op as PortMatch["op"], ports }, next: cursor };
}

export function parseAclEntry(kind: "standard" | "extended", tokens: string[]): Omit<AclEntry, "seq" | "matches" | "text"> | null {
  const action = tokens[0]?.toLowerCase();
  if (action !== "permit" && action !== "deny") return null;
  if (kind === "standard") {
    const source = parseAclAddress(tokens, 1, true);
    if (!source) return null;
    const log = tokens[source.next]?.toLowerCase() === "log";
    if (source.next + (log ? 1 : 0) !== tokens.length) return null;
    return { action, protocol: "ip", src: source.spec, dst: { addr: BigInt(0), wildcard: BigInt(0xffffffff) }, log };
  }
  const protocol = tokens[1]?.toLowerCase();
  if (protocol !== "ip" && protocol !== "icmp" && protocol !== "tcp" && protocol !== "udp") return null;
  const source = parseAclAddress(tokens, 2, false);
  if (!source) return null;
  const ported = protocol === "tcp" || protocol === "udp";
  const srcPort = ported ? parsePortMatch(tokens, source.next) : { next: source.next };
  if (!srcPort) return null;
  const destination = parseAclAddress(tokens, srcPort.next, false);
  if (!destination) return null;
  const dstPort = ported ? parsePortMatch(tokens, destination.next) : { next: destination.next };
  if (!dstPort) return null;
  let cursor = dstPort.next;
  let icmpType: AclEntry["icmpType"];
  let established = false;
  let log = false;
  while (cursor < tokens.length) {
    const token = tokens[cursor].toLowerCase();
    if (protocol === "icmp" && (token === "echo" || token === "echo-reply")) icmpType = token;
    else if (protocol === "tcp" && token === "established") established = true;
    else if (token === "log") log = true;
    else return null;
    cursor += 1;
  }
  return { action, protocol, src: source.spec, dst: destination.spec, srcPort: "match" in srcPort ? srcPort.match : undefined, dstPort: "match" in dstPort ? dstPort.match : undefined, icmpType, established, log };
}

function addAclEntry(device: Device, name: string, kind: "standard" | "extended", numbered: boolean, tokens: string[], seq?: number) {
  const parsed = parseAclEntry(kind, tokens);
  if (!parsed) return invalid;
  const acl = (device.acls[name] ??= { kind, numbered, entries: [] });
  if (acl.kind !== kind) return `% ${name} is not a ${kind} access list`;
  const sequence = seq ?? ((acl.entries[acl.entries.length - 1]?.seq ?? 0) + 10);
  if (acl.entries.some((entry) => entry.seq === sequence)) return "% Duplicate sequence number";
  acl.entries.push({ ...parsed, seq: sequence, matches: 0, text: show.aclEntryText(kind, parsed) });
  acl.entries.sort((a, b) => a.seq - b.seq);
}

const aclKindForNumber = (value: number): "standard" | "extended" | null => (value >= 1 && value <= 99) || (value >= 1300 && value <= 1999) ? "standard" : (value >= 100 && value <= 199) || (value >= 2000 && value <= 2699) ? "extended" : null;

// ---------- EXEC ----------

cmd(["user"], "enable", "Turn on privileged commands", (c) => { c.cli.mode = "privileged"; });
cmd(PRIV, "disable", "Turn off privileged commands", (c) => { c.cli.mode = "user"; });
cmd(EXEC, "exit", "Exit from the EXEC", (c) => { c.cli.mode = "user"; }, undefined, "exit");
cmd(EXEC, "logout", "Exit from the EXEC", (c) => { c.cli.mode = "user"; });
cmd(PRIV, "configure terminal", "Configure from the terminal", (c) => {
  c.cli.mode = "config";
  c.cli.enteredConfig = true;
  return "Enter configuration commands, one per line.  End with CNTL/Z.";
});
cmd(PRIV, "copy running-config startup-config", "Save the running configuration", (c) => {
  c.dev.startupConfig = show.runningConfig(c.dev);
  return "Destination filename [startup-config]? \nBuilding configuration...\n[OK]";
});
cmd(PRIV, "write [ memory ]", "Write running configuration to memory", (c) => {
  c.dev.startupConfig = show.runningConfig(c.dev);
  return "Building configuration...\n[OK]";
}, undefined, "copy running-config startup-config");
cmd(PRIV, "clear ip ospf process", "Reset OSPF processes", (c) => {
  if (!c.dev.ospf) return "";
  c.dev.ospf.activeRid = undefined;
  return "Reset ALL OSPF processes? [no]: yes";
}, ROUTERS);
cmd(PRIV, "clear ip nat translation *", "Clear dynamic NAT translations", (c) => { c.dev.natTranslations = []; }, ["router"]);
cmd(PRIV, "clear access-list counters", "Clear access list statistic counters", (c) => {
  for (const acl of Object.values(c.dev.acls)) for (const entry of acl.entries) entry.matches = 0;
}, NET);
cmd(PRIV, "clear ip dhcp binding *", "Clear DHCP bindings", (c) => { c.dev.dhcpBindings = []; }, ROUTERS);

function pingOutput(c: Ctx, target: string, sourceIf?: string) {
  const parsed = parseAddr(target);
  if (!parsed) return "% Unrecognized host or address, or protocol not running.";
  const result = probe(c.state, c.dev.name, parsed.family, parsed.addr, "icmp", 0, sourceIf);
  c.result = { ok: result.ok, target: formatAddr(parsed.family, parsed.addr, false) };
  if (!result.ok && result.out.reason === "dai") logDai(c, result.out);
  const lines = ["Type escape sequence to abort.", `Sending 5, 100-byte ICMP Echos to ${formatAddr(parsed.family, parsed.addr)}, timeout is 2 seconds:`];
  if (sourceIf) lines.push(`Packet sent with a source address of ${formatAddr(parsed.family, result.out.pkt.src)}`);
  if (result.out.reason === "no-source") return "% No valid source address for destination";
  const failedAt = result.ok ? undefined : (result.back && !result.back.ok ? result.back : result.out);
  const unreachable = failedAt && (failedAt.reason === "acl" || failedAt.reason === "unreachable") && failedAt.at !== c.dev.name;
  lines.push(result.ok ? "!!!!!" : unreachable ? "U.U.U" : ".....");
  lines.push(result.ok ? "Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms" : "Success rate is 0 percent (0/5)");
  return lines.join("\n");
}

function logDai(c: Ctx, trace: Trace) {
  if (!trace.at || !trace.dev) return;
  logTo(c.state, trace.at, `%SW_DAI-4-DHCP_SNOOPING_DENY: 1 Invalid ARPs (Req) on ${shortIf(trace.dev)}, vlan ${c.state.devices[trace.at].interfaces[trace.dev]?.accessVlan ?? 1}.`);
}

cmd(EXEC, "ping <addr> [ source <if> ]", "Send echo messages", (c, [target, sourceIf]) => pingOutput(c, target!, sourceIf), NET, "ping");
cmd(EXEC, "ping ipv6 <ipv6>", "Send IPv6 echo messages", (c, [target]) => pingOutput(c, target!), NET, "ping");
cmd(EXEC, "traceroute <addr>", "Trace route to destination", (c, [target]) => {
  const parsed = parseAddr(target!)!;
  const trace = forward(structuredClone(c.state), c.dev.name, { family: parsed.family, src: probeSource(c, parsed.family, parsed.addr), dst: parsed.addr, proto: "udp", sport: 49152, dport: 33434 });
  const reach = probe(structuredClone(c.state), c.dev.name, parsed.family, parsed.addr);
  c.result = { ok: reach.ok, target: formatAddr(parsed.family, parsed.addr, false) };
  const lines = ["Type escape sequence to abort.", `Tracing the route to ${formatAddr(parsed.family, parsed.addr)}`, "VRF info: (vrf in name/id, vrf out name/id)"];
  trace.hops.forEach((hop, index) => {
    const addr = index === trace.hops.length - 1 && trace.ok ? parsed.addr : hop.addr;
    lines.push(`  ${index + 1} ${addr !== undefined ? formatAddr(parsed.family, addr) : "*"} 1 msec 0 msec 1 msec`);
  });
  if (!trace.ok) for (let index = 0; index < 3; index += 1) lines.push(`  ${trace.hops.length + index + 1}  *  *  * `);
  return lines.join("\n");
}, NET, "traceroute");

function probeSource(c: Ctx, family: 4 | 6, dst: bigint) {
  const result = probe(structuredClone(c.state), c.dev.name, family, dst);
  return result.out.pkt.src;
}

// ---------- show ----------

const SHOWS: [string, string, Handler, DeviceKind[]?, Mode[]?][] = [
  ["show running-config", "Current operating configuration", (c) => show.runningConfig(c.dev), NET, PRIV],
  ["show running-config interface <if>", "Show interface configuration", (c, [name]) => {
    const iface = c.dev.interfaces[name!];
    if (!iface) return invalid;
    return show.runningConfig({ ...c.dev, interfaces: { [name!]: iface } }).split("\n").filter((line, index, lines) => {
      const start = lines.findIndex((item) => item.startsWith("interface "));
      const end = lines.findIndex((item, at) => at > start && item === "!");
      return index >= start && index < end;
    }).join("\n");
  }, NET, PRIV],
  ["show startup-config", "Contents of startup configuration", (c) => c.dev.startupConfig ?? "startup-config is not present", NET, PRIV],
  ["show version", "System hardware and software status", (c) => show.showVersion(c.dev), NET],
  ["show clock", "Display the system clock", () => "*09:14:22.512 UTC Wed Oct 28 2026", NET],
  ["show ip interface brief", "Brief summary of IP status and configuration", (c) => show.showIpInterfaceBrief(c.state, c.dev.name), NET],
  ["show ipv6 interface brief", "Brief summary of IPv6 status", (c) => show.showIpv6InterfaceBrief(c.state, c.dev.name), NET],
  ["show interfaces status", "Show interface line status", (c) => show.showInterfacesStatus(c.state, c.dev.name, false), SWITCHES],
  ["show interfaces status err-disabled", "Show err-disabled interfaces", (c) => show.showInterfacesStatus(c.state, c.dev.name, true), SWITCHES],
  ["show interfaces trunk", "Show trunk interface information", (c) => show.showInterfacesTrunk(c.state, c.dev.name), SWITCHES],
  ["show interfaces <if> switchport", "Show interface switchport information", (c, [name]) => show.showInterfaceSwitchport(c.state, c.dev.name, name!), SWITCHES],
  ["show vlan brief", "VTP all VLAN status in brief", (c) => show.showVlanBrief(c.state, c.dev.name), SWITCHES],
  ["show vlan", "VTP VLAN status", (c) => show.showVlanBrief(c.state, c.dev.name), SWITCHES],
  ["show etherchannel summary", "One-line summary per channel-group", (c) => show.showEtherchannelSummary(c.state, c.dev.name), SWITCHES],
  ["show etherchannel load-balance", "Load-balancing configuration", (c) => `EtherChannel Load-Balancing Configuration:\n        ${c.dev.loadBalance}\n\nEtherChannel Load-Balancing Addresses Used Per-Protocol:\nNon-IP: ${c.dev.loadBalance.includes("mac") ? c.dev.loadBalance.replace("-mac", " MAC address").replace("src-dst", "Source XOR Destination") : "Source XOR Destination MAC address"}\n  IPv4: ${c.dev.loadBalance.replace("src-dst-ip", "Source XOR Destination IP address").replace("src-mac", "Source MAC address").replace("dst-ip", "Destination IP address").replace("src-ip", "Source IP address").replace("dst-mac", "Destination MAC address")}`, SWITCHES],
  ["show lacp neighbor", "LACP neighbor information", (c) => show.showLacpNeighbor(c.state, c.dev.name), SWITCHES],
  ["show spanning-tree", "Spanning tree topology", (c) => show.showSpanningTree(c.state, c.dev.name), SWITCHES],
  ["show spanning-tree vlan <num>", "Spanning tree for a VLAN", (c, [vlan]) => show.showSpanningTree(c.state, c.dev.name, Number(vlan)), SWITCHES],
  ["show spanning-tree summary", "Summary of port states", (c) => show.showSpanningTreeSummary(c.state, c.dev.name), SWITCHES],
  ["show ip route", "IP routing table", (c) => show.showIpRoute(c.state, c.dev.name), NET],
  ["show ip route {ospf|static|connected}", "IP routing table by source", (c, [filter]) => show.showIpRoute(c.state, c.dev.name, filter), NET],
  ["show ipv6 route", "IPv6 routing table", (c) => show.showIpv6Route(c.state, c.dev.name), NET],
  ["show ipv6 route static", "IPv6 static routes", (c) => show.showIpv6Route(c.state, c.dev.name, "static"), NET],
  ["show ip ospf neighbor", "OSPF neighbor list", (c) => show.showIpOspfNeighbor(c.state, c.dev.name), ROUTERS],
  ["show ip ospf interface brief", "Brief OSPF interface information", (c) => show.showIpOspfInterface(c.state, c.dev.name, true), ROUTERS],
  ["show ip ospf interface [ <if> ]", "OSPF interface information", (c, [name]) => show.showIpOspfInterface(c.state, c.dev.name, false, name), ROUTERS],
  ["show ip ospf", "OSPF process information", (c) => show.showIpOspf(c.state, c.dev.name), ROUTERS],
  ["show ip protocols", "IP routing protocol process parameters", (c) => show.showIpProtocols(c.state, c.dev.name), ROUTERS],
  ["show standby brief", "HSRP brief information", (c) => show.showStandby(c.state, c.dev.name, true), ROUTERS],
  ["show standby", "HSRP information", (c) => show.showStandby(c.state, c.dev.name, false), ROUTERS],
  ["show ip dhcp binding", "DHCP address bindings", (c) => show.showDhcpBinding(c.dev), ROUTERS],
  ["show ip dhcp pool", "DHCP pools information", (c) => show.showDhcpPool(c.dev), ROUTERS],
  ["show ip dhcp snooping", "DHCP snooping configuration", (c) => show.showDhcpSnooping(c.dev), SWITCHES],
  ["show ip dhcp snooping binding", "DHCP snooping binding table", (c) => show.showDhcpSnoopingBinding(c.dev), SWITCHES],
  ["show ip arp inspection", "Dynamic ARP Inspection status", (c) => show.showArpInspection(c.dev), SWITCHES],
  ["show ip nat translations", "NAT translation entries", (c) => show.showNatTranslations(c.dev), ["router"]],
  ["show ip nat statistics", "NAT statistics", (c) => show.showNatStatistics(c.dev), ["router"]],
  ["show access-lists [ <word> ]", "List access lists", (c, [name]) => show.showAccessLists(c.dev, name), NET],
  ["show ip access-lists [ <word> ]", "List IP access lists", (c, [name]) => show.showAccessLists(c.dev, name), NET],
  ["show port-security", "Port security summary", (c) => show.showPortSecurity(c.dev), SWITCHES],
  ["show port-security interface <if>", "Port security on an interface", (c, [name]) => show.showPortSecurityInterface(c.dev, name!), SWITCHES],
  ["show ip ssh", "SSH server status", (c) => show.showIpSsh(c.dev), NET],
  ["show ntp associations", "NTP associations", (c) => show.showNtpAssociations(c.state, c.dev.name), NET],
  ["show ntp status", "NTP status", (c) => show.showNtpStatus(c.state, c.dev.name), NET],
  ["show cdp neighbors", "CDP neighbor entries", (c) => show.showCdpNeighbors(c.state, c.dev.name), NET],
  ["show logging", "Contents of logging buffers", (c) => show.showLogging(c.dev), NET],
  ["show mac address-table", "MAC forwarding table", (c) => show.showMacAddressTable(c.state, c.dev.name), SWITCHES],
];
for (const [pattern, help, run, kinds, modes] of SHOWS) {
  cmd(modes ?? EXEC, pattern, help, run, kinds, pattern.replace(/\s*\[.*$/, "").replace(/\s*<[^>]+>/g, "").replace(/\{[^}]+\}/, "").trim());
}

// ---------- global configuration ----------

cmd(CONFIG_MODES, "end", "Exit to privileged EXEC", (c) => leaveConfig(c), undefined, "end");
cmd(["config"], "exit", "Exit from configure mode", (c) => leaveConfig(c), undefined, "exit");
cmd(SUBMODES, "exit", "Exit to global configuration", (c) => exitToConfig(c), undefined, "exit");
cmd(CONF, "hostname <word>", "Set system's network name", (c, [name]) => { c.dev.hostname = name!; });
cmd(CONF, "no ip domain-lookup", "Disable DNS lookups", () => undefined);
cmd(CONF, "ip domain-lookup", "Enable DNS lookups", () => undefined);
cmd(CONF, "ip domain-name <word>", "Define the default domain name", (c, [name]) => { c.dev.domainName = name; }, NET, "ip domain-name");
cmd(CONF, "ip domain name <word>", "Define the default domain name", (c, [name]) => { c.dev.domainName = name; }, NET, "ip domain-name");
cmd(CONF, "service password-encryption", "Encrypt system passwords", (c) => { c.dev.servicePasswordEncryption = true; });
cmd(CONF, "no service password-encryption", "Stop encrypting passwords", (c) => { c.dev.servicePasswordEncryption = false; });
cmd(CONF, "service timestamps log datetime [ msec ]", "Timestamp log messages", (c) => { c.dev.timestamps = true; });
cmd(CONF, "enable secret <rest>", "Assign the privileged level secret", (c, [rest]) => {
  const tokens = rest!.split(" ");
  const password = tokens[tokens.length - 1];
  if (/^\d$/.test(password)) return "% Incomplete command.";
  c.dev.enableSecret = password;
});
cmd(CONF, "username <word> <rest>", "Establish user name authentication", (c, [user, rest]) => {
  const tokens = rest!.split(" ");
  let privilege = 1;
  let index = 0;
  if (tokens[index]?.toLowerCase() === "privilege") { privilege = Number(tokens[index + 1]); index += 2; }
  if (tokens[index]?.toLowerCase() === "algorithm-type") index += 2;
  const type = tokens[index]?.toLowerCase();
  if (type !== "secret" && type !== "password") return invalid;
  index += 1;
  if (/^[0-9]$/.test(tokens[index] ?? "") && tokens.length > index + 1) index += 1;
  const secret = tokens.slice(index).join(" ");
  if (!secret || Number.isNaN(privilege) || privilege > 15) return "% Incomplete command.";
  c.dev.users[user!] = { privilege, secret, type };
}, NET);
cmd(CONF, "no username <word>", "Remove a user", (c, [user]) => { delete c.dev.users[user!]; }, NET);
cmd(CONF, "crypto key generate rsa [ general-keys ] [ modulus <num> ]", "Generate RSA keys", (c, [modulus]) => {
  if (["router", "switch"].includes(c.dev.hostname.toLowerCase())) return `% Please define a hostname other than ${c.dev.hostname}.`;
  if (!c.dev.domainName) return "% Please define a domain-name first.";
  const size = modulus ? Number(modulus) : 512;
  if (size < 360 || size > 4096) return "% Invalid modulus size; must be between 360 and 4096";
  const first = !c.dev.rsaModulus;
  c.dev.rsaModulus = size;
  if (first) logTo(c.state, c.dev.name, "%SSH-5-ENABLED: SSH 1.99 has been enabled");
  return [
    `The name for the keys will be: ${c.dev.hostname}.${c.dev.domainName}`,
    ...(modulus ? [] : ["Choose the size of the key modulus in the range of 360 to 4096 for your", "  General Purpose Keys. Choosing a key modulus greater than 512 may take", "  a few minutes.", "", "How many bits in the modulus [512]: 512"]),
    "",
    `% The key modulus size is ${size} bits`,
    `% Generating ${size} bit RSA keys, keys will be non-exportable...`,
    "[OK] (elapsed time was 1 seconds)",
  ].join("\n");
}, NET, "crypto key generate rsa");
cmd(CONF, "crypto key zeroize rsa", "Remove RSA keys", (c) => { c.dev.rsaModulus = undefined; }, NET);
cmd(CONF, "ip ssh version {1|2}", "Specify protocol version", (c, [version]) => {
  c.dev.sshVersion = Number(version) as 1 | 2;
  if (!c.dev.rsaModulus || c.dev.rsaModulus < 768) return "Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).";
}, NET);
cmd(CONF, "login block-for <num> attempts <num> within <num>", "Set login blocking", (c, [seconds, attempts, within]) => {
  c.dev.loginBlock = { seconds: Number(seconds), attempts: Number(attempts), within: Number(within) };
}, NET);
cmd(CONF, "banner motd <rest>", "Set Message of the Day banner", (c, [rest]) => {
  const delimiter = rest![0];
  const end = rest!.indexOf(delimiter, 1);
  if (end < 0) return "% Banner must end with the same delimiter character it starts with";
  c.dev.banner = rest!.slice(1, end).trim();
}, NET);
cmd(CONF, "no banner motd", "Remove the banner", (c) => { c.dev.banner = undefined; }, NET);
cmd(CONF, "line {console|con|vty} <num> [ <num> ]", "Configure a terminal line", (c, [type]) => {
  c.cli.mode = "line";
  c.cli.line = type === "vty" ? "vty" : "con";
}, NET, "line");
cmd(CONF, "ntp server <ipv4>", "Configure NTP server", (c, [ip]) => {
  const addr = ipv4Of(ip!);
  if (!c.dev.ntp.servers.includes(addr)) c.dev.ntp.servers.push(addr);
}, NET);
cmd(CONF, "no ntp server <ipv4>", "Remove NTP server", (c, [ip]) => { c.dev.ntp.servers = c.dev.ntp.servers.filter((item) => item !== ipv4Of(ip!)); }, NET);
cmd(CONF, "ntp master [ <num> ]", "Act as NTP master clock", (c, [stratum]) => { c.dev.ntp.master = stratum ? Number(stratum) : 8; }, NET);
cmd(CONF, "no ntp master", "Stop acting as NTP master", (c) => { c.dev.ntp.master = undefined; }, NET);
cmd(CONF, "logging host <ipv4>", "Set syslog server", (c, [ip]) => { c.dev.loggingHosts.push(ipv4Of(ip!)); }, NET);
cmd(CONF, "logging <ipv4>", "Set syslog server", (c, [ip]) => { c.dev.loggingHosts.push(ipv4Of(ip!)); }, NET, "logging host");
cmd(CONF, "logging trap <word>", "Set syslog server logging level", (c, [level]) => { c.dev.loggingTrap = level; }, NET);
cmd(CONF, "cdp run", "Enable CDP", (c) => { c.dev.cdp = true; }, NET);
cmd(CONF, "no cdp run", "Disable CDP", (c) => { c.dev.cdp = false; }, NET);
cmd(CONF, "lldp run", "Enable LLDP", (c) => { c.dev.lldp = true; }, NET);
cmd(CONF, "no lldp run", "Disable LLDP", (c) => { c.dev.lldp = false; }, NET);

cmd(CONF, "interface <if>", "Select an interface to configure", (c, [name]) => enterInterface(c, name!), NET, "interface");
cmd(CONF, "interface range <rest>", "Interface range command", (c, [text]) => {
  const names = expandRange(text!);
  if (!names || names.some((name) => !c.dev.interfaces[name])) return invalid;
  c.cli.mode = "interface";
  c.cli.ifaces = names;
}, SWITCHES, "interface range");
cmd(CONF, "no interface <if>", "Delete a logical interface", (c, [name]) => {
  const iface = c.dev.interfaces[name!];
  if (!iface || iface.physical) return "% Removal of physical interfaces is not permitted";
  delete c.dev.interfaces[name!];
  if (name!.startsWith("Port-channel")) {
    const id = Number(name!.slice(12));
    for (const member of Object.values(c.dev.interfaces)) if (member.channelGroup?.id === id) member.channelGroup = undefined;
  }
}, NET);

function enterInterface(c: Ctx, name: string) {
  const device = c.dev;
  if (!device.interfaces[name]) {
    const parent = parentIf(name);
    if (name.includes(".")) {
      if (device.kind !== "router" || !device.interfaces[parent]) return invalid;
    } else if (name.startsWith("Vlan")) {
      if (!isSwitchDevice(device)) return invalid;
    } else if (name.startsWith("Port-channel")) {
      if (!isSwitchDevice(device)) return invalid;
    } else if (!name.startsWith("Loopback")) return invalid;
    device.interfaces[name] = newIface(name, device.kind);
  }
  c.cli.mode = name.includes(".") ? "subif" : "interface";
  c.cli.ifaces = [name];
}

cmd(CONF, "vlan <list>", "VLAN commands", (c, [list]) => {
  const vlans = parseVlans(list!);
  if (!vlans) return "% Bad VLAN list";
  for (const vlan of vlans) c.dev.vlans[vlan] ??= `VLAN${String(vlan).padStart(4, "0")}`;
  c.cli.mode = "vlan";
  c.cli.vlan = vlans[vlans.length - 1];
}, SWITCHES, "vlan");
cmd(CONF, "no vlan <list>", "Delete VLANs", (c, [list]) => {
  for (const vlan of parseVlans(list!) ?? []) if (vlan !== 1) delete c.dev.vlans[vlan];
}, SWITCHES);
cmd(["vlan"], "name <word>", "ASCII name of the VLAN", (c, [name]) => {
  if (c.cli.vlan === 1) return "%Default VLAN 1 may not have its name changed.";
  c.dev.vlans[c.cli.vlan!] = name!;
}, SWITCHES, "name");

cmd(CONF, "ip routing", "Enable IP routing", (c) => { c.dev.ipRouting = true; }, ["l3switch"]);
cmd(CONF, "no ip routing", "Disable IP routing", (c) => { c.dev.ipRouting = false; }, ["l3switch"]);
cmd(CONF, "ipv6 unicast-routing", "Enable unicast routing", (c) => { c.dev.ipv6Routing = true; }, ROUTERS);
cmd(CONF, "no ipv6 unicast-routing", "Disable unicast routing", (c) => { c.dev.ipv6Routing = false; }, ROUTERS);
cmd(CONF, "ip default-gateway <ipv4>", "Specify default gateway", (c, [ip]) => { c.dev.defaultGateway = ipv4Of(ip!); }, NET);
cmd(CONF, "no ip default-gateway [ <ipv4> ]", "Remove default gateway", (c) => { c.dev.defaultGateway = undefined; }, NET);

function parseRouteTail(tokens: string[], family: 4 | 6) {
  let exitIf: string | undefined;
  let nextHop: bigint | undefined;
  let ad = 1;
  let index = 0;
  const ifName = parseIfName(tokens[index] ?? "") ?? (tokens[index + 1] !== undefined ? parseIfName(`${tokens[index]}${tokens[index + 1]}`) : null);
  if (ifName && !/^[\d.:a-f]+$/i.test(tokens[index] ?? "")) {
    exitIf = ifName;
    index += parseIfName(tokens[index]) ? 1 : 2;
  }
  const hop = tokens[index] !== undefined ? (family === 4 ? parseIpv4(tokens[index]) : parseIpv6(tokens[index])) : null;
  if (hop !== null && tokens[index] !== undefined && !/^\d{1,3}$/.test(tokens[index])) { nextHop = hop; index += 1; }
  if (tokens[index] !== undefined) {
    if (!/^\d+$/.test(tokens[index]) || Number(tokens[index]) > 255 || Number(tokens[index]) < 1) return null;
    ad = Number(tokens[index]);
    index += 1;
  }
  if (index !== tokens.length || (!exitIf && nextHop === undefined)) return null;
  return { exitIf, nextHop, ad };
}

cmd(CONF, "ip route <ipv4> <ipv4> <rest>", "Establish static routes", (c, [prefix, mask, rest]) => {
  const len = maskToLen(ipv4Of(mask!));
  if (len === null) return "%Inconsistent address and mask";
  const addr = ipv4Of(prefix!);
  if (network(4, addr, len) !== addr) return "%Inconsistent address and mask";
  const tail = parseRouteTail(rest!.split(" "), 4);
  if (!tail) return invalid;
  if (tail.exitIf && !c.dev.interfaces[tail.exitIf]) return invalid;
  c.dev.staticRoutes = c.dev.staticRoutes.filter((route) => !(route.family === 4 && route.prefix === addr && route.len === len && route.nextHop === tail.nextHop && route.exitIf === tail.exitIf));
  c.dev.staticRoutes.push({ family: 4, prefix: addr, len, ...tail });
}, NET, "ip route");
cmd(CONF, "no ip route <ipv4> <ipv4> [ <rest> ]", "Remove static routes", (c, [prefix, mask, rest]) => {
  const addr = ipv4Of(prefix!);
  const len = maskToLen(ipv4Of(mask!));
  const tail = rest ? parseRouteTail(rest.split(" "), 4) : null;
  c.dev.staticRoutes = c.dev.staticRoutes.filter((route) => !(route.family === 4 && route.prefix === addr && route.len === len && (!tail || (route.nextHop === tail.nextHop && route.exitIf === tail.exitIf))));
}, NET);
cmd(CONF, "ipv6 route <v6prefix> <rest>", "Configure static routes", (c, [prefix, rest]) => {
  const parsed = parseIpv6Prefix(prefix!)!;
  const tail = parseRouteTail(rest!.split(" "), 6);
  if (!tail) return invalid;
  if (tail.nextHop !== undefined && isLinkLocal(tail.nextHop) && !tail.exitIf) return "% Interface has to be specified for a link-local nexthop";
  const addr = network(6, parsed.addr, parsed.len);
  c.dev.staticRoutes = c.dev.staticRoutes.filter((route) => !(route.family === 6 && route.prefix === addr && route.len === parsed.len && route.nextHop === tail.nextHop && route.exitIf === tail.exitIf));
  c.dev.staticRoutes.push({ family: 6, prefix: addr, len: parsed.len, ...tail });
}, ROUTERS, "ipv6 route");
cmd(CONF, "no ipv6 route <v6prefix> [ <rest> ]", "Remove IPv6 static routes", (c, [prefix, rest]) => {
  const parsed = parseIpv6Prefix(prefix!)!;
  const tail = rest ? parseRouteTail(rest.split(" "), 6) : null;
  c.dev.staticRoutes = c.dev.staticRoutes.filter((route) => !(route.family === 6 && route.prefix === network(6, parsed.addr, parsed.len) && route.len === parsed.len && (!tail || (route.nextHop === tail.nextHop && route.exitIf === tail.exitIf))));
}, ROUTERS);

cmd(CONF, "router ospf <num>", "Open Shortest Path First (OSPF)", (c, [pid]) => {
  if (c.dev.ospf && c.dev.ospf.pid !== Number(pid)) return "% Only one OSPF process is supported in this lab.";
  c.dev.ospf ??= { pid: Number(pid), networks: [], passiveDefault: false, passive: [], nonPassive: [], defaultOriginate: false, refBw: 100 };
  c.cli.mode = "router-ospf";
}, ROUTERS, "router ospf");
cmd(CONF, "no router ospf <num>", "Remove an OSPF process", (c) => { c.dev.ospf = null; }, ROUTERS);
cmd(["router-ospf"], "router-id <ipv4>", "Router-id for this OSPF process", (c, [ip]) => {
  const ospf = c.dev.ospf!;
  const addr = ipv4Of(ip!);
  ospf.routerId = addr;
  if (ospf.activeRid !== undefined && ospf.activeRid !== addr) {
    if (ospfAdjacency(c.state, c.dev.name).neighbors.length) return "% OSPF: Reload or use \"clear ip ospf process\" command, for this to take effect";
    ospf.activeRid = addr;
  }
}, ROUTERS);
cmd(["router-ospf"], "no router-id", "Remove the configured router-id", (c) => { c.dev.ospf!.routerId = undefined; }, ROUTERS);
cmd(["router-ospf"], "network <ipv4> <ipv4> area <num>", "Enable routing on an IP network", (c, [ip, wildcard, area]) => {
  const ospf = c.dev.ospf!;
  const wc = wildcardOrMask(ipv4Of(wildcard!));
  const addr = ipv4Of(ip!) & ~wc & BigInt(0xffffffff);
  if (ospf.networks.some((item) => item.addr === addr && item.wildcard === wc)) {
    ospf.networks = ospf.networks.map((item) => (item.addr === addr && item.wildcard === wc ? { ...item, area: Number(area) } : item));
  } else ospf.networks.push({ addr, wildcard: wc, area: Number(area) });
}, ROUTERS, "network");
cmd(["router-ospf"], "no network <ipv4> <ipv4> area <num>", "Remove a network statement", (c, [ip, wildcard]) => {
  const wc = wildcardOrMask(ipv4Of(wildcard!));
  const addr = ipv4Of(ip!) & ~wc & BigInt(0xffffffff);
  c.dev.ospf!.networks = c.dev.ospf!.networks.filter((item) => !(item.addr === addr && item.wildcard === wc));
}, ROUTERS);
cmd(["router-ospf"], "passive-interface default", "Suppress routing updates on all interfaces", (c) => {
  c.dev.ospf!.passiveDefault = true;
  c.dev.ospf!.nonPassive = [];
}, ROUTERS);
cmd(["router-ospf"], "no passive-interface default", "Send hellos on all interfaces", (c) => {
  c.dev.ospf!.passiveDefault = false;
  c.dev.ospf!.passive = [];
}, ROUTERS);
cmd(["router-ospf"], "passive-interface <if>", "Suppress routing updates on an interface", (c, [name]) => {
  const ospf = c.dev.ospf!;
  if (!c.dev.interfaces[name!]) return invalid;
  if (ospf.passiveDefault) ospf.nonPassive = ospf.nonPassive.filter((item) => item !== name);
  else if (!ospf.passive.includes(name!)) ospf.passive.push(name!);
}, ROUTERS, "passive-interface");
cmd(["router-ospf"], "no passive-interface <if>", "Send hellos on an interface", (c, [name]) => {
  const ospf = c.dev.ospf!;
  if (!c.dev.interfaces[name!]) return invalid;
  if (ospf.passiveDefault) { if (!ospf.nonPassive.includes(name!)) ospf.nonPassive.push(name!); }
  else ospf.passive = ospf.passive.filter((item) => item !== name);
}, ROUTERS, "no passive-interface");
cmd(["router-ospf"], "default-information originate [ always ]", "Distribute a default route", (c) => { c.dev.ospf!.defaultOriginate = true; }, ROUTERS);
cmd(["router-ospf"], "no default-information originate", "Stop distributing a default route", (c) => { c.dev.ospf!.defaultOriginate = false; }, ROUTERS);
cmd(["router-ospf"], "auto-cost reference-bandwidth <num>", "Reference bandwidth in Mbits per second", (c, [value]) => {
  c.dev.ospf!.refBw = Number(value);
  return "% OSPF: Reference bandwidth is changed.\n        Please ensure reference bandwidth is consistent across all routers.";
}, ROUTERS);
cmd(["router-ospf"], "log-adjacency-changes [ detail ]", "Log changes in adjacency state", () => undefined, ROUTERS);

cmd(CONF, "spanning-tree mode {pvst|rapid-pvst|mst}", "Spanning tree operating mode", (c, [mode]) => {
  if (mode === "mst") return "% MST is not available in this lab.";
  c.dev.stp.mode = mode as "pvst" | "rapid-pvst";
}, SWITCHES);
cmd(CONF, "spanning-tree vlan <list> root {primary|secondary}", "Configure switch as root", (c, [list, role]) => {
  const vlans = parseVlans(list!);
  if (!vlans) return "% Bad VLAN list";
  for (const vlan of vlans) {
    if (role === "secondary") { c.dev.stp.priority[vlan] = 28672; continue; }
    const root = spanningTree(c.state, vlan).bridges[c.dev.name]?.root;
    const rootPriority = root && root.dev !== c.dev.name ? root.priority - vlan : 32768;
    c.dev.stp.priority[vlan] = rootPriority > 24576 ? 24576 : Math.max(0, Math.floor((rootPriority - 1) / 4096) * 4096);
  }
}, SWITCHES, "spanning-tree vlan root");
cmd(CONF, "spanning-tree vlan <list> priority <num>", "Set the bridge priority", (c, [list, value]) => {
  const priority = Number(value);
  if (priority % 4096 !== 0 || priority > 61440) return "% Bridge Priority must be in increments of 4096.\n% Allowed values are:\n  0     4096  8192  12288 16384 20480 24576 28672\n  32768 36864 40960 45056 49152 53248 57344 61440";
  for (const vlan of parseVlans(list!) ?? []) c.dev.stp.priority[vlan] = priority;
}, SWITCHES, "spanning-tree vlan priority");
cmd(CONF, "no spanning-tree vlan <list> [ <rest> ]", "Restore default bridge priority", (c, [list]) => {
  for (const vlan of parseVlans(list!) ?? []) delete c.dev.stp.priority[vlan];
}, SWITCHES);
for (const pattern of ["spanning-tree portfast default", "spanning-tree portfast edge default"]) {
  cmd(CONF, pattern, "Enable PortFast on all access ports", (c) => { c.dev.stp.portfastDefault = true; }, SWITCHES, "spanning-tree portfast default");
  cmd(CONF, `no ${pattern}`, "Disable PortFast by default", (c) => { c.dev.stp.portfastDefault = false; }, SWITCHES);
}
for (const pattern of ["spanning-tree portfast bpduguard default", "spanning-tree portfast edge bpduguard default"]) {
  cmd(CONF, pattern, "Enable BPDU Guard on PortFast ports", (c) => { c.dev.stp.bpduguardDefault = true; }, SWITCHES, "spanning-tree portfast bpduguard default");
  cmd(CONF, `no ${pattern}`, "Disable BPDU Guard by default", (c) => { c.dev.stp.bpduguardDefault = false; }, SWITCHES);
}
cmd(CONF, "port-channel load-balance {src-mac|dst-mac|src-dst-mac|src-ip|dst-ip|src-dst-ip}", "EtherChannel load-balancing method", (c, [method]) => { c.dev.loadBalance = method!; }, SWITCHES);

cmd(CONF, "ip dhcp excluded-address <ipv4> [ <ipv4> ]", "Prevent DHCP from assigning addresses", (c, [start, end]) => {
  const first = ipv4Of(start!);
  const last = end ? ipv4Of(end) : first;
  if (last < first) return "% Invalid address range";
  c.dev.dhcpExcluded.push({ start: first, end: last });
}, ROUTERS);
cmd(CONF, "no ip dhcp excluded-address <ipv4> [ <ipv4> ]", "Remove an excluded range", (c, [start, end]) => {
  const first = ipv4Of(start!);
  const last = end ? ipv4Of(end) : first;
  c.dev.dhcpExcluded = c.dev.dhcpExcluded.filter((range) => !(range.start === first && range.end === last));
}, ROUTERS);
cmd(CONF, "ip dhcp pool <word>", "Configure DHCP address pools", (c, [name]) => {
  c.dev.dhcpPools[name!] ??= {};
  c.cli.mode = "dhcp";
  c.cli.pool = name;
}, ROUTERS, "ip dhcp pool");
cmd(CONF, "no ip dhcp pool <word>", "Remove a DHCP pool", (c, [name]) => { delete c.dev.dhcpPools[name!]; }, ROUTERS);
cmd(["dhcp"], "network <ipv4> <word>", "Network number and mask", (c, [ip, mask]) => {
  const len = mask!.startsWith("/") ? Number(mask!.slice(1)) : maskToLen(parseIpv4(mask!) ?? BigInt(-1));
  if (len === null || Number.isNaN(len) || len > 30) return invalid;
  c.dev.dhcpPools[c.cli.pool!].network = { addr: network(4, ipv4Of(ip!), len), len };
}, ROUTERS, "network");
cmd(["dhcp"], "default-router <ipv4>", "Default routers", (c, [ip]) => { c.dev.dhcpPools[c.cli.pool!].defaultRouter = ipv4Of(ip!); }, ROUTERS);
cmd(["dhcp"], "dns-server <ipv4>", "DNS servers", (c, [ip]) => { c.dev.dhcpPools[c.cli.pool!].dns = ipv4Of(ip!); }, ROUTERS);
cmd(["dhcp"], "domain-name <word>", "Domain name", (c, [name]) => { c.dev.dhcpPools[c.cli.pool!].domain = name; }, ROUTERS);
cmd(["dhcp"], "lease <rest>", "Address lease time", (c, [rest]) => { c.dev.dhcpPools[c.cli.pool!].lease = Number(rest!.split(" ")[0]) || 1; }, ROUTERS);
cmd(CONF, "ip dhcp relay information trust-all", "Trust relay information on all interfaces", (c) => { c.dev.dhcpRelayTrustAll = true; }, ROUTERS);
cmd(CONF, "no ip dhcp relay information trust-all", "Stop trusting relay information", (c) => { c.dev.dhcpRelayTrustAll = false; }, ROUTERS);

cmd(CONF, "ip dhcp snooping", "Enable DHCP snooping globally", (c) => { c.dev.snooping.enabled = true; }, SWITCHES);
cmd(CONF, "no ip dhcp snooping", "Disable DHCP snooping", (c) => { c.dev.snooping.enabled = false; }, SWITCHES);
cmd(CONF, "ip dhcp snooping vlan <list>", "DHCP snooping VLAN range", (c, [list]) => {
  const vlans = parseVlans(list!);
  if (!vlans) return "% Bad VLAN list";
  c.dev.snooping.vlans = [...new Set([...c.dev.snooping.vlans, ...vlans])].sort((a, b) => a - b);
}, SWITCHES);
cmd(CONF, "no ip dhcp snooping vlan <list>", "Remove DHCP snooping VLANs", (c, [list]) => {
  const vlans = parseVlans(list!) ?? [];
  c.dev.snooping.vlans = c.dev.snooping.vlans.filter((vlan) => !vlans.includes(vlan));
}, SWITCHES);
cmd(CONF, "ip dhcp snooping information option", "Insert option 82", (c) => { c.dev.snooping.option82 = true; }, SWITCHES);
cmd(CONF, "no ip dhcp snooping information option", "Do not insert option 82", (c) => { c.dev.snooping.option82 = false; }, SWITCHES);
cmd(CONF, "ip arp inspection vlan <list>", "Enable Dynamic ARP Inspection on VLANs", (c, [list]) => {
  const vlans = parseVlans(list!);
  if (!vlans) return "% Bad VLAN list";
  c.dev.daiVlans = [...new Set([...c.dev.daiVlans, ...vlans])].sort((a, b) => a - b);
}, SWITCHES);
cmd(CONF, "no ip arp inspection vlan <list>", "Disable Dynamic ARP Inspection", (c, [list]) => {
  const vlans = parseVlans(list!) ?? [];
  c.dev.daiVlans = c.dev.daiVlans.filter((vlan) => !vlans.includes(vlan));
}, SWITCHES);

cmd(CONF, "ip nat inside source list <word> interface <if> [ overload ]", "Dynamic NAT using an interface address", (c, [list, name]) => {
  if (!c.dev.interfaces[name!]) return invalid;
  c.dev.natRules = c.dev.natRules.filter((rule) => rule.list !== list);
  c.dev.natRules.push({ list: list!, iface: name!, overload: true });
}, ["router"], "ip nat inside source list");
cmd(CONF, "no ip nat inside source list <word> [ <rest> ]", "Remove dynamic NAT", (c, [list]) => { c.dev.natRules = c.dev.natRules.filter((rule) => rule.list !== list); }, ["router"]);
cmd(CONF, "ip nat inside source static <ipv4> <ipv4>", "Static NAT translation", (c, [local, global]) => {
  c.dev.natStatics = c.dev.natStatics.filter((item) => item.local !== ipv4Of(local!));
  c.dev.natStatics.push({ local: ipv4Of(local!), global: ipv4Of(global!) });
}, ["router"], "ip nat inside source static");
cmd(CONF, "no ip nat inside source static <ipv4> <ipv4>", "Remove static NAT", (c, [local]) => { c.dev.natStatics = c.dev.natStatics.filter((item) => item.local !== ipv4Of(local!)); }, ["router"]);

cmd(CONF, "access-list <num> <rest>", "Add an access list entry", (c, [number, rest]) => {
  const kind = aclKindForNumber(Number(number));
  if (!kind) return invalid;
  if (rest!.toLowerCase().startsWith("remark")) return;
  return addAclEntry(c.dev, number!, kind, true, rest!.split(" "));
}, NET, "access-list");
cmd(CONF, "no access-list <num>", "Remove an access list", (c, [number]) => { delete c.dev.acls[number!]; }, NET);
cmd(CONF, "ip access-list {standard|extended} <word>", "Named access list", (c, [kind, name]) => {
  const existing = c.dev.acls[name!];
  if (existing && existing.kind !== kind) return `% A ${existing.kind} access list named ${name} already exists`;
  c.dev.acls[name!] ??= { kind: kind as "standard" | "extended", numbered: /^\d+$/.test(name!), entries: [] };
  c.cli.mode = kind === "standard" ? "std-acl" : "ext-acl";
  c.cli.acl = name;
}, NET, "ip access-list");
cmd(CONF, "no ip access-list {standard|extended} <word>", "Remove a named access list", (c, [, name]) => { delete c.dev.acls[name!]; }, NET);
cmd(["std-acl", "ext-acl"], "{permit|deny} <rest>", "Add an entry", (c, [action, rest]) => addAclEntry(c.dev, c.cli.acl!, c.cli.mode === "std-acl" ? "standard" : "extended", false, [action!, ...rest!.split(" ")]), NET, "acl entry");
cmd(["std-acl", "ext-acl"], "<num> {permit|deny} <rest>", "Add a sequenced entry", (c, [seq, action, rest]) => addAclEntry(c.dev, c.cli.acl!, c.cli.mode === "std-acl" ? "standard" : "extended", false, [action!, ...rest!.split(" ")], Number(seq)), NET, "acl entry");
cmd(["std-acl", "ext-acl"], "remark <rest>", "Access list entry comment", () => undefined, NET);
cmd(["std-acl", "ext-acl"], "no <num>", "Delete a sequenced entry", (c, [seq]) => {
  const acl = c.dev.acls[c.cli.acl!];
  acl.entries = acl.entries.filter((entry) => entry.seq !== Number(seq));
}, NET);
cmd(["std-acl", "ext-acl"], "no {permit|deny} <rest>", "Delete a matching entry", (c, [action, rest]) => {
  const acl = c.dev.acls[c.cli.acl!];
  const parsed = parseAclEntry(acl.kind, [action!, ...rest!.split(" ")]);
  if (!parsed) return invalid;
  const text = show.aclEntryText(acl.kind, parsed);
  acl.entries = acl.entries.filter((entry) => entry.text !== text);
}, NET);

// ---------- line ----------

const currentLine = (c: Ctx) => c.dev.lines[c.cli.line!];
cmd(["line"], "password <word>", "Set a password", (c, [password]) => { currentLine(c).password = password; }, NET);
cmd(["line"], "login", "Enable password checking", (c) => {
  currentLine(c).login = "line";
  if (!currentLine(c).password) return `% Login disabled on line ${c.cli.line === "vty" ? 1 : 0}, until 'password' is set`;
}, NET);
cmd(["line"], "login local", "Local password checking", (c) => { currentLine(c).login = "local"; }, NET);
cmd(["line"], "no login", "Disable password checking", (c) => { currentLine(c).login = "none"; }, NET);
cmd(["line"], "transport input <rest>", "Define which protocols to use", (c, [rest]) => {
  if (c.cli.line !== "vty") return invalid;
  const tokens = rest!.toLowerCase().split(" ");
  if (tokens.length === 1 && (tokens[0] === "all" || tokens[0] === "none")) { currentLine(c).transport = tokens[0] as "all" | "none"; return; }
  if (tokens.some((token) => token !== "ssh" && token !== "telnet")) return invalid;
  currentLine(c).transport = [...new Set(tokens)] as ("ssh" | "telnet")[];
}, NET);
cmd(["line"], "access-class <word> in", "Filter connections", (c, [name]) => { currentLine(c).accessClass = name; }, NET);
cmd(["line"], "no access-class <word> in", "Remove connection filter", (c) => { currentLine(c).accessClass = undefined; }, NET);
cmd(["line"], "exec-timeout <num> [ <num> ]", "Set the EXEC timeout", (c, [minutes, seconds]) => { currentLine(c).execTimeout = [Number(minutes), Number(seconds ?? 0)]; }, NET);
cmd(["line"], "logging synchronous", "Synchronized message output", (c) => { currentLine(c).loggingSync = true; }, NET);

// ---------- interface ----------

cmd(IFM, "description <rest>", "Interface specific description", (c, [text]) => { for (const iface of selected(c)) iface.description = text; }, NET);
cmd(IFM, "no description", "Remove the description", (c) => { for (const iface of selected(c)) iface.description = undefined; }, NET);
cmd(IFM, "shutdown", "Shutdown the selected interface", (c) => {
  for (const iface of selected(c)) {
    iface.shutdown = true;
    delete c.dev.errDisabled[iface.name];
  }
}, NET);
cmd(IFM, "no shutdown", "Enable the selected interface", (c) => {
  for (const iface of selected(c)) {
    iface.shutdown = false;
    delete c.dev.errDisabled[iface.name];
  }
}, NET);

cmd(IFM, "ip address <ipv4> <ipv4>", "Set the IP address of an interface", (c, [ip, mask]) => {
  const len = maskToLen(ipv4Of(mask!));
  const addr = ipv4Of(ip!);
  if (len === null) return `% Bad mask 0x${ipv4Of(mask!).toString(16).toUpperCase()} for address ${ip}`;
  for (const iface of selected(c)) {
    if (iface.switchport && !iface.name.startsWith("Vlan")) return c.dev.kind === "l3switch" ? "% IP addresses may not be configured on L2 links." : invalid;
    if (len < 31 && (network(4, addr, len) === addr || (addr | (~maskBits(4, len) & BigInt(0xffffffff))) === addr)) return `% Bad mask /${len} for address ${ip}`;
    const overlap = Object.values(c.dev.interfaces).find((other) => other !== iface && other.ipv4 && sameSubnet(4, other.ipv4.addr, addr, Math.min(other.ipv4.len, len)));
    if (overlap) return `% ${formatIpv4(network(4, addr, len))} overlaps with ${overlap.name}`;
    iface.ipv4 = { addr, len };
  }
}, NET, "ip address");
cmd(IFM, "no ip address [ <rest> ]", "Remove the IP address", (c) => { for (const iface of selected(c)) iface.ipv4 = undefined; }, NET);
cmd(IFM, "ipv6 address <v6prefix> [ {eui-64} ]", "Configure an IPv6 address", (c, [prefix, eui]) => {
  const parsed = parseIpv6Prefix(prefix!)!;
  for (const iface of selected(c)) {
    if (iface.switchport && !iface.name.startsWith("Vlan")) return invalid;
    iface.ipv6 = iface.ipv6.filter((item) => network(6, item.addr, item.len) !== network(6, parsed.addr, parsed.len));
    iface.ipv6.push({ addr: eui ? network(6, parsed.addr, 64) : parsed.addr, len: parsed.len, eui64: Boolean(eui) });
  }
}, ROUTERS, "ipv6 address");
cmd(IFM, "ipv6 address <ipv6> link-local", "Configure a link-local address", (c, [addr]) => {
  const parsed = parseIpv6(addr!)!;
  if (!isLinkLocal(parsed)) return "% Invalid link-local address";
  for (const iface of selected(c)) iface.linkLocal = parsed;
}, ROUTERS, "ipv6 address link-local");
cmd(IFM, "no ipv6 address [ <rest> ]", "Remove IPv6 addresses", (c) => {
  for (const iface of selected(c)) { iface.ipv6 = []; iface.linkLocal = undefined; }
}, ROUTERS);
cmd(IFM, "ipv6 enable", "Enable IPv6 on the interface", (c) => { for (const iface of selected(c)) iface.ipv6Enabled = true; }, ROUTERS);
cmd(IFM, "no ipv6 enable", "Disable IPv6 on the interface", (c) => { for (const iface of selected(c)) iface.ipv6Enabled = false; }, ROUTERS);
cmd(["subif"], "encapsulation dot1q <num> [ {native} ]", "802.1Q Virtual LAN", (c, [vlan, native]) => {
  const id = Number(vlan);
  if (id < 1 || id > 4094) return invalid;
  const iface = selected(c)[0];
  const parent = parentIf(iface.name);
  const clash = Object.values(c.dev.interfaces).find((other) => other !== iface && parentIf(other.name) === parent && other.dot1q?.vlan === id);
  if (clash) return `Configuration of multiple subinterfaces of the same main\ninterface with the same VLAN ID (${id}) is not permitted.\nThis VLAN ID is already configured on ${clash.name}.`;
  iface.dot1q = { vlan: id, native: Boolean(native) };
}, ["router"], "encapsulation dot1q");
cmd(IFM, "bandwidth <num>", "Set bandwidth informational parameter", (c, [value]) => { for (const iface of selected(c)) iface.bandwidth = Number(value); }, NET);
cmd(IFM, "no bandwidth", "Restore default bandwidth", (c) => { for (const iface of selected(c)) iface.bandwidth = undefined; }, NET);
cmd(IFM, "duplex {auto|full|half}", "Configure duplex operation", () => undefined, NET);
cmd(IFM, "speed <word>", "Configure speed operation", () => undefined, NET);

function requireL2(c: Ctx) {
  const routed = selected(c).find((iface) => !iface.switchport || iface.name.startsWith("Vlan") || iface.name.startsWith("Loopback"));
  return routed ? invalid : undefined;
}

cmd(["interface"], "switchport mode {access|trunk}", "Set trunking mode of the interface", (c, [mode]) => requireL2(c) ?? eachL2(c, (iface) => { iface.mode = mode as "access" | "trunk"; }), SWITCHES, "switchport mode");
cmd(["interface"], "switchport mode dynamic {auto|desirable}", "Set DTP negotiation", (c, [mode]) => requireL2(c) ?? eachL2(c, (iface) => {
  iface.mode = `dynamic ${mode}` as Iface["mode"];
  iface.nonegotiate = false;
}), SWITCHES, "switchport mode");
cmd(["interface"], "switchport access vlan <num>", "Set VLAN when interface is in access mode", (c, [vlan]) => {
  const id = Number(vlan);
  if (id < 1 || id > 4094) return invalid;
  const error = requireL2(c);
  if (error) return error;
  let message: string | undefined;
  if (!c.dev.vlans[id]) {
    c.dev.vlans[id] = `VLAN${String(id).padStart(4, "0")}`;
    message = `% Access VLAN does not exist. Creating vlan ${id}`;
  }
  eachL2(c, (iface) => { iface.accessVlan = id; });
  return message;
}, SWITCHES, "switchport access vlan");
cmd(["interface"], "no switchport access vlan", "Reset the access VLAN", (c) => eachL2(c, (iface) => { iface.accessVlan = 1; }), SWITCHES);
cmd(["interface"], "switchport trunk native vlan <num>", "Set native VLAN when interface is trunking", (c, [vlan]) => requireL2(c) ?? eachL2(c, (iface) => { iface.nativeVlan = Number(vlan); }), SWITCHES, "switchport trunk native vlan");
cmd(["interface"], "no switchport trunk native vlan", "Reset the native VLAN", (c) => eachL2(c, (iface) => { iface.nativeVlan = 1; }), SWITCHES);
cmd(["interface"], "switchport trunk allowed vlan <rest>", "Set allowed VLANs when trunking", (c, [rest]) => {
  const error = requireL2(c);
  if (error) return error;
  const tokens = rest!.toLowerCase().split(" ");
  const apply = (change: (current: number[] | null) => number[] | null) => eachL2(c, (iface) => { iface.allowed = change(iface.allowed); });
  if (tokens[0] === "all") return apply(() => null);
  if (tokens[0] === "none") return apply(() => []);
  const list = parseVlans(tokens[tokens.length - 1]);
  if (!list) return invalid;
  if (tokens[0] === "add") return apply((current) => (current === null ? null : [...new Set([...current, ...list])].sort((a, b) => a - b)));
  if (tokens[0] === "remove") return apply((current) => (current ?? Array.from({ length: 4094 }, (_, index) => index + 1)).filter((vlan) => !list.includes(vlan)));
  if (tokens[0] === "except") return apply(() => Array.from({ length: 4094 }, (_, index) => index + 1).filter((vlan) => !list.includes(vlan)));
  if (tokens.length !== 1) return invalid;
  return apply(() => list);
}, SWITCHES, "switchport trunk allowed vlan");
cmd(["interface"], "no switchport trunk allowed vlan", "Allow all VLANs", (c) => eachL2(c, (iface) => { iface.allowed = null; }), SWITCHES);
cmd(["interface"], "switchport trunk encapsulation dot1q", "Set trunk encapsulation", () => undefined, ["l3switch"]);
cmd(["interface"], "switchport nonegotiate", "Disable DTP negotiation", (c) => {
  if (selected(c).some((iface) => iface.mode.startsWith("dynamic"))) return "Command rejected: Conflict between 'nonegotiate' and 'dynamic' status.";
  eachL2(c, (iface) => { iface.nonegotiate = true; });
}, SWITCHES, "switchport nonegotiate");
cmd(["interface"], "no switchport nonegotiate", "Enable DTP negotiation", (c) => eachL2(c, (iface) => { iface.nonegotiate = false; }), SWITCHES);
cmd(["interface"], "no switchport", "Make this a routed (Layer 3) port", (c) => {
  for (const iface of selected(c)) {
    if (!iface.physical && !iface.name.startsWith("Port-channel")) return invalid;
    iface.switchport = false;
  }
}, ["l3switch"], "no switchport");
cmd(["interface"], "switchport", "Make this a Layer 2 port", (c) => {
  for (const iface of selected(c)) {
    if (!iface.physical && !iface.name.startsWith("Port-channel")) return invalid;
    iface.switchport = true;
    iface.ipv4 = undefined;
  }
}, ["l3switch"]);

cmd(["interface"], "switchport port-security", "Enable port security", (c) => {
  for (const iface of selected(c)) {
    if (iface.mode !== "access" && iface.mode !== "trunk") return `Command rejected: ${iface.name} is a dynamic port.`;
    iface.portSecurity.enabled = true;
  }
}, SWITCHES, "switchport port-security");
cmd(["interface"], "no switchport port-security", "Disable port security", (c) => { for (const iface of selected(c)) iface.portSecurity.enabled = false; }, SWITCHES);
cmd(["interface"], "switchport port-security maximum <num>", "Max secure addresses", (c, [value]) => {
  for (const iface of selected(c)) iface.portSecurity.max = Math.max(1, Number(value));
}, SWITCHES, "switchport port-security maximum");
cmd(["interface"], "switchport port-security violation {shutdown|restrict|protect}", "Security violation mode", (c, [mode]) => {
  for (const iface of selected(c)) iface.portSecurity.violation = mode as Iface["portSecurity"]["violation"];
}, SWITCHES, "switchport port-security violation");
cmd(["interface"], "switchport port-security mac-address sticky [ <word> ]", "Learn secure MACs as sticky", (c, [mac]) => {
  for (const iface of selected(c)) {
    iface.portSecurity.sticky = true;
    if (mac) c.dev.psecLearned[iface.name] = [...new Set([...(c.dev.psecLearned[iface.name] ?? []), mac.toLowerCase()])];
  }
}, SWITCHES, "switchport port-security mac-address sticky");
cmd(["interface"], "no switchport port-security mac-address sticky", "Disable sticky learning", (c) => { for (const iface of selected(c)) iface.portSecurity.sticky = false; }, SWITCHES);

cmd(["interface"], "spanning-tree portfast [ edge ] [ trunk ]", "Enable an interface to move directly to forwarding", (c) => {
  for (const iface of selected(c)) iface.portfast = true;
  return "%Warning: portfast should only be enabled on ports connected to a single\n host. Connecting hubs, concentrators, switches, bridges, etc... to this\n interface  when portfast is enabled, can cause temporary bridging loops.\n Use with CAUTION";
}, SWITCHES, "spanning-tree portfast");
cmd(["interface"], "spanning-tree portfast disable", "Disable PortFast on this interface", (c) => { for (const iface of selected(c)) iface.portfast = false; }, SWITCHES);
cmd(["interface"], "no spanning-tree portfast", "Use the global PortFast setting", (c) => { for (const iface of selected(c)) iface.portfast = undefined; }, SWITCHES);
cmd(["interface"], "spanning-tree bpduguard {enable|disable}", "Don't accept BPDUs on this interface", (c, [mode]) => { for (const iface of selected(c)) iface.bpduguard = mode === "enable"; }, SWITCHES, "spanning-tree bpduguard");
cmd(["interface"], "no spanning-tree bpduguard", "Use the global BPDU Guard setting", (c) => { for (const iface of selected(c)) iface.bpduguard = undefined; }, SWITCHES);
cmd(["interface"], "spanning-tree cost <num>", "Change an interface's spanning tree port path cost", (c, [value]) => { for (const iface of selected(c)) iface.stpCost = Number(value); }, SWITCHES);
cmd(["interface"], "no spanning-tree cost", "Restore the default path cost", (c) => { for (const iface of selected(c)) iface.stpCost = undefined; }, SWITCHES);
cmd(["interface"], "spanning-tree link-type point-to-point", "Specify a link type", () => undefined, SWITCHES);

cmd(["interface"], "channel-group <num> mode {active|passive|on|desirable|auto}", "EtherChannel of interfaces", (c, [group, mode]) => {
  const id = Number(group);
  for (const iface of selected(c)) {
    if (!iface.physical) return invalid;
    const po = c.dev.interfaces[`Port-channel${id}`];
    const existingMode = Object.values(c.dev.interfaces).find((other) => other.channelGroup?.id === id && other !== iface)?.channelGroup?.mode;
    const family = (value: string) => (value === "active" || value === "passive" ? "lacp" : value === "on" ? "on" : "pagp");
    if (existingMode && family(existingMode) !== family(mode!)) return "Command rejected (Channel protocol mismatch for interface " + iface.name + " in group " + id + "): the interface can not be added to the channel group";
    if (po && po.switchport !== iface.switchport) return `% Interface ${iface.name} is not compatible with Port-channel${id} and will be suspended (switchport mode mismatch)`;
    iface.channelGroup = { id, mode: mode as ChannelMode };
    if (!po) {
      const created = newIface(`Port-channel${id}`, c.dev.kind);
      Object.assign(created, { switchport: iface.switchport, mode: iface.mode, accessVlan: iface.accessVlan, nativeVlan: iface.nativeVlan, allowed: iface.allowed, nonegotiate: iface.nonegotiate });
      c.dev.interfaces[created.name] = created;
    }
  }
  return `Creating a port-channel interface Port-channel ${id}`;
}, SWITCHES, "channel-group");
cmd(["interface"], "no channel-group", "Remove from the EtherChannel", (c) => { for (const iface of selected(c)) iface.channelGroup = undefined; }, SWITCHES);
cmd(["interface"], "channel-protocol {lacp|pagp}", "Select the channel protocol", () => undefined, SWITCHES);

cmd(["interface"], "ip dhcp snooping trust", "DHCP snooping trust config", (c) => { for (const iface of selected(c)) iface.snoopingTrust = true; }, SWITCHES, "ip dhcp snooping trust");
cmd(["interface"], "no ip dhcp snooping trust", "Untrust the interface", (c) => { for (const iface of selected(c)) iface.snoopingTrust = false; }, SWITCHES);
cmd(["interface"], "ip dhcp snooping limit rate <num>", "DHCP snooping rate limit", (c, [value]) => { for (const iface of selected(c)) iface.snoopingRate = Number(value); }, SWITCHES, "ip dhcp snooping limit rate");
cmd(["interface"], "no ip dhcp snooping limit rate", "Remove the rate limit", (c) => { for (const iface of selected(c)) iface.snoopingRate = undefined; }, SWITCHES);
cmd(["interface"], "ip arp inspection trust", "Configure trust state", (c) => { for (const iface of selected(c)) iface.arpTrust = true; }, SWITCHES, "ip arp inspection trust");
cmd(["interface"], "no ip arp inspection trust", "Untrust the interface", (c) => { for (const iface of selected(c)) iface.arpTrust = false; }, SWITCHES);

cmd(IFM, "ip helper-address <ipv4>", "Specify a destination address for UDP broadcasts", (c, [ip]) => {
  for (const iface of selected(c)) if (!iface.helpers.includes(ipv4Of(ip!))) iface.helpers.push(ipv4Of(ip!));
}, ROUTERS, "ip helper-address");
cmd(IFM, "no ip helper-address [ <ipv4> ]", "Remove helper addresses", (c, [ip]) => {
  for (const iface of selected(c)) iface.helpers = ip ? iface.helpers.filter((item) => item !== ipv4Of(ip)) : [];
}, ROUTERS);
cmd(IFM, "ip nat {inside|outside}", "NAT interface role", (c, [role]) => { for (const iface of selected(c)) iface.nat = role as "inside" | "outside"; }, ["router"], "ip nat");
cmd(IFM, "no ip nat {inside|outside}", "Remove NAT role", (c) => { for (const iface of selected(c)) iface.nat = undefined; }, ["router"]);
cmd(IFM, "ip access-group <word> {in|out}", "Specify access control for packets", (c, [name, direction]) => {
  for (const iface of selected(c)) iface.acl[direction as "in" | "out"] = name;
}, NET, "ip access-group");
cmd(IFM, "no ip access-group <word> {in|out}", "Remove access control", (c, [, direction]) => { for (const iface of selected(c)) iface.acl[direction as "in" | "out"] = undefined; }, NET);
cmd(IFM, "no ip access-group {in|out}", "Remove access control", (c, [direction]) => { for (const iface of selected(c)) iface.acl[direction as "in" | "out"] = undefined; }, NET);

cmd(IFM, "ip ospf <num> area <num>", "Enable OSPF on this interface", (c, [pid, area]) => {
  if (c.dev.ospf && c.dev.ospf.pid !== Number(pid)) return "% Only one OSPF process is supported in this lab.";
  c.dev.ospf ??= { pid: Number(pid), networks: [], passiveDefault: false, passive: [], nonPassive: [], defaultOriginate: false, refBw: 100 };
  for (const iface of selected(c)) iface.ospf = { ...iface.ospf, pid: Number(pid), area: Number(area) };
}, ROUTERS, "ip ospf area");
cmd(IFM, "no ip ospf <num> area <num>", "Disable OSPF on this interface", (c) => { for (const iface of selected(c)) iface.ospf = { ...iface.ospf, pid: undefined, area: undefined }; }, ROUTERS);
const ospfSetting = (key: "cost" | "priority" | "hello" | "dead", keyword: string, max: number) => {
  cmd(IFM, `ip ospf ${keyword} <num>`, `OSPF ${keyword}`, (c, [value]) => {
    if (Number(value) > max) return invalid;
    for (const iface of selected(c)) iface.ospf[key] = Number(value);
  }, ROUTERS, `ip ospf ${keyword}`);
  cmd(IFM, `no ip ospf ${keyword} [ <num> ]`, `Restore default OSPF ${keyword}`, (c) => { for (const iface of selected(c)) iface.ospf[key] = undefined; }, ROUTERS);
};
ospfSetting("cost", "cost", 65535);
ospfSetting("priority", "priority", 255);
ospfSetting("hello", "hello-interval", 65535);
ospfSetting("dead", "dead-interval", 65535);
cmd(IFM, "ip ospf network {point-to-point|broadcast}", "Network type", (c, [type]) => { for (const iface of selected(c)) iface.ospf.network = type as "point-to-point" | "broadcast"; }, ROUTERS, "ip ospf network");
cmd(IFM, "no ip ospf network", "Restore the default network type", (c) => { for (const iface of selected(c)) iface.ospf.network = undefined; }, ROUTERS);

const standbyGroup = (iface: Iface, group: string) => (iface.standby[Number(group)] ??= { priority: 100, preempt: false, track: [] });
cmd(IFM, "standby version {1|2}", "HSRP version", (c, [version]) => { for (const iface of selected(c)) iface.standbyVersion = Number(version) as 1 | 2; }, ROUTERS, "standby version");
cmd(IFM, "standby <num> ip <ipv4>", "Enable HSRP and set the virtual IP address", (c, [group, ip]) => {
  for (const iface of selected(c)) {
    if (!iface.ipv4 || !sameSubnet(4, iface.ipv4.addr, ipv4Of(ip!), iface.ipv4.len)) return `% Address ${ip} in group ${group} does not belong to a subnet on this interface`;
    if (Number(group) > 255 && iface.standbyVersion === 1) return "% Group numbers above 255 require standby version 2";
    standbyGroup(iface, group!).ip = ipv4Of(ip!);
  }
}, ROUTERS, "standby ip");
cmd(IFM, "standby <num> priority <num>", "Priority level", (c, [group, value]) => { for (const iface of selected(c)) standbyGroup(iface, group!).priority = Math.min(255, Number(value)); }, ROUTERS, "standby priority");
cmd(IFM, "standby <num> preempt [ <rest> ]", "Overthrow lower priority Active routers", (c, [group]) => { for (const iface of selected(c)) standbyGroup(iface, group!).preempt = true; }, ROUTERS, "standby preempt");
cmd(IFM, "no standby <num> preempt", "Disable preemption", (c, [group]) => { for (const iface of selected(c)) standbyGroup(iface, group!).preempt = false; }, ROUTERS);
cmd(IFM, "standby <num> track <if> [ <num> ]", "Priority tracking", (c, [group, name, decrement]) => {
  if (!c.dev.interfaces[name!]) return invalid;
  for (const iface of selected(c)) {
    const config = standbyGroup(iface, group!);
    config.track = [...config.track.filter((item) => item.iface !== name), { iface: name!, decrement: decrement ? Number(decrement) : 10 }];
  }
}, ROUTERS, "standby track");
cmd(IFM, "no standby <num>", "Remove an HSRP group", (c, [group]) => {
  for (const iface of selected(c)) { delete iface.standby[Number(group)]; delete c.dev.hsrp[`${iface.name}:${group}`]; }
}, ROUTERS);

cmd(CONFIG_MODES, "do <rest>", "To run exec commands in config mode", () => undefined, NET, "do");

// ---------- host commands ----------

const HOST: Mode[] = ["host"];

function hostPing(c: Ctx, target: string) {
  const parsed = parseAddr(target);
  if (!parsed) return `Ping request could not find host ${target}. Please check the name and try again.`;
  const result = probe(c.state, c.dev.name, parsed.family, parsed.addr);
  c.result = { ok: result.ok, target: formatAddr(parsed.family, parsed.addr, false) };
  if (!result.ok && (result.out.reason === "dai" || result.back?.reason === "dai")) logDai(c, result.out.reason === "dai" ? result.out : result.back!);
  const display = formatAddr(parsed.family, parsed.addr, false);
  const lines = [`Pinging ${display} with 32 bytes of data:`, ""];
  if (result.out.reason === "no-source") lines.push(...Array(4).fill("PING: transmit failed. General failure."));
  else if (result.ok) {
    const hops = result.out.hops.length - 1;
    const ttl = (c.state.devices[result.out.dev!].kind === "host" ? 128 : 255) - hops;
    lines.push(...Array(4).fill(`Reply from ${display}: bytes=32 time<1ms TTL=${ttl}`));
  } else {
    const failed = result.back && !result.back.ok ? result.back : result.out;
    const routerAt = failed.at && failed.at !== c.dev.name && (failed.reason === "acl" || failed.reason === "unreachable") && result.back === undefined;
    const reporter = routerAt && failed.ingress ? c.state.devices[failed.at!].interfaces[failed.ingress]?.ipv4?.addr : undefined;
    lines.push(...Array(4).fill(routerAt && reporter !== undefined ? `Reply from ${formatIpv4(reporter)}: Destination host unreachable.` : "Request timed out."));
  }
  const received = result.ok ? 4 : 0;
  lines.push("", `Ping statistics for ${display}:`, `    Packets: Sent = 4, Received = ${received}, Lost = ${4 - received} (${(4 - received) * 25}% loss),`);
  if (result.ok) lines.push("Approximate round trip times in milli-seconds:", "    Minimum = 0ms, Maximum = 1ms, Average = 0ms");
  return lines.join("\n");
}

function ipconfig(c: Ctx, all: boolean) {
  const host = c.dev.host!;
  const v6 = hostV6(c.state, c.dev.name);
  const linkLocal = (BigInt(0xfe80) << BigInt(112)) | (v6 ? v6.addr & ((BigInt(1) << BigInt(64)) - BigInt(1)) : BigInt(0));
  const lines = [`${hostNic(c.dev)} Connection:(default port)`, ""];
  if (all) lines.push(`   Physical Address................: ${c.dev.mac.replace(/\./g, "").toUpperCase().match(/..../g)!.join(".")}`);
  lines.push("   Connection-specific DNS Suffix..: ");
  if (v6 || host.ipv6Mode !== "none") lines.push(`   Link-local IPv6 Address.........: ${formatAddr(6, v6 ? linkLocal : BigInt(0), false)}`);
  if (v6) lines.push(`   IPv6 Address....................: ${formatAddr(6, v6.addr, false)}`);
  lines.push(`   IPv4 Address....................: ${host.ipv4 ? formatIpv4(host.ipv4.addr) : "0.0.0.0"}`);
  lines.push(`   Subnet Mask.....................: ${host.ipv4 ? lenToMask(host.ipv4.len) : "0.0.0.0"}`);
  const gateways = [v6?.gateway !== undefined ? formatAddr(6, v6.gateway, false) : undefined, host.gateway !== undefined ? formatIpv4(host.gateway) : "0.0.0.0"].filter(Boolean) as string[];
  lines.push(`   Default Gateway.................: ${gateways[0]}`, ...gateways.slice(1).map((gateway) => `                                     ${gateway}`));
  if (all) {
    lines.push(`   DHCP Servers....................: ${host.lease ? formatIpv4(host.lease.server) : "0.0.0.0"}`, `   DNS Servers.....................: ${host.dns !== undefined ? formatIpv4(host.dns) : "0.0.0.0"}`);
  }
  return lines.join("\n");
}

cmd(HOST, "ipconfig", "Display IP configuration", (c) => ipconfig(c, false), ["host"]);
cmd(HOST, "ipconfig /all", "Display full IP configuration", (c) => ipconfig(c, true), ["host"]);
cmd(HOST, "ipconfig /renew", "Renew the DHCP lease", (c) => {
  if (c.dev.host!.ipMode !== "dhcp") return "This adapter has a static IP address. Use DHCP to renew.";
  const result = dhcpRenew(c.state, c.dev.name);
  c.result = { ok: result.ok, target: c.dev.host!.ipv4 ? formatIpv4(c.dev.host!.ipv4.addr) : undefined };
  if (!result.ok) return "DHCP request failed. ";
  const host = c.dev.host!;
  return [`   IP Address......................: ${formatIpv4(host.ipv4!.addr)}`, `   Subnet Mask.....................: ${lenToMask(host.ipv4!.len)}`, `   Default Gateway.................: ${host.gateway !== undefined ? formatIpv4(host.gateway) : "0.0.0.0"}`, `   DNS Server......................: ${host.dns !== undefined ? formatIpv4(host.dns) : "0.0.0.0"}`].join("\n");
}, ["host"]);
cmd(HOST, "ipconfig /release", "Release the DHCP lease", (c) => {
  const host = c.dev.host!;
  if (host.ipMode !== "dhcp") return "This adapter has a static IP address.";
  host.ipv4 = undefined; host.gateway = undefined; host.lease = undefined;
  return "   IP Address......................: 0.0.0.0\n   Subnet Mask.....................: 0.0.0.0\n   Default Gateway.................: 0.0.0.0";
}, ["host"]);
cmd(HOST, "ping <addr>", "Send ICMP echo requests", (c, [target]) => hostPing(c, target!), ["host"], "ping");
cmd(HOST, "ping -6 <ipv6>", "Send ICMPv6 echo requests", (c, [target]) => hostPing(c, target!), ["host"], "ping");
cmd(HOST, "tracert <addr>", "Trace the route to a host", (c, [target]) => {
  const parsed = parseAddr(target!)!;
  const reach = probe(structuredClone(c.state), c.dev.name, parsed.family, parsed.addr);
  const trace = reach.out;
  c.result = { ok: reach.ok, target: formatAddr(parsed.family, parsed.addr, false) };
  const lines = [`Tracing route to ${formatAddr(parsed.family, parsed.addr, false)} over a maximum of 30 hops:`, ""];
  trace.hops.forEach((hop, index) => {
    const addr = index === trace.hops.length - 1 && trace.ok ? parsed.addr : hop.addr;
    lines.push(`  ${String(index + 1).padStart(2)}   1 ms    0 ms    0 ms    ${addr !== undefined ? formatAddr(parsed.family, addr, false) : "*"}`);
  });
  if (!trace.ok) for (let index = 0; index < 2; index += 1) lines.push(`  ${String(trace.hops.length + index + 1).padStart(2)}   *       *       *       Request timed out.`);
  lines.push("", "Trace complete.");
  return lines.join("\n");
}, ["host"], "tracert");
cmd(HOST, "ssh -l <word> <ipv4>", "Open an SSH session", (c, [user, target]) => {
  const result = remoteLogin(c.state, c.dev.name, ipv4Of(target!), "ssh", user);
  c.result = { ok: result.ok, target };
  if (!result.ok) return result.message;
  return `Password: \n\n${result.message}\n\n[Simulated session — connection to ${target} closed]`;
}, ["host"], "ssh");
cmd(HOST, "telnet <ipv4>", "Open a Telnet session", (c, [target]) => {
  const result = remoteLogin(c.state, c.dev.name, ipv4Of(target!), "telnet");
  c.result = { ok: result.ok, target };
  return result.ok ? `Trying ${target} ...Open\n\n${result.message}\n\n[Simulated session — connection to ${target} closed]` : `Trying ${target} ...\n${result.message}`;
}, ["host"], "telnet");
cmd(HOST, "curl <word>", "Fetch a web page", (c, [url]) => {
  const match = url!.match(/^(https?):\/\/([\d.]+)\/?$/i);
  if (!match) return "curl: (3) URL using bad/illegal format or missing URL";
  const https = match[1].toLowerCase() === "https";
  const addr = parseIpv4(match[2]);
  if (addr === null) return "curl: (6) Could not resolve host";
  const result = probe(c.state, c.dev.name, 4, addr, "tcp", https ? 443 : 80);
  c.result = { ok: result.ok, target: `${https ? "https" : "http"}:${match[2]}` };
  if (result.ok) return `HTTP/1.1 200 OK\nServer: CertMastery-Lab\n\n<html><body><h1>${c.state.devices[result.out.dev!].hostname} is serving ${https ? "HTTPS" : "HTTP"}</h1></body></html>`;
  if (result.out.reason === "refused") return `curl: (7) Failed to connect to ${match[2]} port ${https ? 443 : 80}: Connection refused`;
  return `curl: (28) Failed to connect to ${match[2]} port ${https ? 443 : 80} after 21003 ms: Timed out`;
}, ["host"], "curl");
cmd(HOST, "nslookup <word> [ <ipv4> ]", "Query a DNS server", (c, [name, server]) => {
  const dns = server ? ipv4Of(server) : c.dev.host!.dns;
  if (dns === undefined) return "*** Default servers are not available";
  const result = probe(c.state, c.dev.name, 4, dns, "udp", 53);
  c.result = { ok: result.ok, target: formatIpv4(dns) };
  if (!result.ok) return `Server:  UnKnown\nAddress:  ${formatIpv4(dns)}\n\nDNS request timed out.\n    timeout was 2 seconds.\n*** Request to UnKnown timed-out`;
  return `Server:  ${c.state.devices[result.out.dev!].hostname}\nAddress:  ${formatIpv4(dns)}\n\nName:    ${name}\nAddress:  ${formatIpv4(dns)}`;
}, ["host"], "nslookup");

// ---------- dispatcher ----------

const KEYWORD_HELP: Record<string, string> = {
  show: "Show running system information", ip: "IP configuration and information", ipv6: "IPv6 configuration and information",
  no: "Negate a command or set its defaults", interface: "Select an interface to configure", interfaces: "Interface status and configuration",
  "spanning-tree": "Spanning Tree Subsystem", switchport: "Set switching mode characteristics", ping: "Send echo messages",
  standby: "HSRP interface configuration commands", "access-list": "Add an access list entry", router: "Enable a routing process",
  vlan: "VLAN commands", crypto: "Encryption module", line: "Configure a terminal line", ntp: "Configure NTP", logging: "Modify message logging facilities",
  username: "Establish User Name Authentication", enable: "Modify enable password parameters", service: "Modify use of network based services",
  banner: "Define a login banner", clear: "Reset functions", copy: "Copy from one file to another", write: "Write running configuration to memory",
  ipconfig: "Display or renew IP configuration", "running-config": "Current operating configuration", etherchannel: "EtherChannel information",
  "port-security": "Show secure port information", route: "IP routing table", ospf: "OSPF information", dhcp: "DHCP information",
  nat: "NAT configuration and translations", "port-channel": "EtherChannel configuration", "passive-interface": "Suppress routing updates on an interface",
  "default-information": "Control distribution of default information", "auto-cost": "Calculate OSPF interface cost according to bandwidth",
  network: "Enable routing on an IP network", "router-id": "Router-id for this OSPF process", login: "Enable password checking",
  transport: "Define transport protocols for line", "access-class": "Filter connections based on an IP access list",
  "exec-timeout": "Set the EXEC timeout", password: "Set a password", "channel-group": "EtherChannel of interfaces",
  encapsulation: "Set encapsulation type for an interface",
};

const EXEC_HELP: Record<string, string> = { ntp: "Network time protocol", vlan: "VTP VLAN status", interface: "IP interface status and configuration", "access-list": "List access lists", standby: "HSRP information" };

function helpFor(c: Ctx, typed: string) {
  const tokens = typed.trim() ? typed.trim().split(/\s+/) : [];
  const trailingSpace = /\s$/.test(typed) || !typed.trim();
  const suggestions = new Map<string, Set<string>>();
  const add = (key: string, help: string) => suggestions.set(key, (suggestions.get(key) ?? new Set()).add(help));
  for (const command of available(c)) {
    const flat = command.nodes.flatMap((node) => (node.t === "opt" ? node.nodes : [node]));
    let ok = true;
    let index = 0;
    for (; index < tokens.length - (trailingSpace ? 0 : 1); index += 1) {
      const node = flat[index];
      if (!node) { ok = false; break; }
      if (node.t === "kw" && !node.words.some((word) => word.startsWith(tokens[index].toLowerCase()))) { ok = false; break; }
      if (node.t === "arg" && !argValue(node.kind, tokens, index)) { ok = false; break; }
    }
    if (!ok) continue;
    const node = flat[index];
    if (!node) { add("<cr>", ""); continue; }
    const partial = trailingSpace ? "" : tokens[tokens.length - 1].toLowerCase();
    // A keyword reached by several commands gets a generic description rather than one command's.
    const isLast = index === flat.length - 1;
    if (node.t === "kw") for (const word of node.words) { if (word.startsWith(partial)) add(word, isLast && node.words.length === 1 ? command.help : node.words.length > 1 ? "" : command.help); }
    else if (node.t === "arg") add(node.label.toUpperCase().replace(/[<>]/g, "").replace(/^IF$/, "INTERFACE").replace(/^ADDR$/, "A.B.C.D or X:X:X:X::X"), "");
  }
  if (!suggestions.size) return "% Unrecognized command";
  const exec = c.cli.mode === "user" || c.cli.mode === "privileged";
  const describe = (key: string, helps: Set<string>) => (helps.size === 1 ? [...helps][0] : (exec && EXEC_HELP[key]) || KEYWORD_HELP[key] || "");
  const width = Math.max(...[...suggestions.keys()].map((key) => key.length)) + 3;
  return [...suggestions.entries()]
    .sort(([a], [b]) => (a === "<cr>" ? 1 : b === "<cr>" ? -1 : a.localeCompare(b)))
    .map(([key, helps]) => `  ${key.padEnd(width)}${describe(key, helps)}`.trimEnd())
    .join("\n");
}

function available(c: Ctx, mode: Mode = c.cli.mode) {
  return commands.filter((command) => command.modes.includes(mode) && (!command.kinds || command.kinds.includes(c.dev.kind)));
}

function applyPipe(output: string, pipe: string | undefined) {
  if (!pipe) return output;
  const [kind, ...rest] = pipe.trim().split(/\s+/);
  const pattern = rest.join(" ");
  let regex: RegExp;
  try { regex = new RegExp(pattern, "i"); } catch { return "% Invalid regular expression"; }
  const lines = output.split("\n");
  const type = ["include", "exclude", "begin", "section"].find((word) => word.startsWith(kind.toLowerCase()));
  if (!type || !pattern) return invalid;
  if (type === "include") return lines.filter((line) => regex.test(line)).join("\n");
  if (type === "exclude") return lines.filter((line) => !regex.test(line)).join("\n");
  if (type === "begin") { const start = lines.findIndex((line) => regex.test(line)); return start < 0 ? "" : lines.slice(start).join("\n"); }
  const out: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!regex.test(lines[index]) || lines[index].startsWith(" ")) continue;
    out.push(lines[index]);
    while (lines[index + 1]?.startsWith(" ")) { index += 1; out.push(lines[index]); }
  }
  return out.join("\n");
}

function tryMatch(c: Ctx, tokens: string[], mode: Mode) {
  const progress: Progress = { furthest: 0, incomplete: false };
  const matches: { command: Command; caps: (string | undefined)[]; exact: number }[] = [];
  for (const command of available(c, mode)) {
    const result = matchNodes(command.nodes, tokens, 0, [], 0, progress);
    if (result) matches.push({ command, ...result });
  }
  matches.sort((a, b) => b.exact - a.exact);
  return { matches, progress };
}

export function executeLine(c: Ctx, raw: string): Executed {
  const line = raw.trim();
  if (!line) return { output: "", args: [] };
  if (line.endsWith("?")) return { output: helpFor(c, raw.slice(0, raw.lastIndexOf("?"))), args: [] };
  const pipeAt = line.indexOf("|");
  const body = pipeAt >= 0 ? line.slice(0, pipeAt).trim() : line;
  const pipe = pipeAt >= 0 ? line.slice(pipeAt + 1) : undefined;
  const tokens = body.split(/\s+/);

  if (tokens[0].toLowerCase() === "do" && CONFIG_MODES.includes(c.cli.mode) && tokens.length > 1) {
    const saved = c.cli.mode;
    c.cli.mode = "privileged";
    const result = executeLine(c, raw.trim().replace(/^do\s+/i, ""));
    c.cli.mode = saved;
    return result;
  }

  let { matches, progress } = tryMatch(c, tokens, c.cli.mode);
  if (!matches.length && SUBMODES.includes(c.cli.mode)) {
    const global = tryMatch(c, tokens, "config");
    if (global.matches.length) {
      exitToConfig(c);
      ({ matches, progress } = global);
    }
  }
  if (!matches.length) {
    if (c.cli.mode === "host") return { output: `Invalid Command.`, args: [] };
    if (progress.incomplete && progress.furthest >= tokens.length) return { output: "% Incomplete command.", args: [] };
    const offset = tokens.slice(0, progress.furthest).reduce((sum, token) => sum + token.length + 1, 0);
    const caret = c.promptLength + 1 + body.indexOf(tokens[progress.furthest] ?? "", offset > 0 ? offset - 1 : 0);
    return { output: `${" ".repeat(Math.max(0, caret))}^\n${invalid}`, args: [] };
  }
  const best = matches[0];
  const rivals = matches.filter((match) => match.exact === best.exact && match.command.id !== best.command.id);
  if (rivals.length) return { output: `% Ambiguous command:  "${body}"`, args: [] };
  if (pipe && !best.command.id.startsWith("show")) return { output: invalid, args: [] };
  const output = best.command.run(c, best.caps) ?? "";
  return { output: applyPipe(output, pipe), id: best.command.id, args: best.caps, result: c.result };
}

export function promptFor(device: Device, cli: CliContext) {
  if (device.kind === "host") return "C:\\>";
  const host = device.hostname;
  switch (cli.mode) {
    case "user": return `${host}>`;
    case "privileged": return `${host}#`;
    case "config": return `${host}(config)#`;
    case "interface": return `${host}(config-if${cli.ifaces.length > 1 ? "-range" : ""})#`;
    case "subif": return `${host}(config-subif)#`;
    case "vlan": return `${host}(config-vlan)#`;
    case "router-ospf": return `${host}(config-router)#`;
    case "line": return `${host}(config-line)#`;
    case "dhcp": return `${host}(dhcp-config)#`;
    case "std-acl": return `${host}(config-std-nacl)#`;
    case "ext-acl": return `${host}(config-ext-nacl)#`;
    default: return `${host}>`;
  }
}

export const commandCount = () => commands.length;
