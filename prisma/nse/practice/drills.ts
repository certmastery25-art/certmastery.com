// Skill drills whose answers are worked out by code, so each scenario is marked by the rule it tests.
// The generator is seeded: the same drill number always gives the same question.
import type { SeedDifficulty, SeedQuestion } from "../types";
import { q, withExhibit } from "./helpers";

export function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)), pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)] };
}

export const toIp = (value: number) => [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
const maskOf = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

export function subnetDrills(count: number, seed: number): SeedQuestion[] {
  const random = generator(seed);
  return Array.from({ length: count }, (_, index) => {
    const prefix = random.int(22, 29);
    const first = random.pick([[10, random.int(1, 200)], [172, random.int(16, 31)], [192, 168]]);
    const address = ((first[0] << 24) >>> 0) + (first[1] << 16) + (random.int(0, 254) << 8) + random.int(1, 254);
    const mask = maskOf(prefix);
    const network = (address & mask) >>> 0;
    const size = 2 ** (32 - prefix);
    const broadcast = network + size - 1;
    const ip = `${toIp(address >>> 0)}/${prefix}`;
    const kind = index % 3;
    const tech = "IP addressing";
    if (kind === 0) return q("INTERMEDIATE", "Subnetting", tech, `A FortiGate interface is set to ${ip}. What's the network address of that subnet?`, `/${prefix} leaves blocks of ${size} addresses. ${ip} falls in the block starting at ${toIp(network)}.`,
      [toIp(network), "This is the first address of the block that contains the host."], [toIp((network + size) >>> 0), "This is the start of the following block."], [toIp(broadcast >>> 0), "This is the block's broadcast address."], [toIp((network + 1) >>> 0), "This is the first usable host, not the network address."]);
    if (kind === 1) return q("INTERMEDIATE", "Subnetting", tech, `What's the broadcast address of the subnet containing ${ip}?`, `The block is ${toIp(network)} to ${toIp(broadcast >>> 0)}, and the last address is the broadcast.`,
      [toIp(broadcast >>> 0), "This is the last address of the block."], [toIp(network), "This is the network address."], [toIp((broadcast - 1) >>> 0), "This is the last usable host."], [toIp((broadcast + 1) >>> 0), "This belongs to the next block."]);
    const usable = size - 2;
    return q("BEGINNER", "Subnetting", tech, `How many usable host addresses does a /${prefix} subnet give the interface at ${toIp(address >>> 0)}?`, `A /${prefix} has 2^${32 - prefix} = ${size} addresses. Removing the network and broadcast addresses leaves ${usable}.`,
      [String(usable), "Total addresses minus the network and broadcast addresses."], [String(size), "This counts the network and broadcast addresses."], [String(usable - 1), "Only two addresses are reserved, not three."], [String(size * 2 - 2), "This is the figure for a prefix one bit shorter."]);
  });
}

type Rule = { id: number; src: string; dst: string; srcNet: string | null; dstNet: string | null; service: string | null; users: string | null; action: "ACCEPT" | "DENY"; from: string; to: string };

export function policyDrills(count: number, seed: number, d: SeedDifficulty): SeedQuestion[] {
  const random = generator(seed);
  const hosts: Record<string, string> = { "10.1.1.0/24": "10.1.1", "10.1.2.0/24": "10.1.2", "10.1.3.0/24": "10.1.3" };
  const services = ["HTTPS", "DNS", "SSH", "RDP"];
  const servers: Record<string, string> = { "192.0.2.10": "192.0.2.10", "192.0.2.20": "192.0.2.20", "198.51.100.5": "198.51.100.5" };
  return Array.from({ length: count }, (_, index) => {
    const rules: Rule[] = Array.from({ length: 5 }, (__, position) => {
      const source = random.pick([null, ...Object.keys(hosts)]);
      const target = random.pick([null, ...Object.keys(servers)]);
      return { id: random.int(1, 9) * 10 + position, src: source ?? "all", dst: target ?? "all", srcNet: source, dstNet: target, service: random.pick([null, ...services]), users: null, action: random.pick(["ACCEPT", "ACCEPT", "DENY"] as const), from: random.pick(["port3", "port3", "port3", "port4"]), to: "port1" };
    });
    const packet = { from: random.pick(["port3", "port3", "port4"]), to: "port1", net: random.pick(Object.keys(hosts)), host: random.int(5, 200), dst: random.pick(Object.keys(servers)), service: random.pick(services) };
    // Most drills get an entry that fits, so the implicit deny stays the occasional answer.
    if (index % 4 !== 0) {
      const fitting = rules[random.int(0, 4)];
      Object.assign(fitting, { from: packet.from, srcNet: random.pick([null, packet.net]), dstNet: random.pick([null, packet.dst]), service: random.pick([null, packet.service]) });
      fitting.src = fitting.srcNet ?? "all";
      fitting.dst = fitting.dstNet ?? "all";
    }
    const matched = rules.find((rule) => rule.from === packet.from && rule.to === packet.to && (!rule.srcNet || rule.srcNet === packet.net) && (!rule.dstNet || rule.dstNet === packet.dst) && (!rule.service || rule.service === packet.service));
    const table = ["Seq  ID  From   To     Source         Destination     Service  Action", ...rules.map((rule, position) => `${String(position + 1).padEnd(4)} ${String(rule.id).padEnd(3)} ${rule.from.padEnd(6)} ${rule.to.padEnd(6)} ${rule.src.padEnd(14)} ${rule.dst.padEnd(15)} ${(rule.service ?? "ALL").padEnd(8)} ${rule.action}`)].join("\n");
    const source = `${hosts[packet.net]}.${packet.host}`;
    const prompt = `Policy drill ${index + 1}: a new ${packet.service} session arrives on ${packet.from} from ${source} to ${packet.dst}, leaving through ${packet.to}. Which entry decides it?`;
    const answerId = matched ? `Policy ${matched.id} (${matched.action})` : "The implicit deny (policy 0)";
    const options = [...rules.map((rule) => `Policy ${rule.id} (${rule.action})`), "The implicit deny (policy 0)"];
    const wrong = [...new Set(options)].filter((option) => option !== answerId);
    const reason = matched ? `Policies are checked from the top. Policy ${matched.id} is the first entry whose interfaces, source, destination and service all match.` : "No entry matches all of the interfaces, source, destination and service, so the implicit deny applies.";
    const whyWrong = (option: string) => {
      if (option.startsWith("The implicit")) return "It's only reached when nothing above it matches.";
      const rule = rules.find((item) => `Policy ${item.id} (${item.action})` === option)!;
      if (rule.from !== packet.from) return `It applies to traffic arriving on ${rule.from}.`;
      if (rule.srcNet && rule.srcNet !== packet.net) return `Its source, ${rule.src}, doesn't contain ${source}.`;
      if (rule.dstNet && rule.dstNet !== packet.dst) return `Its destination is ${rule.dst}.`;
      if (rule.service && rule.service !== packet.service) return `It only matches ${rule.service}.`;
      return "It would match, but an earlier entry decides the session first.";
    };
    return withExhibit(q(d, "Policy evaluation", "Firewall policy", prompt, reason, [answerId, reason], ...wrong.map((option): [string, string] => [option, whyWrong(option)])), table);
  });
}

export function routeDrills(count: number, seed: number, d: SeedDifficulty): SeedQuestion[] {
  const random = generator(seed);
  return Array.from({ length: count }, (_, index) => {
    const second = random.int(1, 90);
    const third = random.int(0, 200);
    const destination = `10.${second}.${third}.${random.int(10, 240)}`;
    const distance = random.pick([5, 10, 20]);
    const lowPriority = random.int(1, 5);
    const type = index % 3;
    const routes = type === 0
      ? [{ net: `10.${second}.${third}.0/24`, ad: 20, pr: 10, gw: "172.16.1.1", dev: "port2" }, { net: `10.${second}.0.0/16`, ad: 5, pr: 1, gw: "172.16.2.1", dev: "port3" }, { net: "0.0.0.0/0", ad: 1, pr: 1, gw: "203.0.113.1", dev: "port1" }]
      : type === 1
        ? [{ net: `10.${second}.${third}.0/24`, ad: distance, pr: lowPriority + 5, gw: "172.16.1.1", dev: "port2" }, { net: `10.${second}.${third}.0/24`, ad: distance, pr: lowPriority, gw: "172.16.2.1", dev: "port3" }, { net: "0.0.0.0/0", ad: 1, pr: 1, gw: "203.0.113.1", dev: "port1" }]
        : [{ net: `10.${(second % 90) + 100}.${third}.0/24`, ad: 1, pr: 1, gw: "172.16.1.1", dev: "port2" }, { net: `10.${second}.${third}.128/25`, ad: 1, pr: 1, gw: "172.16.2.1", dev: "port3" }, { net: "0.0.0.0/0", ad: 10, pr: 1, gw: "203.0.113.1", dev: "port1" }];
    const last = Number(destination.split(".")[3]);
    const answer = type === 0 ? routes[0] : type === 1 ? routes[1] : last >= 128 ? routes[1] : routes[2];
    const table = ["Destination         Distance  Priority  Gateway        Interface", ...routes.map((route) => `${route.net.padEnd(19)} ${String(route.ad).padEnd(9)} ${String(route.pr).padEnd(9)} ${route.gw.padEnd(14)} ${route.dev}`)].join("\n");
    const reason = type === 1
      ? "Both /24 routes have the same prefix and distance, so the lower priority wins."
      : type === 0
        ? "The longest matching prefix wins before distance is considered, so the /24 beats a /16 with a lower distance."
        : last >= 128 ? `${destination} is inside the /25, which is the longest match.` : `${destination} is below .128, so it's outside the /25. Only the default route matches.`;
    const label = (route: (typeof routes)[number]) => `${route.dev} via ${route.gw}`;
    const whyWrong = (route: (typeof routes)[number]) => route.net === "0.0.0.0/0" ? "The default route only applies when nothing more specific matches." : route.net.startsWith(`10.${(second % 90) + 100}.`) ? "This prefix doesn't contain the destination." : type === 1 ? "It has the higher priority value, and lower is preferred." : type === 2 ? "This /25 covers only .128 to .255." : "This prefix is less specific.";
    return withExhibit(q(d, "Route selection", "Routing", `Routing drill ${index + 1}: using the table shown, where does FortiGate send a packet for ${destination}?`, reason,
      [label(answer), reason], ...routes.filter((route) => route !== answer).map((route): [string, string] => [label(route), whyWrong(route)]), ["The packet is dropped because no route matches", "At least one route matches this destination."]), table);
  });
}

export function haDrills(count: number, seed: number, d: SeedDifficulty): SeedQuestion[] {
  const random = generator(seed);
  return Array.from({ length: count }, (_, index) => {
    const override = index % 2 === 1;
    const scenario = index % 4;
    const a = { name: "FGT-A", ports: 4, uptime: 900, priority: random.int(100, 150), serial: "FGVM0A" };
    const b = { name: "FGT-B", ports: 4, uptime: 900, priority: random.int(160, 240), serial: "FGVM0B" };
    if (scenario === 0 || scenario === 1) a.ports = 3;
    if (scenario === 2) { a.uptime = 86400; b.uptime = 7200; }
    if (scenario === 3) { a.uptime = 86400; b.uptime = 7200; b.priority = a.priority + random.int(5, 60); }
    const winner = a.ports !== b.ports ? (a.ports > b.ports ? a : b)
      : override ? (a.priority > b.priority ? a : b)
        : a.uptime - b.uptime > 300 ? (a.uptime > b.uptime ? a : b) : (a.priority > b.priority ? a : b);
    const reason = a.ports !== b.ports ? "Connected monitored interfaces are compared first, with or without override."
      : override ? "With override enabled, priority is compared before HA uptime." : "With override disabled, HA uptime is compared before priority, and a difference over the default 5 minutes counts.";
    const loser = winner === a ? b : a;
    const table = [`override: ${override ? "enable" : "disable"}`, "Unit   Monitored up  HA uptime  Priority", ...[a, b].map((unit) => `${unit.name}  ${String(unit.ports).padEnd(13)} ${`${unit.uptime}s`.padEnd(10)} ${unit.priority}`)].join("\n");
    return withExhibit(q(d, "FGCP primary election", "HA", `HA drill ${index + 1}: priorities are ${a.priority} and ${b.priority}, with override ${override ? "enabled" : "disabled"}. Using default settings and the values shown, which unit becomes primary?`, `${reason} The serial number is only the final tie-breaker.`,
      [winner.name, reason], [loser.name, "It loses on the first attribute that differs in the election order."], ["Neither, because the cluster goes into split brain", "Different attribute values are how an election is decided, not a fault."], ["Whichever unit booted first, regardless of the values", "Boot order only matters through HA uptime, and not before monitored interfaces."]), table);
  });
}
