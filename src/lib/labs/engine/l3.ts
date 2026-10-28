import { eui64, type Family, formatIpv4, isLinkLocal, maskBits, network, sameSubnet, wildcardMatch } from "./addr";
import { ifaceMac, interfaceLinkLocal, parentIf } from "./device";
import { bundles, l2Domain, logicalUp, physUp, portCarries, l2Ports, type Reached } from "./l2";
import type { Device, Iface, LabState, Service } from "./types";

// ---------- Interface status ----------

export type IfStatus = { admin: boolean; line: boolean; errDisabled?: string };

export function ifStatus(state: LabState, dev: string, name: string): IfStatus {
  const device = state.devices[dev];
  const iface = device.interfaces[name];
  if (!iface) return { admin: false, line: false };
  const admin = !iface.shutdown;
  if (device.errDisabled[name]) return { admin, line: false, errDisabled: device.errDisabled[name] };
  if (!admin) return { admin, line: false };
  if (name.startsWith("Loopback")) return { admin, line: true };
  if (name.includes(".")) return { admin, line: ifUp(state, dev, parentIf(name)) };
  if (name.startsWith("Port-channel")) return { admin, line: bundles(state, dev).find((bundle) => bundle.po === name)?.up ?? false };
  if (name.startsWith("Vlan")) {
    const vlan = Number(name.slice(4));
    const line = Boolean(device.vlans[vlan]) && l2Ports(state, dev).some((port) => logicalUp(state, dev, port) && portCarries(state, dev, port, vlan));
    return { admin, line };
  }
  return { admin, line: physUp(state, dev, name) };
}

export function ifUp(state: LabState, dev: string, name: string) {
  const status = ifStatus(state, dev, name);
  return status.admin && status.line;
}

// ---------- Addresses ----------

export type Addr = { family: Family; addr: bigint; len: number };

export function v6Globals(device: Device, iface: Iface): Addr[] {
  return iface.ipv6.map((item) => ({
    family: 6 as const,
    addr: item.eui64 ? network(6, item.addr, 64) | eui64(ifaceMac(device, iface.name)) : item.addr,
    len: item.len,
  }));
}

export function v6Enabled(iface: Iface) {
  return iface.ipv6Enabled || iface.ipv6.length > 0 || iface.linkLocal !== undefined;
}

/** SLAAC: hosts build an address from the first IPv6 router advertisement on their segment. */
export function hostV6(state: LabState, dev: string): { addr: bigint; len: number; gateway?: bigint } | undefined {
  const host = state.devices[dev].host!;
  if (host.ipv6Mode === "static" && host.ipv6) return { ...host.ipv6, gateway: host.ipv6Gateway };
  if (host.ipv6Mode !== "slaac") return undefined;
  const nic = Object.keys(state.devices[dev].interfaces)[0];
  for (const reached of l2Domain(state, dev, nic)) {
    const router = state.devices[reached.dev];
    if (!router.ipv6Routing || router.kind === "host") continue;
    const iface = router.interfaces[reached.iface];
    const prefix = v6Globals(router, iface).find((item) => item.len === 64);
    if (prefix && ifUp(state, reached.dev, reached.iface)) {
      return { addr: network(6, prefix.addr, 64) | eui64(state.devices[dev].mac), len: 64, gateway: interfaceLinkLocal(router, iface) };
    }
  }
  return undefined;
}

export function ifaceAddrs(state: LabState, dev: string, name: string, family: Family): Addr[] {
  const device = state.devices[dev];
  if (device.kind === "host") {
    if (family === 4) return device.host!.ipv4 ? [{ family: 4, ...device.host!.ipv4 }] : [];
    const v6 = hostV6(state, dev);
    return [...(v6 ? [{ family: 6 as const, addr: v6.addr, len: v6.len }] : []), { family: 6, addr: (BigInt(0xfe80) << BigInt(112)) | eui64(device.mac), len: 64 }];
  }
  const iface = device.interfaces[name];
  if (!iface) return [];
  if (family === 4) return iface.ipv4 ? [{ family: 4, ...iface.ipv4 }] : [];
  if (!v6Enabled(iface)) return [];
  return [...v6Globals(device, iface), { family: 6, addr: interfaceLinkLocal(device, iface), len: 64 }];
}

export function hostNic(device: Device) {
  return Object.keys(device.interfaces)[0];
}

/** Interfaces able to source or receive IP traffic. */
export function l3Interfaces(state: LabState, dev: string) {
  const device = state.devices[dev];
  if (device.kind === "host") return [hostNic(device)];
  return Object.values(device.interfaces).filter((iface) => !iface.switchport || iface.name.startsWith("Vlan")).filter((iface) => !iface.channelGroup).map((iface) => iface.name);
}

const routedDevice = (device: Device) => device.kind === "router" || (device.kind === "l3switch" && device.ipRouting);

// ---------- HSRP ----------

export function hsrpVip(state: LabState, dev: string, iface: string, group: number) {
  const own = state.devices[dev].interfaces[iface].standby[group];
  if (own?.ip !== undefined) return own.ip;
  for (const reached of l2Domain(state, dev, iface)) {
    const ip = state.devices[reached.dev].interfaces[reached.iface]?.standby[group]?.ip;
    if (ip !== undefined) return ip;
  }
  return undefined;
}

