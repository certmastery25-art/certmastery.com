// AZ-104 skill drills whose answers are worked out by code from the rule each one tests.
import { generator, toIp } from "../nse/practice/drills";
import { q, withExhibit } from "../nse/practice/helpers";
import type { SeedDifficulty, SeedQuestion } from "../nse/types";

/** Azure reserves five addresses in every subnet: the network address, .1 for the gateway, .2 and .3 for Azure DNS, and the broadcast address. */
export function azureSubnetDrills(count: number, seed: number): SeedQuestion[] {
  const random = generator(seed);
  return Array.from({ length: count }, (_, index) => {
    const prefix = random.int(24, 29);
    const size = 2 ** (32 - prefix);
    const network = ((10 << 24) >>> 0) + (random.int(0, 30) << 16) + (random.int(0, 254) << 8) + Math.floor(random.int(0, 255) / size) * size;
    const cidr = `${toIp(network)}/${prefix}`;
    const tech = "Azure Virtual Network";
    if (index % 2 === 0) {
      return q("INTERMEDIATE", "Subnet sizing", tech, `Subnet drill ${index + 1}: you create the subnet ${cidr} in an Azure virtual network. How many IP addresses can you assign to resources in it?`,
        `A /${prefix} has ${size} addresses. Azure reserves 5 of them in every subnet: the network address, the first three host addresses and the broadcast address, which leaves ${size - 5}.`,
        [String(size - 5), "Total addresses minus the 5 that Azure reserves."],
        [String(size - 2), "This only removes the network and broadcast addresses, as on a traditional network."],
        [String(size - 3), "Azure reserves more than the gateway, network and broadcast addresses."],
        [String(size), "Some addresses in every subnet are reserved by Azure."]);
    }
    return q("INTERMEDIATE", "Subnet sizing", tech, `Subnet drill ${index + 1}: what's the first IP address Azure can give a network interface in the subnet ${cidr}?`,
      `Azure reserves ${toIp(network)} (network), ${toIp(network + 1)} (default gateway), and ${toIp(network + 2)} and ${toIp(network + 3)} (Azure DNS). The first assignable address is ${toIp(network + 4)}.`,
      [toIp(network + 4), "The first four addresses are reserved, so assignment starts at the fifth."],
      [toIp(network + 1), "Azure uses the first host address as the subnet's default gateway."],
      [toIp(network + 2), "Azure reserves this for mapping Azure DNS."],
      [toIp(network), "This is the network address."]);
  });
}

type Rule = { name: string; priority: number; port: string; source: string; action: "Allow" | "Deny" };
const SOURCES: Record<string, (ip: string) => boolean> = {
  Internet: (ip) => !ip.startsWith("10."),
  VirtualNetwork: (ip) => ip.startsWith("10.0."),
  "203.0.113.0/24": (ip) => ip.startsWith("203.0.113."),
  "*": () => true,
};
const DEFAULTS: Rule[] = [
  { name: "AllowVnetInBound", priority: 65000, port: "*", source: "VirtualNetwork", action: "Allow" },
  { name: "AllowAzureLoadBalancerInBound", priority: 65001, port: "*", source: "AzureLoadBalancer", action: "Allow" },
  { name: "DenyAllInBound", priority: 65500, port: "*", source: "*", action: "Deny" },
];

