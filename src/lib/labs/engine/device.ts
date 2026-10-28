import { eui64, macFor } from "./addr";
import type { Device, DeviceKind, HostConfig, Iface, LineConfig } from "./types";

const IF_TYPES = [
  { full: "GigabitEthernet", short: "Gi" },
  { full: "FastEthernet", short: "Fa" },
  { full: "Serial", short: "Se" },
  { full: "Loopback", short: "Lo" },
  { full: "Port-channel", short: "Po" },
  { full: "Vlan", short: "Vl" },
  { full: "Ethernet", short: "Et" },
];

/** Normalises any IOS interface abbreviation ("g0/1", "Gig 0/0.10", "po1") to its full name. */
export function parseIfName(text: string): string | null {
  const match = text.replace(/\s+/g, "").match(/^([a-z-]+)(\d+(?:\/\d+){0,2}(?:\.\d+)?)$/i);
  if (!match) return null;
  const typed = match[1].toLowerCase().replace(/-/g, "");
  const type = IF_TYPES.find((item) => item.full.toLowerCase().replace(/-/g, "").startsWith(typed));
  return type ? `${type.full}${match[2]}` : null;
}

export function shortIf(name: string) {
  const type = IF_TYPES.find((item) => name.startsWith(item.full));
  return type ? `${type.short}${name.slice(type.full.length)}` : name;
}

export function ifType(name: string) {
  return IF_TYPES.find((item) => name.startsWith(item.full))?.full ?? "";
}

export function parentIf(name: string) {
  return name.includes(".") ? name.slice(0, name.indexOf(".")) : name;
}

/** Expands "Gi0/1 - 4" or "fa0/3-24, fa0/1" into full interface names. */
export function expandRange(text: string): string[] | null {
  const names: string[] = [];
  for (const part of text.split(",")) {
    const match = part.replace(/\s+/g, "").match(/^([a-z-]+\d+(?:\/\d+){0,2}?\/?)(\d+)(?:-(\d+))?$/i);
    if (!match) return null;
    const prefix = match[1];
    const first = Number(match[2]);
    const last = match[3] === undefined ? first : Number(match[3]);
    if (last < first || last - first > 64) return null;
    for (let index = first; index <= last; index += 1) {
      const name = parseIfName(`${prefix}${index}`);
      if (!name) return null;
      names.push(name);
    }
  }
  return names;
}

export function newIface(name: string, kind: DeviceKind): Iface {
  const type = ifType(name);
  const isSwitchPort = (kind === "switch" || kind === "l3switch") && ["GigabitEthernet", "FastEthernet", "Port-channel"].includes(type) && !name.includes(".");
  return {
    name,
    physical: ["GigabitEthernet", "FastEthernet", "Serial", "Ethernet"].includes(type) && !name.includes("."),
    // Routers ship with ports shut; switch SVIs are created administratively down.
    shutdown: kind === "router" && type !== "Loopback" ? !name.includes(".") : type === "Vlan",
    switchport: isSwitchPort,
    mode: "dynamic auto",
    accessVlan: 1,
    nativeVlan: 1,
    allowed: null,
    nonegotiate: false,
    portSecurity: { enabled: false, max: 1, violation: "shutdown", sticky: false },
    snoopingTrust: false,
    arpTrust: false,
    ipv6: [],
    ipv6Enabled: false,
    helpers: [],
    acl: {},
    ospf: {},
    standby: {},
    standbyVersion: 1,
  };
}

const defaultLine = (): LineConfig => ({ login: "none", transport: "all", loggingSync: false });

export type DeviceSpec = {
  name: string;
  kind: DeviceKind;
  model?: string;
  ports: string[];
  bridgeMac?: string;
  host?: Partial<HostConfig>;
  locked?: boolean;
};

export function portRange(prefix: string, first: number, last: number) {
  return Array.from({ length: last - first + 1 }, (_, index) => `${prefix}${first + index}`);
}

export function createDevice(spec: DeviceSpec): Device {
  const mac = macFor(spec.name);
  const kind = spec.kind;
  const device: Device = {
    name: spec.name,
    kind,
    model: spec.model ?? (kind === "router" ? "ISR4321" : kind === "l3switch" ? "C3650-24PS" : kind === "switch" ? "WS-C2960-24TT-L" : "PC"),
    hostname: spec.name,
    mac,
    bridgeMac: spec.bridgeMac ?? mac,
    interfaces: {},
    vlans: kind === "switch" || kind === "l3switch" ? { 1: "default" } : {},
    ipRouting: kind === "router",
    ipv6Routing: false,
    stp: { mode: "pvst", priority: {}, portfastDefault: false, bpduguardDefault: false },
    staticRoutes: [],
    ospf: null,
    dhcpExcluded: [],
    dhcpPools: {},
    dhcpBindings: [],
    dhcpRelayTrustAll: false,
    natRules: [],
    natStatics: [],
    natTranslations: [],
    acls: {},
    snooping: { enabled: false, vlans: [], option82: true, bindings: [] },
    daiVlans: [],
    users: {},
    servicePasswordEncryption: false,
    lines: { con: defaultLine(), vty: { ...defaultLine(), login: "line" } },
    ntp: { servers: [] },
    loggingHosts: [],
    timestamps: false,
    loadBalance: "src-mac",
    cdp: kind !== "host" && kind !== "hub",
    lldp: false,
    logs: [],
    pending: [],
    errDisabled: {},
    psecLearned: {},
    psecViolations: {},
    hsrp: {},
    ospfAdjacencies: [],
    locked: spec.locked ?? false,
  };
  for (const port of spec.ports) device.interfaces[port] = newIface(port, kind);
  if (kind === "switch" || kind === "l3switch") device.interfaces.Vlan1 = newIface("Vlan1", kind);
  if (kind === "host") {
    device.host = { ipMode: "static", ipv6Mode: "none", services: [], ...spec.host };
  }
  return device;
}

/** Each interface gets its own burned-in MAC so EUI-64 and ARP output look realistic. */
export function ifaceMac(device: Device, ifName: string) {
  if (device.kind === "host") return device.mac;
  const parent = parentIf(ifName);
  return macFor(`${device.name}/${parent}`);
}

export function interfaceLinkLocal(device: Device, iface: Iface) {
  return iface.linkLocal ?? ((BigInt(0xfe80) << BigInt(112)) | eui64(ifaceMac(device, iface.name)));
}

export function portNumber(name: string) {
  const match = name.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function sortIfNames(names: string[]) {
  const key = (name: string) => {
    const typeIndex = IF_TYPES.findIndex((item) => name.startsWith(item.full));
    const numbers = name.slice(ifType(name).length).split(/[/.]/).map(Number);
    return { typeIndex, numbers };
  };
  return [...names].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka.typeIndex !== kb.typeIndex) return ka.typeIndex - kb.typeIndex;
    for (let index = 0; index < Math.max(ka.numbers.length, kb.numbers.length); index += 1) {
      const diff = (ka.numbers[index] ?? -1) - (kb.numbers[index] ?? -1);
      if (diff) return diff;
    }
    return 0;
  });
}
