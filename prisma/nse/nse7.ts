import { DOCS, type SeedPathway } from "./types";

const prereq = (track: string) => ["Active NSE 4 FortiOS certification", `Active NSE 5 or NSE 6 ${track} certification`];
const doc = (product: string) => `https://docs.fortinet.com/product/${product}`;

export const nse7Pathways: SeedPathway[] = [
  {
    slug: "nse-7-secure-networking",
    level: 7,
    track: "SECURE_NETWORKING",
    title: "NSE 7: Secure Networking Architect",
    summary: "Design and troubleshoot advanced Fortinet networks across routing, IPsec, SD-WAN and central management.",
    overview: "The modules follow the five domains Fortinet publishes for the Secure Networking 7.6 Architect exam. Questions here test design judgement and multi-layer troubleshooting more than recall. Practise reasoning from evidence: what the output proves, what it rules out and what you'd check next.",
    prerequisites: prereq("Secure Networking"),
    objectives: ["Architect SD-WAN and multi-site designs", "Run central management at scale", "Troubleshoot routing and advanced IPsec", "Balance inspection, availability and performance"],
    officialExams: ["Fortinet NSE 7 - Secure Networking 7.6 Architect"],
    officialPage: "secure_networking_architect_exam",
    officialSpec: "75 minutes, 40 to 50 questions. Product versions: FortiGate, FortiManager and FortiAnalyzer 7.6. Domains: system configuration and SD-WAN setup 20 to 30%, central management 15 to 25%, security profiles 5 to 15%, rules and routing 25 to 35%, advanced IPsec 25 to 35%. Pass mark not published on the exam page. Checked 31 October 2026.",
    version: "FortiOS 7.6",
    mock: [45, 75],
    target: 400,
    modules: [
      {
        slug: "sdwan-architecture", title: "System configuration and SD-WAN architecture", summary: "HA, Fabric and multi-site SD-WAN design.", weight: 25, version: "FortiOS 7.6",
        objectives: ["Design resilient SD-WAN overlays", "Choose HA modes for the requirement", "Plan Security Fabric roles"],
        notes: `### Design questions to answer first
What's the failure you're designing for, what's the recovery time, and which traffic must keep working? SD-WAN, HA and routing all overlap, and a design should explain which one handles which failure.

### Multi-region SD-WAN
Large designs separate regions with hubs. Regional hubs interconnect and spokes use ADVPN in a region. BGP carries reachability, and BGP on loopback addresses avoids tying sessions to one tunnel. Marking routes with SLA state lets a hub prefer a spoke's healthy overlay, so that return traffic also avoids a failed path.

### FGCP and FGSP
FGCP creates a single logical cluster with a shared configuration. **FGSP** synchronises sessions between independent peers, which can suit designs where a load balancer or routing distributes traffic. Choose based on who owns the forwarding decision.

### Failure domains
Two hubs in one rack on one power feed aren't truly redundant. Consider the transport as well: two circuits from one carrier may share a physical path.

### Architecture habit
State the assumption behind each design choice and how you would test it. A failover that's never been tested is a hope.`,
        concepts: ["BGP on loopback", "ADVPN", "SLA-aware routing", "FGCP vs FGSP", "Failure domains"], sources: [DOCS.fortigate],
        questions: [
          { d: "EXPERT", topic: "Return path", tech: "SD-WAN", p: "A spoke correctly moves new sessions to overlay B when overlay A's SLA fails, but the hub keeps returning traffic over overlay A. What design addition addresses this?", a: [["Signal SLA state to the hub so that its route preference follows healthy overlays", "SLA-aware routing aligns the two directions."], ["Add more SD-WAN rules on the spoke only", "This leaves the hub's choice unchanged."], ["Turn off health checks", "This removes the signal altogether."], ["Replace BGP with static routes on one link", "It reduces adaptability."]], c: [0], e: "SD-WAN rules are local decisions. Unless the other end knows the state, traffic can be asymmetric or broken." },
          { d: "EXPERT", topic: "Failure domains", tech: "Architecture", p: "A design uses two internet circuits from different ISPs, but an outage affects both when a street duct is cut. What's the architectural lesson?", a: [["Validate physical path diversity, not just provider diversity", "Separate providers may share infrastructure."], ["SD-WAN doesn't support two ISPs", "It does, but both were affected by the same fault."], ["Add a second performance SLA", "Measurement doesn't add diversity."], ["Use one ISP for simplicity", "This reduces resilience further."]], c: [0], e: "Failure domains must be identified at every layer: power, duct, carrier, device and region." },
          { d: "EXPERT", topic: "HA choice", tech: "HA", p: "An external load balancer splits traffic between two independently managed FortiGates, and sessions must survive when one fails. Which feature best fits?", a: [["FGSP session synchronisation", "It syncs sessions between peers without forming one FGCP cluster."], ["FGCP active-passive", "FGCP makes a single cluster owning the forwarding decision."], ["ADVPN", "It builds shortcuts and doesn't sync firewall sessions."], ["Link aggregation", "This provides link redundancy between devices, not firewall session sync."]], c: [0], e: "Asymmetric paths through peers may need more settings, so test the actual flows." },
        ],
      },
      {
        slug: "central-management", title: "Central management", summary: "FortiManager and FortiAnalyzer at enterprise scale.", weight: 20, version: "FortiManager and FortiAnalyzer 7.6",
        objectives: ["Design ADOM and package structures", "Recover from management failure", "Govern change"],
        notes: `### ADOM structure
Too few ADOMs mix unrelated teams and versions; too many duplicate work. Base the structure on administrative boundaries and firmware compatibility. Use global objects and policies only for what's truly universal.

### Scaling packages
Use per-device mappings and metadata rather than cloning a package per site. Templates (such as SD-WAN, IPsec and CLI templates) create consistent provisioning. Zero-touch provisioning can reduce on-site effort for branches.

### Management plane resilience
A FortiManager outage should not stop FortiGates forwarding: devices keep their last config. However, you lose central changes in that time. Plan for FortiManager HA, backups and a documented break-glass procedure that covers how local changes will be reconciled afterwards.

### Governance
Use workflow approval and session lists to separate proposers from approvers. Log what was installed and who installed it. Treat the management platform as a Tier 0 asset because control of it means control of every firewall.`,
        concepts: ["ADOM boundaries", "Per-device mapping", "Provisioning templates", "Break-glass", "Tier 0 management plane"], sources: [DOCS.fortimanager],
        questions: [
          { d: "EXPERT", topic: "Trust", tech: "FortiManager", p: "Why should FortiManager be treated as one of the most sensitive systems in an estate?", a: [["Compromising it could allow malicious configuration on every managed firewall", "This gives it enormous blast radius."], ["It's the only device that forwards traffic", "It doesn't forward traffic."], ["It can't be backed up", "It can."], ["Its logs are all public", "They aren't."]], c: [0], e: "Restrict access with MFA, separate management networks and strong change control." },
          { d: "ADVANCED", topic: "Design", tech: "FortiManager", p: "A retailer has 800 near-identical stores. Which design scales best?", a: [["One shared package with per-device mappings and provisioning templates", "This avoids duplicated rules and config drift."], ["800 cloned policy packages", "Every change would multiply."], ["Editing each FortiGate locally", "This leads to drift and errors."], ["One ADOM per store", "This fragments management without an administrative reason."]], c: [0], e: "Differences belong in variables, not in copies of the policy." },
          { d: "EXPERT", topic: "Outage", tech: "FortiManager", p: "FortiManager is down during an incident, and an urgent firewall change is required. What's the correct approach?", a: [["Use the documented break-glass process locally, record the change and reconcile it afterwards", "This balances urgency with control."], ["Wait until FortiManager is restored whatever the impact", "This may prolong the incident."], ["Make the change and don't record it", "This causes an unknown overwrite later."], ["Factory reset FortiGates", "This causes a far greater outage."]], c: [0], e: "Plan this before the incident, and include how the change will be retrieved afterwards." },
        ],
      },
      {
        slug: "profiles-at-scale", title: "Security profiles at scale", summary: "Inspection design and performance.", weight: 10, version: "FortiOS 7.6",
        objectives: ["Choose where to inspect", "Measure the effect of inspection", "Handle encrypted traffic exceptions"],
        notes: `### Where to inspect
Inspecting everything everywhere wastes capacity, and inspecting nothing leaves risk. Decide where each traffic flow is best inspected: branch, hub, cloud or internal segment. Avoid inspecting the same traffic twice unless you have a reason to.

### Performance
Published throughput varies greatly with IPS, SSL inspection and packet size. Size using realistic threat protection and SSL inspection figures for the model, not the headline firewall number. Hardware acceleration may not apply to traffic needing proxy-based inspection, and CPU rises as a result.

### Exceptions
Keep exceptions small, documented and reviewed. Blanket SSL exemptions for large SaaS categories remove inspection of data that may matter. Consider inspection in light of policy, privacy and application compatibility.`,
        concepts: ["Inspection placement", "Threat protection throughput", "Hardware offload", "Exception governance"], sources: [DOCS.fortigate],
        questions: [
          { d: "EXPERT", topic: "Sizing", tech: "Architecture", p: "A proposed FortiGate model has a firewall throughput far above the link speed, but the design requires full SSL inspection with IPS. What should an architect do?", a: [["Size against the published SSL inspection and threat protection figures, using a realistic traffic mix", "Those metrics reflect the actual workload."], ["Approve it because firewall throughput exceeds the link", "This ignores the cost of inspection."], ["Remove the requirement and leave it undocumented", "This hides risk."], ["Use packet size of 1 byte for testing", "This isn't a realistic benchmark."]], c: [0], e: "Inspection features can reduce effective throughput by a large factor." },
          { d: "ADVANCED", topic: "Offload", tech: "Performance", p: "After enabling proxy-based inspection on a busy policy, CPU rises sharply even though the traffic volume hasn't changed. What's the best explanation?", a: [["More traffic requires CPU handling because it can't be fully offloaded to hardware", "Proxy inspection is CPU-intensive."], ["The NP processor stopped working", "This doesn't follow from a policy change."], ["DNS is broken", "It doesn't explain the increase."], ["The hostname is too long", "This isn't relevant."]], c: [0], e: "Measure before and after, and scope such features to the traffic that needs them." },
        ],
      },
      {
        slug: "rules-routing", title: "Rules and routing", summary: "OSPF, BGP, policy interaction and multi-layer troubleshooting.", weight: 25, version: "FortiOS 7.6",
        objectives: ["Diagnose OSPF and BGP problems", "Explain route selection across protocols", "Combine routing and policy evidence"],
        notes: `### Administrative distance
FortiOS defaults include **connected 0, static 10, eBGP 20, OSPF 110, iBGP 200**. Lower distance wins between sources for the same prefix.

### OSPF
Neighbours must agree on area, hello and dead timers, authentication, network type and MTU (unless ignored). States to recognise: stuck in **EXSTART/EXCHANGE** often indicates an MTU mismatch, and no neighbour at all may point to mismatched timers, subnets or blocked multicast.
\`\`\`
get router info ospf neighbor
get router info ospf interface
diagnose ip router ospf all enable
\`\`\`

### BGP
\`get router info bgp summary\` shows state. **Idle or Active** means no established session, so check reachability to the peer's address, TCP 179, AS numbers and source interface. A session in Established with 0 prefixes received points to filters or peer advertisement instead. Selection uses attributes such as highest weight (a local Fortinet/Cisco convention), local preference, AS path length and MED.

### Bringing it together
A packet needs a route, reverse path validity and a policy. Asymmetric routing causes RPF drops or sessions that fail stateful checks. Treat logs, sniffer and debug flow as evidence and locate exactly where the packet stops.`,
        concepts: ["Administrative distance", "OSPF EXSTART", "BGP Active", "Local preference", "Asymmetric routing"], exercise: "Do the OSPF lab and write out which output proves each conclusion.", sources: [DOCS.fortigate],
        questions: [
          { d: "ADVANCED", topic: "OSPF", tech: "OSPF", p: "What's the most likely cause of this OSPF state?", x: "FGT # get router info ospf neighbor\nNeighbor ID  Pri  State         Dead Time  Address    Interface\n10.0.0.2     1    Exstart/DR    00:00:36   10.1.1.2   port3", a: [["An interface MTU mismatch", "EXSTART problems commonly come from an MTU mismatch in DBD exchange."], ["Mismatched area ID", "An area mismatch prevents reaching this adjacency stage."], ["Hello timer mismatch", "A timer mismatch prevents neighbours forming earlier."], ["A missing default route", "This isn't required for adjacency."]], c: [0], e: "Having reached EXSTART, hellos clearly work. Compare MTU on both ends." },
          { d: "EXPERT", topic: "BGP", tech: "BGP", p: "What does this output show, and what should be checked?", x: "FGT # get router info bgp summary\nNeighbor    V  AS     MsgRcvd MsgSent Up/Down  State/PfxRcd\n10.255.0.1  4  65001  0       12      never    Active", a: [["The session hasn't established; check reachability to the peer, TCP 179 and the source address", "Active means it's trying to connect but hasn't succeeded."], ["The session is up and 65,001 prefixes were received", "65001 is the peer AS."], ["The peer is advertising no prefixes", "That needs an established session first."], ["The OSPF adjacency is full", "This is BGP output."]], c: [0], e: "Peering on a loopback, in particular, needs a route to the loopback and the correct source interface." },
          { d: "ADVANCED", topic: "Distance", tech: "Routing", p: "Which route is installed for the same prefix learned from OSPF, eBGP and iBGP using FortiOS default distances?", a: [["eBGP, with distance 20", "20 is lower than OSPF's 110 and iBGP's 200."], ["OSPF, with distance 110", "It's higher than eBGP."], ["iBGP, with distance 200", "It's the highest."], ["All three in ECMP", "ECMP needs equal distance."]], c: [0], e: "Distance decides between protocols, and selection within BGP happens first in BGP's own process." },
          { type: "MULTIPLE", d: "EXPERT", topic: "Troubleshooting", tech: "Routing", p: "A site loses connectivity to one remote subnet after a new link is added, with RPF drops. Which two checks are the most useful? (Choose two.)", a: [["Check the route to the source through the arrival interface in the routing table", "RPF compares exactly this."], ["Check whether the path is now asymmetric, by checking both directions", "A new link often changes one direction only."], ["Check FortiGuard antivirus database version", "This isn't related to RPF."], ["Rename the interfaces", "This doesn't change the path."]], c: [0, 1], e: "Fix the routing design, instead of disabling RPF checks by default." },
        ],
      },
      {
        slug: "advanced-ipsec", title: "Advanced IPsec", summary: "Dial-up, ADVPN, redundancy and deep debugging.", weight: 20, version: "FortiOS 7.6",
        objectives: ["Design hub-and-spoke with ADVPN", "Debug negotiation from logs", "Plan cryptographic migration"],
        notes: `### Design choices
- **Dial-up hub:** the hub accepts spokes with dynamic addresses, using one phase 1 template.
- **ADVPN:** spokes make shortcuts following an initial path through the hub. With routing protocols over the overlay, routes are often summarised and next hops must allow shortcut selection.
- **Redundancy:** multiple overlays with BGP, or SD-WAN SLA steering, usually beat simple DPD failover at scale.

### Debugging
\`\`\`
diagnose vpn ike log filter name to-branch
diagnose debug application ike -1
diagnose debug enable
diagnose vpn tunnel list name to-branch
\`\`\`
Look at SA counters: encrypted packets rising and decrypted packets flat means traffic leaves but nothing returns, so check the far end's routes and policy, or a path dropping ESP. Fragmentation can break large packets while small pings work; check MTU and TCP MSS clamping.

### Keep up with crypto
Prefer strong proposals and consider stronger DH groups, and IKEv2. FortiOS 8.0's exam objectives mention quantum-safe IPsec, so check documentation for your release if this is a requirement.`,
        concepts: ["Dial-up phase 1", "ADVPN shortcut", "SA counters", "MTU and MSS clamping", "Quantum-safe IPsec"], exercise: "Do the IPsec lab, then explain which SA counter would prove each failure.", sources: [DOCS.fortigate],
        questions: [
          { d: "EXPERT", topic: "SA counters", tech: "IPsec", p: "Site A sees the counters below for the tunnel to site B. What's the best next step?", x: "FGT-A # diagnose vpn tunnel list name to-B\nstat: rxp=0 txp=4120 rxb=0 txb=412000\nSA: proposal=aes256-sha256 ... state: established", a: [["Check site B's route and policy for the return path, and whether ESP is dropped on the way", "Site A is sending, but nothing returns."], ["Change the PSK on both sides", "The SA is already established."], ["Add a route on site A for its own LAN", "The local side is sending into the tunnel."], ["Lower the DH group", "Crypto negotiation has already succeeded."]], c: [0], e: "Check B's counters too. If B's rxp is rising, the fault is in B's return path or policy. If not, ESP is lost in transit." },
          { d: "EXPERT", topic: "MTU", tech: "IPsec", p: "Over a new tunnel, pings and small HTTP responses work, but file transfers stall. What's the most likely cause?", a: [["MTU or fragmentation problems, so check the tunnel path and clamp TCP MSS", "Small packets pass while large ones fail."], ["PSK mismatch", "The tunnel wouldn't work at all."], ["A missing phase 1", "The tunnel wouldn't exist."], ["The wrong FortiGuard category", "This doesn't explain the size-dependent failure."]], c: [0], e: "IPsec adds overhead. Size-dependent failures are a classic indicator." },
          { d: "EXPERT", topic: "Design", tech: "ADVPN", p: "A hub has 2,000 spokes and spoke-to-spoke traffic is rare but latency-sensitive. Which design best fits?", a: [["Hub-and-spoke overlays with ADVPN shortcuts on demand", "This avoids a full mesh while giving direct paths when needed."], ["A permanent full mesh of static tunnels", "This requires about two million tunnel relationships to be configured."], ["All traffic through the hub permanently", "This doesn't address latency."], ["No encryption between spokes", "This doesn't meet a security requirement."]], c: [0], e: "On-demand shortcuts scale because most pairs of spokes never communicate." },
        ],
      },
    ],
  },
  {
    slug: "nse-7-security-operations",
    level: 7,
    track: "SECURITY_OPERATIONS",
    title: "NSE 7: Security Operations Architect",
    summary: "Architect detection and response using FortiSIEM and FortiSOAR.",
    overview: "The modules follow the four domains Fortinet lists for the Security Operations 7.6 Architect exam. The published page gives no percentage weighting, so CertMastery's module weights are our own estimate.",
    prerequisites: prereq("Security Operations"),
    objectives: ["Apply SOC frameworks to architecture", "Engineer FortiSIEM detections", "Run threat hunts and incidents in FortiSOAR", "Build maintainable playbooks"],
    officialExams: ["Fortinet NSE 7 - Security Operations 7.6 Architect"],
    officialPage: "security_operations_architect_exam",
    officialSpec: "75 minutes, 35 to 40 questions, pass or fail. Product versions: FortiSOAR 7.6 and FortiSIEM 7.3. Domains listed without percentages: SOC foundations; detection; SOAR incident handling and threat hunting; SOAR playbook development. Checked 31 October 2026.",
    version: "FortiSOAR 7.6, FortiSIEM 7.3",
    mock: [38, 75],
    target: 400,
    modules: [
      {
        slug: "soc-foundations", title: "SOC foundations and architecture", summary: "Frameworks, adversaries and SOC design.", weight: 20, version: "FortiSOAR 7.6, FortiSIEM 7.3",
        objectives: ["Map detection coverage to ATT&CK", "Design telemetry", "Reason about adversary behaviour"],
        notes: `### Coverage over volume
Log volume isn't coverage. Ask which adversary techniques your telemetry and detections can actually see. MITRE ATT&CK provides a common language for that, and the **Cyber Kill Chain** remains a useful way to think about disrupting an attack at each stage.

### Telemetry strategy
Combine network, endpoint, identity and cloud sources. Identity logs are especially valuable, because attackers often use valid accounts rather than malware. Decide on retention by how long investigations take to look back, not just by storage cost.

### Fortinet SOC architecture
FortiGate and other sensors feed FortiAnalyzer or FortiSIEM. FortiSOAR orchestrates response. Others add intelligence and deception. The architecture must define who owns each step when an alert moves between them.

### Operating model
Clear severity definitions, escalation paths and on-call rotations matter as much as tools. Measure outcomes such as time to contain.`,
        concepts: ["ATT&CK coverage", "Kill chain", "Valid accounts", "Retention by investigation need", "Severity model"], sources: [doc("fortisiem"), doc("fortisoar")],
        questions: [
          { d: "EXPERT", topic: "Coverage", tech: "SOC architecture", p: "A SOC collects 50 TB of firewall logs monthly but no identity logs. An attacker uses stolen credentials on a VPN and then accesses file shares. What's the key gap?", a: [["Telemetry doesn't cover identity-based techniques, so valid-account abuse is hard to see", "Volume doesn't help where a technique's evidence is missing."], ["Too few firewalls", "More of the same logs won't help."], ["SOAR has too many playbooks", "This isn't the cause of the gap."], ["The retention period is too short", "Retention doesn't create missing sources."]], c: [0], e: "Plan sources from the techniques you need to detect." },
          { d: "EXPERT", topic: "Retention", tech: "SOC architecture", p: "Investigations show attackers often dwell for months. How should this affect log retention design?", a: [["Retention should cover realistic look-back periods, with tiered storage to manage cost", "Evidence must exist when the investigation starts."], ["Keep 24 hours of logs to make queries quick", "Most of the attack would be lost."], ["Store only alerts and not raw logs", "This prevents later hunting."], ["Delete logs at the first detection", "This destroys evidence."]], c: [0], e: "Tiered storage balances fast search and long retention." },
          { type: "ORDERING", d: "ADVANCED", topic: "Kill chain", tech: "Threat models", p: "Order these Cyber Kill Chain stages.", a: [["Reconnaissance", "The attacker researches the target."], ["Weaponization", "A payload is prepared."], ["Delivery", "It reaches the target."], ["Exploitation", "Code runs."], ["Installation", "A foothold persists."], ["Command and control", "The attacker gets remote control."], ["Actions on objectives", "The attacker achieves their goal."]], e: "Earlier disruption generally costs less. ATT&CK then gives more detailed techniques within this flow." },
        ],
      },
      {
        slug: "detection-engineering", title: "Detection with FortiSIEM", summary: "Rule engineering and incident analysis.", weight: 30, version: "FortiSIEM 7.3",
        objectives: ["Engineer multi-pattern rules", "Query event logs", "Validate and measure detections"],
        notes: `### Rule engineering
Multi-subpattern rules link stages, for example failed logons followed by a success from the same source. A precise rule describes behaviour, a time window and how to group entities. Treat each rule as code: state its purpose, test data, known false positives and owner.

### Test your detections
A rule that has never fired may be broken or just rare. Replay sample events or simulate techniques, and verify that an incident is created with the right attributes.

### Enrichment
CMDB attributes help you weigh the same event differently on a domain controller and on a lab machine. Scoring should take account of asset criticality and identity privilege.

### Incident analysis
Start from what triggered the rule. Pivot to raw events, then to related activity by host and user. Record what you found so that the rule can improve.`,
        concepts: ["Multi-pattern rule", "Detection as code", "Replay testing", "Asset criticality", "Pivoting"], sources: [doc("fortisiem")],
        questions: [
          { d: "EXPERT", topic: "Rule design", tech: "FortiSIEM", p: "A team wants to detect a successful brute force, not just failures. Which rule design fits?", a: [["Two subpatterns: many failures followed by a success for the same user and source in a window", "This models the sequence of behaviour."], ["One subpattern counting successes for all users", "Normal logons would fire constantly."], ["One subpattern on any failed logon", "It alerts on every typo."], ["A daily report of total logons", "This is not a timely detection."]], c: [0], e: "Sequence plus shared entities turns weak signals into a stronger one." },
          { d: "EXPERT", topic: "Validation", tech: "Detection engineering", p: "A high-value rule hasn't fired in a year. What's the best action?", a: [["Test it with simulated or replayed events to confirm that it still works", "Silence doesn't distinguish a rare event from a broken rule."], ["Assume there have been no attacks", "This isn't supported by evidence."], ["Delete it because it's unused", "It may detect a rare, serious technique."], ["Change its severity to low", "This doesn't verify anything."]], c: [0], e: "Parser changes and renamed fields can silently break rules." },
          { d: "ADVANCED", topic: "Enrichment", tech: "FortiSIEM", p: "The same malware alert occurs on a lab VM and a domain controller. How should the SOC use the CMDB?", a: [["Raise the domain controller incident's priority based on asset criticality", "Context changes the business impact."], ["Treat them equally, since the same signature fired", "This ignores impact."], ["Close both", "This doesn't address either incident."], ["Ignore the domain controller, as servers aren't targeted", "They're prime targets."]], c: [0], e: "Prioritisation combines confidence with impact." },
        ],
      },
      {
        slug: "soar-incident-hunting", title: "SOAR incident handling and threat hunting", summary: "Queues, war rooms and hypothesis-driven hunts.", weight: 25, version: "FortiSOAR 7.6",
        objectives: ["Run a threat hunt", "Organise incident work in FortiSOAR", "Coordinate major incidents"],
        notes: `### Threat hunting
A hunt starts with a **hypothesis**, not an alert: for example, "an attacker is using a remote management tool from a server that doesn't normally run it". Then find relevant data, analyse it, and either confirm, refute or refine. A valuable outcome is a new detection, even if no attacker is found.

### FortiSOAR incident work
Alerts become incidents as they're confirmed. **Queues** and **shifts** direct workload. **SLAs** track response deadlines. **War rooms** give a shared space with a timeline, tasks and communication for major incidents.

### Coordinating
Name an incident commander. Separate decision-making from hands-on work. Keep a timeline, and agree when containment takes priority over evidence collection. Communication to executives or regulators follows a pre-agreed process.`,
        concepts: ["Hypothesis-driven hunt", "Queue and shift", "SLA", "War room", "Incident commander"], sources: [doc("fortisoar")],
        questions: [
          { d: "EXPERT", topic: "Hunting", tech: "Threat hunting", p: "Which is a strong threat-hunting hypothesis?", a: [["An attacker may be using PowerShell to reach domain controllers from workstations outside the IT group", "It's specific and testable with data."], ["There might be bad things on the network", "It's too vague to test."], ["All alerts should be closed by Friday", "This is an operational target."], ["Antivirus should be upgraded", "This is a task, not a hypothesis."]], c: [0], e: "A good hypothesis names a technique, an environment and evidence you could check." },
          { d: "ADVANCED", topic: "Outcome", tech: "Threat hunting", p: "A hunt finds no attacker. What makes it still worthwhile?", a: [["It can create new detections and show a visibility gap or a validated control", "These outcomes improve defences."], ["Nothing: hunts only succeed by finding attackers", "This undervalues the learning."], ["It proves that the network can never be attacked", "It can't prove this."], ["It reduces the licence cost", "This isn't a usual outcome."]], c: [0], e: "Record the method so it can be repeated or automated." },
          { d: "ADVANCED", topic: "Major incident", tech: "FortiSOAR", p: "During a ransomware incident, several teams are duplicating work. What feature and practice address this?", a: [["A war room with an incident commander and a shared task list", "This provides shared coordination."], ["More email threads for each team", "This creates more fragmentation."], ["Turning off the SIEM", "It removes visibility."], ["Closing the incident until it's quieter", "This doesn't help."]], c: [0], e: "Tools support coordination, but someone still has to make decisions." },
        ],
      },
      {
        slug: "soar-playbooks", title: "SOAR playbook development", summary: "Engineering reliable automation.", weight: 25, version: "FortiSOAR 7.6",
        objectives: ["Structure reusable playbooks", "Transform data with Jinja", "Handle errors and idempotence"],
        notes: `### Build for maintenance
Create small, reusable **sub-playbooks** for jobs such as IP enrichment. Keep configuration in variables rather than hard-coded values, and use a clear naming scheme.

### Data handling
Use Jinja to reach values and transform them, and guard against missing data:
\`\`\`
{% if vars.steps.Lookup.data.results %}
{{ vars.steps.Lookup.data.results | map(attribute='score') | max }}
{% else %}0{% endif %}
\`\`\`

### Reliability
- **Idempotence:** running an action twice is safe. Check whether the block already exists before adding it.
- **Error paths:** decide what happens when a connector times out. Should it retry, or notify a person?
- **Rate limits:** a loop over a thousand items may exceed a provider's API limit.
- **Audit:** keep execution records so that actions can be explained.

### Change control
Test in a non-production environment, version playbooks, and remove obsolete ones. An outdated automated response is a production risk.`,
        concepts: ["Sub-playbook", "Idempotence", "Error handling", "API rate limits", "Playbook versioning"], sources: [doc("fortisoar")],
        questions: [
          { d: "EXPERT", topic: "Idempotence", tech: "FortiSOAR", p: "A blocking playbook sometimes runs twice for the same alert, causing an error because the address object already exists. What's the best fix?", a: [["Check for the object first, so repeat runs are safe", "This makes the action idempotent."], ["Turn off error logging", "This hides the problem."], ["Run it three times", "This doesn't help."], ["Delete all objects each run", "This breaks existing policy."]], c: [0], e: "Automation retries and duplicates happen, so actions should be safe when repeated." },
          { d: "ADVANCED", topic: "Error handling", tech: "FortiSOAR", p: "A connector times out during enrichment. Which design is best?", a: [["Retry within limits, then route to a human with the context", "This avoids silently losing the incident."], ["Mark the alert as benign", "A failure to look something up doesn't prove it's benign."], ["Stop the entire SOAR platform", "This is disproportionate."], ["Retry forever", "This can block work and exceed limits."]], c: [0], e: "Absence of enrichment must never be treated as a clean result." },
          { d: "ADVANCED", topic: "Reuse", tech: "FortiSOAR", p: "Ten playbooks each contain the same IP reputation steps. What's the maintainable approach?", a: [["Move them into one reusable sub-playbook", "One change then fixes all of them."], ["Keep copying them", "This creates inconsistency."], ["Merge all playbooks into one huge playbook", "This reduces clarity."], ["Remove reputation checks", "This loses useful context."]], c: [0], e: "This is ordinary software engineering, applied to automation." },
        ],
      },
    ],
  },
  {
    slug: "nse-7-sase",
    level: 7,
    track: "SASE",
    title: "NSE 7: SASE Architect",
    summary: "Design and troubleshoot complex FortiSASE and SD-WAN infrastructures.",
    overview: "Fortinet names this exam FortiSASE Architect and describes it as designing and troubleshooting complex SASE infrastructures that integrate secure access with SD-WAN. We couldn't verify its duration or question count, so CertMastery's mock settings are our own.",
    prerequisites: prereq("SASE"),
    objectives: ["Architect Zero Trust and identity-driven access", "Integrate FortiSASE with SD-WAN", "Troubleshoot distributed access"],
    officialExams: ["Fortinet NSE 7 - FortiSASE Architect"],
    officialPage: "nse_7_sase",
    mock: [40, 75],
    target: 400,
    modules: [
      {
        slug: "zero-trust-architecture", title: "Zero Trust and identity architecture", summary: "Designing identity-driven access.", weight: 50,
        objectives: ["Design a phased Zero Trust plan", "Use identity and posture signals", "Plan for unmanaged devices and third parties"],
        notes: `### Principles to architecture
Zero Trust isn't a product. It's a design in which each access decision uses identity, device state and context, with minimal privilege and ongoing evaluation. Assume that any network location, internal or external, can be hostile.

### A phased approach
1. Identify users, devices, applications and data.
2. Consolidate identity and require strong MFA.
3. Move high-risk applications to ZTNA.
4. Replace broad VPN access in stages, and add segmentation.
5. Measure: remaining broad access, posture failures and access exceptions.

### Hard cases
- **Unmanaged and third-party devices:** you have no posture data. Limit them to browser-based or isolated access to specific apps.
- **Legacy applications:** they may not support modern identity, so place a proxy in front and restrict paths.
- **Availability:** if the identity provider fails, how do administrators get in? A break-glass process must exist and be protected.

### Identity risk
Phishing-resistant MFA, such as FIDO2, reduces the risk of credential and MFA-prompt attacks. Conditional decisions can step up authentication for sensitive apps.`,
        concepts: ["Continuous evaluation", "Phased migration", "Unmanaged device access", "Break-glass", "Phishing-resistant MFA"], sources: [DOCS.fortisase],
        questions: [
          { d: "EXPERT", topic: "Third parties", tech: "Zero Trust", p: "A supplier's engineers need access to one internal maintenance portal from devices you don't manage. Which design is best?", a: [["Per-application, identity-verified access with MFA and restricted capabilities, and no network-level access", "This limits scope without posture."], ["A full-tunnel VPN into the production network", "This gives broad network access from an unknown device."], ["A public port forward protected by a password", "This exposes the portal widely."], ["Sharing an employee's account", "This removes accountability."]], c: [0], e: "Without posture information, reduce what the session can reach and do." },
          { d: "EXPERT", topic: "Migration", tech: "Zero Trust", p: "An enterprise wants to replace its VPN with ZTNA across 300 applications. Which plan is the most sound?", a: [["Inventory apps, then migrate in phases starting with high-value web apps, keeping the VPN for remaining cases and measuring as you go", "This manages risk while reducing broad access."], ["Disable the VPN on Friday and enable ZTNA on Monday", "An unknown dependency would cause outages."], ["Leave the VPN unchanged and add ZTNA for one test app forever", "This fails to reduce exposure."], ["Move all apps to public IPs", "This increases exposure."]], c: [0], e: "A plan needs an inventory, success measures and a retirement date for the VPN." },
          { d: "EXPERT", topic: "MFA", tech: "Identity", p: "Attackers use MFA push fatigue and adversary-in-the-middle phishing against users. Which control best addresses both?", a: [["Phishing-resistant MFA such as FIDO2 passkeys or security keys", "It binds authentication to the real site and has no push to approve."], ["A longer password", "It doesn't stop either attack."], ["SMS codes", "SMS codes can also be relayed."], ["More push prompts", "This makes fatigue worse."]], c: [0], e: "Phishing resistance removes the user's ability to approve the wrong session." },
        ],
      },
      {
        slug: "sase-sdwan-integration", title: "SASE and SD-WAN integration", summary: "Distributed connectivity and troubleshooting.", weight: 50,
        objectives: ["Choose traffic paths for users and sites", "Integrate private access with hubs", "Troubleshoot by following the path"],
        notes: `### Traffic path decisions
Decide per traffic class: remote user to internet, remote user to private app, branch to internet, branch to data centre. SASE PoPs handle much of the cloud-bound traffic, and SD-WAN overlays handle private transport. Avoid accidental hairpins, such as a SaaS session going from the branch to a hub and then back through a PoP.

### Private access integration
FortiSASE connects to SD-WAN hubs, often with BGP over IPsec overlays. Plan address space so that user pools don't overlap on-premises subnets. Advertise only what's required. Choose which hub each PoP prefers and how it fails over.

### Troubleshooting method
Follow each hop and check the evidence at each:
1. Endpoint: agent connected? Which PoP?
2. SASE: is a policy matched, and which log says so?
3. Overlay: is the route learned, and is the tunnel passing traffic?
4. Hub: does route and policy exist?
5. Application: does it respond, and does its return route point to the user pool?

Performance complaints need path data as well: endpoint Wi-Fi, ISP, PoP region and application location. Digital experience monitoring helps separate these.`,
        concepts: ["Traffic class", "Hairpin", "User pool overlap", "BGP over overlay", "Hop-by-hop troubleshooting", "Digital experience monitoring"], sources: [DOCS.fortisase, DOCS.fortigate],
        questions: [
          { d: "EXPERT", topic: "Addressing", tech: "FortiSASE", p: "Remote users can't reach some internal servers after a private access rollout. The FortiSASE user pool is 10.20.0.0/16, and those servers are in 10.20.5.0/24 on site. What's the most likely cause?", a: [["Overlapping address space confuses the routing", "Traffic to or from those addresses can resolve to the wrong place."], ["FortiSASE can't handle TCP", "It can."], ["The servers need a new FortiGuard category", "This doesn't apply."], ["The users' browsers are too new", "This doesn't explain the subnet-specific failure."]], c: [0], e: "Subnet-specific failure points to routing or addressing. Non-overlapping pools should be planned at design time." },
          { d: "EXPERT", topic: "Path", tech: "SASE design", p: "Branch users' SaaS performance degraded after a redesign. A trace shows traffic going branch to hub to PoP and on to SaaS. What's the best change?", a: [["Send SaaS from the branch directly to the SASE PoP or suitably secured local breakout", "This removes the hairpin and retains inspection."], ["Add inspection at the hub as well", "This adds more latency."], ["Raise the hub's firewall throughput only", "It doesn't remove the extra path."], ["Disable all inspection of SaaS", "It removes protection."]], c: [0], e: "Design paths per traffic class rather than sending everything one way." },
          { type: "ORDERING", d: "EXPERT", topic: "Troubleshooting", tech: "FortiSASE", p: "A user can't reach a private application through FortiSASE. Order a hop-by-hop investigation.", a: [["Confirm the endpoint's agent connection and PoP", "Rule out the user side first."], ["Confirm a FortiSASE policy matches in the logs", "The next decision point is the SASE policy."], ["Confirm a route over a working overlay to the hub", "It has to reach the hub."], ["Confirm hub route and policy to the server", "Then the on-premises part."], ["Confirm the server's response and return route to the user pool", "Return traffic is a common fault."]], e: "Following the path produces evidence at each point and narrows the fault." },
          { d: "EXPERT", topic: "Performance", tech: "Digital experience", p: "Only home users on one ISP report a slow app, while others in the region are fine. Which conclusion is best supported?", a: [["The ISP or its path to the PoP should be investigated before the SASE policy", "The pattern follows the ISP, not the policy."], ["The application's database is overloaded", "All users would then be affected."], ["FortiSASE's web filter is broken globally", "This doesn't match the scope."], ["The users' accounts are compromised", "This doesn't follow from the evidence."]], c: [0], e: "Find what affected users share, then let that guide the next step." },
        ],
      },
    ],
  },
  {
    slug: "nse-7-cloud-security",
    level: 7,
    track: "CLOUD_SECURITY",
    title: "NSE 7: Cloud Security Architect",
    summary: "Architect Fortinet application security for public and private clouds.",
    overview: "Fortinet describes this certification as designing, administering, monitoring and troubleshooting Fortinet application security solutions for public and private cloud applications. We couldn't verify the exam's duration or question count, so CertMastery's mock settings are our own.",
    prerequisites: prereq("Cloud Security"),
    objectives: ["Design hybrid and multi-cloud security", "Place firewalls correctly in cloud networks", "Protect workloads and applications", "Monitor and respond in the cloud"],
    officialExams: ["Fortinet NSE 7 - Cloud Security Architect"],
    officialPage: "nse_7_cloud_security",
    mock: [40, 75],
    target: 400,
    modules: [
      {
        slug: "cloud-network-security", title: "Cloud networking and firewall architecture", summary: "Inspection patterns in AWS and Azure.", weight: 50,
        objectives: ["Choose a centralised or distributed inspection pattern", "Design for HA in the cloud", "Avoid asymmetric traffic"],
        notes: `### How cloud differs
Cloud networks route through provider-controlled fabrics. You can't simply add a firewall in line: you change route tables so that traffic passes through it. There's no broadcast, so traditional first-hop redundancy methods don't work the same way.

### Patterns
**AWS:** a centralised inspection VPC attached through **Transit Gateway** is common, often with a **Gateway Load Balancer** distributing traffic to FortiGate VMs. Keep flows symmetric, for which TGW **appliance mode** is relevant in multi-AZ designs.

**Azure:** a **hub-and-spoke VNet** with a hub firewall and **User Defined Routes** is common, frequently with an internal load balancer in front of a FortiGate pair. **Azure Virtual WAN** is another option.

### Centralised or distributed
| | Centralised | Distributed |
| --- | --- | --- |
| Consistency | Easier | Harder |
| Cost | Shared | Per environment |
| Latency and egress | Extra hops, possibly cross-zone charges | Lower |
| Blast radius | Larger shared dependency | Smaller |

### Automation
Autoscale requires bootstrap configuration, license handling and configuration sync. Define these with infrastructure as code so that environments don't drift. The Fortinet Terraform provider is one route.

### Identity and egress
Use cloud-native metadata in policy through dynamic address objects (SDN connectors), since cloud IPs change. Restrict workload egress, as attackers use it for command and control and data theft.`,
        concepts: ["Route-table steering", "Transit Gateway", "Gateway Load Balancer", "Appliance mode", "User Defined Routes", "SDN connector"], sources: [DOCS.fortigate],
        questions: [
          { d: "EXPERT", topic: "Symmetry", tech: "AWS", p: "In a multi-AZ AWS inspection VPC behind Transit Gateway, some stateful sessions fail, because return traffic reaches a FortiGate in a different AZ. Which setting most directly addresses this?", a: [["Enable Transit Gateway appliance mode on the inspection attachment", "It keeps a flow's two directions on the same AZ's attachment."], ["Add a second internet gateway", "This doesn't address flow symmetry."], ["Disable the firewall's session table", "This removes stateful inspection."], ["Move workloads to a public subnet", "This reduces security and doesn't fix the issue."]], c: [0], e: "Stateful firewalls need both directions of a flow. Check the current AWS documentation for your region and design." },
          { d: "EXPERT", topic: "Azure", tech: "Azure", p: "In a hub-and-spoke Azure design, a FortiGate in the hub never sees traffic between two spokes. What's the most likely missing element?", a: [["User Defined Routes in spoke subnets pointing to the firewall", "Without them, traffic doesn't go through the hub firewall."], ["An extra public IP on the spoke VM", "This doesn't direct traffic through the firewall."], ["An OSPF process on the VM", "UDRs are the common control."], ["Disabling NSGs on all subnets", "It doesn't redirect traffic."]], c: [0], e: "VNet peering isn't transitive, and UDRs send traffic to the firewall's internal IP or load balancer." },
          { d: "ADVANCED", topic: "Dynamic addresses", tech: "SDN connector", p: "Workload IPs change often because of autoscaling. How can FortiGate policy stay accurate without manual updates?", a: [["Use an SDN connector with dynamic address objects based on tags or metadata", "Objects update from the cloud provider."], ["Allow any source and destination", "This loses all segmentation."], ["Update addresses by hand each hour", "This is error-prone and slow."], ["Use static public IPs for every instance", "This is costly, and exposes workloads."]], c: [0], e: "Tags become part of the security model, so control who can change them." },
          { d: "EXPERT", topic: "Trade-offs", tech: "Cloud architecture", p: "A company runs regional applications in several clouds, with strict latency needs and strong team autonomy, but it needs consistent policy. Which approach best balances these?", a: [["Distributed enforcement with centrally defined policy and automation", "This reduces hairpin latency while keeping policy consistent."], ["One firewall in one region for all clouds", "This adds latency and a shared failure domain."], ["Each team writes unrelated rules with no standard", "This loses consistency."], ["No firewalls, relying only on encryption", "This removes network and egress controls."]], c: [0], e: "Central policy doesn't have to mean a central traffic path." },
        ],
      },
      {
        slug: "application-workload-security", title: "Application and workload protection", summary: "Layered protection and cloud monitoring.", weight: 50,
        objectives: ["Layer WAF, API and workload controls", "Secure containers and CI/CD", "Investigate cloud incidents"],
        notes: `### Layers
A public application might use FortiAppSec Cloud or FortiWeb for HTTP attacks and bots, FortiADC for delivery, a cloud firewall for segmentation, and FortiCNAPP for workload and configuration risk. Be clear about what each covers. A WAF doesn't fix a vulnerable library or an over-permissioned role.

### APIs
APIs are attacked differently from websites. Enforce a schema, authenticate and authorise each request, and apply rate limits. **Broken object level authorisation**, where a user can get another user's object by changing an ID, needs application fixes as well as monitoring. A WAF can't generally judge who owns an object.

### Containers and pipelines
Scan images before they're deployed, use minimal base images, and run with least privilege. Pipelines hold powerful credentials, so protect them and use short-lived identities. Treat infrastructure as code as a place to catch misconfiguration before deployment.

### Cloud detection and response
Collect control-plane audit logs, such as CloudTrail or Azure Activity Logs, along with flow and workload data. Attackers abuse identities and APIs, so a stolen access key may not touch any firewall. Containment includes disabling credentials, isolating workloads and keeping a snapshot for forensics. Beware of deleting evidence: terminating an instance may lose volatile data.`,
        concepts: ["Layered controls", "BOLA", "API schema enforcement", "Short-lived credentials", "Control-plane logs", "Cloud forensics"], sources: [doc("forticnapp"), doc("fortiweb")],
        questions: [
          { d: "EXPERT", topic: "APIs", tech: "API security", p: "An API returns any customer's invoice when an authenticated user changes the invoice ID. Which statement is most accurate?", a: [["This is broken object level authorisation, and the fix must include an ownership check in the application", "A WAF generally can't know who owns each object."], ["A WAF signature alone will fully fix this", "The requests look syntactically valid."], ["Encrypting traffic with TLS will fix it", "The user is authorised to use TLS and still sees the data."], ["It's a volumetric DDoS attack", "This isn't related to traffic volume."]], c: [0], e: "Rate limits and anomaly detection can help detect abuse, but authorisation belongs in the application." },
          { d: "EXPERT", topic: "Cloud incident", tech: "Cloud detection", p: "A stolen cloud access key is used to copy data through provider APIs. FortiGate logs show nothing. Why, and where should investigators look?", a: [["The activity went through the provider's control and storage APIs, so check audit logs such as CloudTrail", "It never crossed the firewall."], ["The firewall is misconfigured, so logs are lost", "Not necessarily: the traffic never needed to traverse it."], ["No attack occurred, since firewall logs are empty", "Lack of network logs doesn't prove this."], ["Investigators should look only at the WAF", "The WAF protects the web app path, not provider APIs."]], c: [0], e: "Cloud architecture needs identity and control-plane telemetry, not just network logs." },
          { type: "ORDERING", d: "EXPERT", topic: "Containment", tech: "Cloud response", p: "A cloud VM is confirmed compromised through its role. Order the response.", a: [["Snapshot disks and preserve relevant logs", "Evidence should be kept before changes where urgency allows."], ["Isolate the VM with a restrictive security group", "This stops ongoing activity without deleting it."], ["Revoke or rotate the role's credentials", "This stops stolen credentials being used elsewhere."], ["Investigate scope through audit logs", "Find other affected resources."], ["Rebuild from a trusted image and fix the root cause", "Recover to a known good state."]], e: "In active harm, isolation may need to happen first. Avoid simply terminating the instance, because evidence is lost." },
          { type: "MULTIPLE", d: "EXPERT", topic: "Pipelines", tech: "DevSecOps", p: "Which two measures most reduce the risk of a compromised CI/CD pipeline? (Choose two.)", a: [["Short-lived, narrowly scoped deployment identities", "This limits what a stolen credential can do."], ["Scanning images and infrastructure code before deployment", "This catches risky changes early."], ["Giving pipelines permanent administrator keys", "This increases the blast radius."], ["Disabling audit logs for pipeline accounts", "This removes evidence."]], c: [0, 1], e: "A pipeline can change production, so protect it like production." },
        ],
      },
    ],
  },
];