/** NSG rules are checked by priority, lowest number first, and the first match decides. */
export function nsgDrills(count: number, seed: number, d: SeedDifficulty): SeedQuestion[] {
  const random = generator(seed);
  const PORT_NAMES: Record<string, string> = { "22": "SSH", "3389": "RDP", "443": "HTTPS", "80": "HTTP", "*": "Any" };
  const SOURCE_NAMES: Record<string, string> = { Internet: "Internet", VirtualNetwork: "VNet", "203.0.113.0/24": "Partner", "*": "AnySource" };
  return Array.from({ length: count }, (_, index) => {
    const priorities = [...new Set(Array.from({ length: 6 }, () => random.int(1, 40) * 100))].slice(0, 4).sort((a, b) => a - b);
    const custom: Rule[] = priorities.map((priority) => ({
      name: "",
      priority,
      port: random.pick(["22", "3389", "443", "80", "*"]),
      source: random.pick(["Internet", "VirtualNetwork", "203.0.113.0/24", "*"]),
      action: random.pick(["Allow", "Allow", "Deny"] as const),
    }));
    const port = random.pick(["22", "3389", "443", "80"]);
    const source = random.pick(["203.0.113.25", "198.51.100.7", "10.0.2.14"]);
    // Most drills get a custom rule that fits, so the default rules stay an occasional answer.
    if (index % 4 !== 0) Object.assign(custom[random.int(0, custom.length - 1)], { port: random.pick([port, "*"]), source: random.pick([Object.keys(SOURCES).find((key) => key !== "*" && SOURCES[key](source))!, "*"]) });
    // Named from what each rule actually does, so a name never contradicts its settings.
    for (const rule of custom) rule.name = `${rule.action}-${PORT_NAMES[rule.port]}-${SOURCE_NAMES[rule.source]}-${rule.priority}`;
    const rules = [...custom, ...DEFAULTS];
    const matches = (rule: Rule) => (rule.port === "*" || rule.port === port) && (rule.source === "AzureLoadBalancer" ? false : SOURCES[rule.source](source));
    const winner = rules.find(matches)!;
    const label = (rule: Rule) => `${rule.name} (${rule.action.toLowerCase()})`;
    const table = ["Priority  Name                            Port   Source            Action", ...rules.map((rule) => `${String(rule.priority).padEnd(9)} ${rule.name.padEnd(31)} ${rule.port.padEnd(6)} ${rule.source.padEnd(17)} ${rule.action}`)].join("\n");
    const reason = `Rules are checked from the lowest priority number. ${winner.name} at ${winner.priority} is the first rule whose port and source match, so the traffic is ${winner.action === "Allow" ? "allowed" : "denied"}.`;
    const whyWrong = (rule: Rule) => {
      if (rule.priority > winner.priority && matches(rule)) return "It would match, but a rule with a lower priority number decides first.";
      if (rule.source === "AzureLoadBalancer") return "It only matches traffic from Azure Load Balancer health probes.";
      if (!(rule.port === "*" || rule.port === port)) return `It only matches port ${rule.port}.`;
      return `Its source, ${rule.source}, doesn't include ${source}.`;
    };
    const others = rules.filter((rule) => rule !== winner).sort((a, b) => Number(matches(b)) - Number(matches(a))).slice(0, 4);
    return withExhibit(q(d, "NSG rule evaluation", "Network security groups", `NSG drill ${index + 1}: an inbound TCP connection to port ${port} arrives from ${source}. The VM's subnet NSG has the rules shown, and the virtual network is 10.0.0.0/16. Which rule decides the connection?`, reason,
      [label(winner), reason], ...others.map((rule): [string, string] => [label(rule), whyWrong(rule)])), table);
  });
}

const SCOPES = [
  { id: "mg-corp", label: "the management group mg-corp", parent: null },
  { id: "sub-prod", label: "the subscription sub-prod", parent: "mg-corp" },
  { id: "rg-web", label: "the resource group rg-web", parent: "sub-prod" },
  { id: "rg-data", label: "the resource group rg-data", parent: "sub-prod" },
  { id: "vm-web01", label: "the VM vm-web01", parent: "rg-web" },
  { id: "sql-data01", label: "the database sql-data01", parent: "rg-data" },
] as const;
const ROLES = { Owner: ["read", "write", "assign"], Contributor: ["read", "write"], Reader: ["read"], "User Access Administrator": ["read", "assign"] } as const;
const ACTIONS = { read: "view the configuration of", write: "change the settings of", assign: "grant a colleague the Reader role on" } as const;

/** Role assignments apply at their scope and every scope beneath it, and only for the actions the role allows. */
export function rbacDrills(count: number, seed: number): SeedQuestion[] {
  const random = generator(seed);
  const within = (scope: string, target: string): boolean => {
    if (scope === target) return true;
    const parent = SCOPES.find((item) => item.id === target)?.parent;
    return parent ? within(scope, parent) : false;
  };
  return Array.from({ length: count }, (_, index) => {
    const role = random.pick(Object.keys(ROLES) as (keyof typeof ROLES)[]);
    const target = random.pick(SCOPES.filter((item) => item.id.includes("-0") || item.id.startsWith("rg-")));
    const action = random.pick(Object.keys(ACTIONS) as (keyof typeof ACTIONS)[]);
    // Each drill tests one rule at a time: either the scope or the role decides.
    const inScope = index % 3 !== 0;
    const candidates = SCOPES.filter((item) => within(item.id, target.id) === inScope && item.id !== "mg-corp");
    const scope = inScope ? random.pick(candidates) : random.pick(candidates.length ? candidates : SCOPES.filter((item) => !within(item.id, target.id)));
    const allowed = (ROLES[role] as readonly string[]).includes(action);
    const answer = !inScope ? "scope" : allowed ? "yes" : "role";
    const reason = !inScope
      ? `The assignment is on ${scope.label}, which doesn't contain ${target.label}. Assignments only apply at their scope and below it.`
      : allowed
        ? scope.id === target.id ? `The assignment is made directly on ${target.label}, and ${role} allows this.` : `${target.label} sits within ${scope.label}, so the assignment is inherited, and ${role} allows this.`
        : scope.id === target.id ? `The assignment is made directly on ${target.label}, but ${role} doesn't allow this action.` : `The assignment is inherited, but ${role} doesn't allow this action.`;
    const options: Record<string, [string, string]> = {
      yes: ["Yes", allowed && inScope ? reason : "Something in the assignment prevents it."],
      role: ["No, the role doesn't allow that action", answer === "role" ? reason : allowed ? `${role} does allow this.` : "The scope is the first problem here."],
      scope: ["No, the assignment's scope doesn't cover it", answer === "scope" ? reason : scope.id === target.id ? "The assignment is made on this very resource." : "The resource sits within the assigned scope, so the assignment is inherited."],
      here: ["No, assignments only apply where they're made", "Assignments are inherited by every scope beneath them."],
    };
    return q("INTERMEDIATE", "RBAC scope and inheritance", "Azure RBAC", `RBAC drill ${index + 1}: a user is assigned ${role} on ${scope.label}. The hierarchy is mg-corp, then sub-prod, then the resource groups rg-web (holding vm-web01) and rg-data (holding sql-data01). Can the user ${ACTIONS[action]} ${target.label}?`, reason,
      options[answer], ...Object.entries(options).filter(([key]) => key !== answer).map(([, value]) => value));
  });
}

