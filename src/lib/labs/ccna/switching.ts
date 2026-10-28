import { bpduguardActive, logicalUp, opMode, portCarries, portfastActive, spanningTree } from "../engine/l2";
import type { LabDefinition } from "../engine/lab";
import { access, bundleOf, bundled, host, iface, link, multilayer, reach, rootOf, rootPort, router, vlanNamed } from "./helpers";

export const createVlanLab: LabDefinition = {
  slug: "create-a-vlan",
  title: "Create a VLAN and configure an access port",
  description: "Segment a small office network by creating the Sales VLAN and assigning a switch port to it.",
  domain: "Network Access",
  objective: "2.1",
  difficulty: "Beginner",
  durationMinutes: 8,
  device: "SW1",
  scenario: "PC-A belongs to the sales team. Put it in its own VLAN on SW1.",
  devices: [access("SW1"), host("PC-A", "192.168.20.10/24")],
  links: [link("SW1", "GigabitEthernet0/1", "PC-A", "FastEthernet0")],
  layout: { "PC-A": { x: 170, y: 190, kind: "pc" }, SW1: { x: 470, y: 190, kind: "switch" } },
  bootstrap: {},
  tasks: [
    { id: "configure-mode", title: "Enter configuration mode", instruction: "Move from the user prompt into global configuration mode.", hint: "Use enable, then configure terminal.", check: (s) => s.cli.SW1.enteredConfig },
    { id: "create-vlan", title: "Create VLAN 20", instruction: "Create VLAN 20 and name it SALES.", hint: "From global configuration mode, enter vlan 20, then name SALES.", check: (s) => vlanNamed(s, "SW1", 20, "SALES") },
    {
      id: "assign-port", title: "Assign the access port", instruction: "Configure GigabitEthernet0/1 as an access port in VLAN 20.", hint: "Enter interface Gi0/1, then switchport mode access and switchport access vlan 20.",
      check: (s) => iface(s, "SW1", "GigabitEthernet0/1").mode === "access" && iface(s, "SW1", "GigabitEthernet0/1").accessVlan === 20,
    },
    {
      id: "verify", title: "Verify the configuration", instruction: "Run show vlan brief and confirm VLAN 20 includes Gi0/1.", hint: "Return to privileged EXEC mode with end, then run show vlan brief.",
      verify: { device: "SW1", command: ["show vlan brief", "show vlan"], when: (s) => vlanNamed(s, "SW1", 20, "SALES") && iface(s, "SW1", "GigabitEthernet0/1").mode === "access" && iface(s, "SW1", "GigabitEthernet0/1").accessVlan === 20 },
    },
  ],
};

const roasPorts: [string, number][] = [["FastEthernet0/1", 10], ["FastEthernet0/2", 20], ["FastEthernet0/3", 30]];
const roasTrunkReady = (s: Parameters<NonNullable<LabDefinition["tasks"][number]["check"]>>[0]) => {
  const uplink = iface(s, "SW1", "GigabitEthernet0/1");
  return uplink.mode === "trunk" && uplink.nativeVlan === 99 && uplink.nonegotiate && JSON.stringify(uplink.allowed) === JSON.stringify([10, 20, 30, 99]);
};

