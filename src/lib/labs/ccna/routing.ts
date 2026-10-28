import { formatAddr } from "../engine/addr";
import { forward, ospfAdjacency, ospfIfaces } from "../engine/l3";
import type { LabDefinition } from "../engine/lab";
import type { LabState } from "../engine/types";
import { access, hasRoute, host, iface, ip, link, ospfFull, router, slaacAddress } from "./helpers";

const rid = (state: LabState, dev: string) => state.devices[dev].ospf?.activeRid;
const ospfIf = (state: LabState, dev: string, name: string) => ospfIfaces(state, dev).find((item) => item.iface === name);

export const ospfLab: LabDefinition = {
  slug: "single-area-ospfv2-dr-election-and-default-route",
  title: "Single-area OSPFv2: DR election and default route",
  description: "Bring three routers into OSPF area 0 over a shared segment, control the DR/BDR election, keep LANs passive, and inject a default route toward the ISP.",
  domain: "IP Connectivity",
  objective: "3.4",
  difficulty: "Expert",
  durationMinutes: 45,
  device: "R1",
  scenario: "R1, R2 and R3 share a multi-access backbone segment through SW1, and R1 is the only router with an internet link. The addressing is finished but no routing protocol runs yet. Design requirements: R1 must be the DR, R2 the BDR, R3 must never become DR, and nothing may send hellos toward users.",
  devices: [
    router("R1"), router("R2"), router("R3"), router("ISP"), access("SW1"),
    host("PC2", "10.2.2.10/24", { gateway: "10.2.2.1" }),
    host("PC3", "10.3.3.10/24", { gateway: "10.3.3.1" }),
  ],
  links: [
    link("R1", "GigabitEthernet0/0", "SW1", "GigabitEthernet0/1"),
    link("R2", "GigabitEthernet0/0", "SW1", "FastEthernet0/2"),
    link("R3", "GigabitEthernet0/0", "SW1", "FastEthernet0/3"),
    link("R1", "GigabitEthernet0/1", "ISP", "GigabitEthernet0/0"),
    link("R2", "GigabitEthernet0/1", "PC2", "FastEthernet0"),
    link("R3", "GigabitEthernet0/1", "PC3", "FastEthernet0"),
  ],
  layout: {
    ISP: { x: 320, y: 45, kind: "cloud" },
    R1: { x: 320, y: 150, kind: "router" },
    SW1: { x: 320, y: 255, kind: "switch" },
    R2: { x: 120, y: 255, kind: "router" },
    R3: { x: 520, y: 255, kind: "router" },
    PC2: { x: 120, y: 345, kind: "pc" },
    PC3: { x: 520, y: 345, kind: "pc" },
  },
  bootstrap: {
    R1: ["interface g0/0", "ip address 10.0.123.1 255.255.255.0", "no shutdown", "interface g0/1", "ip address 203.0.113.2 255.255.255.252", "no shutdown"],
    R2: ["interface g0/0", "ip address 10.0.123.2 255.255.255.0", "no shutdown", "interface g0/1", "ip address 10.2.2.1 255.255.255.0", "no shutdown"],
    R3: ["interface g0/0", "ip address 10.0.123.3 255.255.255.0", "no shutdown", "interface g0/1", "ip address 10.3.3.1 255.255.255.0", "no shutdown"],
    ISP: ["interface g0/0", "ip address 203.0.113.1 255.255.255.252", "no shutdown", "interface loopback0", "ip address 8.8.8.8 255.255.255.255", "ip route 10.0.0.0 255.0.0.0 203.0.113.2"],
  },
  tasks: [
    {
      id: "router-ids", title: "Start OSPF with fixed router IDs", instruction: "Run OSPF process 10 on R1, R2 and R3 with router IDs 1.1.1.1, 2.2.2.2 and 3.3.3.3.", hint: "router ospf 10, then router-id 1.1.1.1. If OSPF already picked an ID from an interface and has neighbors, use clear ip ospf process for the new ID to take effect.",
      check: (s) => s.devices.R1.ospf?.pid === 10 && s.devices.R2.ospf?.pid === 10 && s.devices.R3.ospf?.pid === 10
        && rid(s, "R1") === ip("1.1.1.1") && rid(s, "R2") === ip("2.2.2.2") && rid(s, "R3") === ip("3.3.3.3"),
    },
    {
      id: "networks", title: "Advertise the right networks", instruction: "Put the 10.0.123.0/24 backbone and the R2 and R3 LANs into area 0 with exact wildcard masks. Do not run OSPF on R1's ISP link.", hint: "network 10.0.123.0 0.0.0.255 area 0 on every router, plus network 10.2.2.0 0.0.0.255 area 0 on R2 and network 10.3.3.0 0.0.0.255 area 0 on R3.",
      check: (s) => hasRoute(s, "R2", "10.3.3.0/24", "O") && hasRoute(s, "R3", "10.2.2.0/24", "O") && hasRoute(s, "R1", "10.2.2.0/24", "O") && !ospfIf(s, "R1", "GigabitEthernet0/1"),
    },
    {
      id: "passive", title: "Silence the user LANs", instruction: "Make the LAN interfaces on R2 and R3 passive while keeping them advertised.", hint: "Under router ospf 10: passive-interface g0/1. Or use passive-interface default and no passive-interface g0/0.",
      check: (s) => ospfIf(s, "R2", "GigabitEthernet0/1")?.passive === true && ospfIf(s, "R3", "GigabitEthernet0/1")?.passive === true
        && ospfIf(s, "R2", "GigabitEthernet0/0")?.passive === false && ospfIf(s, "R3", "GigabitEthernet0/0")?.passive === false,
    },
    {
      id: "election", title: "Control the DR election", instruction: "Make R1 the DR with OSPF priority 255 on its backbone interface, leave R2 to win BDR, and stop R3 from ever becoming DR or BDR.", hint: "On R1 interface g0/0: ip ospf priority 255. On R3 interface g0/0: ip ospf priority 0.",
      check: (s) => {
        const view = ospfAdjacency(s, "R2").dr["GigabitEthernet0/0"];
        return iface(s, "R1", "GigabitEthernet0/0").ospf.priority === 255 && iface(s, "R3", "GigabitEthernet0/0").ospf.priority === 0
          && view?.dr === ip("1.1.1.1") && view?.bdr === ip("2.2.2.2");
      },
    },
    {
      id: "reference-bandwidth", title: "Fix the cost model", instruction: "Set the OSPF reference bandwidth to 10000 Mbps on all three routers, so Gigabit links don't share a cost with FastEthernet.", hint: "auto-cost reference-bandwidth 10000 under router ospf 10.",
      check: (s) => ["R1", "R2", "R3"].every((name) => s.devices[name].ospf?.refBw === 10000),
    },
    {
      id: "default-route", title: "Originate a default route", instruction: "Give R1 a static default route to the ISP (203.0.113.1) and advertise it into OSPF, so R2 and R3 learn an O*E2 route.", hint: "On R1: ip route 0.0.0.0 0.0.0.0 203.0.113.1, then default-information originate under router ospf 10.",
      check: (s) => hasRoute(s, "R2", "0.0.0.0/0", "O*E2") && hasRoute(s, "R3", "0.0.0.0/0", "O*E2"),
    },
    {
      id: "verify-neighbors", title: "Verify the adjacencies", instruction: "On R3, run show ip ospf neighbor and confirm R1 is FULL/DR and R2 is FULL/BDR.", hint: "show ip ospf neighbor on R3.",
      verify: {
        device: "R3", command: "show ip ospf neighbor",
        when: (s) => {
          const neighbors = ospfAdjacency(s, "R3").neighbors;
          return neighbors.some((n) => n.rid === ip("1.1.1.1") && n.state === "FULL" && n.role === "DR") && neighbors.some((n) => n.rid === ip("2.2.2.2") && n.state === "FULL" && n.role === "BDR");
        },
      },
    },
    {
      id: "verify-internet", title: "Reach the internet", instruction: "From PC3, ping 8.8.8.8 successfully.", hint: "connect PC3, then ping 8.8.8.8.",
      verify: { device: "PC3", command: "ping", when: (_, info) => Boolean(info.result?.ok && info.result.target === "8.8.8.8") },
    },
  ],
};

