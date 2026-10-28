import { type Family, formatAddr, formatIpv4, formatIpv6, hashString, isLinkLocal, lenToMask } from "./addr";
import { interfaceLinkLocal, parentIf, shortIf, sortIfNames } from "./device";
import { bundles, l2Domain, l2Ports, logicalUp, opMode, peerOf, physUp, portCarries, spanningTree, stpPortId, trunkCarries } from "./l2";
import { hsrpPriority, hsrpVip, ifStatus, ntpState, ospfAdjacency, ospfIfaces, routingTable, v6Enabled, v6Globals, type Route } from "./l3";
import type { AclEntry, Device, Iface, LabState, PortMatch } from "./types";

const pad = (text: string | number, width: number) => String(text).padEnd(width);
const padStart = (text: string | number, width: number) => String(text).padStart(width);
const isSwitchDevice = (device: Device) => device.kind === "switch" || device.kind === "l3switch";

export function vlanList(vlans: number[] | null) {
  if (vlans === null) return "1-4094";
  if (!vlans.length) return "none";
  const sorted = [...new Set(vlans)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let index = 0; index < sorted.length;) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    parts.push(end - index >= 1 ? `${sorted[index]}-${sorted[end]}` : `${sorted[index]}`);
    index = end + 1;
  }
  return parts.join(",");
}

function fakeHash(seed: string, length: number) {
  const alphabet = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let value = hashString(seed);
  let out = "";
  for (let index = 0; index < length; index += 1) {
    value = Math.imul(value ^ (value >>> 13), 1597334677) >>> 0;
    out += alphabet[value % alphabet.length];
  }
  return out;
}