type AzureRoute = { prefix: string; bits: number; source: "User" | "Virtual network gateway" | "Default"; hop: string };
const SOURCE_RANK = { User: 0, "Virtual network gateway": 1, Default: 2 } as const;

/** Azure picks the longest matching prefix, then prefers user-defined routes over BGP routes over system routes. */
export function azureRouteDrills(count: number, seed: number): SeedQuestion[] {
  const random = generator(seed);
  return Array.from({ length: count }, (_, index) => {
    const third = random.int(1, 200);
    const host = random.int(10, 240);
    const destination = `10.20.${third}.${host}`;
    const kind = index % 3;
    const routes: AzureRoute[] = kind === 0
      ? [
        { prefix: `10.20.${third}.0/24`, bits: 24, source: "Virtual network gateway", hop: "Virtual network gateway" },
        { prefix: "10.20.0.0/16", bits: 16, source: "User", hop: "Virtual appliance 10.0.9.4" },
        { prefix: "0.0.0.0/0", bits: 0, source: "Default", hop: "Internet" },
      ]
      : kind === 1
        ? [
          { prefix: `10.20.${third}.0/24`, bits: 24, source: "Virtual network gateway", hop: "Virtual network gateway" },
          { prefix: `10.20.${third}.0/24`, bits: 24, source: "User", hop: "Virtual appliance 10.0.9.4" },
          { prefix: "0.0.0.0/0", bits: 0, source: "Default", hop: "Internet" },
        ]
        : [
          { prefix: "10.20.0.0/16", bits: 16, source: "Default", hop: "Virtual network peering" },
          { prefix: "0.0.0.0/0", bits: 0, source: "User", hop: "Virtual appliance 10.0.9.4" },
          { prefix: "0.0.0.0/0", bits: 0, source: "Default", hop: "Internet" },
        ];
    const winner = [...routes].sort((a, b) => b.bits - a.bits || SOURCE_RANK[a.source] - SOURCE_RANK[b.source])[0];
    const reason = kind === 0
      ? "The longest matching prefix wins first, so the /24 learned over BGP beats the user-defined /16."
      : kind === 1
        ? "Both routes are /24. For the same prefix, a user-defined route beats a BGP route from the gateway."
        : "The /16 system route for the peered network is the longest match, so the user-defined default route isn't used for this destination.";
    const table = ["Source                    Address prefix        Next hop type", ...routes.map((route) => `${route.source.padEnd(25)} ${route.prefix.padEnd(21)} ${route.hop}`)].join("\n");
    const whyWrong = (route: AzureRoute) => route.bits < winner.bits ? "Its prefix is shorter than the best match." : "For the same prefix, a user-defined route is preferred.";
    const hops = [...new Set(routes.map((route) => route.hop))];
    return withExhibit(q("ADVANCED", "Route selection", "Azure routing", `Route drill ${index + 1}: the effective routes for a VM's network interface are shown. Where does Azure send a packet to ${destination}?`, reason,
      [winner.hop, reason], ...hops.filter((hop) => hop !== winner.hop).map((hop): [string, string] => [hop, whyWrong(routes.find((route) => route.hop === hop)!)]), ["The packet is dropped", "At least one route matches this destination."]), table);
  });
}