export function hsrpPriority(state: LabState, dev: string, iface: string, group: number) {
  const config = state.devices[dev].interfaces[iface].standby[group];
  return config.priority - config.track.filter((track) => !ifUp(state, dev, track.iface)).reduce((sum, track) => sum + track.decrement, 0);
}

/** True if this interface currently answers for the address, including as HSRP active or a static NAT global. */
function endpointOwns(state: LabState, reached: { dev: string; iface: string }, family: Family, addr: bigint) {
  const device = state.devices[reached.dev];
  if (ifaceAddrs(state, reached.dev, reached.iface, family).some((item) => item.addr === addr)) return true;
  if (family !== 4 || device.kind === "host") return false;
  const iface = device.interfaces[reached.iface];
  for (const group of Object.keys(iface.standby).map(Number)) {
    if (device.hsrp[`${reached.iface}:${group}`] === "Active" && hsrpVip(state, reached.dev, reached.iface, group) === addr) return true;
  }
  return iface.nat === "outside" && device.natStatics.some((item) => item.global === addr);
}

export function ownsAddress(state: LabState, dev: string, family: Family, addr: bigint) {
  return l3Interfaces(state, dev).some((name) => (state.devices[dev].kind === "host" || ifUp(state, dev, name)) && ifaceAddrs(state, dev, name, family).some((item) => item.addr === addr));
}

// ---------- OSPF ----------

export type OspfIf = { dev: string; iface: string; area: number; cost: number; passive: boolean; type: "broadcast" | "point-to-point" | "loopback"; hello: number; dead: number; priority: number; addr: bigint; len: number };

export function ifBandwidth(state: LabState, dev: string, name: string): number {
  const iface = state.devices[dev].interfaces[name];
  if (iface.bandwidth) return iface.bandwidth;
  if (name.includes(".")) return ifBandwidth(state, dev, parentIf(name));
  if (name.startsWith("Port-channel")) {
    const members = bundles(state, dev).find((bundle) => bundle.po === name)?.members.filter((member) => member.flag === "P") ?? [];
    return Math.max(1, members.length) * 1000000;
  }
  if (name.startsWith("Serial")) return 1544;
  if (name.startsWith("Loopback")) return 8000000;
  if (name.startsWith("FastEthernet")) return 100000;
  return 1000000;
}

export function ospfIfaces(state: LabState, dev: string): OspfIf[] {
  const device = state.devices[dev];
  const ospf = device.ospf;
  if (!ospf) return [];
  const result: OspfIf[] = [];
  for (const name of l3Interfaces(state, dev)) {
    const iface = device.interfaces[name];
    if (!iface.ipv4 || !ifUp(state, dev, name)) continue;
    let area = iface.ospf.pid === ospf.pid ? iface.ospf.area : undefined;
    if (area === undefined) {
      const statement = [...ospf.networks].sort((a, b) => (a.wildcard < b.wildcard ? -1 : a.wildcard > b.wildcard ? 1 : 0)).find((item) => wildcardMatch(iface.ipv4!.addr, item.addr, item.wildcard));
      area = statement?.area;
    }
    if (area === undefined) continue;
    const loopback = name.startsWith("Loopback");
    const type = iface.ospf.network ?? (loopback ? "loopback" : name.startsWith("Serial") ? "point-to-point" : "broadcast");
    const hello = iface.ospf.hello ?? 10;
    result.push({
      dev, iface: name, area,
      cost: iface.ospf.cost ?? Math.max(1, Math.floor((ospf.refBw * 1000) / ifBandwidth(state, dev, name))),
      passive: loopback || (ospf.passiveDefault ? !ospf.nonPassive.includes(name) : ospf.passive.includes(name)),
      type,
      hello,
      dead: iface.ospf.dead ?? hello * 4,
      priority: iface.ospf.priority ?? 1,
      addr: iface.ipv4.addr,
      len: iface.ipv4.len,
    });
  }
  return result;
}

export function computeRouterId(state: LabState, dev: string): bigint | undefined {
  const device = state.devices[dev];
  if (device.ospf?.routerId !== undefined) return device.ospf.routerId;
  const candidates = (loopback: boolean) => Object.values(device.interfaces)
    .filter((iface) => iface.ipv4 && iface.name.startsWith("Loopback") === loopback && ifUp(state, dev, iface.name))
    .map((iface) => iface.ipv4!.addr);
  const pick = (list: bigint[]) => list.reduce<bigint | undefined>((best, item) => (best === undefined || item > best ? item : best), undefined);
  return pick(candidates(true)) ?? pick(candidates(false));
}

export type OspfNeighbor = { local: OspfIf; peer: OspfIf; rid: bigint; state: "FULL" | "2WAY"; role: "DR" | "BDR" | "DROTHER" | "-" };
export type OspfProblem = { dev: string; message: string };

