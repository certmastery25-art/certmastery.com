import { sameSubnet } from "../engine/addr";
import { aclPermits, ntpState } from "../engine/l3";
import type { LabDefinition } from "../engine/lab";
import { runningConfig } from "../engine/show";
import type { LabState } from "../engine/types";
import { access, hasRoute, host, iface, ip, link, login, reach, router } from "./helpers";

const excluded = (s: LabState, dev: string, address: string) => s.devices[dev].dhcpExcluded.some((range) => ip(address) >= range.start && ip(address) <= range.end);
const pool = (s: LabState, dev: string, network: string, gateway: string) => Object.values(s.devices[dev].dhcpPools).some((item) => item.network?.addr === ip(network) && item.network.len === 24 && item.defaultRouter === ip(gateway) && item.dns === ip("8.8.8.8"));
const leased = (s: LabState, dev: string, network: string, gateway: string) => {
  const config = s.devices[dev].host!;
  return Boolean(config.lease && !config.lease.viaRogue && config.ipv4 && sameSubnet(4, config.ipv4.addr, ip(network), 24) && config.gateway === ip(gateway));
};

export const ipServicesLab: LabDefinition = {
  slug: "dhcp-relay-nat-pat-and-ntp",
  title: "Edge services: DHCP relay, PAT, static NAT and NTP",
  description: "Turn the edge router into a DHCP server for two sites with a relay, overload one public address for both LANs, publish a web server with static NAT, and build an NTP hierarchy.",
  domain: "IP Services",
  objective: "4.1–4.3, 4.6",
  difficulty: "Expert",
  durationMinutes: 50,
  device: "R1",
  scenario: "R1 is the headquarters edge router with a single public /29 from the ISP. The branch router R2 has no DHCP server of its own. Hosts at both sites need automatic addressing and internet access, the HQ web server must be reachable from the internet at 203.0.113.5, and all routers need accurate time.",
  devices: [
    router("R1"), router("R2", ["GigabitEthernet0/0", "GigabitEthernet0/1"]), router("ISP", ["GigabitEthernet0/0", "GigabitEthernet0/1"]), access("SW1"),
    host("PC-A", null, { dhcp: true }),
    host("WEB", "192.168.10.50/24", { gateway: "192.168.10.1", services: ["http", "https"] }),
    host("PC-C", null, { dhcp: true }),
    host("INET-PC", "198.51.100.10/24", { gateway: "198.51.100.1" }),
  ],
  links: [
    link("R1", "GigabitEthernet0/1", "SW1", "GigabitEthernet0/1"),
    link("SW1", "FastEthernet0/1", "PC-A", "FastEthernet0"),
    link("SW1", "FastEthernet0/2", "WEB", "FastEthernet0"),
    link("R1", "GigabitEthernet0/2", "R2", "GigabitEthernet0/0"),
    link("R2", "GigabitEthernet0/1", "PC-C", "FastEthernet0"),
    link("R1", "GigabitEthernet0/0", "ISP", "GigabitEthernet0/0"),
    link("ISP", "GigabitEthernet0/1", "INET-PC", "FastEthernet0"),
  ],
  layout: {
    ISP: { x: 400, y: 50, kind: "cloud" },
    "INET-PC": { x: 570, y: 50, kind: "pc" },
    R1: { x: 270, y: 160, kind: "router" },
    SW1: { x: 140, y: 255, kind: "switch" },
    "PC-A": { x: 70, y: 345, kind: "pc" },
    WEB: { x: 210, y: 345, kind: "server" },
    R2: { x: 450, y: 255, kind: "router" },
    "PC-C": { x: 450, y: 345, kind: "pc" },
  },
  bootstrap: {
    R1: [
      "interface g0/0", "description ISP", "ip address 203.0.113.2 255.255.255.248", "no shutdown",
      "interface g0/1", "description HQ-LAN", "ip address 192.168.10.1 255.255.255.0", "no shutdown",
      "interface g0/2", "description to-R2", "ip address 10.0.0.1 255.255.255.252", "no shutdown",
    ],
    R2: [
      "interface g0/0", "ip address 10.0.0.2 255.255.255.252", "no shutdown",
      "interface g0/1", "description BRANCH-LAN", "ip address 192.168.20.1 255.255.255.0", "no shutdown",
      "ip route 0.0.0.0 0.0.0.0 10.0.0.1",
    ],
    ISP: [
      "interface g0/0", "ip address 203.0.113.1 255.255.255.248", "no shutdown",
      "interface g0/1", "ip address 198.51.100.1 255.255.255.0", "no shutdown",
      "interface loopback0", "ip address 8.8.8.8 255.255.255.255",
      "ntp master 2",
    ],
  },
  tasks: [
    {
      id: "pools", title: "Build the DHCP pools", instruction: "On R1, create a pool for 192.168.10.0/24 and one for 192.168.20.0/24. Each hands out its own .1 as default router and 8.8.8.8 as DNS. Exclude .1–.10 in both subnets, and 192.168.10.50 for the web server.", hint: "ip dhcp excluded-address 192.168.10.1 192.168.10.10, then ip dhcp pool HQ with network, default-router and dns-server. Repeat for the branch.",
      check: (s) => pool(s, "R1", "192.168.10.0", "192.168.10.1") && pool(s, "R1", "192.168.20.0", "192.168.20.1")
        && ["192.168.10.1", "192.168.10.10", "192.168.10.50", "192.168.20.1", "192.168.20.10"].every((address) => excluded(s, "R1", address)),
    },
    {
      id: "routing", title: "Route for both sites", instruction: "Give R1 a static route to the branch LAN through R2 and a default route to the ISP at 203.0.113.1.", hint: "ip route 192.168.20.0 255.255.255.0 10.0.0.2 and ip route 0.0.0.0 0.0.0.0 203.0.113.1.",
      check: (s) => hasRoute(s, "R1", "192.168.20.0/24", "S") && hasRoute(s, "R1", "0.0.0.0/0", "S"),
    },
    {
      id: "relay", title: "Relay branch DHCP", instruction: "Make R2 forward DHCP requests from its LAN to R1 (10.0.0.1).", hint: "On R2 Gi0/1: ip helper-address 10.0.0.1.",
      check: (s) => iface(s, "R2", "GigabitEthernet0/1").helpers.includes(ip("10.0.0.1")),
    },
    {
      id: "leases", title: "Lease addresses at both sites", instruction: "Renew DHCP on PC-A and PC-C. Each must receive an address from the correct pool with the right gateway.", hint: "connect PC-A, then ipconfig /renew. Do the same on PC-C. If the branch fails, check the relay and R1's route back to 192.168.20.0/24.",
      check: (s) => leased(s, "PC-A", "192.168.10.0", "192.168.10.1") && leased(s, "PC-C", "192.168.20.0", "192.168.20.1"),
    },
    {
      id: "pat", title: "Overload the public address", instruction: "Configure PAT on R1 so both LANs share Gi0/0's address. Mark the inside and outside interfaces correctly, including the link to R2.", hint: "A standard ACL permitting 192.168.10.0 0.0.0.255 and 192.168.20.0 0.0.0.255, then ip nat inside source list <acl> interface g0/0 overload. ip nat inside on g0/1 and g0/2, ip nat outside on g0/0.",
      check: (s) => s.devices.R1.natRules.some((rule) => rule.overload && rule.iface === "GigabitEthernet0/0") && reach(s, "PC-A", "8.8.8.8") && reach(s, "PC-C", "8.8.8.8"),
    },
    {
      id: "static-nat", title: "Publish the web server", instruction: "Map WEB (192.168.10.50) to the public address 203.0.113.5 so INET-PC can browse to it.", hint: "ip nat inside source static 192.168.10.50 203.0.113.5. Test from INET-PC with curl http://203.0.113.5.",
      check: (s) => reach(s, "INET-PC", "203.0.113.5", "tcp", 80),
    },
    {
      id: "ntp", title: "Build the NTP hierarchy", instruction: "Make R1 an NTP client of the ISP (203.0.113.1), and R2 an NTP client of R1 (10.0.0.1), so R2 ends up at stratum 4.", hint: "ntp server 203.0.113.1 on R1, ntp server 10.0.0.1 on R2. Check with show ntp status.",
      check: (s) => s.devices.R1.ntp.servers.includes(ip("203.0.113.1")) && ntpState(s, "R2")?.stratum === 4,
    },
    {
      id: "verify-nat", title: "Inspect the translations", instruction: "Generate internet traffic from a PC, then run show ip nat translations on R1 and find a dynamic PAT entry.", hint: "Ping 8.8.8.8 from PC-A or PC-C first.",
      verify: { device: "R1", command: "show ip nat translations", when: (s) => s.devices.R1.natTranslations.length > 0 },
    },
  ],
};

