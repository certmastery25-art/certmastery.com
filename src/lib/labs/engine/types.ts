import type { Family } from "./addr";

export type DeviceKind = "router" | "switch" | "l3switch" | "host" | "hub";

export type Mode =
  | "user" | "privileged" | "config" | "interface" | "subif" | "vlan" | "router-ospf"
  | "line" | "dhcp" | "std-acl" | "ext-acl" | "host";

export type SwitchportMode = "access" | "trunk" | "dynamic auto" | "dynamic desirable";
export type ChannelMode = "active" | "passive" | "on" | "desirable" | "auto";

export type V6Address = { addr: bigint; len: number; eui64: boolean };

export type StandbyGroup = { ip?: bigint; priority: number; preempt: boolean; track: { iface: string; decrement: number }[] };

export type Iface = {
  name: string;
  physical: boolean;
  shutdown: boolean;
  description?: string;
  /** Layer 2 port (switch). Routed ports on a multilayer switch set this to false. */
  switchport: boolean;
  mode: SwitchportMode;
  accessVlan: number;
  nativeVlan: number;
  /** Allowed VLANs on a trunk, or null for all. */
  allowed: number[] | null;
  nonegotiate: boolean;
  channelGroup?: { id: number; mode: ChannelMode };
  portfast?: boolean;
  bpduguard?: boolean;
  stpCost?: number;
  portSecurity: { enabled: boolean; max: number; violation: "shutdown" | "restrict" | "protect"; sticky: boolean };
  snoopingTrust: boolean;
  snoopingRate?: number;
  arpTrust: boolean;
  ipv4?: { addr: bigint; len: number };
  ipv6: V6Address[];
  linkLocal?: bigint;
  ipv6Enabled: boolean;
  dot1q?: { vlan: number; native: boolean };
  helpers: bigint[];
  nat?: "inside" | "outside";
  acl: { in?: string; out?: string };
  ospf: { pid?: number; area?: number; cost?: number; priority?: number; hello?: number; dead?: number; network?: "point-to-point" | "broadcast" };
  standby: Record<number, StandbyGroup>;
  standbyVersion: 1 | 2;
  bandwidth?: number;
};

export type AclEntry = {
  seq: number;
  action: "permit" | "deny";
  protocol: "ip" | "icmp" | "tcp" | "udp";
  src: { addr: bigint; wildcard: bigint };
  dst: { addr: bigint; wildcard: bigint };
  srcPort?: PortMatch;
  dstPort?: PortMatch;
  icmpType?: "echo" | "echo-reply";
  established?: boolean;
  log: boolean;
  matches: number;
  text: string;
};
export type PortMatch = { op: "eq" | "neq" | "gt" | "lt" | "range"; ports: number[] };
export type Acl = { kind: "standard" | "extended"; numbered: boolean; entries: AclEntry[] };

export type StaticRoute = { family: Family; prefix: bigint; len: number; nextHop?: bigint; exitIf?: string; ad: number };

export type LineConfig = {
  login: "none" | "line" | "local";
  password?: string;
  transport: ("ssh" | "telnet")[] | "all" | "none";
  accessClass?: string;
  execTimeout?: [number, number];
  loggingSync: boolean;
};

export type DhcpPool = { network?: { addr: bigint; len: number }; defaultRouter?: bigint; dns?: bigint; domain?: string; lease?: number };

export type HostConfig = {
  ipMode: "static" | "dhcp";
  ipv4?: { addr: bigint; len: number };
  gateway?: bigint;
  dns?: bigint;
  ipv6Mode: "none" | "slaac" | "static";
  ipv6?: { addr: bigint; len: number };
  ipv6Gateway?: bigint;
  services: Service[];
  /** A host that answers DHCP requests itself, such as a rogue server. */
  dhcpServer?: { addr: bigint; len: number; gateway: bigint; first: bigint };
  lease?: { server: bigint; viaRogue: boolean };
};

export type Service = "http" | "https" | "ssh" | "telnet" | "dns" | "ntp";

export type NatTranslation = { proto: "icmp" | "tcp" | "udp"; insideLocal: bigint; insideGlobal: bigint; outside: bigint; localPort: number; globalPort: number };

export type Device = {
  name: string;
  kind: DeviceKind;
  model: string;
  hostname: string;
  mac: string;
  /** Lower bridge MAC wins root elections; labs set it to steer the default outcome. */
  bridgeMac: string;
  interfaces: Record<string, Iface>;
  vlans: Record<number, string>;
  ipRouting: boolean;
  ipv6Routing: boolean;
  defaultGateway?: bigint;
  stp: { mode: "pvst" | "rapid-pvst"; priority: Record<number, number>; portfastDefault: boolean; bpduguardDefault: boolean };
  staticRoutes: StaticRoute[];
  ospf: null | {
    pid: number;
    routerId?: bigint;
    activeRid?: bigint;
    networks: { addr: bigint; wildcard: bigint; area: number }[];
    passiveDefault: boolean;
    passive: string[];
    nonPassive: string[];
    defaultOriginate: boolean;
    refBw: number;
  };
  dhcpExcluded: { start: bigint; end: bigint }[];
  dhcpPools: Record<string, DhcpPool>;
  dhcpBindings: { ip: bigint; mac: string; pool: string }[];
  dhcpRelayTrustAll: boolean;
  natRules: { list: string; iface: string; overload: boolean }[];
  natStatics: { local: bigint; global: bigint }[];
  natTranslations: NatTranslation[];
  acls: Record<string, Acl>;
  snooping: { enabled: boolean; vlans: number[]; option82: boolean; bindings: { mac: string; ip: bigint; vlan: number; iface: string }[] };
  daiVlans: number[];
  users: Record<string, { privilege: number; secret: string; type: "secret" | "password" }>;
  enableSecret?: string;
  servicePasswordEncryption: boolean;
  domainName?: string;
  rsaModulus?: number;
  sshVersion?: 1 | 2;
  loginBlock?: { seconds: number; attempts: number; within: number };
  lines: { con: LineConfig; vty: LineConfig };
  banner?: string;
  ntp: { servers: bigint[]; master?: number; synced?: { server: bigint; stratum: number } };
  loggingHosts: bigint[];
  loggingTrap?: string;
  timestamps: boolean;
  loadBalance: string;
  cdp: boolean;
  lldp: boolean;
  logs: string[];
  /** Console messages not yet shown in the terminal. */
  pending: string[];
  startupConfig?: string;
  errDisabled: Record<string, string>;
  psecLearned: Record<string, string[]>;
  psecViolations: Record<string, number>;
  hsrp: Record<string, "Active" | "Standby" | "Listen" | "Init">;
  ospfAdjacencies: string[];
  host?: HostConfig;
  /** Devices the learner can't log in to, such as a rogue switch. */
  locked: boolean;
};

export type CliContext = {
  mode: Mode;
  ifaces: string[];
  vlan?: number;
  pool?: string;
  acl?: string;
  line?: "con" | "vty";
  enteredConfig: boolean;
};

export type Link = { a: [string, string]; b: [string, string] };

export type LabState = {
  active: string;
  devices: Record<string, Device>;
  cli: Record<string, CliContext>;
  links: Link[];
  /** Verification tasks completed by running the right command at the right time. */
  verified: string[];
  /** Counter so translations and logs get a deterministic order. */
  tick: number;
};