export function ospfAdjacency(state: LabState, dev: string): { neighbors: OspfNeighbor[]; problems: OspfProblem[]; dr: Record<string, { dr?: bigint; bdr?: bigint }> } {
  const device = state.devices[dev];
  const rid = device.ospf?.activeRid;
  const neighbors: OspfNeighbor[] = [];
  const problems: OspfProblem[] = [];
  const dr: Record<string, { dr?: bigint; bdr?: bigint }> = {};
  if (!device.ospf || rid === undefined) return { neighbors, problems, dr };
  for (const local of ospfIfaces(state, dev)) {
    if (local.passive) continue;
    const segment: { rid: bigint; priority: number; peer?: OspfIf }[] = [{ rid, priority: local.priority }];
    for (const reached of l2Domain(state, dev, local.iface)) {
      const peerDevice = state.devices[reached.dev];
      if (!peerDevice.ospf || peerDevice.ospf.activeRid === undefined) continue;
      const peer = ospfIfaces(state, reached.dev).find((item) => item.iface === reached.iface);
      if (!peer || peer.passive) continue;
      if (!sameSubnet(4, local.addr, peer.addr, local.len) || local.len !== peer.len) continue;
      if (peer.area !== local.area) {
        problems.push({ dev, message: `%OSPF-4-ERRRCV: Received invalid packet: mismatched area ID from backbone area from ${formatIpv4(peer.addr)}, ${local.iface}` });
        continue;
      }
      if (peer.hello !== local.hello || peer.dead !== local.dead || peer.type !== local.type) continue;
      if (peerDevice.ospf.activeRid === rid) {
        problems.push({ dev, message: `%OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id ${formatIpv4(rid)} from ${formatIpv4(peer.addr)} on interface ${local.iface}` });
        continue;
      }
      segment.push({ rid: peerDevice.ospf.activeRid, priority: peer.priority, peer });
    }
    if (local.type === "point-to-point") {
      for (const item of segment.slice(1)) neighbors.push({ local, peer: item.peer!, rid: item.rid, state: "FULL", role: "-" });
      continue;
    }
    const ranked = segment.filter((item) => item.priority > 0).sort((a, b) => b.priority - a.priority || (b.rid > a.rid ? 1 : b.rid < a.rid ? -1 : 0));
    const drRid = ranked[0]?.rid;
    const bdrRid = ranked[1]?.rid;
    dr[local.iface] = { dr: drRid, bdr: bdrRid };
    const roleOf = (value: bigint) => (value === drRid ? "DR" : value === bdrRid ? "BDR" : "DROTHER");
    for (const item of segment.slice(1)) {
      const full = rid === drRid || rid === bdrRid || item.rid === drRid || item.rid === bdrRid;
      neighbors.push({ local, peer: item.peer!, rid: item.rid, state: full ? "FULL" : "2WAY", role: roleOf(item.rid) });
    }
  }
  return { neighbors, problems, dr };
}

// ---------- Routing table ----------

export type NextHop = { ip?: bigint; iface: string };
export type Route = { family: Family; prefix: bigint; len: number; code: string; ad: number; metric: number; via: NextHop[] };

function connectedRoutes(state: LabState, dev: string, family: Family): Route[] {
  const routes: Route[] = [];
  for (const name of l3Interfaces(state, dev)) {
    if (!ifUp(state, dev, name)) continue;
    for (const item of ifaceAddrs(state, dev, name, family)) {
      if (family === 6 && isLinkLocal(item.addr)) continue;
      routes.push({ family, prefix: network(family, item.addr, item.len), len: item.len, code: "C", ad: 0, metric: 0, via: [{ iface: name }] });
      const hostLen = family === 4 ? 32 : 128;
      if (item.len !== hostLen) routes.push({ family, prefix: item.addr, len: hostLen, code: "L", ad: 0, metric: 0, via: [{ iface: name }] });
    }
  }
  return routes;
}

function bestMatch(routes: Route[], family: Family, addr: bigint, skip?: Route) {
  let best: Route | undefined;
  for (const route of routes) {
    if (route === skip || route.family !== family) continue;
    if ((addr & maskBits(family, route.len)) !== route.prefix) continue;
    if (!best || route.len > best.len || (route.len === best.len && route.ad < best.ad)) best = route;
  }
  return best;
}

function resolveStatics(state: LabState, dev: string, family: Family, base: Route[]): Route[] {
  const device = state.devices[dev];
  const resolved: Route[] = [];
  const candidates = device.staticRoutes.filter((route) => route.family === family);
  for (let pass = 0; pass < 3; pass += 1) {
    for (const route of candidates) {
      const prefix = network(family, route.prefix, route.len);
      if (resolved.some((item) => item.prefix === prefix && item.len === route.len && item.ad === route.ad && item.via[0].ip === route.nextHop)) continue;
      const code = route.len === 0 ? "S*" : "S";
      if (route.exitIf) {
        if (!ifUp(state, dev, route.exitIf)) continue;
        resolved.push({ family, prefix, len: route.len, code, ad: route.ad, metric: 0, via: [{ ip: route.nextHop, iface: route.exitIf }] });
        continue;
      }
      if (route.nextHop === undefined || (family === 6 && isLinkLocal(route.nextHop))) continue;
      const pool = [...base, ...resolved].filter((item) => !(item.prefix === prefix && item.len === route.len && item.code.startsWith("S")));
      const via = bestMatch(pool, family, route.nextHop);
      if (!via) continue;
      resolved.push({ family, prefix, len: route.len, code, ad: route.ad, metric: 0, via: [{ ip: route.nextHop, iface: via.via[0].iface }] });
    }
  }
  return resolved;
}