export const routerOnAStickLab: LabDefinition = {
  slug: "inter-vlan-routing-router-on-a-stick",
  title: "Inter-VLAN routing with a hardened 802.1Q trunk",
  description: "Build three user VLANs and a management VLAN, lock down the trunk to R1, and route between VLANs with dot1Q subinterfaces.",
  domain: "Network Access",
  objective: "2.1–2.2",
  difficulty: "Advanced",
  durationMinutes: 35,
  device: "SW1",
  scenario: "A branch office runs on one switch and one router. Staff, guests and servers must be separated by VLAN but still reach each other through R1. A previous technician left SW1 half-configured, so check every port before you trust it.",
  devices: [
    access("SW1"),
    router("R1"),
    host("PC-A", "192.168.10.10/24", { gateway: "192.168.10.1" }),
    host("PC-B", "192.168.20.10/24", { gateway: "192.168.20.1" }),
    host("SRV1", "192.168.30.10/24", { gateway: "192.168.30.1", services: ["http", "https"] }),
  ],
  links: [
    link("R1", "GigabitEthernet0/0", "SW1", "GigabitEthernet0/1"),
    link("SW1", "FastEthernet0/1", "PC-A", "FastEthernet0"),
    link("SW1", "FastEthernet0/2", "PC-B", "FastEthernet0"),
    link("SW1", "FastEthernet0/3", "SRV1", "FastEthernet0"),
  ],
  layout: {
    R1: { x: 320, y: 55, kind: "router" },
    SW1: { x: 320, y: 190, kind: "switch" },
    "PC-A": { x: 110, y: 320, kind: "pc", label: "VLAN 10" },
    "PC-B": { x: 320, y: 320, kind: "pc", label: "VLAN 20" },
    SRV1: { x: 530, y: 320, kind: "server", label: "VLAN 30" },
  },
  bootstrap: {
    SW1: ["interface FastEthernet0/2", "switchport mode access", "switchport access vlan 21", "description PC-B"],
  },
  tasks: [
    {
      id: "vlans", title: "Create the VLANs", instruction: "On SW1 create VLAN 10 STAFF, VLAN 20 GUEST, VLAN 30 SERVERS and VLAN 99 MGMT.", hint: "vlan 10 then name STAFF, and repeat for 20, 30 and 99.",
      check: (s) => vlanNamed(s, "SW1", 10, "STAFF") && vlanNamed(s, "SW1", 20, "GUEST") && vlanNamed(s, "SW1", 30, "SERVERS") && vlanNamed(s, "SW1", 99, "MGMT"),
    },
    {
      id: "access-ports", title: "Assign access ports", instruction: "Make Fa0/1 a static access port in VLAN 10, Fa0/2 in VLAN 20 and Fa0/3 in VLAN 30. One of them is already wrong.", hint: "show vlan brief reveals Fa0/2 sitting in VLAN 21. Use switchport mode access and switchport access vlan on each port.",
      check: (s) => roasPorts.every(([name, vlan]) => iface(s, "SW1", name).mode === "access" && iface(s, "SW1", name).accessVlan === vlan),
    },
    {
      id: "trunk", title: "Harden the trunk", instruction: "Make Gi0/1 a static 802.1Q trunk with native VLAN 99, allow only VLANs 10, 20, 30 and 99, and turn off DTP.", hint: "switchport mode trunk, switchport trunk native vlan 99, switchport trunk allowed vlan 10,20,30,99, switchport nonegotiate.",
      check: roasTrunkReady,
    },
    {
      id: "subinterfaces", title: "Route between VLANs on R1", instruction: "Enable Gi0/0 on R1 and create subinterfaces .10, .20, .30 and .99 using 802.1Q. Each gets the .1 address of its 192.168.<vlan>.0/24 subnet, and VLAN 99 must be the native VLAN.", hint: "interface g0/0.10, encapsulation dot1Q 10, ip address 192.168.10.1 255.255.255.0. For VLAN 99 use encapsulation dot1Q 99 native. Finish with no shutdown on g0/0.",
      check: (s) => iface(s, "R1", "GigabitEthernet0/0.99")?.dot1q?.native === true && reach(s, "PC-A", "192.168.20.10") && reach(s, "PC-B", "192.168.30.10") && reach(s, "SRV1", "192.168.10.10"),
    },
    {
      id: "management", title: "Configure switch management", instruction: "Give SW1 the address 192.168.99.2/24 on VLAN 99 with default gateway 192.168.99.1, so it can be managed from any VLAN.", hint: "interface vlan 99, ip address 192.168.99.2 255.255.255.0, no shutdown. Then ip default-gateway 192.168.99.1 in global configuration.",
      check: (s) => reach(s, "SW1", "192.168.10.10") && reach(s, "PC-B", "192.168.99.2"),
    },
    {
      id: "verify-trunk", title: "Verify the trunk", instruction: "On SW1 run show interfaces trunk and confirm VLANs 10, 20, 30 and 99 are allowed and forwarding.", hint: "Run it from privileged EXEC mode, or use do show interfaces trunk.",
      verify: { device: "SW1", command: "show interfaces trunk", when: (s) => roasTrunkReady(s) && logicalUp(s, "SW1", "GigabitEthernet0/1") && [10, 20, 30, 99].every((vlan) => portCarries(s, "SW1", "GigabitEthernet0/1", vlan)) },
    },
    {
      id: "verify-path", title: "Trace inter-VLAN traffic", instruction: "Connect to PC-A and run tracert 192.168.30.10. The trace should reach SRV1 through R1.", hint: "Type connect PC-A, then tracert 192.168.30.10.",
      verify: { device: "PC-A", command: "tracert", when: (_, info) => Boolean(info.result?.ok && info.result.target === "192.168.30.10") },
    },
  ],
};

