import { parseAddr, parseIpv4 } from "../engine/addr";
import { portRange, type DeviceSpec } from "../engine/device";
import { bundles, spanningTree } from "../engine/l2";
import { canReach, hostV6, ospfAdjacency, remoteLogin, routingTable, type Packet } from "../engine/l3";
import type { HostConfig, LabState, Link } from "../engine/types";

export const ip = (text: string) => parseAddr(text)!.addr;

function cidr(text: string) {
  const [address, len] = text.split("/");
  return { addr: parseIpv4(address)!, len: Number(len) };
}

export const router = (name: string, ports = ["GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2"], model = "CISCO2911"): DeviceSpec => ({ name, kind: "router", model, ports });
export const access = (name: string, bridgeMac?: string): DeviceSpec => ({ name, kind: "switch", model: "WS-C2960-24TT-L", ports: [...portRange("FastEthernet0/", 1, 24), ...portRange("GigabitEthernet0/", 1, 2)], bridgeMac });
export const multilayer = (name: string): DeviceSpec => ({ name, kind: "l3switch", model: "WS-C3650-24PS", ports: portRange("GigabitEthernet1/0/", 1, 24) });

type HostOptions = { gateway?: string; dhcp?: boolean; services?: HostConfig["services"]; slaac?: boolean; dns?: string; dhcpServer?: HostConfig["dhcpServer"] };
export function host(name: string, address: string | null, options: HostOptions = {}): DeviceSpec {
  return {
    name,
    kind: "host",
    model: options.services?.length ? "Server-PT" : "PC-PT",
    ports: ["FastEthernet0"],
    host: {
      ipMode: options.dhcp ? "dhcp" : "static",
      ipv4: address ? cidr(address) : undefined,
      gateway: options.gateway ? ip(options.gateway) : undefined,
      dns: options.dns ? ip(options.dns) : undefined,
      ipv6Mode: options.slaac ? "slaac" : "none",
      services: options.services ?? [],
      dhcpServer: options.dhcpServer,
    },
  };
}

export const link = (a: string, aPort: string, b: string, bPort: string): Link => ({ a: [a, aPort], b: [b, bPort] });
export const nic = (name: string) => [name, "FastEthernet0"] as const;

export function reach(state: LabState, from: string, to: string, proto: Packet["proto"] = "icmp", port = 0) {
  const target = parseAddr(to);
  return target ? canReach(state, from, target.family, target.addr, proto, port) : false;
}

export function login(state: LabState, from: string, to: string, protocol: "ssh" | "telnet", user?: string) {
  return remoteLogin(structuredClone(state), from, ip(to), protocol, user).ok;
}

export function bundleOf(state: LabState, dev: string, id: number) {
  return bundles(state, dev).find((bundle) => bundle.id === id);
}

export function bundled(state: LabState, dev: string, id: number, members: number, layer3: boolean) {
  const bundle = bundleOf(state, dev, id);
  return Boolean(bundle?.up && bundle.layer3 === layer3 && bundle.members.filter((member) => member.flag === "P").length === members);
}

/** The root bridge as seen from a device (defaults to any managed switch in the VLAN). */
export const rootOf = (state: LabState, vlan: number, from?: string) => {
  const bridges = spanningTree(state, vlan).bridges;
  const viewer = from ?? Object.keys(bridges).find((name) => !state.devices[name].locked);
  return viewer ? bridges[viewer]?.root.dev : undefined;
};

export function rootPort(state: LabState, dev: string, vlan: number) {
  return spanningTree(state, vlan).bridges[dev]?.rootPort;
}

export function ospfFull(state: LabState, a: string, b: string) {
  const sees = (from: string, to: string) => ospfAdjacency(state, from).neighbors.some((neighbor) => neighbor.peer.dev === to && neighbor.state === "FULL");
  return sees(a, b) && sees(b, a);
}

export function hasRoute(state: LabState, dev: string, prefix: string, code?: string) {
  const [address, len] = prefix.split("/");
  const parsed = parseAddr(address)!;
  return routingTable(state, dev, parsed.family).some((route) => route.prefix === parsed.addr && route.len === Number(len) && (!code || route.code.startsWith(code)));
}

export const vlanNamed = (state: LabState, dev: string, id: number, name: string) => state.devices[dev].vlans[id]?.toUpperCase() === name.toUpperCase();

export const iface = (state: LabState, dev: string, name: string) => state.devices[dev].interfaces[name];

export function slaacAddress(state: LabState, dev: string) {
  return hostV6(state, dev)?.addr;
}