function hasDefaultStatic(state: LabState, dev: string) {
  return resolveStatics(state, dev, 4, connectedRoutes(state, dev, 4)).some((route) => route.len === 0);
}

function ospfRoutes(state: LabState, dev: string): Route[] {
  const self = state.devices[dev];
  if (!self.ospf || self.ospf.activeRid === undefined) return [];
  const adjacency: Record<string, OspfNeighbor[]> = {};
  const neighborsOf = (name: string) => (adjacency[name] ??= ospfAdjacency(state, name).neighbors);
  const peerDev = (neighbor: OspfNeighbor) => neighbor.peer.dev;
  const dist: Record<string, number> = { [dev]: 0 };
  const hops: Record<string, NextHop[]> = { [dev]: [] };
  const done = new Set<string>();
  while (true) {
    const current = Object.keys(dist).filter((name) => !done.has(name)).sort((a, b) => dist[a] - dist[b])[0];
    if (!current) break;
    done.add(current);
    for (const neighbor of neighborsOf(current)) {
      const target = peerDev(neighbor);
      // A neighbor only counts if it also sees us; one-way adjacencies never carry routes.
      if (!neighborsOf(target).some((back) => back.peer.dev === current)) continue;
      const cost = dist[current] + neighbor.local.cost;
      const viaHops = current === dev ? [{ ip: neighbor.peer.addr, iface: neighbor.local.iface }] : hops[current];
      if (dist[target] === undefined || cost < dist[target]) {
        dist[target] = cost;
        hops[target] = [...viaHops];
      } else if (cost === dist[target]) {
        for (const hop of viaHops) if (!hops[target].some((item) => item.ip === hop.ip && item.iface === hop.iface)) hops[target].push(hop);
      }
    }
  }
  const myAreas = new Set(ospfIfaces(state, dev).map((item) => item.area));
  const best = new Map<string, Route>();
  for (const router of Object.keys(dist)) {
    if (router === dev) continue;
    for (const item of ospfIfaces(state, router)) {
      const len = item.type === "loopback" ? 32 : item.len;
      const prefix = network(4, item.addr, len);
      const metric = dist[router] + (item.type === "loopback" ? 1 : item.cost);
      const key = `${prefix}/${len}`;
      const existing = best.get(key);
      const route: Route = { family: 4, prefix, len, code: myAreas.has(item.area) ? "O" : "O IA", ad: 110, metric, via: [...hops[router]] };
      if (!existing || metric < existing.metric) best.set(key, route);
      else if (metric === existing.metric) for (const hop of route.via) if (!existing.via.some((v) => v.ip === hop.ip)) existing.via.push(hop);
    }
    const ospf = state.devices[router].ospf!;
    if (ospf.defaultOriginate && hasDefaultStatic(state, router)) {
      const existing = best.get("0/0");
      if (!existing || dist[router] < existing.metric) best.set("0/0", { family: 4, prefix: BigInt(0), len: 0, code: "O*E2", ad: 110, metric: dist[router], via: [...hops[router]] });
    }
  }
  return [...best.values()].map((route) => (route.code === "O*E2" ? { ...route, metric: 1 } : route));
}

export function routingTable(state: LabState, dev: string, family: Family): Route[] {
  const device = state.devices[dev];
  if (device.kind === "host") return [];
  const connected = connectedRoutes(state, dev, family);
  if (!routedDevice(device)) return connected;
  const ospf = family === 4 ? ospfRoutes(state, dev) : [];
  const statics = resolveStatics(state, dev, family, [...connected, ...ospf]);
  const all = [...connected, ...ospf, ...statics];
  const selected = new Map<string, Route>();
  for (const route of all) {
    const key = `${route.code === "L" ? "L" : ""}${route.prefix}/${route.len}`;
    const current = selected.get(key);
    if (!current || route.ad < current.ad) selected.set(key, { ...route, via: [...route.via] });
    else if (current.ad === route.ad && route.code.startsWith("S") && current.code.startsWith("S")) current.via.push(...route.via);
  }
  return [...selected.values()];
}

export function lookup(state: LabState, dev: string, family: Family, addr: bigint) {
  return bestMatch(routingTable(state, dev, family), family, addr);
}

export function defaultGatewayRoute(state: LabState, dev: string): { egress: string; nextHop: bigint } | undefined {
  const device = state.devices[dev];
  if (device.defaultGateway === undefined) return undefined;
  for (const name of l3Interfaces(state, dev)) {
    const v4 = device.interfaces[name]?.ipv4;
    if (v4 && ifUp(state, dev, name) && sameSubnet(4, v4.addr, device.defaultGateway, v4.len)) return { egress: name, nextHop: device.defaultGateway };
  }
  return undefined;
}

// ---------- ACLs ----------

export type Packet = { family: Family; src: bigint; dst: bigint; proto: "icmp" | "tcp" | "udp"; sport: number; dport: number; reply?: boolean };

