import type { SeedDifficulty } from "./types";

type Check = { path: string[]; key?: string; includes?: string[] };
type Task = { id: string; title: string; instruction: string; commands: string[]; expected: string; hint: string; checks?: Check[]; verify?: string };
export type SeedLab = {
  slug: string;
  pathway: string;
  title: string;
  difficulty: SeedDifficulty;
  durationMinutes: number;
  summary: string;
  objectives: string[];
  scenario: string;
  topology: string;
  initial?: string[];
  outputs?: { command: string; output: string }[];
  tasks: Task[];
  troubleshooting: string[];
};

const iface = (name: string) => ["system interface", name];
const policy = (id: string) => ["firewall policy", id];
const BASE_TOPOLOGY = "Internet --- port1 (203.0.113.2/24) [FGT] port2 (10.0.1.1/24) --- LAN 10.0.1.0/24";
const BASE_INTERFACES = ["config system interface", "edit port1", "set ip 203.0.113.2 255.255.255.0", "set allowaccess ping", "next", "edit port2", "set ip 10.0.1.1 255.255.255.0", "set allowaccess ping https ssh", "next", "end"];
const BASE_POLICY = ["config firewall policy", "edit 1", "set name LAN-to-WAN", "set srcintf port2", "set dstintf port1", "set srcaddr all", "set dstaddr all", "set action accept", "set schedule always", "set service ALL", "set nat enable", "next", "end"];