export const ospfTroubleshootingLab: LabDefinition = {
  slug: "troubleshoot-a-broken-ospf-network",
  title: "Troubleshoot a broken OSPF network",
  description: "Three routers, five faults: mismatched timers, wrong areas, a passive transit link, a duplicate router ID and a bad wildcard mask. Find each one with show commands and repair it.",
  domain: "IP Connectivity",
  objective: "3.4",
  difficulty: "Expert",
  durationMinutes: 50,
  device: "R2",
  scenario: "A change window went badly. OSPF is configured on R1, R2 and R3 in a triangle, but no router has a full set of routes and users on every LAN are cut off from each other. Nothing in the topology may change: restore full adjacency on every link and full reachability by fixing configuration only. Some faults only appear after you fix the one hiding them.",
  devices: [
    router("R1"), router("R2"), router("R3"),
    host("PC1", "10.1.1.10/24", { gateway: "10.1.1.1" }),
    host("PC2", "10.2.2.10/24", { gateway: "10.2.2.1" }),
    host("PC3", "10.3.3.10/24", { gateway: "10.3.3.1" }),
  ],
  links: [
    link("R1", "GigabitEthernet0/0", "R2", "GigabitEthernet0/0"),
    link("R2", "GigabitEthernet0/1", "R3", "GigabitEthernet0/1"),
    link("R1", "GigabitEthernet0/1", "R3", "GigabitEthernet0/0"),
    link("R1", "GigabitEthernet0/2", "PC1", "FastEthernet0"),
    link("R2", "GigabitEthernet0/2", "PC2", "FastEthernet0"),
    link("R3", "GigabitEthernet0/2", "PC3", "FastEthernet0"),
  ],
  layout: {
    R1: { x: 170, y: 80, kind: "router" },
    R2: { x: 470, y: 80, kind: "router" },
    R3: { x: 320, y: 235, kind: "router" },
    PC1: { x: 70, y: 215, kind: "pc" },
    PC2: { x: 570, y: 215, kind: "pc" },
    PC3: { x: 320, y: 345, kind: "pc" },
  },
  bootstrap: {
    R1: [
      "interface g0/0", "ip address 10.0.12.1 255.255.255.252", "ip ospf hello-interval 5", "no shutdown",
      "interface g0/1", "ip address 10.0.13.1 255.255.255.252", "no shutdown",
      "interface g0/2", "ip address 10.1.1.1 255.255.255.0", "no shutdown",
      "router ospf 1", "router-id 1.1.1.1", "passive-interface g0/2", "passive-interface g0/1",
      "network 10.0.12.0 0.0.0.3 area 0", "network 10.0.13.0 0.0.0.3 area 0", "network 10.1.1.0 0.0.0.255 area 0",
    ],
    R2: [
      "interface g0/0", "ip address 10.0.12.2 255.255.255.252", "no shutdown",
      "interface g0/1", "ip address 10.0.23.1 255.255.255.252", "no shutdown",
      "interface g0/2", "ip address 10.2.2.1 255.255.255.0", "no shutdown",
      "router ospf 1", "router-id 2.2.2.2", "passive-interface g0/2",
      "network 10.0.12.0 0.0.0.3 area 0", "network 10.0.23.0 0.0.0.3 area 0", "network 10.2.2.0 0.0.0.255 area 0",
    ],
    R3: [
      "interface g0/0", "ip address 10.0.13.2 255.255.255.252", "no shutdown",
      "interface g0/1", "ip address 10.0.23.2 255.255.255.252", "no shutdown",
      "interface g0/2", "ip address 10.3.3.1 255.255.255.0", "no shutdown",
      "router ospf 1", "router-id 2.2.2.2", "passive-interface g0/2",
      "network 10.0.13.0 0.0.0.3 area 0", "network 10.0.23.0 0.0.0.3 area 1", "network 10.3.3.0 0.0.0.0 area 0",
    ],
  },
  tasks: [
    {
      id: "r1-r2", title: "Restore R1–R2", instruction: "Bring the R1–R2 adjacency up to FULL.", hint: "Compare show ip ospf interface g0/0 on both routers. The Hello and Dead timers must match.",
      check: (s) => ospfFull(s, "R1", "R2"),
    },
    {
      id: "r1-r3", title: "Restore R1–R3", instruction: "Bring the R1–R3 adjacency up to FULL.", hint: "show ip protocols on R1 lists passive interfaces. A transit link must not be passive.",
      check: (s) => ospfFull(s, "R1", "R3"),
    },
    {
      id: "r2-r3", title: "Restore R2–R3", instruction: "Bring the R2–R3 adjacency up to FULL. Two separate problems block it.", hint: "Watch the console for %OSPF-4-ERRRCV (area mismatch) and %OSPF-4-DUP_RTRID_NBR (duplicate router ID). R3 should use router ID 3.3.3.3; after changing it, run clear ip ospf process.",
      check: (s) => ospfFull(s, "R2", "R3"),
    },
    {
      id: "router-id", title: "Give R3 a unique router ID", instruction: "Make sure R3 is running with router ID 3.3.3.3.", hint: "router-id 3.3.3.3 under router ospf 1, then clear ip ospf process from privileged EXEC.",
      check: (s) => rid(s, "R3") === ip("3.3.3.3"),
    },
    {
      id: "lans", title: "Advertise every LAN", instruction: "Every router must have an OSPF route to the two LANs it isn't connected to.", hint: "show ip route ospf on R1 shows 10.3.3.0/24 missing. A wildcard of 0.0.0.0 only matches one exact address.",
      check: (s) => hasRoute(s, "R1", "10.2.2.0/24", "O") && hasRoute(s, "R1", "10.3.3.0/24", "O") && hasRoute(s, "R2", "10.1.1.0/24", "O")
        && hasRoute(s, "R2", "10.3.3.0/24", "O") && hasRoute(s, "R3", "10.1.1.0/24", "O") && hasRoute(s, "R3", "10.2.2.0/24", "O"),
    },
    {
      id: "verify-r2", title: "Verify from R2", instruction: "On R2, run show ip ospf neighbor and see both R1 and R3 FULL.", hint: "show ip ospf neighbor on R2.",
      verify: { device: "R2", command: "show ip ospf neighbor", when: (s) => ospfFull(s, "R1", "R2") && ospfFull(s, "R2", "R3") },
    },
    {
      id: "verify-pc", title: "Prove end-to-end reachability", instruction: "From PC1, ping PC3 (10.3.3.10) successfully.", hint: "connect PC1, then ping 10.3.3.10.",
      verify: { device: "PC1", command: "ping", when: (_, info) => Boolean(info.result?.ok && info.result.target === "10.3.3.10") },
    },
  ],
};