function portMatches(match: { op: string; ports: number[] } | undefined, port: number) {
  if (!match) return true;
  if (match.op === "eq") return match.ports.includes(port);
  if (match.op === "neq") return !match.ports.includes(port);
  if (match.op === "gt") return port > match.ports[0];
  if (match.op === "lt") return port < match.ports[0];
  return port >= match.ports[0] && port <= match.ports[1];
}

export function aclPermits(device: Device, name: string | undefined, pkt: Packet) {
  if (!name || pkt.family !== 4) return true;
  const acl = device.acls[name];
  if (!acl) return true;
  for (const entry of acl.entries) {
    if (!wildcardMatch(pkt.src, entry.src.addr, entry.src.wildcard)) continue;
    if (acl.kind === "extended") {
      if (entry.protocol !== "ip" && entry.protocol !== pkt.proto) continue;
      if (!wildcardMatch(pkt.dst, entry.dst.addr, entry.dst.wildcard)) continue;
      if (entry.protocol === "tcp" || entry.protocol === "udp") {
        if (!portMatches(entry.srcPort, pkt.sport) || !portMatches(entry.dstPort, pkt.dport)) continue;
        if (entry.established && !pkt.reply) continue;
      }
      if (entry.protocol === "icmp" && entry.icmpType && (entry.icmpType === "echo-reply") !== Boolean(pkt.reply)) continue;
    }
    entry.matches += 1;
    return entry.action === "permit";
  }
  return false;
}

// ---------- Forwarding ----------

export type Trace = { ok: boolean; hops: { dev: string; addr?: bigint }[]; reason?: "unreachable" | "acl" | "arp" | "ttl" | "refused" | "no-source" | "dai"; at?: string; dev?: string; pkt: Packet; ingress?: string };

const SERVICE_PORTS: Record<number, Service> = { 80: "http", 443: "https", 22: "ssh", 23: "telnet", 53: "dns", 123: "ntp" };

function natInsideToOutside(state: LabState, device: Device, ingress: Iface | undefined, egress: Iface, pkt: Packet) {
  if (ingress?.nat !== "inside" || egress.nat !== "outside") return;
  const statics = device.natStatics.find((item) => item.local === pkt.src);
  if (statics) { pkt.src = statics.global; return; }
  const existing = device.natTranslations.find((item) => item.insideLocal === pkt.src && item.localPort === pkt.sport && item.outside === pkt.dst && item.proto === pkt.proto);
  if (existing) { pkt.src = existing.insideGlobal; pkt.sport = existing.globalPort; return; }
  for (const rule of device.natRules) {
    const outside = device.interfaces[rule.iface];
    if (!outside?.ipv4 || !aclPermits(device, rule.list, { ...pkt, dst: BigInt(0) })) continue;
    let globalPort = pkt.sport;
    while (device.natTranslations.some((item) => item.insideGlobal === outside.ipv4!.addr && item.globalPort === globalPort && item.proto === pkt.proto)) globalPort += 1;
    device.natTranslations.push({ proto: pkt.proto, insideLocal: pkt.src, insideGlobal: outside.ipv4.addr, outside: pkt.dst, localPort: pkt.sport, globalPort });
    pkt.src = outside.ipv4.addr;
    pkt.sport = globalPort;
    return;
  }
}

function natOutsideToInside(device: Device, ingress: Iface, pkt: Packet) {
  if (ingress.nat !== "outside") return;
  const statics = device.natStatics.find((item) => item.global === pkt.dst);
  if (statics) { pkt.dst = statics.local; return; }
  const translation = device.natTranslations.find((item) => item.insideGlobal === pkt.dst && item.globalPort === pkt.dport && item.proto === pkt.proto);
  if (translation) { pkt.dst = translation.insideLocal; pkt.dport = translation.localPort; }
}

function sourceIfaceMac(state: LabState, dev: string, iface: string) {
  return ifaceMac(state.devices[dev], iface);
}

/** Dynamic ARP Inspection along a switch path: untrusted ports need a snooping binding for the sender. */
function daiAllows(state: LabState, path: Reached["path"], sender: { mac: string; ip: bigint }, target: { mac: string; ip: bigint }) {
  for (const hop of path) {
    const sw = state.devices[hop.dev];
    if (!sw.daiVlans.includes(hop.vlan)) continue;
    const check = (port: string | undefined, who: { mac: string; ip: bigint }) => {
      if (!port || port.startsWith("Vlan") || sw.interfaces[port]?.arpTrust) return true;
      return sw.snooping.bindings.some((binding) => binding.mac === who.mac && binding.ip === who.ip && binding.vlan === hop.vlan);
    };
    if (!check(hop.inPort, sender)) return { ok: false, dev: hop.dev, port: hop.inPort, who: sender };
    if (!check(hop.outPort, target)) return { ok: false, dev: hop.dev, port: hop.outPort!, who: target };
  }
  return { ok: true as const };
}

export function logTo(state: LabState, dev: string, message: string) {
  const device = state.devices[dev];
  const stamped = device.timestamps ? `*Oct 28 09:${String(Math.floor(state.tick / 60) % 60).padStart(2, "0")}:${String(state.tick % 60).padStart(2, "0")}.${String((state.tick * 37) % 1000).padStart(3, "0")}: ${message}` : message;
  device.logs.push(stamped);
  if (device.logs.length > 80) device.logs.shift();
  device.pending.push(stamped);
}

