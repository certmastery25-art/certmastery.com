import { parentIf, portNumber } from "./device";
import type { Device, Iface, LabState } from "./types";

export function peerOf(state: LabState, dev: string, port: string): [string, string] | null {
  for (const link of state.links) {
    if (link.a[0] === dev && link.a[1] === port) return link.b;
    if (link.b[0] === dev && link.b[1] === port) return link.a;
  }
  return null;
}

const isSwitch = (device?: Device) => device?.kind === "switch" || device?.kind === "l3switch";

/** A physical port is up when both ends are enabled and neither end is err-disabled. */
export function physUp(state: LabState, dev: string, port: string) {
  const device = state.devices[dev];
  const iface = device?.interfaces[port];
  if (!iface || iface.shutdown || device.errDisabled[port]) return false;
  const peer = peerOf(state, dev, port);
  if (!peer) return false;
  const peerDevice = state.devices[peer[0]];
  const peerIface = peerDevice?.interfaces[peer[1]];
  return Boolean(peerIface && !peerIface.shutdown && !peerDevice.errDisabled[peer[1]]);
}

export type MemberFlag = "P" | "s" | "I" | "D";
export type Bundle = { id: number; po: string; members: { name: string; flag: MemberFlag }[]; protocol: "LACP" | "PAgP" | "-"; up: boolean; layer3: boolean };

const sameL2 = (a: Iface, b: Iface) => a.switchport === b.switchport
  && (!a.switchport || (a.mode === b.mode && a.accessVlan === b.accessVlan && a.nativeVlan === b.nativeVlan
    && JSON.stringify(a.allowed) === JSON.stringify(b.allowed)));

function modesCompatible(mine: string, theirs: string | undefined) {
  if (!theirs) return false;
  if (mine === "on" || theirs === "on") return mine === theirs;
  if (mine === "active") return theirs === "active" || theirs === "passive";
  if (mine === "passive") return theirs === "active";
  if (mine === "desirable") return theirs === "desirable" || theirs === "auto";
  return theirs === "desirable";
}

function memberFlag(state: LabState, dev: string, member: string, firstPass: boolean): MemberFlag {
  const device = state.devices[dev];
  const iface = device.interfaces[member];
  const group = iface.channelGroup!;
  if (!physUp(state, dev, member)) return "D";
  const peer = peerOf(state, dev, member)!;
  const peerIface = state.devices[peer[0]].interfaces[peer[1]];
  if (!modesCompatible(group.mode, peerIface.channelGroup?.mode)) return group.mode === "on" ? "s" : "I";
  const po = device.interfaces[`Port-channel${group.id}`];
  if (po && !sameL2(po, iface)) return "s";
  if (firstPass) return "P";
  return memberFlag(state, peer[0], peer[1], true) === "P" ? "P" : "s";
}