export const etherchannelLab: LabDefinition = {
  slug: "lacp-etherchannel-layer2-and-layer3",
  title: "Layer 2 and Layer 3 EtherChannel with LACP",
  description: "Bundle uplinks into a trunked LACP port-channel, build a routed port-channel between distribution switches, and fix a member that refuses to bundle.",
  domain: "Network Access",
  objective: "2.4",
  difficulty: "Expert",
  durationMinutes: 40,
  device: "DSW1",
  scenario: "Users on ASW1 reach a web server behind DSW2. Each pair of switches is wired with two links that should act as one. The access switch was patched in a hurry and its uplinks don't match.",
  devices: [
    multilayer("DSW1"),
    multilayer("DSW2"),
    access("ASW1"),
    host("PC-A", "10.10.10.10/24", { gateway: "10.10.10.1" }),
    host("WEB1", "172.16.50.10/24", { gateway: "172.16.50.1", services: ["http", "https"] }),
  ],
  links: [
    link("DSW1", "GigabitEthernet1/0/1", "ASW1", "GigabitEthernet0/1"),
    link("DSW1", "GigabitEthernet1/0/2", "ASW1", "GigabitEthernet0/2"),
    link("DSW1", "GigabitEthernet1/0/3", "DSW2", "GigabitEthernet1/0/3"),
    link("DSW1", "GigabitEthernet1/0/4", "DSW2", "GigabitEthernet1/0/4"),
    link("ASW1", "FastEthernet0/1", "PC-A", "FastEthernet0"),
    link("DSW2", "GigabitEthernet1/0/10", "WEB1", "FastEthernet0"),
  ],
  layout: {
    DSW1: { x: 320, y: 60, kind: "l3switch" },
    ASW1: { x: 150, y: 210, kind: "switch" },
    DSW2: { x: 490, y: 210, kind: "l3switch" },
    "PC-A": { x: 150, y: 335, kind: "pc" },
    WEB1: { x: 490, y: 335, kind: "server" },
  },
  bootstrap: {
    ASW1: [
      "vlan 10", "name USERS", "vlan 99", "name MGMT",
      "interface FastEthernet0/1", "switchport mode access", "switchport access vlan 10",
      "interface GigabitEthernet0/1", "switchport mode trunk", "switchport trunk native vlan 99",
      "interface vlan 99", "ip address 10.99.99.2 255.255.255.0", "no shutdown",
      "ip default-gateway 10.99.99.1",
    ],
    DSW1: [
      "vlan 10", "name USERS", "vlan 99", "name MGMT",
      "interface vlan 10", "ip address 10.10.10.1 255.255.255.0", "no shutdown",
      "interface vlan 99", "ip address 10.99.99.1 255.255.255.0", "no shutdown",
    ],
    DSW2: [
      "ip routing",
      "interface range g1/0/3 - 4", "no switchport", "channel-group 12 mode passive",
      "interface port-channel 12", "ip address 10.0.12.2 255.255.255.252",
      "interface g1/0/10", "no switchport", "ip address 172.16.50.1 255.255.255.0",
      "ip route 10.10.10.0 255.255.255.0 10.0.12.1",
      "ip route 10.99.99.0 255.255.255.0 10.0.12.1",
    ],
  },
  tasks: [
    {
      id: "po1", title: "Bundle the access uplinks", instruction: "Bundle DSW1 Gi1/0/1-2 and ASW1 Gi0/1-2 into Port-channel 1 using LACP, with DSW1 as the active side.", hint: "On DSW1: interface range g1/0/1 - 2, channel-group 1 mode active. On ASW1 use mode active or passive. A member showing (s) has different settings from the port-channel.",
      check: (s) => bundled(s, "DSW1", 1, 2, false) && bundled(s, "ASW1", 1, 2, false) && bundleOf(s, "DSW1", 1)?.protocol === "LACP" && iface(s, "DSW1", "GigabitEthernet1/0/1").channelGroup?.mode === "active",
    },
    {
      id: "po1-trunk", title: "Trunk the port-channel", instruction: "Make Port-channel 1 a static trunk on both switches with native VLAN 99, allowing only VLANs 10 and 99.", hint: "Configure the interface port-channel 1 on each switch. Settings applied to the port-channel are copied to its members.",
      check: (s) => ["DSW1", "ASW1"].every((name) => {
        const po = iface(s, name, "Port-channel1");
        return po?.mode === "trunk" && po.nativeVlan === 99 && JSON.stringify(po.allowed) === JSON.stringify([10, 99]) && opMode(s, name, "Port-channel1") === "trunk";
      }),
    },
    {
      id: "po12", title: "Build the routed port-channel", instruction: "Turn DSW1 Gi1/0/3-4 into routed ports, bundle them into Port-channel 12 with LACP active, and address it 10.0.12.1/30.", hint: "interface range g1/0/3 - 4, no switchport, channel-group 12 mode active. Then interface port-channel 12, ip address 10.0.12.1 255.255.255.252.",
      check: (s) => bundled(s, "DSW1", 12, 2, true) && iface(s, "DSW1", "Port-channel12")?.ipv4?.addr === BigInt(0x0a000c01),
    },
    {
      id: "routing", title: "Route to the server", instruction: "Enable IP routing on DSW1 and add a static route to 172.16.50.0/24 through DSW2, so PC-A can browse WEB1.", hint: "ip routing, then ip route 172.16.50.0 255.255.255.0 10.0.12.2.",
      check: (s) => s.devices.DSW1.ipRouting && reach(s, "PC-A", "172.16.50.10", "tcp", 80) && reach(s, "ASW1", "172.16.50.10"),
    },
    {
      id: "load-balance", title: "Balance on IP addresses", instruction: "Set the EtherChannel load-balancing method to src-dst-ip on DSW1 and ASW1.", hint: "port-channel load-balance src-dst-ip in global configuration.",
      check: (s) => s.devices.DSW1.loadBalance === "src-dst-ip" && s.devices.ASW1.loadBalance === "src-dst-ip",
    },
    {
      id: "verify-summary", title: "Verify both bundles", instruction: "On DSW1 run show etherchannel summary and confirm Po1 is (SU) and Po12 is (RU) with every member (P).", hint: "show etherchannel summary from privileged EXEC.",
      verify: { device: "DSW1", command: "show etherchannel summary", when: (s) => bundled(s, "DSW1", 1, 2, false) && bundled(s, "DSW1", 12, 2, true) },
    },
    {
      id: "verify-web", title: "Browse the web server", instruction: "From PC-A, run curl http://172.16.50.10 and get a 200 OK.", hint: "connect PC-A, then curl http://172.16.50.10.",
      verify: { device: "PC-A", command: "curl", when: (_, info) => Boolean(info.result?.ok) },
    },
  ],
};