/** Pick the source address a device uses to reach a destination. */
export function sourceFor(state: LabState, dev: string, family: Family, dst: bigint, sourceIf?: string): bigint | undefined {
  const device = state.devices[dev];
  if (sourceIf) return ifaceAddrs(state, dev, sourceIf, family).find((item) => family === 4 || !isLinkLocal(item.addr))?.addr;
  if (device.kind === "host") return ifaceAddrs(state, dev, hostNic(device), family).find((item) => family === 4 || !isLinkLocal(item.addr))?.addr;
  const route = routedDevice(device) || family === 6 ? lookup(state, dev, family, dst) : undefined;
  const egress = route?.via[0]?.iface ?? (family === 4 ? (connectedRoutes(state, dev, 4).find((item) => (dst & maskBits(4, item.len)) === item.prefix)?.via[0].iface ?? defaultGatewayRoute(state, dev)?.egress) : undefined);
  if (!egress) return undefined;
  return ifaceAddrs(state, dev, egress, family).find((item) => family === 4 || !isLinkLocal(item.addr))?.addr;
}

export function forward(state: LabState, from: string, input: Packet): Trace {
  const pkt = { ...input };
  const hops: Trace["hops"] = [];
  let dev = from;
  let ingressName: string | undefined;
  for (let ttl = 0; ttl < 24; ttl += 1) {
    const device = state.devices[dev];
    const ingress = ingressName ? device.interfaces[ingressName] : undefined;
    if (ingress && device.kind !== "host") {
      if (!aclPermits(device, ingress.acl.in, pkt)) return { ok: false, hops, reason: "acl", at: dev, pkt, ingress: ingressName };
      natOutsideToInside(device, ingress, pkt);
    }
    if (ownsAddress(state, dev, pkt.family, pkt.dst) || (ingressName && endpointOwns(state, { dev, iface: ingressName }, pkt.family, pkt.dst) && device.kind !== "host" && pkt.proto === "icmp")) {
      if (device.kind === "host" && pkt.proto !== "icmp" && !pkt.reply && !device.host!.services.includes(SERVICE_PORTS[pkt.dport])) return { ok: false, hops, reason: "refused", at: dev, dev, pkt };
      return { ok: true, hops, dev, pkt };
    }
    if (ingressName && (!routedDevice(device) || (pkt.family === 6 && !device.ipv6Routing))) return { ok: false, hops, reason: "unreachable", at: dev, pkt, ingress: ingressName };

    let egressName: string | undefined;
    let nextHop: bigint | undefined;
    if (device.kind === "host") {
      const nic = hostNic(device);
      const own = ifaceAddrs(state, dev, nic, pkt.family).filter((item) => pkt.family === 4 || !isLinkLocal(item.addr));
      const gateway = pkt.family === 4 ? device.host!.gateway : hostV6(state, dev)?.gateway;
      egressName = nic;
      nextHop = own.some((item) => sameSubnet(pkt.family, item.addr, pkt.dst, item.len)) ? pkt.dst : gateway;
      if (!own.length) return { ok: false, hops, reason: "no-source", at: dev, pkt };
    } else if (routedDevice(device) || pkt.family === 6) {
      const route = lookup(state, dev, pkt.family, pkt.dst);
      if (!route) return { ok: false, hops, reason: "unreachable", at: dev, pkt, ingress: ingressName };
      egressName = route.via[0].iface;
      nextHop = route.via[0].ip ?? pkt.dst;
    } else {
      const connected = connectedRoutes(state, dev, 4).find((item) => item.code === "C" && (pkt.dst & maskBits(4, item.len)) === item.prefix);
      if (connected) { egressName = connected.via[0].iface; nextHop = pkt.dst; }
      else {
        const gateway = defaultGatewayRoute(state, dev);
        egressName = gateway?.egress;
        nextHop = gateway?.nextHop;
      }
    }
    if (!egressName || nextHop === undefined) return { ok: false, hops, reason: "unreachable", at: dev, pkt, ingress: ingressName };
    const egress = device.interfaces[egressName];
    if (device.kind !== "host") {
      natInsideToOutside(state, device, ingress, egress, pkt);
      if (!aclPermits(device, egress.acl.out, pkt)) return { ok: false, hops, reason: "acl", at: dev, pkt, ingress: ingressName };
    }
    const domain = l2Domain(state, dev, egressName, sourceIfaceMac(state, dev, egressName));
    const target = domain.find((reached) => endpointOwns(state, reached, pkt.family, nextHop!));
    if (!target) return { ok: false, hops, reason: "arp", at: dev, pkt };
    if (pkt.family === 4) {
      const senderIp = ifaceAddrs(state, dev, egressName, 4)[0]?.addr ?? pkt.src;
      const dai = daiAllows(state, target.path, { mac: sourceIfaceMac(state, dev, egressName), ip: senderIp }, { mac: sourceIfaceMac(state, target.dev, target.iface), ip: nextHop });
      if (!dai.ok) return { ok: false, hops, reason: "dai", at: dai.dev, dev: dai.port, pkt };
    }
    const hopAddr = ifaceAddrs(state, target.dev, target.iface, pkt.family).find((item) => pkt.family === 4 || !isLinkLocal(item.addr))?.addr ?? nextHop;
    hops.push({ dev: target.dev, addr: hopAddr });
    dev = target.dev;
    ingressName = target.iface;
  }
  return { ok: false, hops, reason: "ttl", at: dev, pkt };
}