const guestPolicy = (s: LabState) =>
  reach(s, "PC-GUEST", "10.10.30.10", "tcp", 80) && reach(s, "PC-GUEST", "10.10.30.10", "tcp", 443) && reach(s, "PC-GUEST", "10.10.30.10", "udp", 53)
  && !reach(s, "PC-GUEST", "10.10.30.10", "tcp", 22) && !reach(s, "PC-GUEST", "10.10.30.10") && !reach(s, "PC-GUEST", "10.10.10.10")
  && reach(s, "PC-GUEST", "8.8.8.8") && reach(s, "PC-STAFF", "10.10.30.10", "tcp", 22);
const edgePolicy = (s: LabState) =>
  reach(s, "INET-PC", "10.10.30.10", "tcp", 443) && !reach(s, "INET-PC", "10.10.30.10", "tcp", 80) && !reach(s, "INET-PC", "10.10.30.10", "tcp", 22)
  && !reach(s, "INET-PC", "10.10.30.10") && reach(s, "PC-STAFF", "8.8.8.8") && reach(s, "PC-STAFF", "198.51.100.10", "tcp", 80);
const hasMatches = (s: LabState, name: string) => s.devices.R1.acls[name]?.entries.some((entry) => entry.matches > 0) ?? false;

export const aclLab: LabDefinition = {
  slug: "secure-management-and-extended-acls",
  title: "SSH-only management and extended ACL policy",
  description: "Lock router management down to SSH from the staff subnet, then write two extended ACLs: a guest policy close to the source and an internet edge policy that uses established and echo-reply.",
  domain: "Security Fundamentals",
  objective: "4.8, 5.3, 5.6",
  difficulty: "Expert",
  durationMinutes: 55,
  device: "R1",
  scenario: "R1 connects staff, guest and server networks to the internet. Today anyone can reach anything, and the router can only be managed from its console. Security has asked for SSH-only management restricted to staff, a guest network that can use only the web and DNS services on SRV1 plus the internet, and an internet edge that admits HTTPS to SRV1 and return traffic, nothing else.",
  devices: [
    router("R1", ["GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "GigabitEthernet0/0/2", "GigabitEthernet0/0/3"], "ISR4331"),
    router("ISP", ["GigabitEthernet0/0", "GigabitEthernet0/1"]),
    host("PC-STAFF", "10.10.10.10/24", { gateway: "10.10.10.1" }),
    host("PC-GUEST", "10.10.20.10/24", { gateway: "10.10.20.1" }),
    host("SRV1", "10.10.30.10/24", { gateway: "10.10.30.1", services: ["http", "https", "ssh", "dns"] }),
    host("INET-PC", "198.51.100.10/24", { gateway: "198.51.100.1", services: ["http"] }),
  ],
  links: [
    link("R1", "GigabitEthernet0/0/0", "ISP", "GigabitEthernet0/0"),
    link("R1", "GigabitEthernet0/0/1", "PC-STAFF", "FastEthernet0"),
    link("R1", "GigabitEthernet0/0/2", "PC-GUEST", "FastEthernet0"),
    link("R1", "GigabitEthernet0/0/3", "SRV1", "FastEthernet0"),
    link("ISP", "GigabitEthernet0/1", "INET-PC", "FastEthernet0"),
  ],
  layout: {
    ISP: { x: 320, y: 45, kind: "cloud" },
    "INET-PC": { x: 520, y: 45, kind: "pc" },
    R1: { x: 320, y: 180, kind: "router" },
    "PC-STAFF": { x: 110, y: 330, kind: "pc" },
    "PC-GUEST": { x: 320, y: 330, kind: "pc" },
    SRV1: { x: 530, y: 330, kind: "server" },
  },
  bootstrap: {
    R1: [
      "interface g0/0/0", "description INTERNET", "ip address 203.0.113.2 255.255.255.252", "no shutdown",
      "interface g0/0/1", "description STAFF", "ip address 10.10.10.1 255.255.255.0", "no shutdown",
      "interface g0/0/2", "description GUEST", "ip address 10.10.20.1 255.255.255.0", "no shutdown",
      "interface g0/0/3", "description SERVERS", "ip address 10.10.30.1 255.255.255.0", "no shutdown",
      "ip route 0.0.0.0 0.0.0.0 203.0.113.1",
    ],
    ISP: [
      "interface g0/0", "ip address 203.0.113.1 255.255.255.252", "no shutdown",
      "interface g0/1", "ip address 198.51.100.1 255.255.255.0", "no shutdown",
      "interface loopback0", "ip address 8.8.8.8 255.255.255.255",
      "ip route 10.10.0.0 255.255.0.0 203.0.113.2",
    ],
  },
  tasks: [
    {
      id: "ssh", title: "Prepare SSH", instruction: "Set the domain name cert.lab, generate a 2048-bit RSA key pair and force SSH version 2.", hint: "ip domain-name cert.lab, crypto key generate rsa modulus 2048, ip ssh version 2.",
      check: (s) => s.devices.R1.domainName === "cert.lab" && (s.devices.R1.rsaModulus ?? 0) >= 2048 && s.devices.R1.sshVersion === 2,
    },
    {
      id: "accounts", title: "Secure the credentials", instruction: "Create local user admin with privilege 15 and a secret, set an enable secret, and encrypt plain-text passwords.", hint: "username admin privilege 15 secret <password>, enable secret <password>, service password-encryption.",
      check: (s) => s.devices.R1.users.admin?.privilege === 15 && s.devices.R1.users.admin.type === "secret" && Boolean(s.devices.R1.enableSecret) && s.devices.R1.servicePasswordEncryption,
    },
    {
      id: "vty", title: "Allow SSH only", instruction: "On VTY lines 0–4, authenticate against the local database, accept SSH only, and log idle sessions out after 10 minutes.", hint: "line vty 0 4, login local, transport input ssh, exec-timeout 10 0.",
      check: (s) => {
        const vty = s.devices.R1.lines.vty;
        return vty.login === "local" && Array.isArray(vty.transport) && vty.transport.length === 1 && vty.transport[0] === "ssh" && vty.execTimeout?.[0] === 10;
      },
    },
    {
      id: "mgmt-acl", title: "Restrict management to staff", instruction: "Use standard ACL 10 on the VTY lines so only 10.10.10.0/24 can open SSH sessions to R1.", hint: "access-list 10 permit 10.10.10.0 0.0.0.255, then access-class 10 in under line vty 0 4.",
      check: (s) => {
        const name = s.devices.R1.lines.vty.accessClass;
        const acl = name ? s.devices.R1.acls[name] : undefined;
        const r1 = structuredClone(s.devices.R1);
        const allows = (source: string) => aclPermits(r1, name, { family: 4, src: ip(source), dst: ip("10.10.10.1"), proto: "tcp", sport: 50000, dport: 22 });
        return acl?.kind === "standard" && allows("10.10.10.10") && !allows("10.10.20.10") && !allows("198.51.100.10")
          && login(s, "PC-STAFF", "10.10.10.1", "ssh", "admin") && !login(s, "PC-STAFF", "10.10.10.1", "telnet");
      },
    },
    {
      id: "guest-acl", title: "Enforce the guest policy", instruction: "Write named extended ACL GUEST-FILTER and apply it inbound on the guest interface. Guests may reach SRV1 only on TCP 80, TCP 443 and UDP 53, must not reach any other internal host, and keep full internet access.", hint: "Permit the three SRV1 services first, then deny ip 10.10.20.0 0.0.0.255 10.10.0.0 0.0.255.255, then permit ip any any. Apply with ip access-group GUEST-FILTER in on g0/0/2.",
      check: (s) => iface(s, "R1", "GigabitEthernet0/0/2").acl.in === "GUEST-FILTER" && s.devices.R1.acls["GUEST-FILTER"]?.kind === "extended" && guestPolicy(s),
    },
    {
      id: "edge-acl", title: "Filter the internet edge", instruction: "Apply extended ACL 110 inbound on Gi0/0/0. Internet hosts may reach only HTTPS on SRV1. Replies to staff and guest traffic (TCP sessions they opened and ping replies) must still come back.", hint: "access-list 110 permit tcp any host 10.10.30.10 eq 443, access-list 110 permit tcp any 10.10.0.0 0.0.255.255 established, access-list 110 permit icmp any 10.10.0.0 0.0.255.255 echo-reply. The implicit deny drops the rest.",
      check: (s) => iface(s, "R1", "GigabitEthernet0/0/0").acl.in === "110" && edgePolicy(s),
    },
    {
      id: "verify-acls", title: "Prove the ACLs are matching", instruction: "Generate test traffic from PC-GUEST and INET-PC, then run show access-lists on R1 and confirm both ACLs show matches.", hint: "For example curl http://10.10.30.10 from PC-GUEST and curl https://10.10.30.10 from INET-PC.",
      verify: { device: "R1", command: ["show access-lists", "show ip access-lists"], when: (s) => hasMatches(s, "GUEST-FILTER") && hasMatches(s, "110") },
    },
    {
      id: "save", title: "Save the configuration", instruction: "When every task above passes, save the running configuration to NVRAM.", hint: "copy running-config startup-config (or write memory). If you change anything afterwards, save again.",
      check: (s) => s.devices.R1.startupConfig === runningConfig(s.devices.R1),
    },
  ],
};

const userPorts = ["FastEthernet0/1", "FastEthernet0/2"];
const sw1Bindings = (s: LabState) => s.devices.SW1.snooping.bindings;

export const layer2SecurityLab: LabDefinition = {
  slug: "port-security-dhcp-snooping-and-dai",
  title: "Port security, DHCP snooping and Dynamic ARP Inspection",
  description: "Defend an access switch against MAC flooding, a rogue DHCP server and ARP spoofing. Then work through the option 82 trap that breaks legitimate DHCP once snooping is on.",
  domain: "Security Fundamentals",
  objective: "5.7",
  difficulty: "Expert",
  durationMinutes: 50,
  device: "SW1",
  scenario: "Users on SW1 are being handed the wrong gateway. Someone has connected a rogue DHCP server to Fa0/4, an unmanaged hub with two devices sits on Fa0/3, and a host with a hand-set address on Fa0/5 is suspected of ARP spoofing. R1 is the only legitimate DHCP server and default gateway.",
  devices: [
    access("SW1"),
    router("R1", ["GigabitEthernet0/0", "GigabitEthernet0/1"]),
    host("PC-A", null, { dhcp: true }),
    host("PC-B", null, { dhcp: true }),
    { name: "HUB1", kind: "hub", model: "Hub-PT", ports: ["Port0", "Port1", "Port2"] },
    host("PC-X", "192.168.10.30/24", { gateway: "192.168.10.1" }),
    host("PC-Y", "192.168.10.31/24", { gateway: "192.168.10.1" }),
    host("ROGUE-DHCP", "192.168.10.66/24", { dhcpServer: { addr: ip("192.168.10.0"), len: 24, gateway: ip("192.168.10.66"), first: ip("192.168.10.200") } }),
    host("ATTACKER", "192.168.10.99/24", { gateway: "192.168.10.1" }),
  ],
  links: [
    link("R1", "GigabitEthernet0/0", "SW1", "GigabitEthernet0/1"),
    link("SW1", "FastEthernet0/1", "PC-A", "FastEthernet0"),
    link("SW1", "FastEthernet0/2", "PC-B", "FastEthernet0"),
    link("SW1", "FastEthernet0/3", "HUB1", "Port0"),
    link("HUB1", "Port1", "PC-X", "FastEthernet0"),
    link("HUB1", "Port2", "PC-Y", "FastEthernet0"),
    link("SW1", "FastEthernet0/4", "ROGUE-DHCP", "FastEthernet0"),
    link("SW1", "FastEthernet0/5", "ATTACKER", "FastEthernet0"),
  ],
  layout: {
    R1: { x: 320, y: 40, kind: "router" },
    SW1: { x: 320, y: 150, kind: "switch" },
    "PC-A": { x: 60, y: 215, kind: "pc" },
    "PC-B": { x: 150, y: 300, kind: "pc" },
    HUB1: { x: 300, y: 260, kind: "hub" },
    "PC-X": { x: 230, y: 345, kind: "pc" },
    "PC-Y": { x: 370, y: 345, kind: "pc" },
    "ROGUE-DHCP": { x: 490, y: 300, kind: "server" },
    ATTACKER: { x: 575, y: 210, kind: "pc" },
  },
  bootstrap: {
    R1: [
      "interface g0/0", "ip address 192.168.10.1 255.255.255.0", "no shutdown",
      "interface loopback0", "description FILE-SERVER", "ip address 172.31.255.1 255.255.255.255",
      "ip dhcp excluded-address 192.168.10.1 192.168.10.20",
      "ip dhcp pool USERS", "network 192.168.10.0 255.255.255.0", "default-router 192.168.10.1", "dns-server 192.168.10.1",
    ],
    SW1: [
      "vlan 10", "name USERS",
      "interface range fa0/1 - 5", "switchport access vlan 10",
      "interface g0/1", "switchport mode access", "switchport access vlan 10",
    ],
  },
  tasks: [
    {
      id: "port-security", title: "Secure the user ports", instruction: "On Fa0/1 and Fa0/2, enable port security with a maximum of 2 MAC addresses, sticky learning, and violation mode restrict.", hint: "Port security needs a static access port: switchport mode access first, then switchport port-security, maximum 2, mac-address sticky, violation restrict.",
      check: (s) => userPorts.every((name) => {
        const port = iface(s, "SW1", name);
        return port.mode === "access" && port.portSecurity.enabled && port.portSecurity.max === 2 && port.portSecurity.sticky && port.portSecurity.violation === "restrict";
      }),
    },
    {
      id: "hub-port", title: "Shut down the hub port", instruction: "Allow only one MAC address on Fa0/3, with violation mode shutdown. The hub's second device should trigger the violation.", hint: "switchport mode access, switchport port-security, switchport port-security maximum 1 (the default). Watch for %PORT_SECURITY-2-PSECURE_VIOLATION.",
      check: (s) => s.devices.SW1.errDisabled["FastEthernet0/3"] === "psecure-violation",
    },
    {
      id: "snooping", title: "Enable DHCP snooping", instruction: "Enable DHCP snooping for VLAN 10, trust only the uplink to R1, and rate-limit DHCP to 15 packets per second on Fa0/1 and Fa0/2.", hint: "ip dhcp snooping, ip dhcp snooping vlan 10, then ip dhcp snooping trust on g0/1 and ip dhcp snooping limit rate 15 on the user ports.",
      check: (s) => s.devices.SW1.snooping.enabled && s.devices.SW1.snooping.vlans.includes(10) && iface(s, "SW1", "GigabitEthernet0/1").snoopingTrust
        && userPorts.every((name) => iface(s, "SW1", name).snoopingRate === 15) && !iface(s, "SW1", "FastEthernet0/4").snoopingTrust,
    },
    {
      id: "leases", title: "Get legitimate leases", instruction: "Renew DHCP on PC-A and PC-B. Both must get addresses from R1, not the rogue server, and appear in the snooping binding table.", hint: "If renewals fail once snooping is on, the switch is inserting option 82 with a zero giaddr and R1 drops it. Fix it on SW1 with no ip dhcp snooping information option, or on R1 with ip dhcp relay information trust-all.",
      check: (s) => ["PC-A", "PC-B"].every((name) => {
        const config = s.devices[name].host!;
        return config.lease && !config.lease.viaRogue && config.gateway === ip("192.168.10.1") && sw1Bindings(s).some((binding) => binding.mac === s.devices[name].mac);
      }),
    },
    {
      id: "dai", title: "Turn on Dynamic ARP Inspection", instruction: "Enable DAI on VLAN 10 and trust the uplink to R1.", hint: "ip arp inspection vlan 10, and ip arp inspection trust on g0/1.",
      check: (s) => s.devices.SW1.daiVlans.includes(10) && iface(s, "SW1", "GigabitEthernet0/1").arpTrust,
    },
    {
      id: "behaviour", title: "Prove the defences work", instruction: "PC-A must reach the file server at 172.31.255.1, while ATTACKER's ARP traffic is dropped so it can't reach the gateway.", hint: "Hosts with a DHCP binding pass DAI; ATTACKER's static address has no binding. Test with ping from each PC.",
      check: (s) => reach(s, "PC-A", "172.31.255.1") && reach(s, "PC-B", "172.31.255.1") && !reach(s, "ATTACKER", "192.168.10.1"),
    },
    {
      id: "verify-bindings", title: "Verify the binding table", instruction: "On SW1, run show ip dhcp snooping binding and confirm both PCs are listed.", hint: "show ip dhcp snooping binding.",
      verify: { device: "SW1", command: "show ip dhcp snooping binding", when: (s) => ["PC-A", "PC-B"].every((name) => sw1Bindings(s).some((binding) => binding.mac === s.devices[name].mac)) },
    },
    {
      id: "verify-violation", title: "Verify the violation", instruction: "On SW1, confirm Fa0/3 is shut down by port security with show port-security interface fa0/3 or show interfaces status err-disabled.", hint: "Either command works from privileged EXEC.",
      verify: {
        device: "SW1", command: ["show port-security interface", "show interfaces status err-disabled"],
        when: (s, info) => s.devices.SW1.errDisabled["FastEthernet0/3"] === "psecure-violation" && (info.id !== "show port-security interface" || info.args[0] === "FastEthernet0/3"),
      },
    },
  ],
};