const SERIAL = "Serial0/0/0";
const v6Router = (name: string) => router(name, ["GigabitEthernet0/0", "GigabitEthernet0/1", SERIAL]);
const pcC = (s: LabState) => slaacAddress(s, "PC-C");
const viaR2 = (s: LabState) => {
  const target = pcC(s);
  if (target === undefined) return false;
  const src = slaacAddress(s, "PC-A");
  if (src === undefined) return false;
  const trace = forward(structuredClone(s), "PC-A", { family: 6, src, dst: target, proto: "icmp", sport: 1, dport: 0 });
  return trace.ok && trace.hops.some((hop) => hop.dev === "R2");
};
const r2Down = (s: LabState) => iface(s, "R2", "GigabitEthernet0/0").shutdown && iface(s, "R2", "GigabitEthernet0/1").shutdown;
const staticV6 = (s: LabState, dev: string) => s.devices[dev].staticRoutes.filter((route) => route.family === 6 && route.len === 0);

export const ipv6Lab: LabDefinition = {
  slug: "ipv6-addressing-slaac-and-floating-static-routes",
  title: "IPv6 addressing, SLAAC and floating static routes",
  description: "Address two routers with global, link-local and EUI-64 addresses, let hosts autoconfigure with SLAAC, and build primary and floating IPv6 default routes that survive a core router failure.",
  domain: "IP Connectivity",
  objective: "1.8–1.9, 3.3",
  difficulty: "Expert",
  durationMinutes: 45,
  device: "R1",
  scenario: "The company is moving its two sites to IPv6. R2 is the provider-managed core and is already configured. Traffic between the sites must normally cross R2, and switch to the slow serial backup link only if R2 fails.",
  devices: [
    v6Router("R1"), v6Router("R2"), v6Router("R3"),
    host("PC-A", null, { slaac: true }),
    host("PC-C", null, { slaac: true }),
  ],
  links: [
    link("R1", "GigabitEthernet0/0", "R2", "GigabitEthernet0/0"),
    link("R2", "GigabitEthernet0/1", "R3", "GigabitEthernet0/1"),
    link("R1", SERIAL, "R3", SERIAL),
    link("R1", "GigabitEthernet0/1", "PC-A", "FastEthernet0"),
    link("R3", "GigabitEthernet0/0", "PC-C", "FastEthernet0"),
  ],
  layout: {
    R2: { x: 320, y: 55, kind: "router" },
    R1: { x: 150, y: 200, kind: "router" },
    R3: { x: 490, y: 200, kind: "router" },
    "PC-A": { x: 150, y: 335, kind: "pc" },
    "PC-C": { x: 490, y: 335, kind: "pc" },
  },
  bootstrap: {
    R1: ["interface g0/0", "no shutdown", "interface g0/1", "no shutdown", `interface ${SERIAL}`, "no shutdown"],
    R2: [
      "ipv6 unicast-routing",
      "interface g0/0", "ipv6 address fe80::2 link-local", "ipv6 address 2001:db8:12::2/64", "no shutdown",
      "interface g0/1", "ipv6 address fe80::2 link-local", "ipv6 address 2001:db8:23::2/64", "no shutdown",
      "ipv6 route 2001:db8:a::/64 2001:db8:12::1",
      "ipv6 route 2001:db8:c::/64 2001:db8:23::3",
    ],
    R3: ["interface g0/0", "no shutdown", "interface g0/1", "no shutdown", `interface ${SERIAL}`, "no shutdown"],
  },
  tasks: [
    {
      id: "r1-addressing", title: "Address R1", instruction: "On R1 assign 2001:db8:12::1/64 to Gi0/0, 2001:db8:a::1/64 to Gi0/1 and 2001:db8:13::1/64 to S0/0/0. Use the static link-local FE80::1 on both Gigabit interfaces.", hint: "ipv6 address 2001:db8:12::1/64 and ipv6 address fe80::1 link-local under each interface.",
      check: (s) => {
        const g0 = iface(s, "R1", "GigabitEthernet0/0");
        const g1 = iface(s, "R1", "GigabitEthernet0/1");
        return g0.ipv6.some((a) => a.addr === ip("2001:db8:12::1")) && g1.ipv6.some((a) => a.addr === ip("2001:db8:a::1"))
          && iface(s, "R1", SERIAL).ipv6.some((a) => a.addr === ip("2001:db8:13::1")) && g0.linkLocal === ip("fe80::1") && g1.linkLocal === ip("fe80::1");
      },
    },
    {
      id: "r3-addressing", title: "Address R3 with EUI-64", instruction: "On R3 assign 2001:db8:23::3/64 to Gi0/1 and 2001:db8:13::3/64 to S0/0/0, and give the LAN interface Gi0/0 an EUI-64 address in 2001:db8:c::/64. Use link-local FE80::3 on both Gigabit interfaces.", hint: "On Gi0/0: ipv6 address 2001:db8:c::/64 eui-64.",
      check: (s) => {
        const lan = iface(s, "R3", "GigabitEthernet0/0");
        return lan.ipv6.some((a) => a.eui64 && a.addr === ip("2001:db8:c::")) && iface(s, "R3", "GigabitEthernet0/1").ipv6.some((a) => a.addr === ip("2001:db8:23::3"))
          && iface(s, "R3", SERIAL).ipv6.some((a) => a.addr === ip("2001:db8:13::3")) && lan.linkLocal === ip("fe80::3") && iface(s, "R3", "GigabitEthernet0/1").linkLocal === ip("fe80::3");
      },
    },
    {
      id: "slaac", title: "Let hosts autoconfigure", instruction: "Enable IPv6 routing on R1 and R3 so they send router advertisements, then confirm PC-A and PC-C build SLAAC addresses.", hint: "ipv6 unicast-routing in global configuration. Then connect PC-C and run ipconfig to see its address.",
      check: (s) => s.devices.R1.ipv6Routing && s.devices.R3.ipv6Routing && slaacAddress(s, "PC-A") !== undefined && pcC(s) !== undefined,
    },
    {
      id: "r1-default", title: "R1 primary default route", instruction: "On R1, add a fully specified IPv6 default route out Gi0/0 to R2's link-local address FE80::2.", hint: "ipv6 route ::/0 g0/0 fe80::2",
      check: (s) => staticV6(s, "R1").some((route) => route.exitIf === "GigabitEthernet0/0" && route.nextHop === ip("fe80::2") && route.ad === 1),
    },
    {
      id: "r3-default", title: "R3 primary default route", instruction: "On R3, add a recursive IPv6 default route to R2's global address 2001:db8:23::2.", hint: "ipv6 route ::/0 2001:db8:23::2",
      check: (s) => staticV6(s, "R3").some((route) => !route.exitIf && route.nextHop === ip("2001:db8:23::2") && route.ad === 1),
    },
    {
      id: "floating", title: "Add floating backups", instruction: "On R1 and R3, add default routes over the serial link with administrative distance 10, so they only take over when the primary fails.", hint: "R1: ipv6 route ::/0 2001:db8:13::3 10. R3: ipv6 route ::/0 2001:db8:13::1 10.",
      check: (s) => staticV6(s, "R1").some((route) => route.ad === 10 && (route.nextHop === ip("2001:db8:13::3") || route.exitIf === SERIAL))
        && staticV6(s, "R3").some((route) => route.ad === 10 && (route.nextHop === ip("2001:db8:13::1") || route.exitIf === SERIAL)),
    },
    {
      id: "verify-primary", title: "Trace the primary path", instruction: "Connect to PC-C and run ipconfig to learn its address. Then, from PC-A, tracert to PC-C and confirm the path crosses R2.", hint: "Copy PC-C's IPv6 address, then on PC-A run tracert <address>.",
      verify: { device: "PC-A", command: "tracert", when: (s, info) => Boolean(info.result?.ok && pcC(s) !== undefined && info.result.target === formatAddr(6, pcC(s)!, false) && viaR2(s)) },
    },
    {
      id: "verify-failover", title: "Survive an R2 failure", instruction: "Shut down both of R2's interfaces, then ping PC-C from PC-A successfully over the floating routes.", hint: "connect R2, shut down g0/0 and g0/1, then connect PC-A and ping PC-C's address again.",
      verify: { device: "PC-A", command: "ping", when: (s, info) => Boolean(info.result?.ok && r2Down(s) && pcC(s) !== undefined && info.result.target === formatAddr(6, pcC(s)!, false)) },
    },
  ],
};