export function bundles(state: LabState, dev: string): Bundle[] {
  const device = state.devices[dev];
  if (!isSwitch(device)) return [];
  const groups = new Map<number, string[]>();
  for (const iface of Object.values(device.interfaces)) {
    if (iface.channelGroup) groups.set(iface.channelGroup.id, [...(groups.get(iface.channelGroup.id) ?? []), iface.name]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([id, names]) => {
    const po = `Port-channel${id}`;
    const members = names.map((name) => ({ name, flag: memberFlag(state, dev, name, false) }));
    const mode = device.interfaces[names[0]].channelGroup!.mode;
    const poIface = device.interfaces[po];
    return {
      id,
      po,
      members,
      protocol: mode === "active" || mode === "passive" ? "LACP" : mode === "on" ? "-" : "PAgP",
      up: Boolean(poIface && !poIface.shutdown && members.some((member) => member.flag === "P")),
      layer3: poIface ? !poIface.switchport : false,
    };
  });
}

/** The logical port that carries traffic for a physical port: its port-channel, itself, or null if suspended. */
export function logicalPort(state: LabState, dev: string, port: string): string | null {
  const iface = state.devices[dev].interfaces[port];
  if (!iface?.channelGroup) return port;
  const bundle = bundles(state, dev).find((item) => item.id === iface.channelGroup!.id);
  const flag = bundle?.members.find((member) => member.name === port)?.flag;
  if (flag === "P") return bundle!.up ? bundle!.po : null;
  return flag === "I" ? port : null;
}

function emitPort(state: LabState, dev: string, logical: string) {
  if (!logical.startsWith("Port-channel")) return logical;
  return bundles(state, dev).find((bundle) => bundle.po === logical)?.members.find((member) => member.flag === "P")?.name ?? null;
}

/** The far-end logical port of a logical port, following a port-channel through any bundled member. */
export function logicalPeer(state: LabState, dev: string, logical: string): [string, string] | null {
  const port = emitPort(state, dev, logical);
  if (!port || !physUp(state, dev, port)) return null;
  const peer = peerOf(state, dev, port);
  if (!peer) return null;
  const peerLogical = isSwitch(state.devices[peer[0]]) ? logicalPort(state, peer[0], peer[1]) : peer[1];
  return peerLogical ? [peer[0], peerLogical] : null;
}

export function logicalUp(state: LabState, dev: string, logical: string) {
  if (logical.startsWith("Port-channel")) return bundles(state, dev).find((bundle) => bundle.po === logical)?.up ?? false;
  return physUp(state, dev, logical) && logicalPort(state, dev, logical) === logical;
}

/** Operational switchport mode after DTP negotiation. */
export function opMode(state: LabState, dev: string, logical: string): "access" | "trunk" | "routed" {
  const iface = state.devices[dev].interfaces[logical];
  if (!iface.switchport) return "routed";
  if (iface.mode === "access" || iface.mode === "trunk") return iface.mode;
  const peer = logicalPeer(state, dev, logical);
  const peerDevice = peer ? state.devices[peer[0]] : undefined;
  const peerIface = peer ? peerDevice?.interfaces[peer[1]] : undefined;
  if (!peerIface || !isSwitch(peerDevice) || !peerIface.switchport) return "access";
  const peerMode = peerIface.mode;
  if (peerMode === "trunk") return peerIface.nonegotiate ? "access" : "trunk";
  if (iface.mode === "dynamic desirable") return peerMode === "dynamic desirable" || peerMode === "dynamic auto" ? "trunk" : "access";
  return peerMode === "dynamic desirable" ? "trunk" : "access";
}

export function trunkCarries(state: LabState, dev: string, logical: string, vlan: number) {
  const device = state.devices[dev];
  const iface = device.interfaces[logical];
  return Boolean(device.vlans[vlan]) && (iface.allowed === null || iface.allowed.includes(vlan));
}

/** VLANs a logical L2 port forwards for. */
export function portCarries(state: LabState, dev: string, logical: string, vlan: number) {
  const mode = opMode(state, dev, logical);
  const iface = state.devices[dev].interfaces[logical];
  if (mode === "access") return iface.accessVlan === vlan && Boolean(state.devices[dev].vlans[vlan]);
  return mode === "trunk" && trunkCarries(state, dev, logical, vlan);
}

/** Logical L2 ports of a switch: standalone switchports and bundled port-channels. */
export function l2Ports(state: LabState, dev: string) {
  const device = state.devices[dev];
  const ports = new Set<string>();
  for (const iface of Object.values(device.interfaces)) {
    if (!iface.physical || !iface.switchport) continue;
    const logical = logicalPort(state, dev, iface.name);
    if (logical && device.interfaces[logical]?.switchport) ports.add(logical);
  }
  return [...ports];
}

export type Hop = { dev: string; vlan: number; inPort: string; outPort?: string };
export type Reached = { dev: string; iface: string; path: Hop[] };

type Frame = { dev: string; port: string; tag: number | null; path: Hop[] };
type Node = { dev: string; vlan: number; inPort: string; path: Hop[] };

/** L3 interface a router or routed switch port delivers an arriving frame to. */
function routerEndpoint(device: Device, port: string, tag: number | null) {
  const subifs = Object.values(device.interfaces).filter((iface) => parentIf(iface.name) === port && iface.name !== port && iface.dot1q);
  const match = tag === null
    ? subifs.find((iface) => iface.dot1q!.native) ?? device.interfaces[port]
    : subifs.find((iface) => iface.dot1q!.vlan === tag && !iface.dot1q!.native) ?? subifs.find((iface) => iface.dot1q!.vlan === tag);
  return match && !match.shutdown ? match.name : null;
}

/** Every L3 endpoint in the broadcast domain of an interface, with the switch path taken to reach it. */
export function l2Domain(state: LabState, dev: string, ifName: string, srcMac?: string): Reached[] {
  const device = state.devices[dev];
  const start = device.interfaces[ifName];
  const results = new Map<string, Reached>();
  const frames: Frame[] = [];
  const nodes: Node[] = [];
  const seenNodes = new Set<string>();
  const seenFrames = new Set<string>();

  if (!start || start.shutdown || ifName.startsWith("Loopback")) return [];
  if (ifName.startsWith("Vlan")) {
    nodes.push({ dev, vlan: Number(ifName.slice(4)), inPort: ifName, path: [{ dev, vlan: Number(ifName.slice(4)), inPort: ifName }] });
  } else if (start.dot1q) {
    frames.push({ dev, port: parentIf(ifName), tag: start.dot1q.native ? null : start.dot1q.vlan, path: [] });
  } else if (ifName.startsWith("Port-channel")) {
    const port = emitPort(state, dev, ifName);
    if (port) frames.push({ dev, port, tag: null, path: [] });
  } else {
    frames.push({ dev, port: ifName, tag: null, path: [] });
  }

  while (frames.length || nodes.length) {
    const frame = frames.shift();
    if (frame) {
      const key = `${frame.dev}|${frame.port}|${frame.tag}`;
      if (seenFrames.has(key) || !physUp(state, frame.dev, frame.port)) continue;
      seenFrames.add(key);
      const [peerDev, peerPort] = peerOf(state, frame.dev, frame.port)!;
      const peer = state.devices[peerDev];
      if (peer.kind === "host") {
        if (frame.tag === null) results.set(`${peerDev}|${peerPort}`, { dev: peerDev, iface: peerPort, path: frame.path });
      } else if (peer.kind === "hub") {
        for (const port of Object.keys(peer.interfaces)) if (port !== peerPort) frames.push({ dev: peerDev, port, tag: frame.tag, path: frame.path });
      } else if (peer.kind === "router") {
        const endpoint = routerEndpoint(peer, peerPort, frame.tag);
        if (endpoint) results.set(`${peerDev}|${endpoint}`, { dev: peerDev, iface: endpoint, path: frame.path });
      } else {
        const logical = logicalPort(state, peerDev, peerPort);
        if (!logical) continue;
        const iface = peer.interfaces[logical];
        if (!iface.switchport) {
          if (frame.tag === null && !iface.shutdown) results.set(`${peerDev}|${logical}`, { dev: peerDev, iface: logical, path: frame.path });
          continue;
        }
        const mode = opMode(state, peerDev, logical);
        let vlan: number;
        if (mode === "access") {
          if (frame.tag !== null) continue;
          vlan = iface.accessVlan;
        } else {
          vlan = frame.tag ?? iface.nativeVlan;
          if (!trunkCarries(state, peerDev, logical, vlan)) continue;
        }
        if (!peer.vlans[vlan]) continue;
        if (frame.path.length === 0 && srcMac && iface.portSecurity.enabled && !(peer.psecLearned[logical] ?? []).includes(srcMac)) continue;
        nodes.push({ dev: peerDev, vlan, inPort: logical, path: [...frame.path, { dev: peerDev, vlan, inPort: logical }] });
      }
      continue;
    }
    const node = nodes.shift()!;
    const nodeKey = `${node.dev}|${node.vlan}`;
    if (seenNodes.has(nodeKey)) continue;
    seenNodes.add(nodeKey);
    const sw = state.devices[node.dev];
    const svi = sw.interfaces[`Vlan${node.vlan}`];
    if (svi && !svi.shutdown && node.inPort !== svi.name) results.set(`${node.dev}|${svi.name}`, { dev: node.dev, iface: svi.name, path: node.path });
    for (const logical of l2Ports(state, node.dev)) {
      if (logical === node.inPort || !logicalUp(state, node.dev, logical) || !portCarries(state, node.dev, logical, node.vlan)) continue;
      const port = emitPort(state, node.dev, logical);
      if (!port) continue;
      const iface = sw.interfaces[logical];
      const tag = opMode(state, node.dev, logical) === "trunk" && node.vlan !== iface.nativeVlan ? node.vlan : null;
      const path = [...node.path.slice(0, -1), { ...node.path[node.path.length - 1], outPort: logical }];
      frames.push({ dev: node.dev, port, tag, path });
    }
  }
  results.delete(`${dev}|${ifName}`);
  return [...results.values()];
}

/** Host MAC addresses seen on a switch port, looking through any hub. */
export function macsBehind(state: LabState, dev: string, port: string) {
  if (!physUp(state, dev, port)) return [];
  const [peerDev, peerPort] = peerOf(state, dev, port)!;
  const peer = state.devices[peerDev];
  if (peer.kind === "host") return [peer.mac];
  if (peer.kind !== "hub") return [];
  return Object.keys(peer.interfaces).filter((name) => name !== peerPort).flatMap((name) => {
    const far = peerOf(state, peerDev, name);
    const farDevice = far ? state.devices[far[0]] : undefined;
    return far && farDevice?.kind === "host" && !farDevice.interfaces[far[1]].shutdown ? [farDevice.mac] : [];
  });
}

// ---------- Spanning tree ----------

export type StpPort = { port: string; role: "Root" | "Desg" | "Altn" | "Back"; state: "FWD" | "BLK"; cost: number; prio: string; edge: boolean };
export type StpRoot = { dev: string; priority: number; mac: string };
export type StpBridge = { dev: string; priority: number; mac: string; root: StpRoot; rootCost: number; rootPort?: string; ports: StpPort[] };
export type StpVlan = { vlan: number; bridges: Record<string, StpBridge> };

export function bridgePriority(device: Device, vlan: number) {
  return (device.stp.priority[vlan] ?? 32768) + vlan;
}

const bidLess = (a: { priority: number; mac: string }, b: { priority: number; mac: string }) => a.priority !== b.priority ? a.priority < b.priority : a.mac < b.mac;

export function stpPortCost(state: LabState, dev: string, logical: string) {
  const iface = state.devices[dev].interfaces[logical];
  if (iface.stpCost) return iface.stpCost;
  if (logical.startsWith("Port-channel")) {
    const members = bundles(state, dev).find((bundle) => bundle.po === logical)?.members.filter((member) => member.flag === "P") ?? [];
    const gig = members.some((member) => member.name.startsWith("Gigabit"));
    return members.length > 1 ? (gig ? 3 : 12) : gig ? 4 : 19;
  }
  return logical.startsWith("Gigabit") ? 4 : 19;
}

export const stpPortId = (logical: string) => `128.${logical.startsWith("Port-channel") ? 64 + portNumber(logical) : portNumber(logical)}`;

export function spanningTree(state: LabState, vlan: number): StpVlan {
  const switches = Object.values(state.devices).filter((device) => isSwitch(device) && device.vlans[vlan]);
  const bridges: Record<string, StpBridge> = {};
  type Edge = { from: string; port: string; to: string; peerPort: string };
  const edges: Edge[] = [];
  const edgePorts = new Map<string, string[]>();
  for (const sw of switches) {
    bridges[sw.name] = { dev: sw.name, priority: bridgePriority(sw, vlan), mac: sw.bridgeMac, root: { dev: sw.name, priority: bridgePriority(sw, vlan), mac: sw.bridgeMac }, rootCost: 0, ports: [] };
    for (const logical of l2Ports(state, sw.name)) {
      if (!logicalUp(state, sw.name, logical) || !portCarries(state, sw.name, logical, vlan)) continue;
      const peer = logicalPeer(state, sw.name, logical);
      const peerDevice = peer ? state.devices[peer[0]] : undefined;
      if (peer && isSwitch(peerDevice) && peerDevice!.vlans[vlan] && peerDevice!.interfaces[peer[1]]?.switchport && portCarries(state, peer[0], peer[1], vlan)) {
        edges.push({ from: sw.name, port: logical, to: peer[0], peerPort: peer[1] });
      } else {
        edgePorts.set(sw.name, [...(edgePorts.get(sw.name) ?? []), logical]);
      }
    }
  }
  if (!switches.length) return { vlan, bridges };

  // Each connected component elects its own root bridge.
  const dist: Record<string, number> = {};
  const assigned = new Set<string>();
  for (const start of switches) {
    if (assigned.has(start.name)) continue;
    const component = [start.name];
    assigned.add(start.name);
    for (let index = 0; index < component.length; index += 1) {
      for (const edge of edges.filter((item) => item.from === component[index] && !assigned.has(item.to))) {
        assigned.add(edge.to);
        component.push(edge.to);
      }
    }
    let root = component[0];
    for (const name of component) if (bidLess(bridges[name], bridges[root])) root = name;
    const rootInfo = { dev: root, priority: bridges[root].priority, mac: state.devices[root].bridgeMac };
    for (const name of component) bridges[name].root = rootInfo;
    dist[root] = 0;
    const done = new Set<string>();
    while (true) {
      const current = component.filter((name) => dist[name] !== undefined && !done.has(name)).sort((a, b) => dist[a] - dist[b])[0];
      if (!current) break;
      done.add(current);
      for (const edge of edges.filter((item) => item.from === current)) {
        const cost = dist[current] + stpPortCost(state, edge.to, edge.peerPort);
        if (dist[edge.to] === undefined || cost < dist[edge.to]) dist[edge.to] = cost;
      }
    }
  }

  for (const sw of switches) {
    const bridge = bridges[sw.name];
    if (dist[sw.name] === undefined) continue;
    bridge.rootCost = dist[sw.name];
    if (sw.name !== bridge.root.dev) {
      const candidates = edges.filter((edge) => edge.from === sw.name && dist[edge.to] !== undefined).map((edge) => ({
        edge,
        cost: dist[edge.to] + stpPortCost(state, sw.name, edge.port),
        senderBid: bridges[edge.to],
        senderPort: portNumber(edge.peerPort),
        ownPort: portNumber(edge.port),
      }));
      candidates.sort((a, b) => a.cost - b.cost || (bidLess(a.senderBid, b.senderBid) ? -1 : bidLess(b.senderBid, a.senderBid) ? 1 : 0) || a.senderPort - b.senderPort || a.ownPort - b.ownPort);
      bridge.rootPort = candidates[0]?.edge.port;
    }
  }

  for (const edge of edges) {
    const mine = bridges[edge.from];
    const theirs = bridges[edge.to];
    const cost = stpPortCost(state, edge.from, edge.port);
    const prio = stpPortId(edge.port);
    let role: StpPort["role"];
    if (mine.rootPort === edge.port) role = "Root";
    else {
      const mineWins = mine.rootCost !== theirs.rootCost ? mine.rootCost < theirs.rootCost
        : bidLess(mine, theirs) || (!bidLess(theirs, mine) && portNumber(edge.port) < portNumber(edge.peerPort));
      role = mineWins ? "Desg" : "Altn";
    }
    mine.ports.push({ port: edge.port, role, state: role === "Altn" ? "BLK" : "FWD", cost, prio, edge: false });
  }
  for (const [dev, ports] of edgePorts) {
    for (const port of ports) bridges[dev].ports.push({ port, role: "Desg", state: "FWD", cost: stpPortCost(state, dev, port), prio: stpPortId(port), edge: portfastActive(state, dev, port) });
  }
  return { vlan, bridges };
}

export function portfastActive(state: LabState, dev: string, logical: string) {
  const device = state.devices[dev];
  const iface = device.interfaces[logical];
  if (iface.portfast !== undefined) return iface.portfast;
  return device.stp.portfastDefault && opMode(state, dev, logical) === "access";
}

export function bpduguardActive(state: LabState, dev: string, port: string) {
  const device = state.devices[dev];
  const iface = device.interfaces[port];
  if (iface.bpduguard !== undefined) return iface.bpduguard;
  return device.stp.bpduguardDefault && portfastActive(state, dev, port);
}