const secretText = (secret: string) => `9 $9$${fakeHash(secret, 14)}$${fakeHash(`${secret}!`, 43)}`;
const type7 = (password: string) => Array.from(password).map((char, index) => ((char.charCodeAt(0) ^ (0x5a + index * 7)) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join("").replace(/^/, "0822");

const PORT_NAMES: Record<number, string> = { 80: "www", 23: "telnet", 53: "domain", 123: "ntp", 67: "bootps", 68: "bootpc", 21: "ftp", 25: "smtp", 69: "tftp", 161: "snmp", 514: "syslog" };

export function portText(match?: PortMatch) {
  if (!match) return "";
  return ` ${match.op} ${match.ports.map((port) => PORT_NAMES[port] ?? String(port)).join(" ")}`;
}

export function addrSpec(spec: { addr: bigint; wildcard: bigint }) {
  if (spec.wildcard === BigInt(0xffffffff)) return "any";
  if (spec.wildcard === BigInt(0)) return `host ${formatIpv4(spec.addr)}`;
  return `${formatIpv4(spec.addr)} ${formatIpv4(spec.wildcard)}`;
}

export function aclEntryText(kind: "standard" | "extended", entry: Omit<AclEntry, "text" | "seq" | "matches">) {
  if (kind === "standard") return `${entry.action} ${addrSpec(entry.src)}${entry.log ? " log" : ""}`;
  return `${entry.action} ${entry.protocol} ${addrSpec(entry.src)}${portText(entry.srcPort)} ${addrSpec(entry.dst)}${portText(entry.dstPort)}${entry.icmpType ? ` ${entry.icmpType}` : ""}${entry.established ? " established" : ""}${entry.log ? " log" : ""}`;
}

// ---------- running-config ----------

function interfaceConfig(device: Device, iface: Iface) {
  const lines = [`interface ${iface.name}`];
  if (iface.description) lines.push(` description ${iface.description}`);
  if (iface.dot1q) lines.push(` encapsulation dot1Q ${iface.dot1q.vlan}${iface.dot1q.native ? " native" : ""}`);
  if (isSwitchDevice(device) && iface.switchport) {
    if (iface.nativeVlan !== 1) lines.push(` switchport trunk native vlan ${iface.nativeVlan}`);
    if (iface.allowed !== null) lines.push(` switchport trunk allowed vlan ${vlanList(iface.allowed)}`);
    if (iface.accessVlan !== 1) lines.push(` switchport access vlan ${iface.accessVlan}`);
    if (iface.mode !== "dynamic auto") lines.push(` switchport mode ${iface.mode}`);
    if (iface.nonegotiate) lines.push(" switchport nonegotiate");
    const security = iface.portSecurity;
    if (security.max !== 1) lines.push(` switchport port-security maximum ${security.max}`);
    if (security.violation !== "shutdown") lines.push(` switchport port-security violation ${security.violation}`);
    if (security.sticky) {
      lines.push(" switchport port-security mac-address sticky");
      for (const mac of device.psecLearned[iface.name] ?? []) lines.push(` switchport port-security mac-address sticky ${mac}`);
    }
    if (security.enabled) lines.push(" switchport port-security");
  } else if (device.kind === "l3switch" && iface.physical || (device.kind === "l3switch" && iface.name.startsWith("Port-channel") && !iface.switchport)) {
    lines.push(" no switchport");
  }
  if (iface.channelGroup) lines.push(` channel-group ${iface.channelGroup.id} mode ${iface.channelGroup.mode}`);
  if (iface.arpTrust) lines.push(" ip arp inspection trust");
  if (iface.portfast === true) lines.push(" spanning-tree portfast");
  if (iface.portfast === false) lines.push(" spanning-tree portfast disable");
  if (iface.bpduguard === true) lines.push(" spanning-tree bpduguard enable");
  if (iface.bpduguard === false) lines.push(" spanning-tree bpduguard disable");
  if (iface.stpCost) lines.push(` spanning-tree cost ${iface.stpCost}`);
  if (iface.snoopingRate) lines.push(` ip dhcp snooping limit rate ${iface.snoopingRate}`);
  if (iface.snoopingTrust) lines.push(" ip dhcp snooping trust");
  if (iface.bandwidth) lines.push(` bandwidth ${iface.bandwidth}`);
  if (!iface.switchport || iface.name.startsWith("Vlan")) {
    if (iface.ipv4) lines.push(` ip address ${formatIpv4(iface.ipv4.addr)} ${lenToMask(iface.ipv4.len)}`);
    else if (!iface.ipv6.length && device.kind === "router") lines.push(" no ip address");
    for (const helper of iface.helpers) lines.push(` ip helper-address ${formatIpv4(helper)}`);
    if (iface.acl.in) lines.push(` ip access-group ${iface.acl.in} in`);
    if (iface.acl.out) lines.push(` ip access-group ${iface.acl.out} out`);
    if (iface.nat) lines.push(` ip nat ${iface.nat}`);
    const ospf = iface.ospf;
    if (ospf.pid !== undefined) lines.push(` ip ospf ${ospf.pid} area ${ospf.area}`);
    if (ospf.network) lines.push(` ip ospf network ${ospf.network}`);
    if (ospf.cost !== undefined) lines.push(` ip ospf cost ${ospf.cost}`);
    if (ospf.priority !== undefined) lines.push(` ip ospf priority ${ospf.priority}`);
    if (ospf.hello !== undefined) lines.push(` ip ospf hello-interval ${ospf.hello}`);
    if (ospf.dead !== undefined) lines.push(` ip ospf dead-interval ${ospf.dead}`);
    if (iface.linkLocal !== undefined) lines.push(` ipv6 address ${formatIpv6(iface.linkLocal)} link-local`);
    for (const item of iface.ipv6) lines.push(` ipv6 address ${formatIpv6(item.addr)}/${item.len}${item.eui64 ? " eui-64" : ""}`);
    if (iface.ipv6Enabled) lines.push(" ipv6 enable");
    if (Object.keys(iface.standby).length && iface.standbyVersion === 2) lines.push(" standby version 2");
    for (const [group, config] of Object.entries(iface.standby)) {
      if (config.ip !== undefined) lines.push(` standby ${group} ip ${formatIpv4(config.ip)}`);
      if (config.priority !== 100) lines.push(` standby ${group} priority ${config.priority}`);
      if (config.preempt) lines.push(` standby ${group} preempt`);
      for (const track of config.track) lines.push(` standby ${group} track ${track.iface} ${track.decrement}`);
    }
  }
  if (iface.shutdown) lines.push(" shutdown");
  return lines;
}

function lineConfig(name: string, device: Device, line: Device["lines"]["con"]) {
  const lines = [`line ${name}`];
  if (line.accessClass) lines.push(` access-class ${line.accessClass} in`);
  if (line.execTimeout) lines.push(` exec-timeout ${line.execTimeout[0]} ${line.execTimeout[1]}`);
  if (line.password) lines.push(` password ${device.servicePasswordEncryption ? `7 ${type7(line.password)}` : line.password}`);
  if (line.loggingSync) lines.push(" logging synchronous");
  if (line.login === "local") lines.push(" login local");
  else if (line.login === "line" && name.startsWith("vty")) lines.push(" login");
  else if (line.login === "line") lines.push(" login");
  if (name.startsWith("vty") && line.transport !== "all") lines.push(` transport input ${line.transport === "none" ? "none" : line.transport.join(" ")}`);
  return lines;
}

export function runningConfig(device: Device) {
  const lines: string[] = ["!", "version 15.2"];
  if (device.timestamps) lines.push("service timestamps log datetime msec");
  if (device.servicePasswordEncryption) lines.push("service password-encryption");
  lines.push("!", `hostname ${device.hostname}`, "!");
  if (device.loginBlock) lines.push(`login block-for ${device.loginBlock.seconds} attempts ${device.loginBlock.attempts} within ${device.loginBlock.within}`);
  if (device.enableSecret) lines.push(`enable secret ${secretText(device.enableSecret)}`);
  if (device.loginBlock || device.enableSecret) lines.push("!");
  for (const range of device.dhcpExcluded) lines.push(`ip dhcp excluded-address ${formatIpv4(range.start)}${range.end !== range.start ? ` ${formatIpv4(range.end)}` : ""}`);
  if (device.dhcpExcluded.length) lines.push("!");
  for (const [name, pool] of Object.entries(device.dhcpPools)) {
    lines.push(`ip dhcp pool ${name}`);
    if (pool.network) lines.push(` network ${formatIpv4(pool.network.addr)} ${lenToMask(pool.network.len)}`);
    if (pool.defaultRouter !== undefined) lines.push(` default-router ${formatIpv4(pool.defaultRouter)}`);
    if (pool.dns !== undefined) lines.push(` dns-server ${formatIpv4(pool.dns)}`);
    if (pool.domain) lines.push(` domain-name ${pool.domain}`);
    lines.push("!");
  }
  if (device.dhcpRelayTrustAll) lines.push("ip dhcp relay information trust-all");
  if (device.snooping.vlans.length) lines.push(`ip dhcp snooping vlan ${vlanList(device.snooping.vlans)}`);
  if (!device.snooping.option82) lines.push("no ip dhcp snooping information option");
  if (device.snooping.enabled) lines.push("ip dhcp snooping");
  if (device.daiVlans.length) lines.push(`ip arp inspection vlan ${vlanList(device.daiVlans)}`);
  if (device.domainName) lines.push(`ip domain name ${device.domainName}`);
  if (device.kind === "l3switch" && device.ipRouting) lines.push("ip routing");
  if (device.ipv6Routing) lines.push("ipv6 unicast-routing");
  lines.push("!");
  for (const [user, config] of Object.entries(device.users)) {
    lines.push(`username ${user}${config.privilege !== 1 ? ` privilege ${config.privilege}` : ""} ${config.type === "secret" ? `secret ${secretText(config.secret)}` : `password ${device.servicePasswordEncryption ? `7 ${type7(config.secret)}` : `0 ${config.secret}`}`}`);
  }
  if (Object.keys(device.users).length) lines.push("!");
  if (isSwitchDevice(device)) {
    lines.push(`spanning-tree mode ${device.stp.mode}`);
    if (device.stp.portfastDefault) lines.push("spanning-tree portfast default");
    if (device.stp.bpduguardDefault) lines.push("spanning-tree portfast bpduguard default");
    const byPriority = new Map<number, number[]>();
    for (const [vlan, priority] of Object.entries(device.stp.priority)) byPriority.set(priority, [...(byPriority.get(priority) ?? []), Number(vlan)]);
    for (const [priority, vlans] of byPriority) lines.push(`spanning-tree vlan ${vlanList(vlans)} priority ${priority}`);
    if (device.loadBalance !== "src-mac") lines.push(`port-channel load-balance ${device.loadBalance}`);
    lines.push("!");
    for (const [id, name] of Object.entries(device.vlans)) {
      if (Number(id) === 1) continue;
      lines.push(`vlan ${id}`, ` name ${name}`, "!");
    }
  }
  for (const name of sortIfNames(Object.keys(device.interfaces))) lines.push(...interfaceConfig(device, device.interfaces[name]), "!");
  if (device.ospf) {
    const ospf = device.ospf;
    lines.push(`router ospf ${ospf.pid}`);
    if (ospf.routerId !== undefined) lines.push(` router-id ${formatIpv4(ospf.routerId)}`);
    if (ospf.refBw !== 100) lines.push(` auto-cost reference-bandwidth ${ospf.refBw}`);
    if (ospf.passiveDefault) {
      lines.push(" passive-interface default");
      for (const name of ospf.nonPassive) lines.push(` no passive-interface ${name}`);
    } else for (const name of ospf.passive) lines.push(` passive-interface ${name}`);
    for (const network of ospf.networks) lines.push(` network ${formatIpv4(network.addr)} ${formatIpv4(network.wildcard)} area ${network.area}`);
    if (ospf.defaultOriginate) lines.push(" default-information originate");
    lines.push("!");
  }
  for (const rule of device.natRules) lines.push(`ip nat inside source list ${rule.list} interface ${rule.iface}${rule.overload ? " overload" : ""}`);
  for (const item of device.natStatics) lines.push(`ip nat inside source static ${formatIpv4(item.local)} ${formatIpv4(item.global)}`);
  if (device.defaultGateway !== undefined) lines.push(`ip default-gateway ${formatIpv4(device.defaultGateway)}`);
  for (const route of device.staticRoutes.filter((item) => item.family === 4)) {
    lines.push(`ip route ${formatIpv4(route.prefix)} ${lenToMask(route.len)}${route.exitIf ? ` ${route.exitIf}` : ""}${route.nextHop !== undefined ? ` ${formatIpv4(route.nextHop)}` : ""}${route.ad !== 1 ? ` ${route.ad}` : ""}`);
  }
  if (device.sshVersion) lines.push(`ip ssh version ${device.sshVersion}`);
  lines.push("!");
  for (const [name, acl] of Object.entries(device.acls)) {
    if (acl.numbered) for (const entry of acl.entries) lines.push(`access-list ${name} ${entry.text}`);
    else {
      lines.push(`ip access-list ${acl.kind} ${name}`);
      for (const entry of acl.entries) lines.push(` ${entry.text}`);
    }
  }
  for (const route of device.staticRoutes.filter((item) => item.family === 6)) {
    lines.push(`ipv6 route ${formatIpv6(route.prefix)}/${route.len}${route.exitIf ? ` ${route.exitIf}` : ""}${route.nextHop !== undefined ? ` ${formatIpv6(route.nextHop)}` : ""}${route.ad !== 1 ? ` ${route.ad}` : ""}`);
  }
  if (device.loggingTrap) lines.push(`logging trap ${device.loggingTrap}`);
  for (const host of device.loggingHosts) lines.push(`logging host ${formatIpv4(host)}`);
  if (!device.cdp) lines.push("no cdp run");
  if (device.lldp) lines.push("lldp run");
  lines.push("!");
  if (device.banner) lines.push(`banner motd ^C${device.banner}^C`, "!");
  lines.push(...lineConfig("con 0", device, device.lines.con), ...lineConfig("vty 0 4", device, device.lines.vty), "!");
  if (device.ntp.master !== undefined) lines.push(`ntp master ${device.ntp.master}`);
  for (const server of device.ntp.servers) lines.push(`ntp server ${formatIpv4(server)}`);
  lines.push("!", "end");
  const body = lines.join("\n");
  return `Building configuration...\n\nCurrent configuration : ${body.length} bytes\n${body}`;
}

// ---------- interfaces ----------

export function showIpInterfaceBrief(state: LabState, dev: string) {
  const device = state.devices[dev];
  const rows = [`${pad("Interface", 23)}${pad("IP-Address", 16)}OK? Method ${pad("Status", 22)}Protocol`];
  for (const name of sortIfNames(Object.keys(device.interfaces))) {
    const iface = device.interfaces[name];
    const status = ifStatus(state, dev, name);
    const statusText = !status.admin ? "administratively down" : status.line ? "up" : "down";
    rows.push(`${pad(name, 23)}${pad(iface.ipv4 ? formatIpv4(iface.ipv4.addr) : "unassigned", 16)}YES ${pad(iface.ipv4 ? "manual" : "unset", 7)}${pad(statusText, 22)}${status.line ? "up" : "down"}`);
  }
  return rows.join("\n");
}

export function showIpv6InterfaceBrief(state: LabState, dev: string) {
  const device = state.devices[dev];
  const rows: string[] = [];
  for (const name of sortIfNames(Object.keys(device.interfaces))) {
    const iface = device.interfaces[name];
    if (iface.switchport && !name.startsWith("Vlan")) continue;
    const status = ifStatus(state, dev, name);
    rows.push(`${pad(name, 23)}[${!status.admin ? "administratively down/down" : status.line ? "up/up" : "down/down"}]`);
    if (!v6Enabled(iface)) rows.push("    unassigned");
    else {
      rows.push(`    ${formatIpv6(interfaceLinkLocal(device, iface))}`);
      for (const item of v6Globals(device, iface)) rows.push(`    ${formatIpv6(item.addr)}`);
    }
  }
  return rows.join("\n");
}

export function showInterfacesStatus(state: LabState, dev: string, errOnly: boolean) {
  const device = state.devices[dev];
  const rows = errOnly ? [`${pad("Port", 10)}${pad("Name", 19)}${pad("Status", 13)}Reason`] : [`${pad("Port", 10)}${pad("Name", 19)}${pad("Status", 13)}${pad("Vlan", 11)}${pad("Duplex", 7)}${pad("Speed", 7)}Type`];
  for (const name of sortIfNames(Object.keys(device.interfaces))) {
    const iface = device.interfaces[name];
    if (!iface.physical && !name.startsWith("Port-channel")) continue;
    const status = ifStatus(state, dev, name);
    const statusText = status.errDisabled ? "err-disabled" : !status.admin ? "disabled" : status.line ? "connected" : "notconnect";
    if (errOnly) {
      if (status.errDisabled) rows.push(`${pad(shortIf(name), 10)}${pad((iface.description ?? "").slice(0, 18), 19)}${pad(statusText, 13)}${status.errDisabled}`);
      continue;
    }
    const mode = iface.switchport ? (status.line ? opMode(state, dev, iface.channelGroup ? `Port-channel${iface.channelGroup.id}` : name) : iface.mode === "trunk" ? "trunk" : "access") : "routed";
    const vlan = mode === "trunk" ? "trunk" : mode === "routed" ? "routed" : String(iface.accessVlan);
    const gig = name.startsWith("Gigabit");
    rows.push(`${pad(shortIf(name), 10)}${pad((iface.description ?? "").slice(0, 18), 19)}${pad(statusText, 13)}${pad(vlan, 11)}${pad(status.line ? "a-full" : "auto", 7)}${pad(status.line ? (gig ? "a-1000" : "a-100") : "auto", 7)}${gig ? "10/100/1000BaseTX" : "10/100BaseTX"}`);
  }
  return rows.join("\n");
}

function trunkPorts(state: LabState, dev: string) {
  return l2Ports(state, dev).filter((port) => logicalUp(state, dev, port) && opMode(state, dev, port) === "trunk");
}

export function showInterfacesTrunk(state: LabState, dev: string) {
  const device = state.devices[dev];
  const ports = sortIfNames(trunkPorts(state, dev));
  if (!ports.length) return "";
  const allowed = (port: string) => device.interfaces[port].allowed;
  const active = (port: string) => Object.keys(device.vlans).map(Number).filter((vlan) => trunkCarries(state, dev, port, vlan));
  const stp = (port: string) => active(port).filter((vlan) => spanningTree(state, vlan).bridges[dev]?.ports.find((item) => item.port === port)?.state !== "BLK");
  const modeText = (port: string) => {
    const mode = device.interfaces[port].mode;
    return mode === "trunk" ? "on" : mode === "dynamic desirable" ? "desirable" : "auto";
  };
  return [
    `${pad("Port", 12)}${pad("Mode", 17)}${pad("Encapsulation", 15)}${pad("Status", 14)}Native vlan`,
    ...ports.map((port) => `${pad(shortIf(port), 12)}${pad(modeText(port), 17)}${pad("802.1q", 15)}${pad("trunking", 14)}${device.interfaces[port].nativeVlan}`),
    "",
    `${pad("Port", 12)}Vlans allowed on trunk`,
    ...ports.map((port) => `${pad(shortIf(port), 12)}${vlanList(allowed(port))}`),
    "",
    `${pad("Port", 12)}Vlans allowed and active in management domain`,
    ...ports.map((port) => `${pad(shortIf(port), 12)}${vlanList(active(port))}`),
    "",
    `${pad("Port", 12)}Vlans in spanning tree forwarding state and not pruned`,
    ...ports.map((port) => `${pad(shortIf(port), 12)}${vlanList(stp(port))}`),
  ].join("\n");
}

export function showInterfaceSwitchport(state: LabState, dev: string, name: string) {
  const iface = state.devices[dev].interfaces[name];
  if (!iface?.switchport) return `Name: ${shortIf(name)}\nSwitchport: Disabled`;
  const logical = iface.channelGroup ? `Port-channel${iface.channelGroup.id}` : name;
  const operational = physUp(state, dev, name) ? opMode(state, dev, logical) : "down";
  const adminMode = iface.mode === "trunk" ? "trunk" : iface.mode === "access" ? "static access" : iface.mode;
  return [
    `Name: ${shortIf(name)}`,
    "Switchport: Enabled",
    `Administrative Mode: ${adminMode}`,
    `Operational Mode: ${operational === "access" ? "static access" : operational}`,
    "Administrative Trunking Encapsulation: dot1q",
    `Operational Trunking Encapsulation: ${operational === "trunk" ? "dot1q" : "native"}`,
    `Negotiation of Trunking: ${iface.nonegotiate || iface.mode === "access" ? "Off" : "On"}`,
    `Access Mode VLAN: ${iface.accessVlan} (${state.devices[dev].vlans[iface.accessVlan] ?? "Inactive"})`,
    `Trunking Native Mode VLAN: ${iface.nativeVlan} (${state.devices[dev].vlans[iface.nativeVlan] ?? "Inactive"})`,
    `Trunking VLANs Enabled: ${iface.allowed === null ? "ALL" : vlanList(iface.allowed)}`,
  ].join("\n");
}

export function showVlanBrief(state: LabState, dev: string) {
  const device = state.devices[dev];
  const rows = [`${pad("VLAN", 5)}${pad("Name", 33)}${pad("Status", 10)}Ports`, `${"-".repeat(4)} ${"-".repeat(32)} ${"-".repeat(9)} ${"-".repeat(31)}`];
  const accessPorts = (vlan: number) => sortIfNames(Object.values(device.interfaces).filter((iface) => {
    if (!iface.switchport || iface.name.startsWith("Vlan") || iface.channelGroup) return false;
    const logical = iface.name;
    const mode = physUp(state, dev, logical) ? opMode(state, dev, logical) : iface.mode === "trunk" ? "trunk" : "access";
    return mode === "access" && iface.accessVlan === vlan;
  }).map((iface) => iface.name)).map(shortIf);
  for (const id of Object.keys(device.vlans).map(Number).sort((a, b) => a - b)) {
    const ports = accessPorts(id);
    const chunks: string[] = [];
    for (let index = 0; index < ports.length; index += 4) chunks.push(ports.slice(index, index + 4).join(", "));
    rows.push(`${pad(id, 5)}${pad(device.vlans[id], 33)}${pad("active", 10)}${chunks[0] ?? ""}`);
    for (const chunk of chunks.slice(1)) rows.push(`${" ".repeat(48)}${chunk}`);
  }
  rows.push(`${pad(1002, 5)}${pad("fddi-default", 33)}act/unsup`, `${pad(1003, 5)}${pad("token-ring-default", 33)}act/unsup`, `${pad(1004, 5)}${pad("fddinet-default", 33)}act/unsup`, `${pad(1005, 5)}${pad("trnet-default", 33)}act/unsup`);
  return rows.join("\n");
}

// ---------- EtherChannel / STP ----------

export function showEtherchannelSummary(state: LabState, dev: string) {
  const list = bundles(state, dev);
  const header = [
    "Flags:  D - down        P - bundled in port-channel",
    "        I - stand-alone s - suspended",
    "        H - Hot-standby (LACP only)",
    "        R - Layer3      S - Layer2",
    "        U - in use      f - failed to allocate aggregator",
    "",
    "        M - not in use, minimum links not met",
    "        u - unsuitable for bundling",
    "        w - waiting to be aggregated",
    "        d - default port",
    "",
    "",
    `Number of channel-groups in use: ${list.length}`,
    `Number of aggregators:           ${list.length}`,
    "",
    "Group  Port-channel  Protocol    Ports",
    "------+-------------+-----------+-----------------------------------------------",
  ];
  for (const bundle of list) {
    const flags = `${bundle.layer3 ? "R" : "S"}${bundle.up ? "U" : "D"}`;
    header.push(`${pad(bundle.id, 7)}${pad(`Po${bundle.id}(${flags})`, 16)}${pad(bundle.protocol, 10)}${bundle.members.map((member) => pad(`${shortIf(member.name)}(${member.flag})`, 12)).join("")}`.trimEnd());
  }
  return header.join("\n");
}

export function showLacpNeighbor(state: LabState, dev: string) {
  const rows: string[] = ["Flags:  S - Device is requesting Slow LACPDUs", "        F - Device is requesting Fast LACPDUs", "        A - Device is in Active mode       P - Device is in Passive mode", ""];
  for (const bundle of bundles(state, dev).filter((item) => item.protocol === "LACP")) {
    rows.push(`Channel group ${bundle.id} neighbors`, "", "Partner's information:", "", `${pad("", 18)}${pad("LACP port", 30)}Admin  Oper   Port    Port`, `${pad("Port", 10)}${pad("Flags", 8)}${pad("Priority  Dev ID", 22)}${pad("Age", 8)}key    Key    Number  State`);
    for (const member of bundle.members) {
      const peer = peerOf(state, dev, member.name);
      const peerDevice = peer ? state.devices[peer[0]] : undefined;
      const peerMode = peer ? peerDevice?.interfaces[peer[1]]?.channelGroup?.mode : undefined;
      if (!peer || !peerDevice || (peerMode !== "active" && peerMode !== "passive") || !physUp(state, dev, member.name)) continue;
      rows.push(`${pad(shortIf(member.name), 10)}${pad(peerMode === "active" ? "SA" : "SP", 8)}${pad(`32768     ${peerDevice.mac}`, 30)}0x0    0x${bundle.id}    0x${(Number(peer[1].match(/(\d+)$/)?.[1] ?? 0) + 0x100).toString(16)}   0x3D`);
    }
    rows.push("");
  }
  return rows.join("\n").trimEnd();
}

export function showSpanningTree(state: LabState, dev: string, onlyVlan?: number) {
  const device = state.devices[dev];
  const blocks: string[] = [];
  const vlans = onlyVlan !== undefined ? [onlyVlan] : Object.keys(device.vlans).map(Number).sort((a, b) => a - b);
  for (const vlan of vlans) {
    if (!device.vlans[vlan]) { blocks.push(`Spanning tree instance(s) for vlan ${vlan} does not exist.`); continue; }
    const tree = spanningTree(state, vlan);
    const bridge = tree.bridges[dev];
    if (!bridge || !bridge.ports.length) { if (onlyVlan !== undefined) blocks.push(`Spanning tree instance(s) for vlan ${vlan} does not exist.`); continue; }
    const isRoot = bridge.root.dev === dev;
    const lines = [
      `VLAN${String(vlan).padStart(4, "0")}`,
      `  Spanning tree enabled protocol ${device.stp.mode === "rapid-pvst" ? "rstp" : "ieee"}`,
      `  Root ID    Priority    ${bridge.root.priority}`,
      `             Address     ${bridge.root.mac}`,
      ...(isRoot ? ["             This bridge is the root"] : [`             Cost        ${bridge.rootCost}`, `             Port        ${bridge.rootPort ? stpPortId(bridge.rootPort).split(".")[1] : 0} (${bridge.rootPort})`]),
      "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
      "",
      `  Bridge ID  Priority    ${bridge.priority}  (priority ${bridge.priority - vlan} sys-id-ext ${vlan})`,
      `             Address     ${device.bridgeMac}`,
      "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
      "             Aging Time  300 sec",
      "",
      `${pad("Interface", 20)}Role Sts Cost      Prio.Nbr Type`,
      "------------------- ---- --- --------- -------- --------------------------------",
      ...sortIfNames(bridge.ports.map((port) => port.port)).map((name) => {
        const port = bridge.ports.find((item) => item.port === name)!;
        return `${pad(shortIf(port.port), 20)}${port.role} ${port.state} ${pad(port.cost, 10)}${pad(port.prio, 9)}P2p${port.edge ? " Edge" : ""}`;
      }),
    ];
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

export function showSpanningTreeSummary(state: LabState, dev: string) {
  const device = state.devices[dev];
  const rootFor = Object.keys(device.vlans).map(Number).filter((vlan) => spanningTree(state, vlan).bridges[dev]?.root.dev === dev);
  return [
    `Switch is in ${device.stp.mode} mode`,
    `Root bridge for: ${rootFor.length ? rootFor.map((vlan) => `VLAN${String(vlan).padStart(4, "0")}`).join(", ") : "none"}`,
    "Extended system ID                      is enabled",
    `Portfast Default                        is ${device.stp.portfastDefault ? "enabled" : "disabled"}`,
    `PortFast BPDU Guard Default             is ${device.stp.bpduguardDefault ? "enabled" : "disabled"}`,
    "Portfast BPDU Filter Default            is disabled",
    "Loopguard Default                       is disabled",
    "EtherChannel misconfig guard            is enabled",
    "UplinkFast                              is disabled",
    "BackboneFast                            is disabled",
    "Pathcost method used                    is short",
  ].join("\n");
}

// ---------- Routing ----------

const classfulLen = (prefix: bigint) => {
  const first = Number(prefix >> BigInt(24));
  return first < 128 ? 8 : first < 192 ? 16 : 24;
};

function viaText(route: Route, hop: Route["via"][number], family: Family) {
  if (route.code === "C" || route.code === "L") return `is directly connected, ${hop.iface}`;
  const metric = `[${route.ad}/${route.metric}]`;
  const age = route.code.startsWith("O") ? ", 00:03:12" : "";
  if (hop.ip === undefined) return `is directly connected, ${hop.iface}`;
  return `${metric} via ${formatAddr(family, hop.ip)}${age}${route.code.startsWith("O") ? `, ${hop.iface}` : ""}`;
}

export function showIpRoute(state: LabState, dev: string, filter?: string) {
  const device = state.devices[dev];
  let routes = routingTable(state, dev, 4);
  const all = routes;
  if (filter === "ospf") routes = routes.filter((route) => route.code.startsWith("O"));
  if (filter === "static") routes = routes.filter((route) => route.code.startsWith("S"));
  if (filter === "connected") routes = routes.filter((route) => route.code === "C" || route.code === "L");
  const codes = [
    "Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP",
    "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area",
    "       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2",
    "       E1 - OSPF external type 1, E2 - OSPF external type 2",
    "       * - candidate default, U - per-user static route, o - ODR",
    "       P - periodic downloaded static route, H - NHRP, l - LISP",
    "       + - replicated route, % - next hop override",
    "",
  ];
  const defaultRoute = all.find((route) => route.len === 0);
  const gateway = device.kind !== "router" && !device.ipRouting
    ? (device.defaultGateway !== undefined ? `Default gateway is ${formatIpv4(device.defaultGateway)}` : "Default gateway is not set")
    : defaultRoute
      ? `Gateway of last resort is ${defaultRoute.via[0].ip !== undefined ? formatIpv4(defaultRoute.via[0].ip) : "0.0.0.0"} to network 0.0.0.0`
      : "Gateway of last resort is not set";
  const lines = [...codes, gateway, ""];
  if (device.kind !== "router" && !device.ipRouting) return lines.join("\n").trimEnd();
  const sorted = [...routes].sort((a, b) => (a.prefix < b.prefix ? -1 : a.prefix > b.prefix ? 1 : a.len - b.len));
  const groups = new Map<string, Route[]>();
  for (const route of sorted) {
    const major = route.len > classfulLen(route.prefix) ? `${route.prefix >> BigInt(32 - classfulLen(route.prefix))}` : `self-${route.prefix}-${route.len}`;
    groups.set(major, [...(groups.get(major) ?? []), route]);
  }
  for (const [key, items] of groups) {
    const nested = !key.startsWith("self");
    if (nested) {
      const cl = classfulLen(items[0].prefix);
      const majorPrefix = (items[0].prefix >> BigInt(32 - cl)) << BigInt(32 - cl);
      const masks = new Set(items.map((item) => item.len));
      lines.push(masks.size > 1
        ? `      ${formatIpv4(majorPrefix)}/${cl} is variably subnetted, ${items.length} subnets, ${masks.size} masks`
        : `      ${formatIpv4(majorPrefix)}/${items[0].len} is subnetted, ${items.length} subnets`);
    }
    for (const route of items) {
      const code = route.code.replace("O IA", "O IA").replace("O*E2", "O*E2");
      const prefixText = `${formatIpv4(route.prefix)}${nested && new Set(items.map((item) => item.len)).size === 1 ? "" : `/${route.len}`}`;
      const first = `${pad(code, nested ? 9 : 6)}${prefixText} ${viaText(route, route.via[0], 4)}`;
      lines.push(first);
      for (const hop of route.via.slice(1)) lines.push(`${" ".repeat((nested ? 9 : 6) + prefixText.length + 1)}${viaText(route, hop, 4)}`);
    }
  }
  return lines.join("\n");
}

export function showIpv6Route(state: LabState, dev: string, filter?: string) {
  let routes = routingTable(state, dev, 6);
  if (filter === "static") routes = routes.filter((route) => route.code.startsWith("S"));
  const sorted = [...routes].sort((a, b) => (a.prefix < b.prefix ? -1 : a.prefix > b.prefix ? 1 : a.len - b.len));
  const lines = [
    `IPv6 Routing Table - default - ${sorted.length + 1} entries`,
    "Codes: C - Connected, L - Local, S - Static, U - Per-user Static route",
    "       B - BGP, R - RIP, H - NHRP, I1 - ISIS L1",
    "       I2 - ISIS L2, IA - ISIS interarea, IS - ISIS summary, D - EIGRP",
    "       EX - EIGRP external, ND - ND Default, NDp - ND Prefix, DCE - Destination",
    "       NDr - Redirect, O - OSPF Intra, OI - OSPF Inter, OE1 - OSPF ext 1",
    "       OE2 - OSPF ext 2, ON1 - OSPF NSSA ext 1, ON2 - OSPF NSSA ext 2",
  ];
  for (const route of sorted) {
    lines.push(`${pad(route.code.replace("*", ""), 4)}${formatIpv6(route.prefix)}/${route.len} [${route.ad}/${route.metric}]`);
    for (const hop of route.via) {
      if (route.code === "C") lines.push(`     via ${hop.iface}, directly connected`);
      else if (route.code === "L") lines.push(`     via ${hop.iface}, receive`);
      else lines.push(`     via ${hop.ip !== undefined ? formatIpv6(hop.ip) : hop.iface}${hop.ip !== undefined && hop.iface && isLinkLocal(hop.ip) ? `, ${hop.iface}` : hop.ip === undefined ? ", directly connected" : ""}`);
    }
  }
  lines.push(`${pad("L", 4)}FF00::/8 [0/0]`, "     via Null0, receive");
  return lines.join("\n");
}

// ---------- OSPF ----------

export function showIpOspfNeighbor(state: LabState, dev: string) {
  const { neighbors } = ospfAdjacency(state, dev);
  const rows = [`${pad("Neighbor ID", 16)}${pad("Pri", 6)}${pad("State", 16)}${pad("Dead Time", 12)}${pad("Address", 16)}Interface`];
  for (const neighbor of neighbors) {
    const stateText = `${neighbor.state}/${neighbor.role === "-" ? "  -" : neighbor.role}`;
    rows.push(`${pad(formatIpv4(neighbor.rid), 16)}${pad(padStart(neighbor.peer.priority, 3), 6)}${pad(stateText, 16)}${pad(`00:00:${String(Math.max(neighbor.peer.dead - 5, 0)).padStart(2, "0")}`, 12)}${pad(formatIpv4(neighbor.peer.addr), 16)}${neighbor.local.iface}`);
  }
  return neighbors.length ? rows.join("\n") : "";
}

function ospfIfState(state: LabState, dev: string, item: ReturnType<typeof ospfIfaces>[number]) {
  if (item.type === "loopback") return "LOOP";
  if (item.type === "point-to-point") return "P2P";
  const rid = state.devices[dev].ospf!.activeRid;
  const election = ospfAdjacency(state, dev).dr[item.iface];
  if (item.passive || !election) return "DR";
  if (item.priority === 0) return "DROTH";
  return election.dr === rid ? "DR" : election.bdr === rid ? "BDR" : "DROTH";
}

export function showIpOspfInterface(state: LabState, dev: string, brief: boolean, only?: string) {
  const device = state.devices[dev];
  if (!device.ospf) return "";
  const items = ospfIfaces(state, dev).filter((item) => !only || item.iface === only);
  const { neighbors, dr } = ospfAdjacency(state, dev);
  if (brief) {
    const rows = [`${pad("Interface", 13)}${pad("PID", 6)}${pad("Area", 16)}${pad("IP Address/Mask", 19)}${pad("Cost", 6)}${pad("State", 6)}Nbrs F/C`];
    for (const item of items) {
      const mine = neighbors.filter((neighbor) => neighbor.local.iface === item.iface);
      rows.push(`${pad(shortIf(item.iface), 13)}${pad(device.ospf.pid, 6)}${pad(item.area, 16)}${pad(`${formatIpv4(item.addr)}/${item.len}`, 19)}${pad(item.cost, 6)}${pad(ospfIfState(state, dev, item), 6)}${mine.filter((n) => n.state === "FULL").length}/${mine.length}`);
    }
    return rows.join("\n");
  }
  const blocks: string[] = [];
  for (const item of items) {
    const mine = neighbors.filter((neighbor) => neighbor.local.iface === item.iface);
    const typeText = item.type === "loopback" ? "LOOPBACK" : item.type === "point-to-point" ? "POINT_TO_POINT" : "BROADCAST";
    const lines = [
      `${item.iface} is up, line protocol is up`,
      `  Internet Address ${formatIpv4(item.addr)}/${item.len}, Area ${item.area}, Attached via ${device.interfaces[item.iface].ospf.pid !== undefined ? "Interface Enable" : "Network Statement"}`,
      `  Process ID ${device.ospf.pid}, Router ID ${device.ospf.activeRid !== undefined ? formatIpv4(device.ospf.activeRid) : "0.0.0.0"}, Network Type ${typeText}, Cost: ${item.cost}`,
    ];
    if (item.type === "loopback") lines.push("  Loopback interface is treated as a stub Host");
    else {
      lines.push(`  Transmit Delay is 1 sec, State ${item.type === "point-to-point" ? "POINT_TO_POINT" : ospfIfState(state, dev, item).replace("DROTH", "DROTHER")}, Priority ${item.priority}`);
      const election = dr[item.iface];
      if (item.type === "broadcast" && election?.dr !== undefined) {
        lines.push(`  Designated Router (ID) ${formatIpv4(election.dr)}`);
        if (election.bdr !== undefined) lines.push(`  Backup Designated router (ID) ${formatIpv4(election.bdr)}`);
      }
      lines.push(`  Timer intervals configured, Hello ${item.hello}, Dead ${item.dead}, Wait ${item.dead}, Retransmit 5`);
      if (item.passive) lines.push("    No Hellos (Passive interface)");
      else lines.push("    Hello due in 00:00:04");
      lines.push(`  Neighbor Count is ${mine.length}, Adjacent neighbor count is ${mine.filter((n) => n.state === "FULL").length}`);
      for (const neighbor of mine.filter((n) => n.state === "FULL")) lines.push(`    Adjacent with neighbor ${formatIpv4(neighbor.rid)}${neighbor.role === "DR" ? "  (Designated Router)" : neighbor.role === "BDR" ? "  (Backup Designated Router)" : ""}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n");
}

export function showIpOspf(state: LabState, dev: string) {
  const ospf = state.devices[dev].ospf;
  if (!ospf) return "";
  const areas = [...new Set(ospfIfaces(state, dev).map((item) => item.area))];
  return [
    ` Routing Process "ospf ${ospf.pid}" with ID ${ospf.activeRid !== undefined ? formatIpv4(ospf.activeRid) : "0.0.0.0"}`,
    " Start time: 00:00:08.112, Time elapsed: 00:14:22.506",
    " Supports only single TOS(TOS0) routes",
    " Supports opaque LSA",
    ` ${ospf.defaultOriginate ? "It is an autonomous system boundary router" : "Router is not originating router-LSAs with maximum metric"}`,
    ` Reference bandwidth unit is ${ospf.refBw} mbps`,
    ` Number of areas in this router is ${areas.length}. ${areas.length} normal 0 stub 0 nssa`,
    ...areas.map((area) => `    Area ${area === 0 ? "BACKBONE(0)" : area}\n        Number of interfaces in this area is ${ospfIfaces(state, dev).filter((item) => item.area === area).length}`),
  ].join("\n");
}

export function showIpProtocols(state: LabState, dev: string) {
  const device = state.devices[dev];
  const ospf = device.ospf;
  if (!ospf) return "*** IP Routing is NSF aware ***\n";
  const items = ospfIfaces(state, dev);
  const explicit = items.filter((item) => device.interfaces[item.iface].ospf.pid !== undefined);
  const neighbors = ospfAdjacency(state, dev).neighbors;
  const passive = ospf.passiveDefault
    ? Object.keys(device.interfaces).filter((name) => !ospf.nonPassive.includes(name) && !device.interfaces[name].switchport)
    : ospf.passive;
  return [
    "*** IP Routing is NSF aware ***",
    "",
    `Routing Protocol is "ospf ${ospf.pid}"`,
    "  Outgoing update filter list for all interfaces is not set",
    "  Incoming update filter list for all interfaces is not set",
    `  Router ID ${ospf.activeRid !== undefined ? formatIpv4(ospf.activeRid) : "0.0.0.0"}`,
    ...(ospf.defaultOriginate ? ["  It is an autonomous system boundary router", "  Redistributing External Routes from,"] : []),
    `  Number of areas in this router is ${new Set(items.map((item) => item.area)).size}. ${new Set(items.map((item) => item.area)).size} normal 0 stub 0 nssa`,
    "  Maximum path: 4",
    "  Routing for Networks:",
    ...ospf.networks.map((network) => `    ${formatIpv4(network.addr)} ${formatIpv4(network.wildcard)} area ${network.area}`),
    ...(explicit.length ? [`  Routing on Interfaces Configured Explicitly (Area ${explicit[0].area}):`, ...explicit.map((item) => `    ${item.iface}`)] : []),
    ...(passive.length ? ["  Passive Interface(s):", ...passive.map((name) => `    ${name}`)] : []),
    "  Routing Information Sources:",
    "    Gateway         Distance      Last Update",
    ...[...new Set(neighbors.map((neighbor) => neighbor.rid))].map((rid) => `    ${pad(formatIpv4(rid), 16)}${padStart(110, 8)}      00:03:12`),
    "  Distance: (default is 110)",
  ].join("\n");
}

// ---------- HSRP ----------

function hsrpPeers(state: LabState, dev: string, iface: string, group: number) {
  const version = state.devices[dev].interfaces[iface].standbyVersion;
  return l2Domain(state, dev, iface).filter((reached) => {
    const peer = state.devices[reached.dev].interfaces[reached.iface];
    return peer?.standby[group] && peer.standbyVersion === version;
  });
}

export function showStandby(state: LabState, dev: string, brief: boolean) {
  const device = state.devices[dev];
  const entries: { iface: string; group: number }[] = [];
  for (const iface of Object.values(device.interfaces)) for (const group of Object.keys(iface.standby).map(Number)) entries.push({ iface: iface.name, group });
  const peerState = (entry: { iface: string; group: number }, wanted: string) => {
    for (const reached of hsrpPeers(state, dev, entry.iface, entry.group)) {
      if (state.devices[reached.dev].hsrp[`${reached.iface}:${entry.group}`] === wanted) return reached;
    }
    return undefined;
  };
  const roleAddr = (entry: { iface: string; group: number }, wanted: "Active" | "Standby") => {
    if (device.hsrp[`${entry.iface}:${entry.group}`] === wanted) return "local";
    const peer = peerState(entry, wanted);
    return peer ? formatIpv4(state.devices[peer.dev].interfaces[peer.iface].ipv4!.addr) : "unknown";
  };
  if (brief) {
    const rows = [`${" ".repeat(21)}P indicates configured to preempt.`, `${" ".repeat(21)}|`, `${pad("Interface", 12)}${pad("Grp", 5)}${pad("Pri", 4)}P ${pad("State", 8)}${pad("Active", 16)}${pad("Standby", 16)}Virtual IP`];
    for (const entry of entries) {
      const config = device.interfaces[entry.iface].standby[entry.group];
      const vip = hsrpVip(state, dev, entry.iface, entry.group);
      rows.push(`${pad(shortIf(entry.iface), 12)}${pad(entry.group, 5)}${pad(hsrpPriority(state, dev, entry.iface, entry.group), 4)}${config.preempt ? "P" : " "} ${pad(device.hsrp[`${entry.iface}:${entry.group}`] ?? "Init", 8)}${pad(roleAddr(entry, "Active"), 16)}${pad(roleAddr(entry, "Standby"), 16)}${vip !== undefined ? formatIpv4(vip) : "unknown"}`);
    }
    return rows.join("\n");
  }
  return entries.map((entry) => {
    const iface = device.interfaces[entry.iface];
    const config = iface.standby[entry.group];
    const vip = hsrpVip(state, dev, entry.iface, entry.group);
    const vmac = iface.standbyVersion === 2 ? `0000.0c9f.f${entry.group.toString(16).padStart(3, "0")}` : `0000.0c07.ac${entry.group.toString(16).padStart(2, "0")}`;
    const priority = hsrpPriority(state, dev, entry.iface, entry.group);
    return [
      `${entry.iface} - Group ${entry.group}${iface.standbyVersion === 2 ? " (version 2)" : ""}`,
      `  State is ${device.hsrp[`${entry.iface}:${entry.group}`] ?? "Init"}`,
      `  Virtual IP address is ${vip !== undefined ? formatIpv4(vip) : "unknown"}`,
      `  Active virtual MAC address is ${vmac}`,
      "  Hello time 3 sec, hold time 10 sec",
      `  Preemption ${config.preempt ? "enabled" : "disabled"}`,
      `  Active router is ${roleAddr(entry, "Active")}`,
      `  Standby router is ${roleAddr(entry, "Standby")}`,
      `  Priority ${priority} (configured ${config.priority})`,
      ...config.track.map((track) => `    Track interface ${track.iface} state ${ifStatus(state, dev, track.iface).line && ifStatus(state, dev, track.iface).admin ? "Up" : "Down"} decrement ${track.decrement}`),
      `  Group name is "hsrp-${shortIf(entry.iface)}-${entry.group}" (default)`,
    ].join("\n");
  }).join("\n");
}

// ---------- DHCP / snooping / DAI ----------

const colonMac = (mac: string) => mac.replace(/\./g, "").toUpperCase().match(/../g)!.join(":");

export function showDhcpBinding(device: Device) {
  const rows = ["Bindings from all pools not associated with VRF:", `${pad("IP address", 20)}${pad("Client-ID/", 24)}${pad("Lease expiration", 24)}${pad("Type", 11)}State`, `${pad("", 20)}Hardware address/`, `${pad("", 20)}User name`];
  for (const binding of [...device.dhcpBindings].sort((a, b) => (a.ip < b.ip ? -1 : 1))) {
    rows.push(`${pad(formatIpv4(binding.ip), 20)}${pad(`01${binding.mac.replace(/\./g, "").replace(/(..)(..)(..)(..)(..)(..)/, "$1.$2$3.$4$5.$6")}`, 24)}${pad("Oct 29 2026 09:14 AM", 24)}${pad("Automatic", 11)}Active`);
  }
  return rows.join("\n");
}

export function showDhcpPool(device: Device) {
  return Object.entries(device.dhcpPools).map(([name, pool]) => {
    if (!pool.network) return `Pool ${name} :\n Utilization mark (high/low)    : 100 / 0\n Total addresses                : 0`;
    const total = (2 ** (32 - pool.network.len)) - 2;
    const first = pool.network.addr + BigInt(1);
    const last = pool.network.addr + BigInt(total);
    const excluded = device.dhcpExcluded.reduce((sum, range) => {
      const start = range.start > first ? range.start : first;
      const end = range.end < last ? range.end : last;
      return end >= start ? sum + Number(end - start) + 1 : sum;
    }, 0);
    const leased = device.dhcpBindings.filter((binding) => binding.pool === name).length;
    return [
      `Pool ${name} :`,
      " Utilization mark (high/low)    : 100 / 0",
      " Subnet size (first/next)       : 0 / 0",
      ` Total addresses                : ${total}`,
      ` Leased addresses               : ${leased}`,
      ` Excluded addresses             : ${excluded}`,
      " Pending event                  : none",
      " 1 subnet is currently in the pool :",
      ` ${pad("Current index", 21)}${pad("IP address range", 36)}Leased/Excluded/Total`,
      ` ${pad(formatIpv4(first + BigInt(leased + excluded)), 21)}${pad(`${formatIpv4(first)}     - ${formatIpv4(last)}`, 36)}${leased}    / ${excluded}    / ${total}`,
    ].join("\n");
  }).join("\n\n");
}

export function showDhcpSnooping(device: Device) {
  const ifaces = sortIfNames(Object.values(device.interfaces).filter((iface) => iface.snoopingTrust || iface.snoopingRate).map((iface) => iface.name));
  return [
    `Switch DHCP snooping is ${device.snooping.enabled ? "enabled" : "disabled"}`,
    "Switch DHCP gleaning is disabled",
    "DHCP snooping is configured on following VLANs:",
    vlanList(device.snooping.vlans),
    "DHCP snooping is operational on following VLANs:",
    device.snooping.enabled ? vlanList(device.snooping.vlans) : "none",
    "DHCP snooping is configured on the following L3 Interfaces:",
    "",
    `Insertion of option 82 is ${device.snooping.option82 ? "enabled" : "disabled"}`,
    "   circuit-id default format: vlan-mod-port",
    "   remote-id: " + device.mac + " (MAC)",
    "Option 82 on untrusted port is not allowed",
    "Verification of hwaddr field is enabled",
    "Verification of giaddr field is enabled",
    "DHCP snooping trust/rate is configured on the following Interfaces:",
    "",
    `${pad("Interface", 27)}${pad("Trusted", 11)}${pad("Allow option", 16)}Rate limit (pps)`,
    `${"-".repeat(23)}    -------    ------------    ----------------`,
    ...ifaces.map((name) => {
      const iface = device.interfaces[name];
      return `${pad(name, 27)}${pad(iface.snoopingTrust ? "yes" : "no", 11)}${pad(iface.snoopingTrust ? "yes" : "no", 16)}${iface.snoopingRate ?? "unlimited"}`;
    }),
  ].join("\n");
}

export function showDhcpSnoopingBinding(device: Device) {
  return [
    `${pad("MacAddress", 20)}${pad("IpAddress", 17)}${pad("Lease(sec)", 12)}${pad("Type", 15)}${pad("VLAN", 6)}Interface`,
    "------------------  ---------------  ----------  -------------  ----  --------------------",
    ...device.snooping.bindings.map((binding) => `${pad(colonMac(binding.mac), 20)}${pad(formatIpv4(binding.ip), 17)}${pad(86400, 12)}${pad("dhcp-snooping", 15)}${pad(binding.vlan, 6)}${binding.iface}`),
    `Total number of bindings: ${device.snooping.bindings.length}`,
  ].join("\n");
}

export function showArpInspection(device: Device) {
  const vlans = [...new Set([...device.daiVlans, ...Object.keys(device.vlans).map(Number).filter((vlan) => vlan !== 1)])].sort((a, b) => a - b);
  return [
    "Source Mac Validation      : Disabled",
    "Destination Mac Validation : Disabled",
    "IP Address Validation      : Disabled",
    "",
    " Vlan     Configuration    Operation   ACL Match          Static ACL",
    " ----     -------------    ---------   ---------          ----------",
    ...vlans.map((vlan) => ` ${padStart(vlan, 4)}     ${pad(device.daiVlans.includes(vlan) ? "Enabled" : "Disabled", 17)}${device.daiVlans.includes(vlan) ? "Active" : "Inactive"}`),
    "",
    " Interface        Trust State",
    " ---------------  -----------",
    ...sortIfNames(Object.values(device.interfaces).filter((iface) => iface.physical).map((iface) => iface.name)).map((name) => ` ${pad(shortIf(name), 17)}${device.interfaces[name].arpTrust ? "Trusted" : "Untrusted"}`),
  ].join("\n");
}

// ---------- NAT / ACL ----------

export function showNatTranslations(device: Device) {
  const rows = [`${pad("Pro", 5)}${pad("Inside global", 22)}${pad("Inside local", 22)}${pad("Outside local", 22)}Outside global`];
  for (const item of device.natTranslations) {
    const outside = `${formatIpv4(item.outside)}:${item.localPort}`;
    rows.push(`${pad(item.proto, 5)}${pad(`${formatIpv4(item.insideGlobal)}:${item.globalPort}`, 22)}${pad(`${formatIpv4(item.insideLocal)}:${item.localPort}`, 22)}${pad(outside, 22)}${outside}`);
  }
  for (const item of device.natStatics) rows.push(`${pad("---", 5)}${pad(formatIpv4(item.global), 22)}${pad(formatIpv4(item.local), 22)}${pad("---", 22)}---`);
  return rows.join("\n");
}

export function showNatStatistics(device: Device) {
  const inside = Object.values(device.interfaces).filter((iface) => iface.nat === "inside").map((iface) => iface.name);
  const outside = Object.values(device.interfaces).filter((iface) => iface.nat === "outside").map((iface) => iface.name);
  const total = device.natTranslations.length + device.natStatics.length;
  return [
    `Total active translations: ${total} (${device.natStatics.length} static, ${device.natTranslations.length} dynamic; ${device.natTranslations.length} extended)`,
    "Outside interfaces:",
    `  ${outside.join(", ") || "none"}`,
    "Inside interfaces:",
    `  ${inside.join(", ") || "none"}`,
    `Hits: ${device.natTranslations.length * 4}  Misses: 0`,
    "Expired translations: 0",
    "Dynamic mappings:",
    "-- Inside Source",
    ...device.natRules.map((rule, index) => `[Id: ${index + 1}] access-list ${rule.list} interface ${rule.iface}${rule.overload ? " overload" : ""} refcount ${device.natTranslations.length}`),
  ].join("\n");
}

export function showAccessLists(device: Device, only?: string) {
  const blocks: string[] = [];
  for (const [name, acl] of Object.entries(device.acls)) {
    if (only && only !== name) continue;
    const lines = [`${acl.kind === "standard" ? "Standard" : "Extended"} IP access list ${name}`];
    for (const entry of acl.entries) {
      const text = acl.kind === "standard"
        ? entry.text.replace(/^(permit|deny) (\S+) (\S+)$/, (_, action, addr, wildcard) => `${action} ${addr}, wildcard bits ${wildcard}`).replace(/^(permit|deny) host (\S+)/, "$1 $2")
        : entry.text;
      lines.push(`    ${entry.seq} ${text}${entry.matches ? ` (${entry.matches} match${entry.matches === 1 ? "" : "es"})` : ""}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n");
}

// ---------- Port security ----------

export function showPortSecurity(device: Device) {
  const rows = [
    "Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action",
    "                (Count)       (Count)          (Count)",
    "---------------------------------------------------------------------------",
  ];
  for (const name of sortIfNames(Object.keys(device.interfaces))) {
    const iface = device.interfaces[name];
    if (!iface.portSecurity.enabled) continue;
    const violations = device.errDisabled[name] === "psecure-violation" ? 1 : device.psecViolations[name] ?? 0;
    rows.push(`${padStart(shortIf(name), 11)}${padStart(iface.portSecurity.max, 15)}${padStart((device.psecLearned[name] ?? []).length, 13)}${padStart(violations, 19)}${padStart(iface.portSecurity.violation[0].toUpperCase() + iface.portSecurity.violation.slice(1), 18)}`);
  }
  rows.push("---------------------------------------------------------------------------", "Total Addresses in System (excluding one mac per port)     : 0", "Max Addresses limit in System (excluding one mac per port) : 4096");
  return rows.join("\n");
}

export function showPortSecurityInterface(device: Device, name: string) {
  const iface = device.interfaces[name];
  if (!iface) return "% Invalid interface";
  const learned = device.psecLearned[name] ?? [];
  const status = !iface.portSecurity.enabled ? "Secure-down" : device.errDisabled[name] === "psecure-violation" ? "Secure-shutdown" : learned.length ? "Secure-up" : "Secure-down";
  return [
    `Port Security              : ${iface.portSecurity.enabled ? "Enabled" : "Disabled"}`,
    `Port Status                : ${status}`,
    `Violation Mode             : ${iface.portSecurity.violation[0].toUpperCase()}${iface.portSecurity.violation.slice(1)}`,
    "Aging Time                 : 0 mins",
    "Aging Type                 : Absolute",
    "SecureStatic Address Aging : Disabled",
    `Maximum MAC Addresses      : ${iface.portSecurity.max}`,
    `Total MAC Addresses        : ${learned.length}`,
    "Configured MAC Addresses   : 0",
    `Sticky MAC Addresses       : ${iface.portSecurity.sticky ? learned.length : 0}`,
    `Last Source Address:Vlan   : ${learned.length ? `${learned[learned.length - 1]}:${iface.accessVlan}` : "0000.0000.0000:0"}`,
    `Security Violation Count   : ${device.errDisabled[name] === "psecure-violation" ? 1 : device.psecViolations[name] ?? 0}`,
  ].join("\n");
}

// ---------- Management ----------

export function showIpSsh(device: Device) {
  const enabled = Boolean(device.rsaModulus);
  const version = device.sshVersion === 2 ? "2.0" : device.sshVersion === 1 ? "1.5" : "1.99";
  const lines = [`SSH ${enabled ? "Enabled" : "Disabled"} - version ${version}`];
  if (!enabled) lines.push("%Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).");
  lines.push("Authentication methods:publickey,keyboard-interactive,password", "Authentication Publickey Algorithms:x509v3-ssh-rsa,ssh-rsa", "Authentication timeout: 120 secs; Authentication retries: 3", "Minimum expected Diffie Hellman key size : 2048 bits");
  if (enabled) lines.push(`IOS Keys in SECSH format(ssh-rsa, base64 encoded): ${device.hostname}.${device.domainName ?? ""}`, `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAA${fakeHash(device.hostname, 40)}`);
  return lines.join("\n");
}

export function showNtpAssociations(state: LabState, dev: string) {
  const device = state.devices[dev];
  const status = ntpState(state, dev);
  const rows = ["  address         ref clock       st   when   poll reach  delay  offset   disp"];
  if (device.ntp.master !== undefined && !device.ntp.servers.length) rows.push(`*~127.127.1.1     .LOCL.          ${padStart(device.ntp.master - 1, 2)}      7     16   377  0.000   0.000  0.190`);
  for (const server of device.ntp.servers) {
    const synced = status?.server === server;
    rows.push(`${synced ? "*" : " "}~${pad(formatIpv4(server), 16)}${pad(synced ? (status!.stratum > 2 ? "10.0.0.1" : ".GPS.") : ".INIT.", 16)}${padStart(synced ? status!.stratum - 1 : 16, 2)}${padStart(synced ? 24 : "-", 7)}${padStart(64, 7)}${padStart(synced ? 377 : 0, 6)}  ${synced ? "1.204   0.218  0.152" : "0.000   0.000 15937."}`);
  }
  rows.push(" * sys.peer, # selected, + candidate, - outlyer, x falseticker, ~ configured");
  return rows.join("\n");
}

export function showNtpStatus(state: LabState, dev: string) {
  const status = ntpState(state, dev);
  if (!status) return "Clock is unsynchronized, stratum 16, no reference clock\nnominal freq is 250.0000 Hz, actual freq is 250.0000 Hz, precision is 2**10";
  return `Clock is synchronized, stratum ${status.stratum}, reference is ${status.server !== undefined ? formatIpv4(status.server) : "127.127.1.1"}\nnominal freq is 250.0000 Hz, actual freq is 250.0000 Hz, precision is 2**10\nreference time is EB1F2C3A.1BA5E354 (09:12:26.108 UTC Wed Oct 28 2026)`;
}

export function showCdpNeighbors(state: LabState, dev: string) {
  const device = state.devices[dev];
  if (!device.cdp) return "% CDP is not enabled";
  const rows = [
    "Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge",
    "                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone,",
    "                  D - Remote, C - CVTA, M - Two-port Mac Relay",
    "",
    `${pad("Device ID", 17)}${pad("Local Intrfce", 18)}${pad("Holdtme", 11)}${pad("Capability", 12)}${pad("Platform", 10)}Port ID`,
  ];
  const short = (name: string) => shortIf(name).replace(/^Gi/, "Gig ").replace(/^Fa/, "Fas ").replace(/^Se/, "Ser ");
  for (const name of sortIfNames(Object.keys(device.interfaces))) {
    if (!device.interfaces[name].physical || !physUp(state, dev, name)) continue;
    const peer = peerOf(state, dev, name);
    const peerDevice = peer ? state.devices[peer[0]] : undefined;
    if (!peer || !peerDevice || !peerDevice.cdp || peerDevice.kind === "host" || peerDevice.kind === "hub") continue;
    const capability = peerDevice.kind === "router" ? "R B S I" : peerDevice.kind === "l3switch" ? "R S I" : "S I";
    rows.push(`${pad(peerDevice.hostname, 17)}${pad(short(name), 18)}${pad(163, 11)}${pad(capability, 12)}${pad(peerDevice.model.slice(0, 9), 10)}${short(peer[1])}`);
  }
  return rows.join("\n");
}

export function showLogging(device: Device) {
  return [
    "Syslog logging: enabled (0 messages dropped, 0 messages rate-limited, 0 flushes, 0 overruns)",
    "    Console logging: level debugging",
    `    Trap logging: level ${device.loggingTrap ?? "informational"}`,
    ...device.loggingHosts.map((host) => `        Logging to ${formatIpv4(host)}  (udp port 514, audit disabled, link up)`),
    "",
    `Log Buffer (8192 bytes):`,
    ...device.logs,
  ].join("\n");
}

export function showVersion(device: Device) {
  const switching = device.kind === "switch" || device.kind === "l3switch";
  return [
    `Cisco IOS Software, ${switching ? "C2960 Software (C2960-LANBASEK9-M)" : "ISR Software (X86_64_LINUX_IOSD-UNIVERSALK9-M)"}, Version 15.2(4)E, RELEASE SOFTWARE`,
    "Technical Support: http://www.cisco.com/techsupport",
    "",
    `${device.hostname} uptime is 2 hours, 14 minutes`,
    "System image file is \"flash:/ios.bin\"",
    "",
    `cisco ${device.model} processor with 524288K bytes of memory.`,
    `Base ethernet MAC Address       : ${device.mac}`,
    "Configuration register is 0x2102",
  ].join("\n");
}

export function showMacAddressTable(state: LabState, dev: string) {
  const device = state.devices[dev];
  const rows = ["          Mac Address Table", "-------------------------------------------", "", "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----"];
  for (const port of sortIfNames(l2Ports(state, dev))) {
    if (!logicalUp(state, dev, port)) continue;
    const vlans = Object.keys(device.vlans).map(Number).filter((vlan) => portCarries(state, dev, port, vlan));
    const peer = peerOf(state, dev, parentIf(port.startsWith("Port-channel") ? bundles(state, dev).find((bundle) => bundle.po === port)?.members[0]?.name ?? port : port));
    const peerDevice = peer ? state.devices[peer[0]] : undefined;
    if (!peerDevice) continue;
    const macs = peerDevice.kind === "host" ? [peerDevice.mac] : peerDevice.kind === "hub" ? (device.psecLearned[port] ?? []) : [peerDevice.mac];
    for (const mac of macs) rows.push(`${pad(` ${vlans[0] ?? 1}`, 8)}${pad(mac, 18)}${pad(device.psecLearned[port]?.includes(mac) && device.interfaces[port].portSecurity.sticky ? "STATIC" : "DYNAMIC", 12)}${shortIf(port)}`);
  }
  rows.push(`Total Mac Addresses for this criterion: ${rows.length - 5}`);
  return rows.join("\n");
}