const hsrpState = (s: LabState, dev: string) => s.devices[dev].hsrp["GigabitEthernet0/1:10"];

export const hsrpLab: LabDefinition = {
  slug: "hsrp-first-hop-redundancy-and-failover",
  title: "HSRP first-hop redundancy with interface tracking",
  description: "Give a LAN a virtual default gateway shared by two routers, prefer R1 with preemption, track its WAN link, and prove traffic fails over and back.",
  domain: "IP Connectivity",
  objective: "3.5",
  difficulty: "Advanced",
  durationMinutes: 35,
  device: "R1",
  scenario: "Hosts on 192.168.1.0/24 already point at 192.168.1.254, but no device owns that address yet. R1 and R2 each have their own ISP uplink. R1 should normally forward traffic, R2 must take over if R1 or its uplink fails, and R1 must take the role back when it recovers.",
  devices: [
    router("R1"), router("R2"), router("ISP"), access("SW1"),
    host("PC-A", "192.168.1.10/24", { gateway: "192.168.1.254" }),
    host("PC-B", "192.168.1.11/24", { gateway: "192.168.1.254" }),
  ],
  links: [
    link("R1", "GigabitEthernet0/1", "SW1", "GigabitEthernet0/1"),
    link("R2", "GigabitEthernet0/1", "SW1", "GigabitEthernet0/2"),
    link("SW1", "FastEthernet0/1", "PC-A", "FastEthernet0"),
    link("SW1", "FastEthernet0/2", "PC-B", "FastEthernet0"),
    link("R1", "GigabitEthernet0/0", "ISP", "GigabitEthernet0/0"),
    link("R2", "GigabitEthernet0/0", "ISP", "GigabitEthernet0/1"),
  ],
  layout: {
    ISP: { x: 320, y: 45, kind: "cloud" },
    R1: { x: 150, y: 150, kind: "router" },
    R2: { x: 490, y: 150, kind: "router" },
    SW1: { x: 320, y: 245, kind: "switch" },
    "PC-A": { x: 190, y: 340, kind: "pc" },
    "PC-B": { x: 450, y: 340, kind: "pc" },
  },
  bootstrap: {
    R1: ["interface g0/0", "ip address 198.51.100.1 255.255.255.252", "no shutdown", "interface g0/1", "ip address 192.168.1.2 255.255.255.0", "no shutdown", "ip route 0.0.0.0 0.0.0.0 198.51.100.2"],
    R2: ["interface g0/0", "ip address 198.51.100.5 255.255.255.252", "no shutdown", "interface g0/1", "ip address 192.168.1.3 255.255.255.0", "no shutdown", "ip route 0.0.0.0 0.0.0.0 198.51.100.6"],
    ISP: [
      "interface g0/0", "ip address 198.51.100.2 255.255.255.252", "no shutdown",
      "interface g0/1", "ip address 198.51.100.6 255.255.255.252", "no shutdown",
      "interface loopback0", "ip address 203.0.113.10 255.255.255.255",
      "ip route 192.168.1.0 255.255.255.0 198.51.100.1",
      "ip route 192.168.1.0 255.255.255.0 198.51.100.5",
    ],
  },
  tasks: [
    {
      id: "group", title: "Create the HSRP group", instruction: "On R1 and R2 Gi0/1, run HSRP version 2, group 10, with virtual IP 192.168.1.254.", hint: "standby version 2, then standby 10 ip 192.168.1.254 on both routers.",
      check: (s) => ["R1", "R2"].every((name) => {
        const lan = iface(s, name, "GigabitEthernet0/1");
        return lan.standbyVersion === 2 && lan.standby[10]?.ip === ip("192.168.1.254");
      }),
    },
    {
      id: "priority", title: "Prefer R1", instruction: "Give R1 priority 150 and enable preemption on both routers.", hint: "R1: standby 10 priority 150 and standby 10 preempt. R2: standby 10 preempt.",
      check: (s) => iface(s, "R1", "GigabitEthernet0/1").standby[10]?.priority === 150 && iface(s, "R1", "GigabitEthernet0/1").standby[10]?.preempt === true && iface(s, "R2", "GigabitEthernet0/1").standby[10]?.preempt === true,
    },
    {
      id: "track", title: "Track R1's uplink", instruction: "Make R1 drop its priority by 60 if Gi0/0 goes down, so R2 (priority 100) takes over.", hint: "standby 10 track g0/0 60 on R1 Gi0/1.",
      check: (s) => iface(s, "R1", "GigabitEthernet0/1").standby[10]?.track.some((track) => track.iface === "GigabitEthernet0/0" && track.decrement > 50) === true,
    },
    {
      id: "verify-roles", title: "Verify the roles", instruction: "On R2, run show standby brief while R1 is Active and R2 is Standby.", hint: "If R2 became Active first, R1 needs preempt to take over.",
      verify: { device: "R2", command: "show standby brief", when: (s) => hsrpState(s, "R1") === "Active" && hsrpState(s, "R2") === "Standby" },
    },
    {
      id: "verify-internet", title: "Reach the internet", instruction: "From PC-A, ping 203.0.113.10 successfully.", hint: "connect PC-A, then ping 203.0.113.10.",
      verify: { device: "PC-A", command: "ping", when: (_, info) => Boolean(info.result?.ok && info.result.target === "203.0.113.10") },
    },
    {
      id: "failover", title: "Fail R1's uplink", instruction: "Shut down R1 Gi0/0. Confirm R2 becomes Active, then trace from PC-A to 203.0.113.10 successfully.", hint: "On R1: interface g0/0, shutdown. Watch for %HSRP-5-STATECHANGE on R2, then run tracert 203.0.113.10 on PC-A.",
      verify: { device: "PC-A", command: "tracert", when: (s, info) => Boolean(info.result?.ok && info.result.target === "203.0.113.10" && iface(s, "R1", "GigabitEthernet0/0").shutdown && hsrpState(s, "R2") === "Active") },
    },
    {
      id: "recover", title: "Recover and preempt", instruction: "Re-enable R1 Gi0/0 and confirm with show standby brief on R1 that it preempts back to Active.", hint: "no shutdown on R1 Gi0/0, then show standby brief.",
      verify: { device: "R1", command: "show standby brief", when: (s) => s.verified.includes("failover") && !iface(s, "R1", "GigabitEthernet0/0").shutdown && hsrpState(s, "R1") === "Active" },
    },
  ],
};