/** A round trip: request then reply, both subject to routing, NAT and ACLs. */
export function roundTrip(state: LabState, from: string, pkt: Packet) {
  const out = forward(state, from, pkt);
  if (!out.ok) return { ok: false, out, back: undefined };
  const back = forward(state, out.dev!, { family: pkt.family, src: out.pkt.dst, dst: out.pkt.src, proto: pkt.proto, sport: out.pkt.dport, dport: out.pkt.sport, reply: true });
  return { ok: back.ok, out, back };
}

export function probe(state: LabState, from: string, family: Family, dst: bigint, proto: Packet["proto"] = "icmp", dport = 0, sourceIf?: string) {
  const src = sourceFor(state, from, family, dst, sourceIf);
  if (src === undefined) return { ok: false, out: { ok: false, hops: [], reason: "no-source" as const, pkt: { family, src: BigInt(0), dst, proto, sport: 0, dport } }, back: undefined };
  state.tick += 1;
  const id = (state.tick % 16000) + 1;
  return roundTrip(state, from, { family, src, dst, proto, sport: proto === "icmp" ? id : 49152 + id, dport });
}

/** Evaluates reachability on a throwaway copy so checks never touch counters or NAT tables. */
export function canReach(state: LabState, from: string, family: Family, dst: bigint, proto: Packet["proto"] = "icmp", dport = 0) {
  return probe(structuredClone(state), from, family, dst, proto, dport).ok;
}

// ---------- DHCP ----------

function poolFor(device: Device, giaddr: bigint) {
  return Object.entries(device.dhcpPools).find(([, pool]) => pool.network && sameSubnet(4, pool.network.addr, giaddr, pool.network.len));
}

function allocate(state: LabState, server: string, poolName: string, mac: string, domainAddrs: bigint[]) {
  const device = state.devices[server];
  const pool = device.dhcpPools[poolName];
  const existing = device.dhcpBindings.find((binding) => binding.mac === mac && binding.pool === poolName);
  if (existing) return existing.ip;
  const size = BigInt(1) << BigInt(32 - pool.network!.len);
  for (let offset = BigInt(1); offset < size - BigInt(1); offset += BigInt(1)) {
    const ip = pool.network!.addr + offset;
    if (device.dhcpExcluded.some((range) => ip >= range.start && ip <= range.end)) continue;
    if (device.dhcpBindings.some((binding) => binding.ip === ip) || ip === pool.defaultRouter || domainAddrs.includes(ip)) continue;
    device.dhcpBindings.push({ ip, mac, pool: poolName });
    return ip;
  }
  return undefined;
}

export type DhcpResult = { ok: boolean; message: string };

