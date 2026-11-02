import { DOCS, type SeedPathway } from "./types";

const prereq = ["Active NSE 4 FortiOS certification"];
const doc = (product: string) => `https://docs.fortinet.com/product/${product}`;

export const nse6Pathways: SeedPathway[] = [
  {
    slug: "nse-6-secure-networking",
    level: 6,
    track: "SECURE_NETWORKING",
    title: "NSE 6: Secure Networking",
    summary: "Centrally managing FortiGate estates and controlling network access at scale.",
    overview: "NSE 6 goes deeper than NSE 5 into advanced products. Fortinet lists FortiManager, FortiNAC, FortiVoice and FortiAnalyzer Administrator exams for this track, with the last two marked for Q4 2026 when we checked. You need NSE 4 and one exam.",
    prerequisites: prereq,
    objectives: ["Operate FortiManager across ADOMs and policy packages", "Diagnose install and synchronisation failures", "Use FortiNAC to profile and control devices", "Administer FortiAnalyzer and FortiVoice at a foundational level"],
    officialExams: ["Fortinet NSE 6 - FortiManager Administrator", "Fortinet NSE 6 - FortiNAC Administrator", "Fortinet NSE 6 - FortiVoice Administrator (Fortinet listed Q4 2026)", "Fortinet NSE 6 - FortiAnalyzer Administrator (Fortinet listed Q4 2026)"],
    officialPage: "nse_6_secure_networking",
    mock: [35, 70],
    target: 350,
    modules: [
      {
        slug: "fortimanager", title: "FortiManager", summary: "ADOMs, policy packages, installs and troubleshooting.", weight: 50, version: "FortiManager 7.6",
        objectives: ["Add devices and handle synchronisation", "Use policy packages and ADOM objects", "Troubleshoot import and install failures"],
        notes: `### Connection
FortiGate and FortiManager communicate using **FGFM on TCP 541**. On the FortiGate:
\`\`\`
config system central-management
    set type fortimanager
    set fmg 10.0.0.60
end
\`\`\`
After authorising a device, FortiManager holds a copy of its settings in its **device database**.

### The model
An **ADOM** groups devices of a compatible version and isolates objects. **Policy packages** hold firewall policies that can be installed on many devices. **Dynamic objects and metadata variables** let one package map to different values on each device. Global ADOMs can push shared policies above and below local ones.

### Install flow
Import or retrieve the device's configuration, edit it in FortiManager, preview, then install. Status values to learn:
- **Synchronized:** the two are in step.
- **Modified:** changed on FortiManager, not yet installed.
- **Out of sync / Auto-update:** changed locally on the FortiGate.

Local changes create conflict. Either enable automatic retrieve for them, or retrieve the config before you install, or you may overwrite them.

### Troubleshooting
Before installing, look at the **install preview** and the **install log**. Common failures: an object that exists with conflicting values, an unsupported setting for that firmware, or a loss of FGFM connectivity. An ADOM version mismatch and unassigned interface mappings are also common. For packages, an unmapped **normalized interface** on one device breaks that device's install.

### Workspace mode
Workspace or workflow mode locks objects and records changes to help multiple administrators work safely.`,
        concepts: ["FGFM TCP 541", "Device database", "Policy package", "Normalized interface", "Install preview", "Workspace mode"],
        exercise: "Do the FortiManager integration lab.",
        sources: [DOCS.fortimanager],
        questions: [
          { d: "ADVANCED", topic: "Sync status", tech: "FortiManager", p: "An engineer made an emergency change directly on a FortiGate. FortiManager now shows the device out of sync, and a policy package is awaiting install. What's the safest next step?", a: [["Review the difference, then retrieve the local change into FortiManager before installing", "This avoids overwriting the emergency change."], ["Install the package immediately", "It could overwrite the local change."], ["Delete the device from FortiManager", "This is disruptive and unnecessary."], ["Factory reset the FortiGate", "This causes an outage and loses the configuration."]], c: [0], e: "Treat the local change deliberately: bring it in or reject it knowingly." },
          { d: "EXPERT", topic: "Install failure", tech: "FortiManager", p: "A policy package installs on branch A but fails on branch B with an interface mapping error. Both use the normalized interface \"LAN\". What is the most likely cause?", a: [["\"LAN\" has no per-device mapping for branch B", "The normalized interface must resolve on each device."], ["Branch A has a newer licence", "This doesn't explain the mapping error on B."], ["Policy packages can only target one device", "They can target many."], ["FGFM uses the wrong protocol on B", "Then connectivity would fail, not interface mapping."]], c: [0], e: "Add the mapping for the device, or a default mapping, and preview again." },
          { d: "ADVANCED", topic: "Connectivity", tech: "FortiManager", p: "A FortiGate can't register with FortiManager over a routed path. Which traffic must be allowed?", a: [["TCP 541", "This is FGFM."], ["UDP 5246", "This is CAPWAP."], ["TCP 8000", "This is commonly the FSSO collector port."], ["UDP 4500", "This is NAT-T for IPsec."]], c: [0], e: "Also check central-management settings, and that the FortiManager is reachable from the FortiGate." },
          { type: "MATCHING", d: "ADVANCED", topic: "Objects", tech: "FortiManager", p: "Match each need to the FortiManager feature.", a: [["One rule set used by 50 branches with different LAN subnets", "Policy package with per-device mappings", "This lets a shared policy resolve to local values."], ["Separate customers' devices and objects", "ADOM", "It isolates administrative domains."], ["Apply mandatory corporate rules above each ADOM's rules", "Global policy package", "Global policies are assigned to ADOMs."], ["Stop two administrators editing a policy at once", "Workspace mode", "It uses locking."]], e: "Using these together is what makes large estates manageable." },
          { type: "ORDERING", d: "ADVANCED", topic: "Safe change", tech: "FortiManager", p: "Put these steps in a safe order for a policy change.", a: [["Lock the policy package and edit it", "Workspace avoids conflicting edits."], ["Save and create or review a revision", "This gives a rollback point."], ["Run the install preview", "It shows the actual commands to be pushed."], ["Install to the target devices", "This applies the change."], ["Verify the traffic and install log", "This confirms the result."]], e: "The preview shows what will change on the real device." },
        ],
      },
      {
        slug: "fortinac", title: "FortiNAC", summary: "Visibility, profiling and network access control.", weight: 25,
        objectives: ["Explain how FortiNAC gains visibility", "Use device profiling", "Enforce access with VLANs or policy"],
        notes: `### What NAC solves
You can't secure what you don't know is connected: printers, cameras, IoT sensors and personal devices. FortiNAC discovers devices, profiles them, then controls what they can reach.

### Visibility and profiling
FortiNAC models the network by reading from switches, routers and wireless controllers, using SNMP and CLI methods as well as other sources. **Device profiling rules** use methods like DHCP fingerprinting, vendor OUI and traffic attributes to classify a device, for example as an IP camera.

### Control
Depending on the design, FortiNAC changes network access by moving a port or device to another VLAN, by applying a policy through a FortiGate, or through RADIUS. Typical states are **registered**, **rogue/unknown** and **quarantine**. Isolate unknown devices rather than giving them production access.

### Practical limits
OUI alone is weak and can be spoofed, so combine methods. Testing is important before enforcement: a wrong rule can move critical equipment out of its VLAN. Use a monitor-only phase first.`,
        concepts: ["Device profiling", "DHCP fingerprint", "Rogue host", "VLAN enforcement", "Monitor first"], sources: [doc("fortinac")],
        questions: [
          { d: "ADVANCED", topic: "Rollout", tech: "FortiNAC", p: "A hospital plans to enforce device-based VLANs across all sites next week. Which approach is the least risky?", a: [["Run in visibility mode, validate the profiling results, then enforce in stages", "This avoids moving critical devices by mistake."], ["Enforce everywhere at once to shorten the project", "A profiling error could disrupt clinical systems."], ["Rely on OUI alone for all medical devices", "OUI is weak evidence and may misclassify."], ["Remove all VLANs first", "This removes existing segmentation."]], c: [0], e: "For NAC, an enforcement error is an availability incident." },
          { d: "ADVANCED", topic: "Profiling", tech: "FortiNAC", p: "Why combine profiling methods instead of relying on the MAC vendor prefix?", a: [["A MAC address can be spoofed and a vendor prefix doesn't reveal the device's function", "Multiple attributes increase confidence."], ["MAC addresses change every minute", "They don't normally change this way, though privacy features can randomise them."], ["Vendors don't own OUIs", "OUIs are assigned to vendors."], ["Switches can't report MAC addresses", "They do."]], c: [0], e: "A single PC vendor could make laptops and appliances, and an attacker can copy a printer's MAC." },
          { type: "MULTIPLE", d: "INTERMEDIATE", topic: "Purpose", tech: "FortiNAC", p: "Which two are core functions of FortiNAC? (Choose two.)", a: [["Discovering and profiling connected devices", "This is its visibility function."], ["Controlling network access based on a device's status", "This is its enforcement function."], ["Replacing FortiManager for firmware", "This isn't its role."], ["Scanning email attachments", "That's for email security products."]], c: [0, 1], e: "See, classify and control are the essence of NAC." },
        ],
      },
      {
        slug: "fortivoice-fortianalyzer-admin", title: "FortiVoice and FortiAnalyzer administration", summary: "Voice basics and running FortiAnalyzer as a platform.", weight: 25,
        objectives: ["Explain SIP call flow issues", "Manage FortiAnalyzer storage and HA concepts"],
        notes: `### FortiVoice
FortiVoice is an IP PBX and unified communications platform. It uses SIP for call signalling and RTP for audio. Check connectivity in both: a call that connects with one-way audio often points to NAT or firewall treatment of RTP rather than signalling.

Trunks connect to a carrier, and extensions and dial plans determine routing. Treat voice as a security target: weak extension passwords lead to toll fraud.

### FortiAnalyzer administration
The analyst's view is in NSE 5. As an administrator you size **disk quotas** by ADOM, set **data policies** and watch the **log rate**. If logs arrive faster than the unit can process them, you'll see delays in analytics. Run FortiAnalyzer in HA or forward logs to another system where retention or availability requires it.

Fortinet listed both of these exams as due in Q4 2026 when we checked, so their objectives may change.`,
        concepts: ["SIP vs RTP", "Toll fraud", "Disk quota", "Log rate", "Log forwarding"], sources: [doc("fortivoice"), DOCS.fortianalyzer],
        questions: [
          { d: "ADVANCED", topic: "One-way audio", tech: "FortiVoice", p: "Calls connect but one party can't hear audio. Signalling is working. What should be investigated first?", a: [["NAT and firewall handling of the RTP media path", "Media takes a different path and ports from signalling."], ["The SIP password", "Calls connect, so registration works."], ["The FortiGuard licence", "This doesn't directly cause one-way audio."], ["DNS filter logs for the web", "These aren't the first check here."]], c: [0], e: "SIP signalling and RTP media are distinct flows, which is why signalling success doesn't prove that audio will work." },
          { d: "ADVANCED", topic: "Capacity", tech: "FortiAnalyzer", p: "An administrator sees events from FortiGate appearing in FortiAnalyzer analytics after a long delay. Which should be investigated?", a: [["Log rate compared with the unit's capacity, and disk or insert backlog", "Backlogs show the system is overloaded."], ["The FortiGate's Wi-Fi channel", "This isn't relevant."], ["A missing SD-WAN rule", "This doesn't affect indexing."], ["The colour of the report template", "This has no effect."]], c: [0], e: "Sizing is based on logs per second and retention, which should be checked against the model's published limits." },
        ],
      },
    ],
  },
  {
    slug: "nse-6-security-operations",
    level: 6,
    track: "SECURITY_OPERATIONS",
    title: "NSE 6: Security Operations",
    summary: "Specialist detection and response with FortiSIEM, FortiSOAR, FortiNDR Cloud, FortiRecon and FortiDeceptor.",
    overview: "Fortinet lists five analyst and administrator exams for this track. Each module below prepares you for one product, and you pass one exam, together with an active NSE 4, to earn the certification.",
    prerequisites: prereq,
    objectives: ["Author detection rules in FortiSIEM", "Automate response with FortiSOAR", "Use network detection, deception and external intelligence"],
    officialExams: ["Fortinet NSE 6 - FortiSIEM Analyst", "Fortinet NSE 6 - FortiNDR Cloud Analyst", "Fortinet NSE 6 - FortiSOAR Analyst", "Fortinet NSE 6 - FortiRecon Analyst", "Fortinet NSE 6 - FortiDeceptor Administrator"],
    officialPage: "nse_6_security_operations",
    mock: [35, 70],
    target: 350,
    modules: [
      {
        slug: "fortisiem", title: "FortiSIEM", summary: "Architecture, CMDB and rule logic.", weight: 40,
        objectives: ["Describe the supervisor, worker and collector roles", "Read rule logic", "Use the CMDB to add context"],
        notes: `### Architecture
A **Supervisor** provides the GUI and control. **Workers** process events and queries for scale. **Collectors** gather data from remote sites and forward it. Discovery builds a **CMDB** of devices and applications, which gives events useful context.

### Rules
A rule has one or more **subpatterns**. Each filters events, groups by attributes, and uses an aggregate condition.
\`\`\`
Subpattern: FailedLogons
  Filter:     Event Type IN (Logon failures)
  Group by:   Source IP, User
  Aggregate:  COUNT(Matched Events) >= 10
  Window:     300 seconds
\`\`\`
Grouping decides what is counted together. Grouped by source and user, the rule catches many guesses against one account from one address, but a password spray across many users would not meet it. So you'd group by source and count distinct users to catch spraying.

### Investigating
Analytic searches can pivot from incidents to raw events. Use CMDB context such as device criticality to prioritise them. Rule triggering depends on the **event type classification**: if events aren't parsed correctly, the rule can't match, so check parsers before rewriting logic.`,
        concepts: ["Supervisor, worker, collector", "CMDB", "Subpattern", "Group by and aggregate", "Parser"], sources: [doc("fortisiem")],
        questions: [
          { d: "EXPERT", topic: "Rule logic", tech: "FortiSIEM", p: "This rule misses a password spray in which one source tries one password against 200 users. What change detects it?", x: "Filter: Logon failure\nGroup by: Source IP, User\nAggregate: COUNT(Matched Events) >= 10 in 300s", a: [["Group by Source IP and aggregate on a distinct count of users", "This counts how many accounts one source has tried."], ["Add more users to the Group by clause", "Grouping per user is what splits the count."], ["Increase the count threshold to 100", "It would make detection even harder."], ["Shorten the window with the same grouping", "Each per-user count stays at one."]], c: [0], e: "A spray's signature is breadth, one try per user. The original rule detects depth, many tries on one user." },
          { d: "ADVANCED", topic: "Parsing", tech: "FortiSIEM", p: "A correct-looking rule never triggers for a new firewall's logs, even though raw logs arrive. What should be examined first?", a: [["Whether the parser assigns the event types the rule expects", "Rules match parsed attributes."], ["The Supervisor's wallpaper", "This doesn't matter."], ["CMDB licence count for printers", "This is not the first check."], ["The number of analysts on shift", "This doesn't affect matching."]], c: [0], e: "Check the parsed event's type and fields before changing rule logic." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "Architecture", tech: "FortiSIEM", p: "Match each role.", a: [["Supervisor", "Central GUI and control", "It's the management point."], ["Worker", "Scales event processing and queries", "It adds capacity."], ["Collector", "Gathers logs at remote sites", "It forwards data centrally."]], e: "Sizing often means adding workers and placing collectors close to sources." },
        ],
      },
      {
        slug: "fortisoar", title: "FortiSOAR", summary: "Playbooks, connectors and case handling.", weight: 30,
        objectives: ["Design a safe playbook", "Use connectors and Jinja", "Decide what to automate"],
        notes: `### Automation
FortiSOAR automates security workflows with **playbooks**, made of triggers and steps. **Connectors** integrate with other products, such as a FortiGate or a threat intelligence source. **Jinja** expressions manipulate data between steps.

\`\`\`
{{ vars.input.records[0].sourceIp }}
{{ vars.steps.Get_Reputation.data.score | int }}
\`\`\`

### Designing a safe playbook
Automate reversible, high-confidence steps first, such as enrichment. Keep humans in the loop with a **manual approval step** for impactful actions, like blocking a business-critical address. Handle errors: a failed step shouldn't leave an incident in an ambiguous state.

### Case management
Records for alerts, incidents and indicators track work. **Queues** and **shifts** route tasks to the right team. **War rooms** bring responders together for serious incidents.

### Troubleshooting
Execution history shows each step's input and output. Most failures come from unexpected input data, connector configuration, or a Jinja path that doesn't exist in the record.`,
        concepts: ["Playbook trigger", "Connector", "Jinja", "Manual approval", "Execution history", "War room"], sources: [doc("fortisoar")],
        questions: [
          { d: "ADVANCED", topic: "Automation safety", tech: "FortiSOAR", p: "A playbook blocks any IP with a medium threat score. Last week it blocked a partner's gateway. What is the best change?", a: [["Add an allowlist check and a manual approval step for medium-confidence blocks", "This keeps automation while controlling impact."], ["Delete the playbook and stop automation", "This loses automation's benefit altogether."], ["Block more addresses to compensate", "This increases the risk."], ["Remove logging from the playbook", "This reduces accountability."]], c: [0], e: "Match automation to confidence and impact." },
          { d: "EXPERT", topic: "Debugging", tech: "FortiSOAR", p: "A playbook step fails, and its Jinja expression renders as empty. What is the best first diagnostic?", x: "{{ vars.steps.Lookup.data.results[0].score }}", a: [["Review the Lookup step's output in execution history to see the actual data shape", "The path may not match what the connector returned."], ["Reinstall FortiSOAR", "This is disproportionate."], ["Add more steps after this one", "This doesn't reveal the data issue."], ["Change the playbook's name", "This doesn't matter."]], c: [0], e: "Connectors can return an empty results list or a different structure. Guard against empty data." },
          { type: "ORDERING", d: "ADVANCED", topic: "Playbook", tech: "FortiSOAR", p: "Order the steps of a phishing-response playbook.", a: [["Trigger on a new phishing alert", "This starts the flow."], ["Extract URLs and sender from the message", "These are needed for enrichment."], ["Enrich indicators with threat intelligence", "This determines confidence."], ["Request analyst approval when confidence is not high", "This keeps a human decision for uncertain cases."], ["Block the indicators and update the record", "Action and audit follow the decision."]], e: "Extract, enrich, decide, act and record is a reliable pattern." },
        ],
      },
      {
        slug: "ndr-recon-deception", title: "FortiNDR Cloud, FortiRecon and FortiDeceptor", summary: "Network detection, external intelligence and deception.", weight: 30,
        objectives: ["Explain what each product detects", "Choose a product for a given gap", "Use deception signals"],
        notes: `### FortiNDR Cloud
**Network detection and response** analyses network metadata from sensors to find suspicious behaviour such as command-and-control and lateral movement, useful where endpoint agents can't be deployed. It gives retrospective search over retained metadata.

### FortiRecon
FortiRecon looks **outside** the organisation, with three broad areas: **external attack surface management**, **brand protection** such as lookalike domains, and **adversary-centric intelligence** on threat actors and leaked data.

### FortiDeceptor
**Deception** places decoys and lures that legitimate users have no reason to touch. An interaction is a high-confidence signal. It can also integrate with other Fabric products to quarantine the source. Deception is useful for OT and flat networks where other tooling is difficult, but decoys must look realistic and be placed where attackers will look.

### Comparing them
| Need | Product |
| --- | --- |
| See exposed services and leaked credentials | FortiRecon |
| Detect lateral movement from network behaviour | FortiNDR Cloud |
| High-confidence signal from an intruder inside | FortiDeceptor |`,
        concepts: ["NDR metadata", "EASM", "Brand protection", "Decoy and lure", "High-fidelity alert"], sources: [doc("fortindr-cloud"), doc("fortirecon"), doc("fortideceptor")],
        questions: [
          { d: "INTERMEDIATE", topic: "Deception", tech: "FortiDeceptor", p: "Why is an interaction with a decoy considered a high-confidence alert?", a: [["Legitimate users have no reason to touch it", "So activity is suspicious by design."], ["Decoys run on faster hardware", "This has no relevance."], ["Decoys hold real customer data", "They should not hold real sensitive data."], ["Decoys can't be scanned", "Attackers can scan them, which is the point."]], c: [0], e: "Deception's strength is a low false-positive rate. Authorised scanners should be excluded or expected." },
          { type: "MATCHING", d: "ADVANCED", topic: "Product selection", tech: "Security Operations", p: "Match each gap to a product.", a: [["Employee credentials appear on a leak site", "FortiRecon", "It monitors external sources."], ["Unmanaged OT devices may be beaconing", "FortiNDR Cloud", "It sees network behaviour without agents."], ["You want a tripwire on a file share segment", "FortiDeceptor", "Decoys act as tripwires."]], e: "These tools look in different places, so they complement each other." },
          { d: "ADVANCED", topic: "NDR", tech: "FortiNDR Cloud", p: "Which advantage does network detection have over endpoint detection in a factory with many unmanaged devices?", a: [["It can observe devices that can't run an agent", "Network visibility doesn't require host software."], ["It can always read encrypted payloads", "It often relies on metadata and doesn't decrypt everything."], ["It replaces patching", "It's a detection tool."], ["It requires no network sensors", "Sensors are needed for visibility."]], c: [0], e: "The trade-off is less host-level detail, such as which process produced a connection." },
        ],
      },
    ],
  },
  {
    slug: "nse-6-sase",
    level: 6,
    track: "SASE",
    title: "NSE 6: SASE",
    summary: "Endpoint posture, detection and data protection with FortiClient EMS, FortiEDR and FortiDLP.",
    overview: "On Fortinet's page, this track focuses on endpoint posture enforcement, threat detection and response, and data loss prevention, which is different from the FortiSASE focus of NSE 5. You need NSE 4 and one exam.",
    prerequisites: prereq,
    objectives: ["Manage endpoints and ZTNA tags with EMS", "Operate and tune FortiEDR", "Protect data with FortiDLP"],
    officialExams: ["Fortinet NSE 6 - FortiClient EMS Administrator", "Fortinet NSE 6 - FortiDLP Administrator", "Fortinet NSE 6 - FortiEDR Administrator"],
    officialPage: "nse_6_sase",
    mock: [35, 70],
    target: 350,
    modules: [
      {
        slug: "forticlient-ems", title: "FortiClient EMS", summary: "Endpoint management and ZTNA tags.", weight: 40,
        objectives: ["Deploy FortiClient profiles", "Use ZTNA tags with FortiGate", "Troubleshoot posture-based access"],
        notes: `### Role
**FortiClient EMS** centrally manages FortiClient: it deploys software, assigns **profiles** by group, and gets **telemetry** from each endpoint.

### Tags and ZTNA
EMS evaluates **posture rules** such as OS version or running antivirus, and applies **ZTNA tags**. An **EMS Fabric connector** syncs tags to FortiGate, where policy can use them.

ZTNA access flow:
1. The user's endpoint presents an EMS-issued client certificate to the FortiGate's access proxy.
2. The FortiGate identifies the device and its tags.
3. A rule applies identity, tags and destination, then proxies the connection.

### Common faults
- The FortiGate doesn't trust EMS (check the connector and certificate authorisation).
- The tag isn't synced yet, or the endpoint isn't registered.
- The device certificate is missing or the browser or client doesn't present it.
- A posture rule's condition is correct for most devices but fails on one OS build.

Check what EMS says about the endpoint, and then what the FortiGate says.`,
        concepts: ["Endpoint telemetry", "ZTNA tag", "EMS Fabric connector", "Access proxy", "Client certificate"], sources: [doc("forticlient"), DOCS.fortigate],
        questions: [
          { d: "EXPERT", topic: "ZTNA tags", tech: "FortiClient EMS", p: "A patched laptop is denied by a ZTNA rule requiring the Compliant tag. EMS shows the tag on the endpoint. On the FortiGate the device doesn't have the tag. What should be checked?", a: [["The EMS Fabric connector and tag synchronisation on the FortiGate", "EMS is correct, so the fault lies in passing information to the FortiGate."], ["The laptop's posture rule", "EMS already shows the correct tag."], ["The DNS filter category", "This isn't relevant to a tag decision."], ["The firmware of a FortiSwitch", "This isn't relevant."]], c: [0], e: "Follow the data: endpoint to EMS, EMS to FortiGate, FortiGate to rule. Here the second link is broken." },
          { d: "ADVANCED", topic: "Certificates", tech: "ZTNA", p: "What does the client certificate provide in the ZTNA access flow?", a: [["It identifies the device to the access proxy", "That's how the FortiGate links the session to the endpoint."], ["It replaces the user's identity and all authentication", "User authentication can still be required."], ["It decrypts all web traffic on the device", "It doesn't do this."], ["It gives the device a public IP", "It doesn't."]], c: [0], e: "Device identity and user identity can both feed the access decision." },
          { type: "ORDERING", d: "ADVANCED", topic: "Flow", tech: "ZTNA", p: "Order the events when a managed laptop gains ZTNA access.", a: [["FortiClient reports posture to EMS", "EMS needs data."], ["EMS applies tags and synchronises them to the FortiGate", "The FortiGate gets the context."], ["The endpoint connects to the access proxy and presents its certificate", "This identifies the device."], ["The FortiGate evaluates rule, tags and identity, then proxies the connection", "This produces the access decision."]], e: "Access follows the device's continuing state." },
        ],
      },
      {
        slug: "fortiedr", title: "FortiEDR", summary: "Endpoint detection, response and exception handling.", weight: 30,
        objectives: ["Describe architecture", "Triage security events", "Create safe exceptions"],
        notes: `### Components
**Collectors** run on endpoints. The **Core** analyses activity, the **Aggregator** manages communication and load, and the **Central Manager** provides the console. Threat Hunting searches recorded activity.

### Prevention and simulation
Policies can run in **simulation**, which logs what would be blocked, or **prevention**, which blocks. Start with simulation on a new population, review it and then change to prevention, focusing on the groups with the most risk.

### Triage
Review the event's process chain, which rule fired and the destination. A signed tool used in an unusual way can still be malicious; living-off-the-land attacks rely on this.

### Exceptions
Make exceptions as narrow as possible: tie them to a specific process path, rule and collector group. Don't exclude a broad tool such as PowerShell across the estate because of one business script.

### Response
Playbooks can notify, isolate a device or remediate. Isolate first if the threat is active, and collect the evidence you need.`,
        concepts: ["Collector, Core, Aggregator", "Simulation vs prevention", "Process chain", "Living off the land", "Narrow exception"], sources: [doc("fortiedr")],
        questions: [
          { d: "ADVANCED", topic: "Exceptions", tech: "FortiEDR", p: "A business script run by PowerShell triggers a FortiEDR event daily. What is the best exception?", a: [["An exception limited to the script's specific path and rule on the relevant group", "This leaves PowerShell protection in place elsewhere."], ["Exclude PowerShell everywhere", "Attackers commonly abuse PowerShell."], ["Move all collectors to simulation", "This removes blocking from everyone."], ["Uninstall the collector on that server", "This removes all protection."]], c: [0], e: "Narrow exceptions fix the false positive without creating a blind spot." },
          { d: "INTERMEDIATE", topic: "Modes", tech: "FortiEDR", p: "Why would a team first deploy a new policy in simulation?", a: [["To see what would be blocked before it interrupts users", "This allows tuning."], ["Because simulation blocks more threats", "It doesn't block."], ["Because collectors can't be installed otherwise", "This isn't so."], ["To disable logging", "It logs what would happen."]], c: [0], e: "Don't stay in simulation forever: it provides visibility but not prevention." },
          { d: "EXPERT", topic: "Triage", tech: "FortiEDR", p: "A signed Windows utility downloads a file from an unfamiliar domain and launches it after being started by an Office document. How should an analyst interpret this?", a: [["As suspicious, since the process chain suggests a living-off-the-land technique, regardless of the signature", "The signature proves origin, not intent."], ["As safe, because the utility is signed by Microsoft", "Signed tools are often abused."], ["As a false positive, because Office documents can't launch processes", "They can, especially with macros."], ["As a hardware fault", "This isn't what's indicated."]], c: [0], e: "Context in the chain matters more than a single binary's reputation." },
        ],
      },
      {
        slug: "fortidlp", title: "FortiDLP", summary: "Protecting sensitive data on endpoints.", weight: 30,
        objectives: ["Explain behaviour-based data protection", "Write proportionate policies", "Investigate a data incident"],
        notes: `### Approach
**FortiDLP** uses an endpoint agent to monitor how data moves: uploads, removable media, cloud apps, printing and copy and paste into web apps, including AI tools. Instead of relying only on content patterns, it adds user and data context.

### Policy design
Start by monitoring. Identify sensitive data with labels, content patterns and data origin. Then respond in proportion:
- **Educate:** coach the user at the moment of risk.
- **Warn or require justification:** the user can continue but it is recorded.
- **Block:** for clearly prohibited actions.

### Investigation and privacy
An incident should show the user, data, destination and timeline. Monitoring employees has legal and privacy implications, so involve HR and legal teams. Restrict analyst access, and consider masking identities until an investigation is justified.

### False positives
Regular expressions alone produce false positives: a 16-digit number isn't always a card number. Use validation such as checksums, plus surrounding context.`,
        concepts: ["Data lineage", "Coaching", "Justification", "Pattern validation", "Privacy controls"], sources: [doc("fortidlp")],
        questions: [
          { d: "ADVANCED", topic: "Policy", tech: "FortiDLP", p: "Staff paste customer data into a public AI chatbot. Management wants to reduce this but avoid blocking all productive AI use immediately. Which first step is the most appropriate?", a: [["Monitor and coach users when sensitive data is pasted, then tighten based on evidence", "This changes behaviour and builds evidence with low disruption."], ["Block all websites", "This is disproportionate."], ["Do nothing until a breach occurs", "This accepts a known risk."], ["Publish an email reminder only", "A reminder alone doesn't provide visibility or control."]], c: [0], e: "Policy can be tightened for sensitive categories as you see how people actually use the tools." },
          { d: "INTERMEDIATE", topic: "Detection", tech: "DLP", p: "A rule for 16-digit numbers flags many invoice references as card numbers. What is the best improvement?", a: [["Add checksum validation and nearby context", "This makes matches more precise."], ["Search for any number instead", "This creates more false positives."], ["Remove card detection altogether", "This creates false negatives."], ["Only scan on Fridays", "This reduces coverage and doesn't improve precision."]], c: [0], e: "Valid card numbers pass the Luhn check, while most random references don't." },
          { type: "MULTIPLE", d: "ADVANCED", topic: "Governance", tech: "DLP", p: "Which two practices help keep employee data monitoring proportionate? (Choose two.)", a: [["Restrict who can view user-identifiable investigations", "This limits unnecessary exposure."], ["Involve legal and HR teams when setting policy", "Requirements vary by jurisdiction."], ["Give all employees access to everyone's incidents", "This creates a privacy violation."], ["Record everything forever by default", "Retention should be justified and limited."]], c: [0, 1], e: "Trust in the programme depends on governance as well as technology." },
        ],
      },
    ],
  },
  {
    slug: "nse-6-cloud-security",
    level: 6,
    track: "CLOUD_SECURITY",
    title: "NSE 6: Cloud Security",
    summary: "Cloud-native protection, email security and DDoS defence with FortiCNAPP, FortiMail and FortiDDoS.",
    overview: "Fortinet lists exams for FortiCNAPP, FortiMail and FortiDDoS, plus FortiMail WorkSpace Security, which was marked for Q4 2026 when we checked. You need NSE 4 and one exam.",
    prerequisites: prereq,
    objectives: ["Prioritise cloud risk with FortiCNAPP", "Deploy and tune FortiMail", "Defend services with FortiDDoS"],
    officialExams: ["Fortinet NSE 6 - FortiCNAPP Analyst", "Fortinet NSE 6 - FortiMail Administrator", "Fortinet NSE 6 - FortiDDoS Administrator", "Fortinet NSE 6 - FortiMail WorkSpace Security Administrator (Fortinet listed Q4 2026)"],
    officialPage: "nse_6_cloud_security",
    mock: [35, 70],
    target: 350,
    modules: [
      {
        slug: "forticnapp", title: "FortiCNAPP", summary: "Cloud-native application protection.", weight: 35,
        objectives: ["Explain CNAPP", "Prioritise findings", "Investigate anomalies"],
        notes: `### What a CNAPP does
A **cloud-native application protection platform** brings together posture management (misconfiguration), workload protection, identity risk, and vulnerability and code scanning. FortiCNAPP reads cloud APIs and audit logs, and it can use agents or agentless scanning for workloads.

### Prioritising
Cloud findings can number in the thousands. Prioritise by **attack path**: a critical CVE on an isolated host may matter less than a medium flaw on an internet-exposed VM with an over-privileged role. **Identity** is often the most important part of that path.

### Anomaly detection
FortiCNAPP builds a behavioural baseline of normal activity, and can flag deviations such as a new outbound connection or a role used in an unusual region. Baselines take time to form and need context: a planned migration can look like an attack.

### Compliance
Reports map to frameworks. A pass shows that a control is configured, not that the environment is secure, and failed controls should be prioritised by risk.`,
        concepts: ["CSPM", "CWPP", "CIEM", "Attack path", "Behavioural baseline"], sources: [doc("forticnapp")],
        questions: [
          { d: "EXPERT", topic: "Prioritisation", tech: "FortiCNAPP", p: "Which finding should a team address first?", x: "A: Critical CVE on a VM with no inbound access and no sensitive role\nB: High CVE on an internet-facing VM whose role can read all customer storage\nC: Medium finding on a test bucket containing no data\nD: Low finding on a disabled account", a: [["B", "It combines exposure, an exploitable flaw and a powerful identity leading to sensitive data."], ["A", "Severity alone ignores the lack of exposure and impact."], ["C", "There's little impact here."], ["D", "This poses little risk."]], c: [0], e: "A flaw's score isn't its risk. Reachability and privilege determine what an attacker can actually do." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "CNAPP", tech: "FortiCNAPP", p: "Match each finding to a CNAPP area.", a: [["A storage bucket is publicly readable", "Posture management", "This is a misconfiguration."], ["A container runs an unexpected process", "Workload protection", "This is runtime behaviour."], ["A role has unused admin rights", "Identity entitlement", "This is excessive permission."]], e: "A CNAPP's value is linking these into a single picture of risk." },
          { d: "ADVANCED", topic: "Anomalies", tech: "FortiCNAPP", p: "An alert flags an unusual API call pattern during a scheduled migration. What should the analyst do?", a: [["Check it against the change record and identity, and only then close or escalate it", "Context separates expected change from abuse, and an attacker could hide in a migration."], ["Close all alerts during the migration without checks", "This creates a blind spot."], ["Delete the baseline permanently", "This removes detection."], ["Immediately terminate all VMs", "This is disproportionate."]], c: [0], e: "A change window explains behaviour only if the identity and actions match the plan." },
        ],
      },
      {
        slug: "fortimail", title: "FortiMail", summary: "Email security modes, filtering and authentication.", weight: 35,
        objectives: ["Choose a deployment mode", "Interpret SPF, DKIM and DMARC", "Tune spam and impersonation controls"],
        notes: `### Operating modes
- **Gateway:** sits before a mail server and relays mail; MX points to it.
- **Transparent:** inline and invisible to mail flow addressing.
- **Server:** FortiMail also hosts mailboxes.

### Domain authentication
- **SPF:** which servers may send for a domain.
- **DKIM:** a signature over the message, using the domain's key.
- **DMARC:** what to do when SPF and DKIM fail to align with the visible From domain, and where to send reports.

Passing SPF doesn't prove that the visible From address is genuine unless it aligns with it. That's why DMARC matters.

### Filtering
Session profiles apply to the SMTP connection, such as sender reputation and rate limits. Antispam profiles apply content and reputation checks. Antivirus, sandboxing and content disarm can protect against malicious attachments and URLs. **Impersonation analysis** helps with executive-spoofing attacks.

### Troubleshooting
History logs show what happened to each message and why. If a legitimate sender is blocked, find the specific reason before you add an allowlist entry, since allowlists can also bypass protection.

### FortiMail WorkSpace Security
This product extends protection to collaboration apps. Its exam was marked for Q4 2026 when we checked, so check the official objectives.`,
        concepts: ["Gateway, transparent, server", "SPF, DKIM, DMARC", "Session profile", "History log", "Impersonation analysis"], sources: [doc("fortimail")],
        questions: [
          { d: "ADVANCED", topic: "Authentication", tech: "Email security", p: "A phishing message shows From: ceo@example.com, but SPF passes for bounce.attacker.test. Which control is specifically meant to catch this mismatch?", a: [["DMARC alignment", "It checks that the authenticated domain matches the visible From domain."], ["SPF alone", "SPF passed for a different domain."], ["DNS caching", "This isn't an authentication control."], ["TLS only", "TLS protects transit and doesn't validate the sender's identity."]], c: [0], e: "SPF checks the envelope sender. DMARC ties authentication to what the user actually sees." },
          { d: "INTERMEDIATE", topic: "Deployment", tech: "FortiMail", p: "An organisation wants to keep its Exchange mailboxes and needs FortiMail in front by changing its MX record. Which mode fits?", a: [["Gateway", "It relays inspected mail to the existing server."], ["Server", "This means hosting the mailboxes on FortiMail."], ["FortiLink", "This is a switch management technology."], ["Offline protection", "This is a FortiWeb term."]], c: [0], e: "Remember to restrict direct SMTP to the mail server so attackers can't bypass the gateway." },
          { d: "ADVANCED", topic: "Troubleshooting", tech: "FortiMail", p: "A supplier's invoices are being quarantined. What's the best first step?", a: [["Use the history log to find the specific classifier and reason", "The fix depends on why it was caught."], ["Allowlist the supplier's whole domain immediately", "This could admit compromised-supplier attacks."], ["Disable antispam", "This removes protection for everyone."], ["Ask the supplier to send plain text forever", "This isn't a diagnosis."]], c: [0], e: "Diagnose before you make an exception, and make any exception narrow." },
        ],
      },
      {
        slug: "fortiddos", title: "FortiDDoS", summary: "Behaviour-based DDoS mitigation.", weight: 30,
        objectives: ["Distinguish DDoS types", "Use learning and thresholds", "Understand what on-premises mitigation can't do"],
        notes: `### DDoS types
- **Volumetric:** fills the link.
- **Protocol:** exhausts state, such as a SYN flood.
- **Application:** looks like valid requests but overwhelms an application, such as HTTP floods.

### FortiDDoS approach
FortiDDoS sits inline and builds **behavioural baselines** to set adaptive thresholds, rather than relying only on signatures. **Service Protection Profiles (SPPs)** apply settings to a protected group of services.

### Deployment
Typically you start in **detection mode** to learn traffic, review thresholds and then move to **prevention mode**. Keep baselines updated as business traffic changes. A learning period with an active attack or an unusual peak can create unrealistic thresholds.

### Limits
An on-premises device can't help if the attack fills your internet link before reaching it. Volumetric attacks often need upstream or cloud scrubbing, so a hybrid design is common.`,
        concepts: ["Volumetric, protocol, application", "SYN flood", "SPP", "Adaptive threshold", "Detection then prevention", "Upstream scrubbing"], sources: ["https://docs.fortinet.com/product/fortiddos-be/5.7"],
        questions: [
          { d: "ADVANCED", topic: "Limits", tech: "FortiDDoS", p: "A 10 Gbps internet link is saturated by a 40 Gbps flood, and an on-premises DDoS appliance behind the link is working correctly. What is the main problem?", a: [["The link is full before traffic reaches the appliance, so upstream scrubbing is needed", "On-premises mitigation can't create bandwidth upstream."], ["The appliance needs another SPP", "It can't fix a saturated upstream link."], ["The attack must be application-layer", "A flood of this size points to volumetric."], ["DNS caching should be off", "This doesn't address the link saturation."]], c: [0], e: "A hybrid design pairs local mitigation with an upstream service." },
          { d: "ADVANCED", topic: "Baselines", tech: "FortiDDoS", p: "Why is it risky to set thresholds from a learning period that included an attack?", a: [["Thresholds may be inflated and allow future attacks", "Attack traffic would be treated as normal."], ["The appliance would be unable to reboot", "This isn't related."], ["It would disable HTTPS", "It doesn't do this."], ["It prevents logging", "It doesn't."]], c: [0], e: "Review baselines before moving to prevention mode, and revisit them when traffic changes." },
          { type: "MATCHING", d: "INTERMEDIATE", topic: "Attack types", tech: "DDoS", p: "Match each attack to its type.", a: [["A huge UDP reflection flood fills the WAN link", "Volumetric", "It consumes bandwidth."], ["Half-open TCP connections fill a server's table", "Protocol", "It exhausts connection state."], ["Bots repeatedly request an expensive search page", "Application", "It exhausts application resources."]], e: "The layer attacked determines which control can help." },
        ],
      },
    ],
  },
];