const coreSwitches = ["CORE1", "CORE2", "ACC1"];
const edgePorts = ["FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3"];

export const rapidPvstLab: LabDefinition = {
  slug: "rapid-pvst-root-bridge-and-edge-protection",
  title: "Rapid PVST+ root placement and edge port protection",
  description: "Take back root bridge control from a rogue switch, load-share VLANs across two core switches, and protect edge ports with PortFast and BPDU Guard.",
  domain: "Network Access",
  objective: "2.5",
  difficulty: "Expert",
  durationMinutes: 40,
  device: "ACC1",
  scenario: "Users report slow failover and odd traffic paths. Someone has plugged an unmanaged switch with priority 0 into ACC1 Fa0/24, and every switch still runs legacy PVST+ with default priorities. CORE1 should be root for VLANs 10 and 20, CORE2 for VLAN 30, and each should back up the other.",
  devices: [
    access("CORE1", "0019.e8a1.3300"),
    access("CORE2", "0019.e8a1.2200"),
    access("ACC1", "0019.e8a1.1100"),
    { ...access("ROGUE", "00d0.bc11.0001"), locked: true },
    host("PC1", "10.1.10.11/24"),
    host("PC2", "10.1.20.12/24"),
    host("PC3", "10.1.30.13/24"),
  ],
  links: [
    link("CORE1", "GigabitEthernet0/1", "CORE2", "GigabitEthernet0/1"),
    link("CORE1", "GigabitEthernet0/2", "ACC1", "GigabitEthernet0/1"),
    link("CORE2", "GigabitEthernet0/2", "ACC1", "GigabitEthernet0/2"),
    link("ACC1", "FastEthernet0/1", "PC1", "FastEthernet0"),
    link("ACC1", "FastEthernet0/2", "PC2", "FastEthernet0"),
    link("ACC1", "FastEthernet0/3", "PC3", "FastEthernet0"),
    link("ACC1", "FastEthernet0/24", "ROGUE", "FastEthernet0/1"),
  ],
  layout: {
    CORE1: { x: 170, y: 55, kind: "switch" },
    CORE2: { x: 470, y: 55, kind: "switch" },
    ACC1: { x: 320, y: 195, kind: "switch" },
    ROGUE: { x: 555, y: 225, kind: "switch", label: "unmanaged" },
    PC1: { x: 110, y: 325, kind: "pc", label: "VLAN 10" },
    PC2: { x: 290, y: 325, kind: "pc", label: "VLAN 20" },
    PC3: { x: 470, y: 325, kind: "pc", label: "VLAN 30" },
  },
  bootstrap: {
    ...Object.fromEntries(["CORE1", "CORE2"].map((name) => [name, ["vlan 10,20,30", "interface range g0/1 - 2", "switchport mode trunk"]])),
    ACC1: [
      "vlan 10,20,30",
      "interface range g0/1 - 2", "switchport mode trunk",
      "interface fa0/1", "switchport mode access", "switchport access vlan 10",
      "interface fa0/2", "switchport mode access", "switchport access vlan 20",
      "interface fa0/3", "switchport mode access", "switchport access vlan 30",
      "interface fa0/24", "switchport mode access", "switchport access vlan 10",
    ],
    ROGUE: ["vlan 10,20,30", "spanning-tree vlan 10,20,30 priority 0", "interface fa0/1", "switchport mode trunk"],
  },
  tasks: [
    {
      id: "rapid", title: "Move to Rapid PVST+", instruction: "Run Rapid PVST+ on CORE1, CORE2 and ACC1.", hint: "spanning-tree mode rapid-pvst on each switch.",
      check: (s) => coreSwitches.every((name) => s.devices[name].stp.mode === "rapid-pvst"),
    },
    {
      id: "edge", title: "Protect the edge ports", instruction: "On ACC1, make every access port (Fa0/1-3 and Fa0/24) a PortFast edge port with BPDU Guard.", hint: "Either interface range fa0/1 - 3 , fa0/24 with spanning-tree portfast and spanning-tree bpduguard enable, or globally: spanning-tree portfast default and spanning-tree portfast bpduguard default.",
      check: (s) => [...edgePorts, "FastEthernet0/24"].every((name) => portfastActive(s, "ACC1", name) && bpduguardActive(s, "ACC1", name)),
    },
    {
      id: "rogue", title: "Isolate the rogue switch", instruction: "Confirm BPDU Guard has put Fa0/24 into the err-disabled state, removing the rogue switch from the topology.", hint: "BPDU Guard reacts as soon as it is enabled. Check with show interfaces status err-disabled.",
      check: (s) => s.devices.ACC1.errDisabled["FastEthernet0/24"] === "bpduguard",
    },
    {
      id: "roots", title: "Place the root bridges", instruction: "Make CORE1 the primary root for VLANs 10 and 20 and secondary for VLAN 30. Make CORE2 the primary root for VLAN 30 and secondary for VLANs 10 and 20.", hint: "On CORE1: spanning-tree vlan 10,20 root primary and spanning-tree vlan 30 root secondary. Reverse it on CORE2.",
      check: (s) => rootOf(s, 10) === "CORE1" && rootOf(s, 20) === "CORE1" && rootOf(s, 30) === "CORE2"
        && s.devices.CORE2.stp.priority[10] === 28672 && s.devices.CORE2.stp.priority[20] === 28672 && s.devices.CORE1.stp.priority[30] === 28672,
    },
    {
      id: "verify-vlan10", title: "Verify VLAN 10 forwarding", instruction: "On ACC1 run show spanning-tree vlan 10. Gi0/1 should be the root port toward CORE1 and Gi0/2 an alternate (blocking) port.", hint: "show spanning-tree vlan 10 on ACC1.",
      verify: {
        device: "ACC1", command: "show spanning-tree vlan",
        when: (s, info) => info.args[0] === "10" && rootOf(s, 10) === "CORE1" && rootPort(s, "ACC1", 10) === "GigabitEthernet0/1"
          && spanningTree(s, 10).bridges.ACC1.ports.find((port) => port.port === "GigabitEthernet0/2")?.role === "Altn",
      },
    },
    {
      id: "verify-vlan30", title: "Verify load sharing", instruction: "On ACC1 run show spanning-tree vlan 30 and confirm VLAN 30 uses Gi0/2 toward CORE2 as its root port.", hint: "show spanning-tree vlan 30 on ACC1.",
      verify: { device: "ACC1", command: "show spanning-tree vlan", when: (s, info) => info.args[0] === "30" && rootOf(s, 30) === "CORE2" && rootPort(s, "ACC1", 30) === "GigabitEthernet0/2" },
    },
    {
      id: "verify-errdisable", title: "Confirm the rogue is blocked", instruction: "On ACC1 run show interfaces status err-disabled and find Fa0/24 with reason bpduguard.", hint: "show interfaces status err-disabled.",
      verify: { device: "ACC1", command: "show interfaces status err-disabled", when: (s) => s.devices.ACC1.errDisabled["FastEthernet0/24"] === "bpduguard" },
    },
  ],
};