export function dhcpRenew(state: LabState, hostName: string): DhcpResult {
  const host = state.devices[hostName];
  const config = host.host!;
  const nic = hostNic(host);
  const domain = l2Domain(state, hostName, nic, host.mac);
  const domainAddrs = domain.flatMap((reached) => ifaceAddrs(state, reached.dev, reached.iface, 4).map((item) => item.addr));

  type Offer = { ip: bigint; len: number; gateway?: bigint; dns?: bigint; server: bigint; rogue: boolean; path: Reached["path"] };
  const candidates: { rogue: boolean; make: () => Offer | undefined }[] = [];
  const snoopBlocks = (path: Reached["path"]) => path.some((hop) => {
    const sw = state.devices[hop.dev];
    return sw.snooping.enabled && sw.snooping.vlans.includes(hop.vlan) && hop.outPort !== undefined && !hop.outPort.startsWith("Vlan") && !sw.interfaces[hop.outPort]?.snoopingTrust;
  });
  const option82 = (path: Reached["path"]) => path.some((hop) => {
    const sw = state.devices[hop.dev];
    return sw.snooping.enabled && sw.snooping.vlans.includes(hop.vlan) && sw.snooping.option82;
  });

  for (const reached of domain) {
    const device = state.devices[reached.dev];
    if (snoopBlocks(reached.path)) continue;
    if (device.kind === "host" && device.host?.dhcpServer) {
      const rogue = device.host.dhcpServer;
      candidates.push({ rogue: true, make: () => ({ ip: rogue.first, len: rogue.len, gateway: rogue.gateway, server: device.host!.ipv4!.addr, rogue: true, path: reached.path }) });
      continue;
    }
    if (device.kind === "host") continue;
    const iface = device.interfaces[reached.iface];
    if (!iface?.ipv4 || !ifUp(state, reached.dev, reached.iface)) continue;
    // Snooping switches add option 82 with giaddr 0; IOS servers and relays drop that unless told to trust it.
    if (option82(reached.path) && !device.dhcpRelayTrustAll) continue;
    const giaddr = iface.ipv4.addr;
    const local = poolFor(device, giaddr);
    if (local) {
      candidates.push({ rogue: false, make: () => {
        const ip = allocate(state, reached.dev, local[0], host.mac, domainAddrs);
        return ip === undefined ? undefined : { ip, len: local[1].network!.len, gateway: local[1].defaultRouter, dns: local[1].dns, server: giaddr, rogue: false, path: reached.path };
      } });
      continue;
    }
    for (const helper of iface.helpers) {
      const toServer = probe(structuredClone(state), reached.dev, 4, helper, "udp", 67, reached.iface);
      if (!toServer.ok || !toServer.out.dev) continue;
      const serverDev = toServer.out.dev;
      const remote = poolFor(state.devices[serverDev], giaddr);
      if (!remote) continue;
      candidates.push({ rogue: false, make: () => {
        const ip = allocate(state, serverDev, remote[0], host.mac, domainAddrs);
        return ip === undefined ? undefined : { ip, len: remote[1].network!.len, gateway: remote[1].defaultRouter, dns: remote[1].dns, server: helper, rogue: false, path: reached.path };
      } });
      break;
    }
  }
  // A rogue server on the local segment answers first.
  candidates.sort((a, b) => Number(b.rogue) - Number(a.rogue));
  let offer: Offer | undefined;
  for (const candidate of candidates) {
    offer = candidate.make();
    if (offer) break;
  }
  if (!offer) {
    config.ipv4 = undefined;
    config.gateway = undefined;
    config.lease = undefined;
    return { ok: false, message: "DHCP request failed." };
  }
  config.ipv4 = { addr: offer.ip, len: offer.len };
  config.gateway = offer.gateway;
  config.dns = offer.dns;
  config.lease = { server: offer.server, viaRogue: offer.rogue };
  for (const hop of offer.path) {
    const sw = state.devices[hop.dev];
    if (!sw.snooping.enabled || !sw.snooping.vlans.includes(hop.vlan)) continue;
    sw.snooping.bindings = sw.snooping.bindings.filter((binding) => binding.mac !== host.mac);
    sw.snooping.bindings.push({ mac: host.mac, ip: offer.ip, vlan: hop.vlan, iface: hop.inPort });
  }
  return { ok: true, message: "" };
}

// ---------- NTP ----------

export function ntpState(state: LabState, dev: string, depth = 0): { stratum: number; server?: bigint } | undefined {
  const device = state.devices[dev];
  if (device.kind === "host") return device.host!.services.includes("ntp") ? { stratum: 1 } : undefined;
  if (depth > 4) return undefined;
  for (const server of device.ntp.servers) {
    const reach = probe(structuredClone(state), dev, 4, server, "udp", 123);
    if (!reach.ok || !reach.out.dev) continue;
    const upstream = ntpState(state, reach.out.dev, depth + 1);
    if (upstream && upstream.stratum < 15) return { stratum: upstream.stratum + 1, server };
  }
  if (device.ntp.master !== undefined) return { stratum: device.ntp.master };
  return undefined;
}

// ---------- Remote access ----------

export function remoteLogin(state: LabState, from: string, dst: bigint, protocol: "ssh" | "telnet", user?: string): { ok: boolean; message: string } {
  const result = probe(state, from, 4, dst, "tcp", protocol === "ssh" ? 22 : 23);
  if (!result.ok) {
    if (result.out.reason === "refused") return { ok: false, message: "% Connection refused by remote host" };
    return { ok: false, message: result.out.reason === "acl" ? "% Destination unreachable; gateway or host down" : "% Connection timed out; remote host not responding" };
  }
  const target = state.devices[result.out.dev!];
  if (target.kind === "host") return { ok: true, message: `Connected to ${target.hostname}.` };
  const vty = target.lines.vty;
  const permittedTransport = vty.transport === "all" || (vty.transport !== "none" && vty.transport.includes(protocol));
  if (!permittedTransport) return { ok: false, message: "% Connection refused by remote host" };
  if (vty.accessClass) {
    const acl = target.acls[vty.accessClass];
    if (acl && !aclPermits(target, vty.accessClass, { family: 4, src: result.out.pkt.src, dst, proto: "tcp", sport: 0, dport: 22 })) return { ok: false, message: "% Connection refused by remote host" };
  }
  if (protocol === "ssh") {
    if (!target.rsaModulus || target.rsaModulus < 768) return { ok: false, message: "% Connection refused by remote host" };
    if (vty.login !== "local") return { ok: false, message: "% Authentication failed." };
    if (!user || !target.users[user]) return { ok: false, message: "% Authentication failed." };
  } else {
    if (vty.login === "line" && !vty.password) return { ok: false, message: "Password required, but none set\n\n[Connection to host closed by foreign host]" };
    if (vty.login === "local" && !Object.keys(target.users).length) return { ok: false, message: "% Login invalid\n\n[Connection to host closed by foreign host]" };
  }
  const banner = target.banner ? `${target.banner}\n\n` : "";
  const privilege = protocol === "ssh" && user ? target.users[user].privilege : 1;
  return { ok: true, message: `${banner}${target.hostname}${privilege >= 15 ? "#" : ">"}` };
}