export const nseLabs: SeedLab[] = [
  {
    slug: "fortigate-initial-configuration", pathway: "nse-3", title: "FortiGate initial configuration", difficulty: "BEGINNER", durationMinutes: 20,
    summary: "Name a device, address its interfaces and restrict administrative access.",
    objectives: ["Use config, edit, set, next and end", "Set an interface address", "Limit administrative access"],
    scenario: "A new FortiGate has arrived for a branch. Give it a name, connect it to the LAN and make sure the WAN doesn't offer management access.",
    topology: BASE_TOPOLOGY,
    outputs: [{ command: "get system status", output: "Hostname: BRANCH-FGT\nVersion: simulated output, not a real device" }],
    tasks: [
      { id: "hostname", title: "Set the hostname", instruction: "Set the hostname to BRANCH-FGT under system global.", commands: ["config system global", "set hostname BRANCH-FGT", "end"], expected: "show system global displays the hostname.", hint: "Global settings have no edit level, so set them straight inside the table.", checks: [{ path: ["system global"], key: "hostname", includes: ["BRANCH-FGT"] }] },
      { id: "lan", title: "Address the LAN", instruction: "Give port2 the address 10.0.1.1/24 and allow ping, HTTPS and SSH.", commands: ["config system interface", "edit port2", "set ip 10.0.1.1 255.255.255.0", "set allowaccess ping https ssh", "next", "end"], expected: "show system interface lists port2 with its address.", hint: "FortiOS takes the mask in dotted form here.", checks: [{ path: iface("port2"), key: "ip", includes: ["10.0.1.1", "255.255.255.0"] }, { path: iface("port2"), key: "allowaccess", includes: ["https", "ssh"] }] },
      { id: "wan", title: "Address the WAN safely", instruction: "Give port1 the address 203.0.113.2/24 and allow only ping.", commands: ["config system interface", "edit port1", "set ip 203.0.113.2 255.255.255.0", "set allowaccess ping", "next", "end"], expected: "port1 has an address and doesn't list HTTPS or SSH.", hint: "Internet-facing management access is a common route for attackers.", checks: [{ path: iface("port1"), key: "ip", includes: ["203.0.113.2"] }, { path: iface("port1"), key: "allowaccess", includes: ["ping"] }] },
      { id: "check", title: "Check your work", instruction: "Display the interface configuration.", commands: ["show system interface"], expected: "Both interfaces appear with your settings.", hint: "Run show from the top-level prompt.", verify: "show system interface" },
    ],
    troubleshooting: ["If the prompt is still inside a table, type end to go back to the top.", "On a real unit, removing access from the interface you're connected through can lock you out."],
  },
  {
    slug: "vlan-configuration", pathway: "nse-3", title: "VLAN interfaces", difficulty: "BEGINNER", durationMinutes: 15,
    summary: "Add VLAN subinterfaces on a trunk link.",
    objectives: ["Create VLAN interfaces", "Assign VLAN IDs and addressing"],
    scenario: "Port2 is a trunk to a switch carrying staff VLAN 10 and guest VLAN 20. Create both gateways on the FortiGate.",
    topology: "Switch (trunk, VLAN 10 and 20) --- port2 [FGT] port1 --- Internet",
    initial: BASE_INTERFACES,
    tasks: [
      { id: "staff", title: "Create VLAN 10", instruction: "Create an interface STAFF on port2 with VLAN ID 10 and address 10.10.0.1/24.", commands: ["config system interface", "edit STAFF", "set vdom root", "set interface port2", "set vlanid 10", "set ip 10.10.0.1 255.255.255.0", "next", "end"], expected: "The STAFF interface exists with VLAN 10.", hint: "A VLAN interface needs a parent interface and a VLAN ID.", checks: [{ path: iface("STAFF"), key: "vlanid", includes: ["10"] }, { path: iface("STAFF"), key: "interface", includes: ["port2"] }, { path: iface("STAFF"), key: "ip", includes: ["10.10.0.1"] }] },
      { id: "guest", title: "Create VLAN 20", instruction: "Create an interface GUEST on port2 with VLAN ID 20 and address 10.20.0.1/24.", commands: ["config system interface", "edit GUEST", "set vdom root", "set interface port2", "set vlanid 20", "set ip 10.20.0.1 255.255.255.0", "next", "end"], expected: "The GUEST interface exists with VLAN 20.", hint: "Use the same structure as STAFF.", checks: [{ path: iface("GUEST"), key: "vlanid", includes: ["20"] }, { path: iface("GUEST"), key: "interface", includes: ["port2"] }, { path: iface("GUEST"), key: "ip", includes: ["10.20.0.1"] }] },
    ],
    troubleshooting: ["Each VLAN must also be allowed on the switch trunk.", "Traffic between VLANs still needs a firewall policy."],
  },
  {
    slug: "firewall-policy", pathway: "nse-3", title: "Create a firewall policy", difficulty: "BEGINNER", durationMinutes: 20,
    summary: "Use objects and a policy to allow LAN users to browse.",
    objectives: ["Create an address object", "Build an accepting policy", "Enable logging"],
    scenario: "Allow the LAN to browse the web and resolve DNS, and log all sessions.",
    topology: BASE_TOPOLOGY,
    initial: BASE_INTERFACES,
    tasks: [
      { id: "object", title: "Create the address object", instruction: "Create LAN-Net for 10.0.1.0/24.", commands: ["config firewall address", "edit LAN-Net", "set subnet 10.0.1.0 255.255.255.0", "next", "end"], expected: "The address object is listed.", hint: "Addresses live in firewall address.", checks: [{ path: ["firewall address", "LAN-Net"], key: "subnet", includes: ["10.0.1.0"] }] },
      { id: "policy", title: "Create the policy", instruction: "Create policy 1 from port2 to port1, with source LAN-Net, destination all, schedule always, and services HTTP, HTTPS and DNS, and accept it.", commands: ["config firewall policy", "edit 1", "set name LAN-Web", "set srcintf port2", "set dstintf port1", "set srcaddr LAN-Net", "set dstaddr all", "set action accept", "set schedule always", "set service HTTP HTTPS DNS", "next", "end"], expected: "Policy 1 matches LAN traffic to the internet.", hint: "A policy needs interfaces, addresses, a schedule, a service and an action.", checks: [{ path: policy("1"), key: "srcintf", includes: ["port2"] }, { path: policy("1"), key: "dstintf", includes: ["port1"] }, { path: policy("1"), key: "srcaddr", includes: ["LAN-Net"] }, { path: policy("1"), key: "action", includes: ["accept"] }, { path: policy("1"), key: "service", includes: ["HTTPS", "DNS"] }] },
      { id: "log", title: "Log all sessions", instruction: "Set logtraffic to all on policy 1.", commands: ["config firewall policy", "edit 1", "set logtraffic all", "next", "end"], expected: "Sessions on the policy are logged.", hint: "Edit the existing policy.", checks: [{ path: policy("1"), key: "logtraffic", includes: ["all"] }] },
    ],
    troubleshooting: ["Policy matching is top down, so check where the policy sits.", "A real policy accepting traffic to the internet with private sources normally needs NAT too, which the next lab covers."],
  },
  {
    slug: "nat-configuration", pathway: "nse-4", title: "Source NAT and a VIP", difficulty: "INTERMEDIATE", durationMinutes: 25,
    summary: "Enable outbound NAT and publish an internal web server.",
    objectives: ["Enable source NAT", "Create a VIP with port forwarding", "Reference a VIP in a policy"],
    scenario: "LAN users need internet access, and an internal server at 10.0.2.10 must be reachable at 203.0.113.10 on port 443.",
    topology: "Internet --- port1 [FGT] port3 (10.0.2.1/24) --- Web server 10.0.2.10\n                 [FGT] port2 --- LAN",
    initial: [...BASE_INTERFACES, "config firewall policy", "edit 1", "set name LAN-to-WAN", "set srcintf port2", "set dstintf port1", "set srcaddr all", "set dstaddr all", "set action accept", "set schedule always", "set service ALL", "next", "end"],
    outputs: [{ command: "diagnose sys session list", output: "(simulated)\nact=snat 10.0.1.25:51000->198.51.100.10:443(203.0.113.2:51000)\nact=dnat 198.51.100.77:44000->203.0.113.10:443(10.0.2.10:443)" }],
    tasks: [
      { id: "snat", title: "Enable source NAT", instruction: "Enable NAT on policy 1.", commands: ["config firewall policy", "edit 1", "set nat enable", "next", "end"], expected: "Outbound sessions use port1's address.", hint: "NAT is set per policy here.", checks: [{ path: policy("1"), key: "nat", includes: ["enable"] }] },
      { id: "vip", title: "Create the VIP", instruction: "Create WEB-VIP mapping 203.0.113.10 on port1 to 10.0.2.10, forwarding port 443.", commands: ["config firewall vip", "edit WEB-VIP", "set extip 203.0.113.10", "set extintf port1", "set mappedip 10.0.2.10", "set portforward enable", "set extport 443", "set mappedport 443", "next", "end"], expected: "The VIP is listed.", hint: "Port forwarding needs extport and mappedport.", checks: [{ path: ["firewall vip", "WEB-VIP"], key: "extip", includes: ["203.0.113.10"] }, { path: ["firewall vip", "WEB-VIP"], key: "mappedip", includes: ["10.0.2.10"] }, { path: ["firewall vip", "WEB-VIP"], key: "portforward", includes: ["enable"] }, { path: ["firewall vip", "WEB-VIP"], key: "mappedport", includes: ["443"] }] },
      { id: "inbound", title: "Allow it inbound", instruction: "Create policy 2 from port1 to port3, with destination WEB-VIP, service HTTPS, and accept it.", commands: ["config firewall policy", "edit 2", "set srcintf port1", "set dstintf port3", "set srcaddr all", "set dstaddr WEB-VIP", "set action accept", "set schedule always", "set service HTTPS", "next", "end"], expected: "Internet clients can reach the server.", hint: "The policy's destination is the VIP itself.", checks: [{ path: policy("2"), key: "dstaddr", includes: ["WEB-VIP"] }, { path: policy("2"), key: "dstintf", includes: ["port3"] }, { path: policy("2"), key: "action", includes: ["accept"] }] },
      { id: "sessions", title: "Inspect the sessions", instruction: "Read the session table to see both translations.", commands: ["diagnose sys session list"], expected: "An snat and a dnat action appear (scripted output).", hint: "Look at the act= field.", verify: "diagnose sys session list" },
    ],
    troubleshooting: ["If inbound fails, check that the VIP is in the policy destination.", "If internal clients use the public address, consider hairpin NAT."],
  },
  {
    slug: "static-routing", pathway: "nse-4", title: "Static routing with a backup path", difficulty: "INTERMEDIATE", durationMinutes: 20,
    summary: "Add primary and backup default routes and read the table.",
    objectives: ["Add static routes", "Use distance for a backup", "Read the routing table"],
    scenario: "The FortiGate has a primary ISP on port1 and a backup on port4. Add routes so that port4 is used only if port1's route is removed.",
    topology: "ISP-A 203.0.113.1 --- port1 [FGT] port4 --- ISP-B 192.0.2.1",
    initial: BASE_INTERFACES,
    outputs: [{ command: "get router info routing-table all", output: "(simulated, after both routes are configured)\nS*   0.0.0.0/0 [10/0] via 203.0.113.1, port1\nC    203.0.113.0/24 is directly connected, port1" }, { command: "get router info routing-table database", output: "(simulated)\nS  *> 0.0.0.0/0 [10/0] via 203.0.113.1, port1\nS     0.0.0.0/0 [20/0] via 192.0.2.1, port4 inactive" }],
    tasks: [
      { id: "primary", title: "Primary route", instruction: "Add route 1: default via 203.0.113.1 on port1 with distance 10.", commands: ["config router static", "edit 1", "set dst 0.0.0.0 0.0.0.0", "set gateway 203.0.113.1", "set device port1", "set distance 10", "next", "end"], expected: "A default route via port1.", hint: "10 is the default distance.", checks: [{ path: ["router static", "1"], key: "gateway", includes: ["203.0.113.1"] }, { path: ["router static", "1"], key: "device", includes: ["port1"] }] },
      { id: "backup", title: "Backup route", instruction: "Add route 2: default via 192.0.2.1 on port4 with distance 20.", commands: ["config router static", "edit 2", "set dst 0.0.0.0 0.0.0.0", "set gateway 192.0.2.1", "set device port4", "set distance 20", "next", "end"], expected: "This route waits in the database, and isn't active.", hint: "Higher distance loses.", checks: [{ path: ["router static", "2"], key: "gateway", includes: ["192.0.2.1"] }, { path: ["router static", "2"], key: "distance", includes: ["20"] }] },
      { id: "database", title: "Find the inactive route", instruction: "View the routing database to see the backup.", commands: ["get router info routing-table database"], expected: "The backup route appears as inactive (scripted output).", hint: "routing-table all shows only active routes.", verify: "get router info routing-table database" },
    ],
    troubleshooting: ["Static routes with a higher distance don't appear in the active table.", "A link that's up but broken upstream won't remove a route without link health monitoring or SD-WAN."],
  },
  {
    slug: "ospf-configuration", pathway: "nse-7-secure-networking", title: "OSPF adjacency", difficulty: "ADVANCED", durationMinutes: 30,
    summary: "Configure OSPF, then diagnose a stuck neighbour.",
    objectives: ["Configure OSPF area 0", "Read neighbour states", "Apply an MTU fix"],
    scenario: "The FortiGate must form an OSPF adjacency with a core router on port3. It reports a neighbour stuck in Exstart.",
    topology: "[FGT] port3 10.1.1.1/30 --- 10.1.1.2/30 Core router (MTU 1400)",
    initial: ["config system interface", "edit port3", "set ip 10.1.1.1 255.255.255.252", "set mtu-override enable", "set mtu 1500", "next", "end"],
    outputs: [{ command: "get router info ospf neighbor", output: "(simulated)\nNeighbor ID  Pri  State       Dead Time  Address   Interface\n10.0.0.2     1    Exstart/DR  00:00:36   10.1.1.2  port3" }, { command: "get router info ospf interface", output: "(simulated)\nport3 is up, line protocol is up\n  Internet Address 10.1.1.1/30, Area 0.0.0.0, MTU 1500" }],
    tasks: [
      { id: "ospf", title: "Enable OSPF", instruction: "Set router ID 10.0.0.1, then create area 0.0.0.0 and network entry 1 for 10.1.1.0/30 in that area.", commands: ["config router ospf", "set router-id 10.0.0.1", "config area", "edit 0.0.0.0", "next", "end", "config network", "edit 1", "set prefix 10.1.1.0 255.255.255.252", "set area 0.0.0.0", "next", "end", "end"], expected: "OSPF is configured on port3.", hint: "Tables nest inside config router ospf.", checks: [{ path: ["router ospf"], key: "router-id", includes: ["10.0.0.1"] }, { path: ["router ospf", "area", "0.0.0.0"] }, { path: ["router ospf", "network", "1"], key: "prefix", includes: ["10.1.1.0"] }] },
      { id: "state", title: "Check neighbour state", instruction: "Read the neighbour state and identify the problem.", commands: ["get router info ospf neighbor"], expected: "Exstart suggests an MTU mismatch (scripted output).", hint: "Hellos work if you've reached this state.", verify: "get router info ospf neighbor" },
      { id: "mtu", title: "Fix the MTU", instruction: "The core router uses MTU 1400. Set port3 to match.", commands: ["config system interface", "edit port3", "set mtu 1400", "next", "end"], expected: "Both sides agree on MTU.", hint: "mtu-override is already enabled.", checks: [{ path: iface("port3"), key: "mtu", includes: ["1400"] }] },
    ],
    troubleshooting: ["The neighbour's state tells you how far the exchange got.", "Timer, area and authentication mismatches usually stop neighbours earlier than Exstart.", "This simulator scripts the neighbour output, so it doesn't recalculate state after your fix."],
  },
  {
    slug: "ipsec-vpn", pathway: "nse-4", title: "Route-based IPsec VPN", difficulty: "ADVANCED", durationMinutes: 40,
    summary: "Build a site-to-site tunnel with routes and policies.",
    objectives: ["Configure IKEv2 phase 1 and phase 2", "Add a tunnel route", "Allow traffic in both directions"],
    scenario: "Connect HQ LAN 10.1.0.0/24 to branch LAN 10.2.0.0/24 through a route-based tunnel to 198.51.100.2.",
    topology: "10.1.0.0/24 --- port2 [HQ FGT] port1 ===IPsec=== 198.51.100.2 [Branch FGT] --- 10.2.0.0/24",
    initial: BASE_INTERFACES,
    outputs: [{ command: "get vpn ipsec tunnel summary", output: "(simulated)\n'to-branch' 198.51.100.2:0  selectors(total,up): 1/1  rx(pkt,err): 0/0  tx(pkt,err): 12/0" }, { command: "diagnose vpn tunnel list", output: "(simulated)\nname=to-branch ver=2 serial=1 203.0.113.2:0->198.51.100.2:0\nstat: rxp=0 txp=12 rxb=0 txb=1008\nsa=1 proposal=aes256-sha256" }],
    tasks: [
      { id: "p1", title: "Phase 1", instruction: "Create phase1-interface to-branch on port1, IKE version 2, peertype any, proposal aes256-sha256, remote gateway 198.51.100.2 and a pre-shared key of your choice.", commands: ["config vpn ipsec phase1-interface", "edit to-branch", "set interface port1", "set ike-version 2", "set peertype any", "set proposal aes256-sha256", "set remote-gw 198.51.100.2", "set psksecret <your-lab-key>", "next", "end"], expected: "Phase 1 is configured.", hint: "The tunnel interface takes this name.", checks: [{ path: ["vpn ipsec phase1-interface", "to-branch"], key: "remote-gw", includes: ["198.51.100.2"] }, { path: ["vpn ipsec phase1-interface", "to-branch"], key: "ike-version", includes: ["2"] }, { path: ["vpn ipsec phase1-interface", "to-branch"], key: "psksecret" }] },
      { id: "p2", title: "Phase 2", instruction: "Create phase2-interface to-branch-p2 with matching selectors.", commands: ["config vpn ipsec phase2-interface", "edit to-branch-p2", "set phase1name to-branch", "set proposal aes256-sha256", "set src-subnet 10.1.0.0 255.255.255.0", "set dst-subnet 10.2.0.0 255.255.255.0", "next", "end"], expected: "Phase 2 is configured.", hint: "The far end mirrors these selectors.", checks: [{ path: ["vpn ipsec phase2-interface", "to-branch-p2"], key: "phase1name", includes: ["to-branch"] }, { path: ["vpn ipsec phase2-interface", "to-branch-p2"], key: "src-subnet", includes: ["10.1.0.0"] }, { path: ["vpn ipsec phase2-interface", "to-branch-p2"], key: "dst-subnet", includes: ["10.2.0.0"] }] },
      { id: "route", title: "Route", instruction: "Add route 5 to 10.2.0.0/24 through device to-branch.", commands: ["config router static", "edit 5", "set dst 10.2.0.0 255.255.255.0", "set device to-branch", "next", "end"], expected: "Traffic to the branch uses the tunnel.", hint: "A tunnel interface needs no gateway.", checks: [{ path: ["router static", "5"], key: "device", includes: ["to-branch"] }, { path: ["router static", "5"], key: "dst", includes: ["10.2.0.0"] }] },
      { id: "policies", title: "Policies", instruction: "Create policy 10 from port2 to to-branch and policy 11 from to-branch to port2, both accepted, with schedule always and service ALL.", commands: ["config firewall policy", "edit 10", "set srcintf port2", "set dstintf to-branch", "set srcaddr all", "set dstaddr all", "set action accept", "set schedule always", "set service ALL", "next", "edit 11", "set srcintf to-branch", "set dstintf port2", "set srcaddr all", "set dstaddr all", "set action accept", "set schedule always", "set service ALL", "next", "end"], expected: "Both directions are allowed.", hint: "In production, use specific address objects.", checks: [{ path: policy("10"), key: "dstintf", includes: ["to-branch"] }, { path: policy("11"), key: "srcintf", includes: ["to-branch"] }, { path: policy("10"), key: "action", includes: ["accept"] }, { path: policy("11"), key: "action", includes: ["accept"] }] },
      { id: "counters", title: "Read the counters", instruction: "Inspect the tunnel. What does rxp=0 with txp=12 tell you?", commands: ["diagnose vpn tunnel list"], expected: "Local traffic is being sent, but nothing is returning (scripted output).", hint: "Next you'd check the branch's routes and policies.", verify: "diagnose vpn tunnel list" },
    ],
    troubleshooting: ["Use diagnose debug application ike -1 for negotiation failures on a real unit.", "An up tunnel doesn't mean traffic will flow: check route and policy.", "This simulator doesn't negotiate IKE. It checks your configuration against the task."],
  },
  {
    slug: "security-profiles", pathway: "nse-3", title: "Apply security profiles", difficulty: "INTERMEDIATE", durationMinutes: 15,
    summary: "Attach antivirus, IPS and inspection to a policy.",
    objectives: ["Enable profiles on a policy", "Pick an SSL/SSH profile"],
    scenario: "Policy 1 accepts LAN traffic without inspection. Add protection using the default profiles.",
    topology: BASE_TOPOLOGY,
    initial: [...BASE_INTERFACES, ...BASE_POLICY],
    tasks: [
      { id: "attach", title: "Attach profiles", instruction: "On policy 1, enable utm-status, use the certificate-inspection SSL profile, and the default antivirus and IPS profiles.", commands: ["config firewall policy", "edit 1", "set utm-status enable", "set ssl-ssh-profile certificate-inspection", "set av-profile default", "set ips-sensor default", "next", "end"], expected: "Policy 1 references the profiles.", hint: "Set utm-status before adding the profile references.", checks: [{ path: policy("1"), key: "utm-status", includes: ["enable"] }, { path: policy("1"), key: "ssl-ssh-profile", includes: ["certificate-inspection"] }, { path: policy("1"), key: "av-profile", includes: ["default"] }, { path: policy("1"), key: "ips-sensor", includes: ["default"] }] },
    ],
    troubleshooting: ["Certificate inspection can't scan encrypted content, so antivirus can't see inside HTTPS with it.", "A profile on one policy doesn't affect traffic matching a different policy."],
  },
  {
    slug: "web-filtering", pathway: "nse-4", title: "Web filtering", difficulty: "INTERMEDIATE", durationMinutes: 20,
    summary: "Block a URL pattern and attach the web filter.",
    objectives: ["Build a static URL filter", "Create a web filter profile", "Attach it to a policy"],
    scenario: "Block *.gambling.example with a static URL filter and apply it to LAN browsing.",
    topology: BASE_TOPOLOGY,
    initial: [...BASE_INTERFACES, ...BASE_POLICY],
    outputs: [{ command: "diagnose debug rating", output: "(simulated)\nLocale: english\nService: Web-filter  Status: Enable  License: Contract\nList of FortiGuard servers: simulated-entry  State: OK" }],
    tasks: [
      { id: "urlfilter", title: "URL filter list", instruction: "Create webfilter urlfilter entry 1 named Block-List, with entry 1 matching *.gambling.example as a wildcard with action block.", commands: ["config webfilter urlfilter", "edit 1", "set name Block-List", "config entries", "edit 1", "set url *.gambling.example", "set type wildcard", "set action block", "next", "end", "next", "end"], expected: "The list contains the entry.", hint: "Entries are nested in the list.", checks: [{ path: ["webfilter urlfilter", "1", "entries", "1"], key: "url", includes: ["gambling.example"] }, { path: ["webfilter urlfilter", "1", "entries", "1"], key: "action", includes: ["block"] }] },
      { id: "profile", title: "Web filter profile", instruction: "Create webfilter profile Staff-Web using URL filter table 1.", commands: ["config webfilter profile", "edit Staff-Web", "config web", "set urlfilter-table 1", "end", "next", "end"], expected: "The profile refers to the list.", hint: "urlfilter-table sits in the web sub-table.", checks: [{ path: ["webfilter profile", "Staff-Web", "web"], key: "urlfilter-table", includes: ["1"] }] },
      { id: "apply", title: "Apply it", instruction: "Attach Staff-Web to policy 1 with utm-status enabled.", commands: ["config firewall policy", "edit 1", "set utm-status enable", "set webfilter-profile Staff-Web", "next", "end"], expected: "Policy 1 filters web traffic.", hint: "Profiles work only when attached.", checks: [{ path: policy("1"), key: "webfilter-profile", includes: ["Staff-Web"] }] },
      { id: "rating", title: "Check FortiGuard status", instruction: "Check the rating service.", commands: ["diagnose debug rating"], expected: "Scripted status output appears.", hint: "Category filtering depends on this service.", verify: "diagnose debug rating" },
    ],
    troubleshooting: ["Static URL filter entries are checked before FortiGuard categories.", "Full URL filtering of HTTPS requires deep inspection."],
  },
  {
    slug: "application-control", pathway: "nse-4", title: "Application control", difficulty: "INTERMEDIATE", durationMinutes: 15,
    summary: "Create a sensor and apply it.",
    objectives: ["Create an application sensor", "Attach it to a policy"],
    scenario: "Management wants to block peer-to-peer applications from the LAN.",
    topology: BASE_TOPOLOGY,
    initial: [...BASE_INTERFACES, ...BASE_POLICY],
    tasks: [
      { id: "sensor", title: "Create the sensor", instruction: "Create application list Block-P2P with entry 1 set to category 2 and action block. (Category 2 is P2P in this lab. Confirm IDs on a real unit using the GUI or CLI help.)", commands: ["config application list", "edit Block-P2P", "config entries", "edit 1", "set category 2", "set action block", "next", "end", "next", "end"], expected: "The sensor exists.", hint: "Entries are nested in the list.", checks: [{ path: ["application list", "Block-P2P", "entries", "1"], key: "action", includes: ["block"] }, { path: ["application list", "Block-P2P", "entries", "1"], key: "category", includes: ["2"] }] },
      { id: "apply", title: "Apply it", instruction: "Attach Block-P2P to policy 1 with utm-status enabled and an SSL profile of certificate-inspection.", commands: ["config firewall policy", "edit 1", "set utm-status enable", "set ssl-ssh-profile certificate-inspection", "set application-list Block-P2P", "next", "end"], expected: "Policy 1 applies the sensor.", hint: "An SSL profile is normally needed alongside profiles.", checks: [{ path: policy("1"), key: "application-list", includes: ["Block-P2P"] }, { path: policy("1"), key: "utm-status", includes: ["enable"] }] },
    ],
    troubleshooting: ["Check the application control log for the matched signature.", "Some applications need deep inspection for accurate identification."],
  },
  {
    slug: "intrusion-prevention", pathway: "nse-4", title: "Intrusion prevention", difficulty: "INTERMEDIATE", durationMinutes: 20,
    summary: "Create a focused IPS sensor for a server.",
    objectives: ["Filter signatures by severity", "Apply a sensor to an inbound policy"],
    scenario: "Protect a published web server from high and critical severity exploits.",
    topology: "Internet --- port1 [FGT] port3 --- Web server 10.0.2.10",
    initial: ["config firewall policy", "edit 2", "set srcintf port1", "set dstintf port3", "set srcaddr all", "set dstaddr WEB-VIP", "set action accept", "set schedule always", "set service HTTPS", "next", "end"],
    outputs: [{ command: "diagnose sys top", output: "(simulated)\nRun Time:  2 days, 3 hours\nipsengine     204      S      7.1     3.5\nnewcli        310      R      0.3     0.4" }],
    tasks: [
      { id: "sensor", title: "Build the sensor", instruction: "Create IPS sensor Protect-Web with entry 1, severity high critical, status enable, action block.", commands: ["config ips sensor", "edit Protect-Web", "config entries", "edit 1", "set severity high critical", "set status enable", "set action block", "next", "end", "next", "end"], expected: "The sensor exists.", hint: "Selecting relevant signatures keeps CPU use down.", checks: [{ path: ["ips sensor", "Protect-Web", "entries", "1"], key: "severity", includes: ["high", "critical"] }, { path: ["ips sensor", "Protect-Web", "entries", "1"], key: "action", includes: ["block"] }] },
      { id: "apply", title: "Apply it", instruction: "Attach Protect-Web to policy 2 with utm-status enabled.", commands: ["config firewall policy", "edit 2", "set utm-status enable", "set ips-sensor Protect-Web", "next", "end"], expected: "Inbound traffic is inspected.", hint: "The direction of a server policy is inbound.", checks: [{ path: policy("2"), key: "ips-sensor", includes: ["Protect-Web"] }] },
      { id: "cpu", title: "Check the load", instruction: "Check top processes after enabling it.", commands: ["diagnose sys top"], expected: "ipsengine is visible (scripted output).", hint: "Press q on a real unit to leave this view.", verify: "diagnose sys top" },
    ],
    troubleshooting: ["For encrypted inbound traffic, use server-side inspection with the server's certificate.", "Tune for false positives before you widen blocking."],
  },
  {
    slug: "high-availability", pathway: "nse-4", title: "FGCP high availability", difficulty: "ADVANCED", durationMinutes: 25,
    summary: "Configure an active-passive pair and predict election.",
    objectives: ["Configure FGCP", "Enable session pickup", "Monitor interfaces"],
    scenario: "Configure the first unit of an active-passive pair. Heartbeats use port3 and port4, and port1 and port2 are monitored.",
    topology: "[FGT-A] port3 --- heartbeat --- port3 [FGT-B]\n[FGT-A] port4 --- heartbeat --- port4 [FGT-B]",
    outputs: [{ command: "get system ha status", output: "(simulated)\nHA Health Status: OK\nMode: HA A-P\nPrimary: FGT-A\nSecondary: FGT-B" }],
    tasks: [
      { id: "ha", title: "Configure HA", instruction: "Set mode a-p, group-name HQ, a password of your choice, hbdev port3 50 port4 50, and session-pickup enable.", commands: ["config system ha", "set mode a-p", "set group-name HQ", "set password <your-lab-password>", "set hbdev port3 50 port4 50", "set session-pickup enable", "end"], expected: "HA settings are present.", hint: "HA settings sit directly in the table.", checks: [{ path: ["system ha"], key: "mode", includes: ["a-p"] }, { path: ["system ha"], key: "group-name", includes: ["HQ"] }, { path: ["system ha"], key: "password" }, { path: ["system ha"], key: "hbdev", includes: ["port3", "port4"] }, { path: ["system ha"], key: "session-pickup", includes: ["enable"] }] },
      { id: "monitor", title: "Monitor interfaces", instruction: "Monitor port1 and port2, and set priority 200.", commands: ["config system ha", "set monitor port1 port2", "set priority 200", "end"], expected: "A failed monitored link can cause failover.", hint: "With override disabled, uptime comes before priority.", checks: [{ path: ["system ha"], key: "monitor", includes: ["port1", "port2"] }, { path: ["system ha"], key: "priority", includes: ["200"] }] },
      { id: "status", title: "Check status", instruction: "Check the cluster state.", commands: ["get system ha status"], expected: "Both units are listed (scripted output).", hint: "This simulator has one unit, so the status is scripted.", verify: "get system ha status" },
    ],
    troubleshooting: ["Group name, password and mode must match on both units.", "Hardware model and firmware must match for FGCP."],
  },
  {
    slug: "sd-wan", pathway: "nse-4", title: "SD-WAN with SLA steering", difficulty: "ADVANCED", durationMinutes: 40,
    summary: "Create zones, members, a health check and a rule.",
    objectives: ["Build an SD-WAN zone", "Measure with performance SLAs", "Steer traffic by rule"],
    scenario: "Use two internet links for resilience, and send traffic to the link that meets the SLA.",
    topology: "ISP-A 203.0.113.1 --- port1 [FGT] port4 --- ISP-B 198.51.100.1",
    outputs: [{ command: "diagnose sys sdwan health-check", output: "(simulated)\nHealth Check(internet):\nSeq(1 port1): state(alive), packet-loss(0.000%) latency(12.3), jitter(1.1)\nSeq(2 port4): state(alive), packet-loss(0.000%) latency(35.9), jitter(4.2)" }],
    tasks: [
      { id: "enable", title: "Enable and add a zone", instruction: "Enable SD-WAN and create zone underlay.", commands: ["config system sdwan", "set status enable", "config zone", "edit underlay", "next", "end", "end"], expected: "SD-WAN is on.", hint: "Zones hold members.", checks: [{ path: ["system sdwan"], key: "status", includes: ["enable"] }, { path: ["system sdwan", "zone", "underlay"] }] },
      { id: "members", title: "Add members", instruction: "Add member 1 (port1, gateway 203.0.113.1) and member 2 (port4, gateway 198.51.100.1) to underlay.", commands: ["config system sdwan", "config members", "edit 1", "set interface port1", "set gateway 203.0.113.1", "set zone underlay", "next", "edit 2", "set interface port4", "set gateway 198.51.100.1", "set zone underlay", "next", "end", "end"], expected: "Two members exist.", hint: "Remove interface references first on a real unit, if the interface is in use.", checks: [{ path: ["system sdwan", "members", "1"], key: "interface", includes: ["port1"] }, { path: ["system sdwan", "members", "2"], key: "interface", includes: ["port4"] }, { path: ["system sdwan", "members", "2"], key: "zone", includes: ["underlay"] }] },
      { id: "sla", title: "Add a performance SLA", instruction: "Create health check internet, with server 8.8.8.8, members 1 and 2, and SLA 1 with latency threshold 100.", commands: ["config system sdwan", "config health-check", "edit internet", "set server 8.8.8.8", "set members 1 2", "config sla", "edit 1", "set latency-threshold 100", "next", "end", "next", "end", "end"], expected: "Both members are measured.", hint: "SLA entries are nested in the health check.", checks: [{ path: ["system sdwan", "health-check", "internet"], key: "members", includes: ["1", "2"] }, { path: ["system sdwan", "health-check", "internet", "sla", "1"], key: "latency-threshold", includes: ["100"] }] },
      { id: "rule", title: "Add a steering rule", instruction: "Create service rule 1, named Prefer-SLA, in sla mode, destination all, with sla entry internet.", commands: ["config system sdwan", "config service", "edit 1", "set name Prefer-SLA", "set mode sla", "set dst all", "set src all", "config sla", "edit internet", "set id 1", "next", "end", "set priority-members 1 2", "next", "end", "end"], expected: "Traffic uses the first member meeting the SLA.", hint: "A rule uses members with valid routes.", checks: [{ path: ["system sdwan", "service", "1"], key: "mode", includes: ["sla"] }, { path: ["system sdwan", "service", "1", "sla", "internet"], key: "id", includes: ["1"] }, { path: ["system sdwan", "service", "1"], key: "priority-members", includes: ["1", "2"] }] },
      { id: "measure", title: "Read the measurements", instruction: "Review health check results.", commands: ["diagnose sys sdwan health-check"], expected: "Latency and loss per member appear (scripted output).", hint: "Compare them with your threshold.", verify: "diagnose sys sdwan health-check" },
    ],
    troubleshooting: ["Add a route through the SD-WAN zone: rules can't use a member with no route.", "Reference the zone in firewall policies."],
  },
  {
    slug: "traffic-analysis", pathway: "nse-4", title: "Traffic analysis with sniffer and flow debug", difficulty: "ADVANCED", durationMinutes: 25,
    summary: "Use diagnostics to find out why traffic is dropped.",
    objectives: ["Use the packet sniffer", "Use debug flow", "Map evidence to a fix"],
    scenario: "A user at 10.0.1.25 reports that they can't reach 198.51.100.10. Find out why, then fix it.",
    topology: BASE_TOPOLOGY,
    initial: BASE_INTERFACES,
    outputs: [
      { command: "diagnose sniffer packet any", output: "(simulated)\nport2 in 10.0.1.25.51000 -> 198.51.100.10.443: syn\nport2 in 10.0.1.25.51000 -> 198.51.100.10.443: syn" },
      { command: "diagnose debug flow trace start", output: "(simulated)\nmsg=\"vd-root:0 received a packet(proto=6, 10.0.1.25:51000->198.51.100.10:443) from port2.\"\nmsg=\"Denied by forward policy check (policy 0)\"" },
    ],
    tasks: [
      { id: "sniff", title: "Capture the traffic", instruction: "Run a sniffer for the client, with verbosity 4.", commands: ['diagnose sniffer packet any "host 10.0.1.25" 4'], expected: "Packets enter on port2 and don't leave (scripted output).", hint: "Verbosity 4 shows the interface name.", verify: "diagnose sniffer packet any" },
      { id: "flow", title: "Trace the decision", instruction: "Set a filter and start a flow trace.", commands: ["diagnose debug flow filter addr 10.0.1.25", "diagnose debug flow trace start 10"], expected: "\"Denied by forward policy check (policy 0)\" (scripted output).", hint: "Policy 0 is the implicit deny.", verify: "diagnose debug flow trace start" },
      { id: "fix", title: "Fix it", instruction: "Create policy 1 from port2 to port1, with all addresses, schedule always, service ALL, accept and NAT enabled.", commands: ["config firewall policy", "edit 1", "set srcintf port2", "set dstintf port1", "set srcaddr all", "set dstaddr all", "set action accept", "set schedule always", "set service ALL", "set nat enable", "next", "end"], expected: "Traffic now has a matching policy.", hint: "Tighten addresses and services for production.", checks: [{ path: policy("1"), key: "srcintf", includes: ["port2"] }, { path: policy("1"), key: "dstintf", includes: ["port1"] }, { path: policy("1"), key: "action", includes: ["accept"] }, { path: policy("1"), key: "nat", includes: ["enable"] }] },
    ],
    troubleshooting: ["On a real unit, run diagnose debug enable to see flow output, and disable it afterwards.", "Scripted outputs don't change after your fix."],
  },
  {
    slug: "fortianalyzer-integration", pathway: "nse-4", title: "FortiAnalyzer integration", difficulty: "INTERMEDIATE", durationMinutes: 15,
    summary: "Send logs to FortiAnalyzer and check the connection.",
    objectives: ["Configure the log destination", "Test connectivity"],
    scenario: "Send this FortiGate's logs to FortiAnalyzer at 10.0.0.50. An administrator will authorise the device there.",
    topology: "[FGT] --- management network --- FortiAnalyzer 10.0.0.50",
    outputs: [{ command: "execute log fortianalyzer test-connectivity", output: "(simulated)\nFAZ Host Name: FAZ-LAB\nRegistration: registered\nConnection: allow\nDisk Usage: 8%" }],
    tasks: [
      { id: "faz", title: "Configure logging", instruction: "Enable log fortianalyzer setting with server 10.0.0.50.", commands: ["config log fortianalyzer setting", "set status enable", "set server 10.0.0.50", "end"], expected: "Logging is configured.", hint: "Settings tables have no edit level.", checks: [{ path: ["log fortianalyzer setting"], key: "status", includes: ["enable"] }, { path: ["log fortianalyzer setting"], key: "server", includes: ["10.0.0.50"] }] },
      { id: "test", title: "Test it", instruction: "Test connectivity.", commands: ["execute log fortianalyzer test-connectivity"], expected: "Registered and allowed (scripted output).", hint: "A real unit will report an unregistered state until it's authorised on FortiAnalyzer.", verify: "execute log fortianalyzer test-connectivity" },
    ],
    troubleshooting: ["Check TCP 514 between the devices.", "Confirm that the device is authorised in the correct ADOM."],
  },
  {
    slug: "fortimanager-integration", pathway: "nse-6-secure-networking", title: "FortiManager integration", difficulty: "INTERMEDIATE", durationMinutes: 15,
    summary: "Connect a FortiGate to central management.",
    objectives: ["Configure central management", "Check connection state"],
    scenario: "Bring this FortiGate under FortiManager at 10.0.0.60.",
    topology: "[FGT] --- TCP 541 --- FortiManager 10.0.0.60",
    outputs: [{ command: "diagnose fdsm contract-controller-update", output: "(simulated) No contract update is needed for this lab." }, { command: "get system central-management", output: "(simulated)\ntype: fortimanager\nfmg: 10.0.0.60\nmode: normal" }],
    tasks: [
      { id: "fmg", title: "Configure management", instruction: "Set type fortimanager and fmg 10.0.0.60.", commands: ["config system central-management", "set type fortimanager", "set fmg 10.0.0.60", "end"], expected: "The FortiGate targets FortiManager.", hint: "Authorise it on FortiManager afterwards.", checks: [{ path: ["system central-management"], key: "type", includes: ["fortimanager"] }, { path: ["system central-management"], key: "fmg", includes: ["10.0.0.60"] }] },
      { id: "verify", title: "Check it", instruction: "Display central management settings.", commands: ["get system central-management"], expected: "Your settings appear (scripted output).", hint: "Status on FortiManager tells the rest.", verify: "get system central-management" },
    ],
    troubleshooting: ["FGFM uses TCP 541, so check any path firewall.", "Interface allowaccess may need fgfm on the relevant interface."],
  },
  {
    slug: "troubleshooting-broken-branch", pathway: "nse-4", title: "Troubleshooting a broken branch", difficulty: "EXPERT", durationMinutes: 35,
    summary: "Three faults, one symptom. Find each with evidence.",
    objectives: ["Work bottom up", "Avoid changing unrelated settings", "Confirm each fix"],
    scenario: "A branch reports no internet access. The configuration below has been loaded. Read it, look at the diagnostics, then fix each fault.",
    topology: BASE_TOPOLOGY,
    initial: [...BASE_INTERFACES, "config firewall policy", "edit 1", "set name LAN-to-WAN", "set srcintf port1", "set dstintf port2", "set srcaddr all", "set dstaddr all", "set action accept", "set schedule always", "set service ALL", "next", "end"],
    outputs: [{ command: "get router info routing-table all", output: "(simulated, starting state)\nC    10.0.1.0/24 is directly connected, port2\nC    203.0.113.0/24 is directly connected, port1" }, { command: "diagnose debug flow trace start", output: "(simulated, starting state)\nmsg=\"Denied by forward policy check (policy 0)\"" }],
    tasks: [
      { id: "see", title: "Gather evidence", instruction: "View the routing table.", commands: ["get router info routing-table all"], expected: "No default route (scripted output).", hint: "Compare it with what internet traffic needs.", verify: "get router info routing-table all" },
      { id: "route", title: "Fix fault 1", instruction: "Add route 1, a default route via 203.0.113.1 on port1.", commands: ["config router static", "edit 1", "set dst 0.0.0.0 0.0.0.0", "set gateway 203.0.113.1", "set device port1", "next", "end"], expected: "A default route exists.", hint: "What's missing from the routing table?", checks: [{ path: ["router static", "1"], key: "gateway", includes: ["203.0.113.1"] }, { path: ["router static", "1"], key: "dst", includes: ["0.0.0.0"] }] },
      { id: "direction", title: "Fix fault 2", instruction: "Use show firewall policy, then correct policy 1's direction.", commands: ["config firewall policy", "edit 1", "set srcintf port2", "set dstintf port1", "next", "end"], expected: "The policy runs from LAN to WAN.", hint: "Which interface is the LAN on?", checks: [{ path: policy("1"), key: "srcintf", includes: ["port2"] }, { path: policy("1"), key: "dstintf", includes: ["port1"] }] },
      { id: "nat", title: "Fix fault 3", instruction: "Private LAN addresses need translation. Fix it on policy 1.", commands: ["config firewall policy", "edit 1", "set nat enable", "next", "end"], expected: "Source NAT is on.", hint: "Replies won't come back to RFC 1918 addresses.", checks: [{ path: policy("1"), key: "nat", includes: ["enable"] }] },
    ],
    troubleshooting: ["Fix one thing at a time and re-test.", "Write down what each piece of evidence rules out."],
  },
  {
    slug: "firmware-and-backup", pathway: "nse-3", title: "Configuration backup and admin hardening", difficulty: "BEGINNER", durationMinutes: 15,
    summary: "Create a named administrator and restrict where it can log in.",
    objectives: ["Create a restricted admin account", "Know how backups work"],
    scenario: "Before maintenance, add a named administrator limited to the management subnet, then run a backup.",
    topology: BASE_TOPOLOGY,
    initial: BASE_INTERFACES,
    outputs: [{ command: "execute backup config", output: "(simulated) A real unit would send the configuration to the destination you name, such as a TFTP or FTP server. Use the GUI's encrypted backup option for sensitive configurations." }],
    tasks: [
      { id: "admin", title: "Create an administrator", instruction: "Create admin netops with profile super_admin, trusted host 10.0.1.0/24 (trusthost1), and a password of your choice.", commands: ["config system admin", "edit netops", "set accprofile super_admin", "set trusthost1 10.0.1.0 255.255.255.0", "set password <your-lab-password>", "next", "end"], expected: "A restricted admin exists.", hint: "Use a smaller profile than super_admin for most real users.", checks: [{ path: ["system admin", "netops"], key: "trusthost1", includes: ["10.0.1.0"] }, { path: ["system admin", "netops"], key: "accprofile", includes: ["super_admin"] }, { path: ["system admin", "netops"], key: "password" }] },
      { id: "backup", title: "Back up", instruction: "Run a configuration backup command.", commands: ["execute backup config tftp lab.conf 10.0.1.50"], expected: "Scripted guidance appears.", hint: "Encrypt backups that leave the device.", verify: "execute backup config" },
    ],
    troubleshooting: ["Trusted hosts apply to the admin's login source, so don't lock yourself out.", "Keep backup passwords safe: encrypted backups can't be restored without them."],
  },
];
