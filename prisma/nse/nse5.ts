import { DOCS, type SeedPathway } from "./types";

const prereq = ["Active NSE 4 FortiOS certification"];
const doc = (product: string) => `https://docs.fortinet.com/product/${product}`;

export const nse5Pathways: SeedPathway[] = [
  {
    slug: "nse-5-secure-networking",
    level: 5,
    track: "SECURE_NETWORKING",
    title: "NSE 5: Secure Networking",
    summary: "Secure access and branch networking with FortiSwitch, FortiAP and core SD-WAN.",
    overview: "To earn this certification you hold NSE 4 and pass one of the three proctored exams Fortinet lists for the track. Each module below prepares you for one of those exams. Fortinet's exam format is multiple choice and drag-and-drop, with no partial credit.",
    prerequisites: prereq,
    objectives: ["Manage FortiSwitch through FortiLink", "Design and fix secure wireless on FortiAP", "Deploy core SD-WAN with overlays"],
    officialExams: ["Fortinet NSE 5 - FortiSwitch Administrator", "Fortinet NSE 5 - Secure Wireless LAN Administrator", "Fortinet NSE 5 - SD-WAN Core Administrator"],
    officialPage: "nse_5_secure_networking",
    mock: [30, 60],
    target: 300,
    modules: [
      {
        slug: "fortiswitch", title: "FortiSwitch and FortiLink", summary: "Managing switching from FortiGate.", weight: 33,
        objectives: ["Explain FortiLink management", "Create VLANs and assign ports", "Describe switch redundancy options"],
        notes: `### FortiLink
In FortiLink mode, a FortiGate manages FortiSwitch units as an extension of itself: VLANs are FortiGate interfaces and ports are configured from the FortiGate's switch controller.

A FortiGate interface is designated with \`set fortilink enable\`. Discovered switches must be **authorised** before they carry managed configuration. Check them with:
\`\`\`
execute switch-controller get-conn-status
\`\`\`
The managed switch's entry lives under \`config switch-controller managed-switch\`.

### VLANs and policy
Create a VLAN on the FortiLink interface and assign it to a port's native VLAN or allowed VLANs. Traffic between VLANs is routed through the FortiGate, so firewall policies apply. Traffic within one VLAN is switched locally and doesn't reach the policy engine unless you use a specific isolation feature.

### Port security and redundancy
Common controls: 802.1X, loop protection through STP and storm control. For redundancy, a **FortiLink split interface** or LAG connects to multiple switches, and **MCLAG** peers present a single logical LAG to a downstream device.`,
        concepts: ["FortiLink", "Authorising a switch", "Native VLAN", "Inter-VLAN policy", "MCLAG"], sources: [doc("fortiswitch"), DOCS.fortigate],
        questions: [
          { d: "INTERMEDIATE", topic: "FortiLink", tech: "FortiSwitch", p: "A newly connected FortiSwitch appears on the FortiGate but carries no managed configuration. What is the most likely next step?", a: [["Authorise the switch", "Managed configuration is pushed after authorisation."], ["Replace the FortiGate's licence", "FortiLink management isn't blocked by this."], ["Create a static route to the switch", "FortiLink is a directly connected management link."], ["Enable SD-WAN", "SD-WAN isn't related to switch management."]], c: [0], e: "Discovery alone doesn't bring a switch under management." },
          { d: "ADVANCED", topic: "VLANs", tech: "FortiSwitch", p: "Two PCs in VLAN 20 on the same managed FortiSwitch communicate, but no entry appears in the FortiGate's forward traffic log. Why?", a: [["Traffic within a VLAN is switched by the FortiSwitch without reaching the FortiGate", "No routing is needed, so the firewall doesn't see it."], ["Logging is off on all interfaces", "Inter-VLAN traffic would still reach the policy engine, so this isn't the most direct reason."], ["FortiLink encrypts all traffic so it can't be logged", "This isn't why the log is empty."], ["The PCs use IPv6", "This doesn't explain it."]], c: [0], e: "Same-VLAN traffic is Layer 2 local. Controlling it needs a feature such as VLAN isolation or moving devices to separate VLANs." },
          { type: "MATCHING", d: "ADVANCED", topic: "Features", tech: "FortiSwitch", p: "Match each need to a FortiSwitch feature.", a: [["Authenticate a device before it gets network access on a port", "802.1X", "Port-based network access control."], ["Present two switches as one LAG to a server", "MCLAG", "Multi-chassis LAG."], ["Limit broadcast floods on a port", "Storm control", "It limits broadcast, multicast and unknown unicast rates."]], e: "These features protect different things: identity, availability and stability." },
          { d: "INTERMEDIATE", topic: "Inter-VLAN", tech: "FortiSwitch", p: "Users in VLAN 10 can't reach a printer in VLAN 20. Both VLANs are FortiLink interfaces on the FortiGate. What should you check first?", a: [["A firewall policy between the two VLAN interfaces", "Inter-VLAN traffic is routed through FortiGate policy."], ["The printer's MAC table on the FortiGate's WAN", "The WAN isn't involved."], ["SD-WAN health checks", "These are not relevant for local VLANs."], ["The FortiSwitch's PoE budget only", "It might affect power, not routed access."]], c: [0], e: "Every VLAN acts like a routed interface on the FortiGate, so normal policy rules apply." },
        ],
      },
      {
        slug: "secure-wireless", title: "Secure wireless LAN", summary: "FortiAP management, SSIDs and rogue AP control.", weight: 33,
        objectives: ["Explain FortiAP management with CAPWAP", "Choose tunnel or bridge SSIDs", "Secure wireless access"],
        notes: `### FortiAP management
A FortiGate (or cloud service) controls FortiAP units using **CAPWAP**, on UDP 5246 for control and UDP 5247 for data. Discovered APs must be authorised, and they get their settings from an **FortiAP profile** (\`wtp-profile\`).

### SSID modes
- **Tunnel:** client traffic returns to the FortiGate over CAPWAP. It's simple to apply policy centrally.
- **Bridge:** client traffic exits locally at the AP onto the wired network. It reduces the load on the FortiGate, but the local network must carry it and inspection requires traffic to pass through the firewall later.
- **Mesh:** an AP connects wirelessly back to another AP.

### Security
Use WPA2-Enterprise or WPA3-Enterprise with RADIUS where users have directory accounts. Open guest networks should use a captive portal and strict isolation from internal resources. **Rogue AP detection** finds unauthorised access points; suppression actively interferes with a device and can have legal implications, so only use it in line with policy.

### RF basics
Interference and overlapping channels cause many complaints that look like network faults. Check channel plans, 2.4 vs 5/6 GHz coverage, and transmit power before suspecting authentication.`,
        concepts: ["CAPWAP", "Tunnel vs bridge", "wtp-profile", "WPA3-Enterprise", "Rogue AP suppression"], sources: [doc("fortiap"), DOCS.fortigate],
        questions: [
          { d: "INTERMEDIATE", topic: "SSID modes", tech: "FortiAP", p: "A branch has a large file server locally and wants wireless users to reach it without sending traffic back over a slow link to a central controller. Which SSID mode fits best?", a: [["Bridge", "Traffic exits at the AP onto the local network."], ["Tunnel to a remote FortiGate", "All traffic would hairpin across the slow link."], ["Mesh only", "Mesh describes AP backhaul and not local breakout."], ["Captive portal", "This is an authentication method."]], c: [0], e: "The trade-off is that tunnel mode centralises enforcement, while bridge mode favours local traffic." },
          { d: "ADVANCED", topic: "CAPWAP", tech: "FortiAP", p: "A FortiAP across a routed WAN doesn't appear on the FortiGate. Which firewall traffic must be permitted for management?", a: [["UDP 5246 and UDP 5247", "These are the CAPWAP control and data ports."], ["TCP 541", "This is FGFM to FortiManager."], ["UDP 500 and UDP 4500", "These are IKE and NAT-T."], ["TCP 514", "This is commonly FortiAnalyzer log traffic."]], c: [0], e: "CAPWAP uses UDP 5246 and 5247. Also check that the AP has a way to discover the controller, such as DHCP or a static setting." },
          { type: "MULTIPLE", d: "ADVANCED", topic: "Wireless security", tech: "Wireless", p: "Which two choices best secure corporate wireless access for staff with directory accounts? (Choose two.)", a: [["WPA2 or WPA3 Enterprise", "Each user authenticates with individual credentials."], ["RADIUS integration with the directory", "It provides central authentication and revocation."], ["An open SSID with a hidden name", "Hiding the name doesn't provide security."], ["A single shared WPA2 password for all staff", "A shared key doesn't identify users and is hard to revoke."]], c: [0, 1], e: "Enterprise modes tie access to individual identity." },
        ],
      },
      {
        slug: "sdwan-core", title: "SD-WAN core", summary: "Overlay and underlay design and steering.", weight: 34,
        objectives: ["Separate underlay and overlay", "Steer applications using SLAs", "Scale a hub-and-spoke design"],
        notes: `### Underlay and overlay
The **underlay** is your transport: internet and MPLS links. The **overlay** is IPsec tunnels built on those links. Most SD-WAN designs route between sites over overlays and use BGP or ADVPN for scale.

### Hub and spoke with ADVPN
A hub-and-spoke network can send traffic between spokes through the hub. **ADVPN** lets spokes build direct shortcut tunnels on demand for that traffic, reducing hub load and latency.

### Application steering
Rules can match Internet Service Database entries and application signatures as well as addresses. Application steering may rely on the first packets of a session to identify the application, so a new session may need that information to be learned first.

### Direct internet access
Branches can send trusted SaaS straight to the internet instead of backhauling it. Security must then be enforced at the branch or in the cloud, so a DIA design is also a security decision.

### Verifying
Compare \`diagnose sys sdwan service\` with \`diagnose sys session list\`: the first shows which member the rule prefers and the second shows what a session is actually using.`,
        concepts: ["Underlay vs overlay", "ADVPN shortcuts", "Internet Service Database", "Direct internet access"], sources: [DOCS.fortigate],
        questions: [
          { d: "INTERMEDIATE", topic: "Design", tech: "SD-WAN", p: "Spoke-to-spoke voice traffic has high latency because it travels through the hub. Which technology addresses this?", a: [["ADVPN shortcuts", "Spokes build direct on-demand tunnels."], ["Adding more firewall policies on the hub", "Policies don't shorten the path."], ["Certificate inspection", "This has no effect on routing."], ["Turning off the performance SLA", "It removes measurement and doesn't change the path."]], c: [0], e: "ADVPN keeps a simple hub-and-spoke control structure while allowing direct paths for data." },
          { d: "ADVANCED", topic: "Sessions", tech: "SD-WAN", p: "An SD-WAN rule's preferred member changes, but a long-lived session stays on the old link. What does this indicate?", a: [["Established sessions can keep their path, because rule selection mainly applies to new sessions unless configured or forced otherwise", "Session stickiness is expected behaviour."], ["The rule failed to install", "The rule may be fine; only this existing session stays put."], ["The session table is corrupted", "This is normal."], ["SD-WAN doesn't support long-lived sessions", "It does."]], c: [0], e: "Check for settings that move sessions, or clear the session during a maintenance window if appropriate." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "Terms", tech: "SD-WAN", p: "Match each item to its layer.", a: [["Broadband circuit from an ISP", "Underlay", "It's physical transport."], ["IPsec tunnel between a branch and the hub", "Overlay", "It runs on top of transport."], ["MPLS service", "Underlay", "It's also transport."]], e: "SD-WAN can steer across overlays while health checks test each path." },
        ],
      },
    ],
  },
  {
    slug: "nse-5-security-operations",
    level: 5,
    track: "SECURITY_OPERATIONS",
    title: "NSE 5: Security Operations",
    summary: "Security monitoring, log analysis and investigation with FortiAnalyzer.",
    overview: "Fortinet lists the FortiAnalyzer Analyst exam for this certification. It describes the scope as deploying, managing and monitoring core security operations products and the day-to-day tasks around them. These modules combine SOC fundamentals with FortiAnalyzer skills.",
    prerequisites: prereq,
    objectives: ["Describe SOC workflows and SIEM concepts", "Analyse logs and correlate events in FortiAnalyzer", "Take an incident from alert to closure"],
    officialExams: ["Fortinet NSE 5 - FortiAnalyzer Analyst"],
    officialPage: "nse_5_security_operations",
    mock: [30, 60],
    target: 300,
    modules: [
      {
        slug: "soc-fundamentals", title: "SOC, SIEM and incident response", summary: "How security operations teams work.", weight: 40,
        objectives: ["Explain SIEM functions", "Apply an incident response workflow", "Measure SOC performance"],
        notes: `### What a SOC does
A SOC collects security telemetry, detects suspicious activity, investigates it and coordinates a response. Tier 1 usually triages, Tier 2 investigates, and senior analysts hunt threats and improve detection, although team designs vary.

### SIEM concepts
A SIEM **collects and normalises** logs from many sources and **correlates** them. An example: repeated authentication failures followed by a success for the same account, then an unusual admin action. No single log proves much, but together they tell a story.

### Incident response
A common lifecycle is **preparation; detection and analysis; containment, eradication and recovery; and post-incident activity**. Don't destroy evidence while containing: isolate a host from the network before wiping it, for example.

### Alert quality
A **false positive** is an alert on benign activity. A **false negative** is a missed attack, which is more dangerous because nobody knows about it. Tune rules by adding context, not by simply muting them. Teams often track **MTTD** and **MTTR**, mean time to detect and to respond.

### Frameworks
MITRE ATT&CK describes attacker tactics and techniques. Mapping detections to it reveals coverage gaps.`,
        concepts: ["Normalisation", "Correlation", "IR lifecycle", "False positive vs false negative", "MTTD and MTTR", "MITRE ATT&CK"], sources: [doc("fortianalyzer")],
        questions: [
          { d: "INTERMEDIATE", topic: "Correlation", tech: "SIEM", p: "Which scenario best shows the value of event correlation?", a: [["Many failed logons, then a success, then a new admin account, linked into one incident", "Individually weak signals become meaningful together."], ["Storing a firewall log for one year", "That's retention."], ["Displaying CPU use on a dashboard", "That's monitoring a single value."], ["Sending a daily report of total log volume", "That's reporting without linking activity."]], c: [0], e: "Correlation finds relationships across time and sources." },
          { type: "ORDERING", d: "INTERMEDIATE", topic: "Response", tech: "Incident response", p: "An analyst confirms an infected workstation. Put the actions in a sound order.", a: [["Validate and scope the alert", "Establish what's actually happening."], ["Isolate the workstation from the network", "Containment stops the spread and preserves evidence."], ["Remove the malware and fix how it entered", "Eradication addresses root cause."], ["Restore the system and monitor it", "Recovery returns it to service."], ["Record lessons learned and update detections", "Post-incident work improves defences."]], e: "Containing before eradicating avoids tipping off the attacker while evidence is lost." },
          { d: "ADVANCED", topic: "Tuning", tech: "SOC operations", p: "A rule generates hundreds of alerts daily from one vulnerability scanner the team runs on purpose. What is the best improvement?", a: [["Add a narrowly scoped exception for the scanner's source and scheduled activity", "It removes known-benign noise while keeping detection elsewhere."], ["Disable the rule for all sources", "This creates false negatives."], ["Stop reviewing alerts from that rule", "Real attacks could be missed."], ["Increase log retention", "This doesn't reduce noise."]], c: [0], e: "Tuning should narrow by context, documented with its owner and an expiry review." },
          { d: "INTERMEDIATE", topic: "Metrics", tech: "SOC operations", p: "Which outcome is usually most dangerous for a SOC?", a: [["A false negative", "A real attack goes undetected."], ["A false positive", "It costs analyst time but is visible."], ["A true negative", "This is benign activity with no alert, which is correct."], ["A true positive that is resolved", "This means the process worked."]], c: [0], e: "Excessive false positives can also create false negatives through alert fatigue, which is why tuning matters." },
        ],
      },
      {
        slug: "fortianalyzer-analyst", title: "FortiAnalyzer analysis", summary: "Logs, event handlers, incidents and reports.", weight: 60,
        objectives: ["Navigate logs and ADOMs", "Use event handlers and incidents", "Build reports for the right audience"],
        notes: `### Log flow
FortiGate and other Fabric devices send logs to FortiAnalyzer after being authorised. **ADOMs** separate devices and data, for example per customer or business unit. Device logs are generally stored in two forms: compressed raw logs in **archive** and indexed logs in the **analytics** database. A **data policy** sets how long each is kept.

### Investigation views
**Log View** finds specific entries with filters. **FortiView** summarises top sources, destinations, threats and applications. Start with a time window and narrow by source, then pivot between hosts, users and destinations.

### Event handlers and incidents
**Event handlers** match logs against conditions and raise **events** in Event Monitor. Analysts can escalate events to **incidents** in FortiSoC, attach evidence and assign owners. Playbooks can automate routine steps, such as enriching data or notifying a team.

### Reports
Reports use **charts**, **datasets** (SQL queries) and **templates**, and can be scheduled. Pick charts for the reader: an executive needs risk trends, and an analyst needs top offending hosts and details.

### Storage matters
Check disk quotas per ADOM. When analytics fills up, older logs are deleted according to policy and investigations may lose data.`,
        concepts: ["ADOM", "Analytics vs archive", "Data policy", "Event handler", "FortiSoC incident", "Dataset"], sources: [doc("fortianalyzer")],
        questions: [
          { d: "ADVANCED", topic: "Retention", tech: "FortiAnalyzer", p: "An analyst can see compressed logs from three months ago but cannot search them quickly in FortiView. What is the most likely explanation?", a: [["The logs have aged out of the analytics store but remain in the archive", "Data policy retains the two stores for different periods."], ["FortiGate deleted the logs", "FortiAnalyzer holds its own copy once received."], ["ADOMs block access to old logs", "ADOMs separate data; they don't enforce age."], ["Reports must be disabled first", "Reports don't block queries."]], c: [0], e: "Fast querying depends on indexed analytics data. Older archive logs can be restored into analytics when needed." },
          { d: "INTERMEDIATE", topic: "Event handlers", tech: "FortiAnalyzer", p: "What does an event handler do?", a: [["Generates an event when logs match its conditions", "That's its purpose."], ["Blocks the traffic on FortiGate directly", "Blocking is not its core function, though a playbook could trigger an action."], ["Compresses logs for archive", "Log storage handles this."], ["Installs firmware", "This is a device administration task."]], c: [0], e: "Event handlers turn raw logs into something analysts can act on." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "Where to look", tech: "FortiAnalyzer", p: "Match each task to the most appropriate feature.", a: [["Find every session for one IP at 09:15", "Log View", "It searches individual log entries."], ["See the top threats this week at a glance", "FortiView", "It summarises activity."], ["Assign and track an investigation", "Incidents", "It holds case work."], ["Send a monthly summary to management", "Reports", "They can be scheduled and delivered."]], e: "Choosing the correct view quickly is a daily analyst skill." },
          { d: "ADVANCED", topic: "Tenancy", tech: "FortiAnalyzer", p: "An MSSP must ensure that each customer's administrator sees only their own logs on one FortiAnalyzer. Which feature should be used?", a: [["ADOMs with administrator profiles scoped to each ADOM", "This separates data and access per tenant."], ["Separate dashboards only", "Dashboards don't enforce access separation."], ["A shared super-admin account", "This defeats separation."], ["Different report colours", "This doesn't restrict access."]], c: [0], e: "Least privilege means tenant admins are limited to their ADOM, and quotas can also be set per ADOM." },
          { type: "MULTIPLE", d: "EXPERT", topic: "Investigation", tech: "FortiAnalyzer", p: "An alert shows one host contacting a known malicious domain. Which two next steps best establish scope? (Choose two.)", a: [["Search DNS and web logs for other hosts contacting the same domain", "This shows how widespread the activity is."], ["Review what else that host did before and after the alert", "A timeline reveals related activity."], ["Delete the alert to reduce noise", "This destroys context without analysis."], ["Immediately reimage every workstation in the company", "This is disproportionate before scoping and destroys evidence."]], c: [0, 1], e: "Scope across hosts and across time before deciding containment." },
        ],
      },
    ],
  },
  {
    slug: "nse-5-sase",
    level: 5,
    track: "SASE",
    title: "NSE 5: SASE",
    summary: "Securing internet and SaaS access with FortiSASE and core SD-WAN.",
    overview: "Fortinet lists one exam here, FortiSASE and SD-WAN Core Administrator, and describes it as covering the design, deployment and management of small and medium SASE infrastructures. Together with an active NSE 4, it earns the certification.",
    prerequisites: prereq,
    objectives: ["Explain SASE and Zero Trust concepts", "Deploy FortiSASE for remote users", "Connect SASE with SD-WAN and private applications"],
    officialExams: ["Fortinet NSE 5 - FortiSASE and SD-WAN Core Administrator"],
    officialPage: "nse_5_sase",
    mock: [30, 60],
    target: 300,
    modules: [
      {
        slug: "sase-concepts", title: "SASE and Zero Trust concepts", summary: "Why security moved to the cloud edge.", weight: 40,
        objectives: ["Define SASE components", "Explain ZTNA vs VPN", "Identify use cases"],
        notes: `### Why SASE
With users and applications outside the old perimeter, backhauling everything to headquarters adds latency and creates a bottleneck. **SASE** combines networking and security as a cloud-delivered service close to users.

### Components
- **Secure Web Gateway (SWG):** protects internet access.
- **CASB:** gives visibility and control over SaaS use.
- **ZTNA:** gives per-application access based on identity and device posture.
- **Firewall as a Service:** provides network firewall controls from the cloud.
- **DLP:** protects sensitive data.

### Zero Trust
Zero Trust means never assuming trust from network location. Verify identity and device, grant the least access necessary, and keep checking. A traditional VPN typically places a user on a network. **ZTNA** connects a user to one specific application, which reduces lateral movement.

### FortiSASE
FortiSASE is Fortinet's cloud-delivered service. Remote users connect through FortiClient (agent), or with a browser-based approach using a SWG configuration. Branches can connect using thin edge devices or Secure SD-WAN. Check current FortiSASE documentation, as features move quickly.`,
        concepts: ["SWG", "CASB", "ZTNA", "Least-privilege access", "Device posture", "PoP"], sources: [DOCS.fortisase],
        questions: [
          { d: "INTERMEDIATE", topic: "ZTNA", tech: "ZTNA", p: "How does ZTNA reduce an attacker's options after a user's device is compromised, compared with a traditional full-network VPN?", a: [["The user gets access only to specific applications, rather than a network", "This limits lateral movement."], ["ZTNA encrypts data while traditional VPNs don't", "VPNs encrypt too."], ["ZTNA removes the need for authentication", "Authentication is central to it."], ["ZTNA disables the compromised endpoint automatically", "This isn't inherent to ZTNA, though posture checks can reduce access."]], c: [0], e: "Scope of access is the key difference, and device posture adds a continuing check." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "Components", tech: "SASE", p: "Match each need to a SASE component.", a: [["Filter malicious web sites for remote users", "Secure Web Gateway", "It protects web traffic."], ["Discover unsanctioned SaaS use", "CASB", "It gives SaaS visibility and control."], ["Give contractors access to one internal app", "ZTNA", "It provides per-application access."], ["Prevent sensitive data from being uploaded", "DLP", "It inspects data for policy violations."]], e: "SASE is a set of functions delivered together, not a single feature." },
          { d: "BEGINNER", topic: "Rationale", tech: "SASE", p: "What problem does SASE most directly address?", a: [["Latency and inconsistent security from backhauling distributed users to a central site", "It delivers security closer to users."], ["The need for physical cabling in offices", "It doesn't remove cabling."], ["Slow CPUs in on-premises firewalls only", "That's not its main purpose."], ["Removing all authentication", "Identity is more important under SASE."]], c: [0], e: "The shift to SaaS and remote work moved traffic away from the traditional perimeter." },
        ],
      },
      {
        slug: "fortisase-admin", title: "FortiSASE administration", summary: "Connecting users, policies and SD-WAN integration.", weight: 60,
        objectives: ["Choose user connection methods", "Configure security policies for users", "Integrate private access"],
        notes: `### Connecting remote users
- **FortiClient agent** provides a tunnel for full traffic steering and gives device information.
- **SWG mode** uses a proxy configuration in the browser, with no tunnel for other applications.

Agent mode generally gives broader coverage because non-web traffic can also be inspected, while SWG suits unmanaged devices that only need web protection.

### Policy
FortiSASE policies combine users or groups, destinations, and security profiles such as web filter and antivirus. As with FortiGate, encrypted traffic needs a suitable inspection profile with a trusted CA for deep inspection.

### Private access
FortiSASE can reach private applications by connecting to a FortiGate SD-WAN hub using overlays (**Secure Private Access**), or through ZTNA connectors. The on-premises side still needs routing and policy for user traffic.

### Identity
Integrate with an identity provider using SAML, so the same groups drive access decisions and users get single sign-on.

### Thin edge and logging
Sites can connect using FortiExtender or FortiAP where available. Logs and dashboards help to identify which user, application and policy were involved, and can be forwarded for central retention.`,
        concepts: ["Agent vs SWG", "Secure Private Access", "SAML identity", "Deep inspection with FortiSASE", "Thin edge"], sources: [DOCS.fortisase],
        questions: [
          { d: "ADVANCED", topic: "Connection method", tech: "FortiSASE", p: "A company needs to protect web access for contractors' unmanaged laptops where it can't install software. Which approach fits best?", a: [["SWG mode with a proxy configuration in the browser", "It protects web traffic without an agent."], ["FortiClient agent with a full tunnel", "This requires installing the agent."], ["A site-to-site tunnel from each laptop", "This isn't a laptop use case."], ["A VIP for each contractor", "A VIP does inbound NAT for servers."]], c: [0], e: "The trade-off is coverage: SWG mode is web-focused and offers less device information." },
          { d: "EXPERT", topic: "Private access", tech: "FortiSASE", p: "Remote FortiSASE users can reach the internet but not an internal application behind an on-premises hub connected through Secure Private Access. Overlays are up. What should be checked next?", a: [["Routing between FortiSASE and the hub, and hub firewall policies permitting the user traffic", "The overlay being up doesn't ensure route exchange or policy."], ["The FortiGuard web filter category of the internal app", "This doesn't apply as a first step for routing to private IP space."], ["The users' browser language", "It's irrelevant."], ["The FortiSwitch PoE status", "It's unrelated."]], c: [0], e: "Same principle as IPsec: tunnels up isn't the same as traffic allowed. Check both routing and policy in both directions." },
          { type: "MULTIPLE", d: "INTERMEDIATE", topic: "Identity", tech: "FortiSASE", p: "Which two benefits come from integrating FortiSASE with a SAML identity provider? (Choose two.)", a: [["Users sign in with their existing identity", "Single sign-on simplifies access."], ["Policies can use the directory's groups", "This enables role-based policies."], ["All SaaS traffic no longer needs inspection", "Identity doesn't remove inspection."], ["Endpoints no longer need patching", "It doesn't affect patching."]], c: [0, 1], e: "Identity integration ties policy to people rather than to IP addresses." },
          { d: "ADVANCED", topic: "Inspection", tech: "FortiSASE", p: "After enabling deep inspection in FortiSASE, managed users see certificate errors. Which action most directly resolves this?", a: [["Distribute the inspection CA certificate to managed endpoints as trusted", "The client must trust the re-signing CA."], ["Change the SSID", "This doesn't affect certificate trust."], ["Disable DNS", "This breaks resolution and doesn't fix trust."], ["Add a static route on each laptop", "Routing doesn't fix certificates."]], c: [0], e: "The certificate logic is the same as on FortiGate, wherever the inspection happens." },
        ],
      },
    ],
  },
  {
    slug: "nse-5-cloud-security",
    level: 5,
    track: "CLOUD_SECURITY",
    title: "NSE 5: Cloud Security",
    summary: "Protecting applications with FortiWeb, FortiAppSec Cloud and FortiADC.",
    overview: "Fortinet focuses this track on application security. It lists FortiWeb, FortiAppSec and FortiADC Administrator exams, and notes that FortiADC was due in Q3 2026 when we checked. You need an active NSE 4 and one exam.",
    prerequisites: prereq,
    objectives: ["Deploy and tune a web application firewall", "Onboard applications to a cloud WAF", "Load balance applications with health checks"],
    officialExams: ["Fortinet NSE 5 - FortiWeb Administrator", "Fortinet NSE 5 - FortiAppSec Administrator", "Fortinet NSE 5 - FortiADC Administrator (Fortinet listed Q3 2026 availability)"],
    officialPage: "nse_5_cloud_security",
    mock: [30, 60],
    target: 300,
    modules: [
      {
        slug: "fortiweb", title: "FortiWeb", summary: "WAF deployment modes and protection.", weight: 40,
        objectives: ["Select a deployment mode", "Build a server policy", "Reduce false positives"],
        notes: `### Why a WAF
A network firewall sees that a request is allowed HTTPS. A **web application firewall** reads the HTTP request and looks for attacks such as SQL injection and cross-site scripting, using signatures, protocol rules and, on FortiWeb, machine learning for anomalies.

### Deployment modes
| Mode | Behaviour |
| --- | --- |
| Reverse proxy | Clients connect to FortiWeb's virtual server. Full feature set, including blocking and traffic rewriting. |
| True transparent proxy | Sits inline without address changes and can block. |
| Transparent inspection | Inline and asynchronous, so it can't always stop the first malicious request. |
| Offline protection | Sees a copy of traffic. Mainly used for detection or learning before a live deployment. |

### Server policy
A **server policy** links a virtual server, a server pool, a protection profile and a certificate if HTTPS is decrypted at FortiWeb.

### Tuning
Run new protections in **alert only** at first, watch for false positives and build exceptions for specific URLs and parameters. Don't turn off a whole signature class because of one false positive. ML needs time and representative traffic to build a model.`,
        concepts: ["Reverse proxy mode", "Offline protection", "Server policy", "Protection profile", "Alert only"], sources: [doc("fortiweb")],
        questions: [
          { d: "INTERMEDIATE", topic: "Deployment", tech: "FortiWeb", p: "A team needs FortiWeb to block attacks reliably and rewrite HTTP headers. Which mode is the best fit?", a: [["Reverse proxy", "It's in the traffic path and supports the fullest feature set."], ["Offline protection", "It sees a copy and can't reliably stop requests."], ["Transparent inspection", "It's asynchronous and may not stop the first request."], ["A SPAN port on the switch", "This describes a copy of the traffic, not a blocking deployment."]], c: [0], e: "Features like rewriting need FortiWeb to act as a full proxy." },
          { d: "ADVANCED", topic: "False positives", tech: "FortiWeb", p: "A signature blocks one valid value in a form parameter on /checkout. What is the best response?", a: [["Add an exception for that signature, URL and parameter", "This narrows the change and retains protection elsewhere."], ["Disable SQL injection protection globally", "This removes protection for the whole application."], ["Remove the server policy", "This leaves the application unprotected or offline."], ["Ask users not to use the form", "This doesn't fix the problem."]], c: [0], e: "Scope exceptions as narrowly as possible, and review them over time." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "Attacks", tech: "Application security", p: "Match each request pattern to the attack it suggests.", a: [["id=1' OR '1'='1", "SQL injection", "It attempts to change query logic."], ["name=<script>alert(1)</script>", "Cross-site scripting", "It injects script into a page."], ["file=../../etc/passwd", "Path traversal", "It tries to escape a directory."]], e: "A WAF examines parameter content that a port-based firewall doesn't interpret." },
        ],
      },
      {
        slug: "fortiappsec", title: "FortiAppSec Cloud", summary: "Cloud-delivered application protection.", weight: 30,
        objectives: ["Onboard an application", "Avoid origin bypass", "Compare with on-premises WAF"],
        notes: `### Service model
FortiAppSec Cloud delivers application security as a SaaS service. You onboard a domain and change DNS, typically with a CNAME record, so traffic goes through the service to your origin.

### The origin bypass problem
If attackers learn your origin server's address, they can go directly to it and skip the WAF. Restrict the origin so that it accepts web traffic only from the service, using its published addresses, or an equivalent control.

### Certificates
For HTTPS inspection, the service needs a certificate for your domain, either one you upload or one it manages, where this option exists.

### Choosing a model
A cloud service reduces infrastructure work and scales without you managing appliances. An on-premises or VM FortiWeb gives more control over network placement and data path, which may matter for internal applications and data residency.

Always check the current FortiAppSec Cloud documentation, since service names and features have changed over time.`,
        concepts: ["CNAME onboarding", "Origin bypass", "Origin allowlist", "SaaS vs self-managed"], sources: [doc("fortiappsec-cloud"), doc("fortiweb")],
        questions: [
          { d: "ADVANCED", topic: "Origin protection", tech: "FortiAppSec Cloud", p: "An application is onboarded behind a cloud WAF, but attackers still reach it directly at its public IP. What should be done?", a: [["Restrict the origin to accept web traffic only from the WAF service", "This closes the bypass."], ["Change the website's logo", "This has no security effect."], ["Lengthen the DNS TTL", "This doesn't stop direct access to the IP."], ["Disable HTTPS on the origin", "This reduces security and doesn't stop the bypass."]], c: [0], e: "Consider also moving to a new origin address, because the old one is already known." },
          { d: "INTERMEDIATE", topic: "Onboarding", tech: "FortiAppSec Cloud", p: "How does traffic usually get directed to a cloud WAF service during onboarding?", a: [["By updating the application's DNS to point to the service", "Clients then resolve to the service."], ["By changing each client's default gateway", "Internet users' gateways can't be changed."], ["By installing FortiClient on all visitors' devices", "This isn't feasible for public visitors."], ["By configuring OSPF with visitors' ISPs", "This isn't how SaaS WAFs are onboarded."]], c: [0], e: "DNS is the common control point, and propagation time should be planned for." },
          { type: "MULTIPLE", d: "ADVANCED", topic: "Decision", tech: "WAF design", p: "Which two factors could favour self-managed FortiWeb over a SaaS WAF? (Choose two.)", a: [["An internal-only application not reachable from the internet", "A public cloud service can't sit in the path without more connectivity."], ["Strict requirements on where decrypted traffic is processed", "Control of the data path may be essential."], ["A wish to avoid managing appliances", "This favours SaaS."], ["Very little security staff", "This generally favours managed services."]], c: [0, 1], e: "Both can be correct designs, depending on data path, operations and application location." },
        ],
      },
      {
        slug: "fortiadc", title: "FortiADC", summary: "Load balancing and application delivery.", weight: 30,
        objectives: ["Build a virtual server and pool", "Choose load-balancing methods", "Use health checks and persistence"],
        notes: `### Core objects
A client connects to a **virtual server**. FortiADC chooses a **real server** from a **pool** using a load-balancing method, after checking its **health**.

### Methods and persistence
- **Round robin:** in turn.
- **Least connections:** the server with the fewest active connections.
- **Fastest response:** a server responding quickly.

**Persistence** keeps a client with one server, for example with a cookie or source address, when the application keeps session state locally. Source-address persistence can overload a single server when many users sit behind one NAT address.

### Health checks
Simple checks like ping show a server is up but not that the application works. An HTTP check looking for an expected response code or string is more accurate.

### SSL offload
Terminating TLS at FortiADC reduces load on servers and makes HTTP inspection and rewriting possible. Re-encrypt to the servers where the network path requires it.

### GSLB
**Global server load balancing** uses DNS to send users to a healthy or nearby data centre.`,
        concepts: ["Virtual server", "Real server pool", "Least connections", "Persistence", "Application health check", "GSLB"], sources: [doc("fortiadc")],
        questions: [
          { d: "ADVANCED", topic: "Health checks", tech: "FortiADC", p: "A server's application crashes but the server still answers ping, and users keep being sent to it. What should be changed?", a: [["Use an HTTP health check that validates an application response", "This detects application failure."], ["Change the load-balancing method to round robin", "The failed server remains in rotation."], ["Disable persistence only", "The failed server could still be selected."], ["Lower the server's IP TTL", "This doesn't test application health."]], c: [0], e: "Test as close to real application behaviour as you reasonably can." },
          { d: "ADVANCED", topic: "Persistence", tech: "FortiADC", p: "Most users of a site are behind one corporate NAT address, and one server receives nearly all traffic. Persistence uses the source IP. What is a better option for this HTTP application?", a: [["Cookie-based persistence", "It identifies individual browsers even when they share an address."], ["Turning off TLS", "This doesn't change the persistence issue."], ["Adding a default route", "This isn't relevant."], ["Using ICMP health checks", "This doesn't affect distribution."]], c: [0], e: "If the application can keep state in a shared store, you may not need persistence at all." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "Features", tech: "FortiADC", p: "Match each requirement to a feature.", a: [["Send users to another data centre if one fails", "GSLB", "DNS-based site selection."], ["Remove TLS processing from web servers", "SSL offload", "The ADC terminates TLS."], ["Prefer the server with the fewest active sessions", "Least connections", "It's a load-balancing method."]], e: "Application delivery combines availability, performance and security features." },
        ],
      },
    ],
  },
];
