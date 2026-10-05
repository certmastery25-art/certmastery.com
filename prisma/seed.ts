import { PrismaClient, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

const certifications = [
  {
    slug: "security-plus",
    acronym: "Security+",
    name: "CompTIA Security+",
    examCode: "SY0-701",
    description: "Build practical security knowledge across threats, architecture, operations, and governance.",
    color: "#c84b31",
    domains: [
      { name: "General Security Concepts", objective: "1.0", sortOrder: 1 },
      { name: "Threats, Vulnerabilities & Mitigations", objective: "2.0", sortOrder: 2 },
      { name: "Security Architecture", objective: "3.0", sortOrder: 3 },
      { name: "Security Operations", objective: "4.0", sortOrder: 4 },
      { name: "Security Program Management", objective: "5.0", sortOrder: 5 },
    ],
  },
  {
    slug: "server-plus",
    acronym: "Server+",
    name: "CompTIA Server+",
    examCode: "SK0-005",
    description: "Practice server hardware, administration, troubleshooting, and disaster recovery.",
    color: "#147a72",
    domains: [
      { name: "Server Hardware Installation & Management", objective: "1.0", sortOrder: 1 },
      { name: "Server Administration", objective: "2.0", sortOrder: 2 },
      { name: "Security & Disaster Recovery", objective: "3.0", sortOrder: 3 },
      { name: "Troubleshooting", objective: "4.0", sortOrder: 4 },
    ],
  },
  {
    slug: "ccna",
    acronym: "CCNA",
    name: "Cisco CCNA",
    examCode: "200-301",
    description: "Strengthen your foundations in network access, IP connectivity, services, and security.",
    color: "#2265a5",
    domains: [
      { name: "Network Fundamentals", objective: "1.0", sortOrder: 1 },
      { name: "Network Access", objective: "2.0", sortOrder: 2 },
      { name: "IP Connectivity", objective: "3.0", sortOrder: 3 },
      { name: "IP Services", objective: "4.0", sortOrder: 4 },
      { name: "Security Fundamentals", objective: "5.0", sortOrder: 5 },
      { name: "Automation & Programmability", objective: "6.0", sortOrder: 6 },
    ],
  },
];

const questions = [
  {
    id: "sec-q-01", certification: "security-plus", domain: "Threats, Vulnerabilities & Mitigations", difficulty: Difficulty.MEDIUM,
    prompt: "A security analyst sees repeated failed logins followed by a successful login from an unfamiliar location. Which action should the analyst take FIRST?",
    options: ["A", "Reset the affected account credentials and revoke active sessions", "B", "Delete the identity provider audit logs", "C", "Disable multifactor authentication for the account", "D", "Reimage every workstation in the organization"], correct: "A",
    explanation: "The pattern suggests a possible account compromise. Contain access by resetting credentials and revoking sessions, then investigate the sign-in trail and scope. Preserve logs as evidence; broad reimaging is not justified by this signal alone.",
  },
  {
    id: "sec-q-02", certification: "security-plus", domain: "General Security Concepts", difficulty: Difficulty.EASY,
    prompt: "Which security control is designed primarily to discourage unauthorized physical access through a visible presence?",
    options: ["A", "Tokenization", "B", "A guard stationed at the entrance", "C", "Database normalization", "D", "Data masking"], correct: "B",
    explanation: "A visible guard is a deterrent physical control: its presence is intended to discourage an attempted intrusion. The other choices relate to data processing or database design, not physical access deterrence.",
  },
  {
    id: "sec-q-03", certification: "security-plus", domain: "Security Architecture", difficulty: Difficulty.HARD,
    prompt: "A company needs to let a partner query a narrow set of customer records without exposing its internal network. Which design BEST supports least privilege?",
    options: ["A", "A public API gateway that validates scoped tokens and brokers requests to an isolated service", "B", "A shared VPN account with access to the entire application subnet", "C", "A database replica reachable from the public internet", "D", "An administrator account embedded in the partner application"], correct: "A",
    explanation: "An API gateway with scoped authorization and an isolated backend limits the partner to explicitly permitted operations. A broad VPN, public database, or embedded administrator credential violates least privilege and increases exposure.",
  },
  {
    id: "srv-q-01", certification: "server-plus", domain: "Server Hardware Installation & Management", difficulty: Difficulty.MEDIUM,
    prompt: "A server has two power supplies connected to the same UPS. What change most directly improves power-path redundancy?",
    options: ["A", "Connect both supplies to separate outlets on the same PDU", "B", "Connect each supply to an independent power source or PDU", "C", "Increase the server's memory allocation", "D", "Disable one power supply in firmware"], correct: "B",
    explanation: "Redundant power supplies protect against a failed source only when their paths are independent. Connecting each supply to a separate power source or PDU reduces the risk of a single upstream failure taking both supplies offline.",
  },
  {
    id: "srv-q-02", certification: "server-plus", domain: "Server Administration", difficulty: Difficulty.EASY,
    prompt: "Which service commonly assigns IP addresses and related network configuration to servers and clients?",
    options: ["A", "NTP", "B", "DHCP", "C", "SNMP trap receiver", "D", "SMTP relay"], correct: "B",
    explanation: "DHCP leases IP configuration such as addresses, subnet masks, gateways, and DNS servers. NTP synchronizes clocks, SNMP supports monitoring, and SMTP relays email.",
  },
  {
    id: "srv-q-03", certification: "server-plus", domain: "Troubleshooting", difficulty: Difficulty.HARD,
    prompt: "A storage array reports rising latency while controller CPU and network utilization remain low. Which evidence should be checked NEXT?",
    options: ["A", "Disk queue depth and drive health metrics", "B", "The web server's TLS certificate chain", "C", "The DHCP lease duration", "D", "The switch's PoE budget"], correct: "A",
    explanation: "Low controller and network utilization with rising storage latency points toward the disk subsystem. Queue depth and drive health help distinguish contention from failing media before making changes.",
  },
  {
    id: "ccna-q-01", certification: "ccna", domain: "IP Connectivity", difficulty: Difficulty.MEDIUM,
    prompt: "A router has two routes to the same prefix: one learned through OSPF and one configured as a static route. Which factor is considered first when both routes are otherwise eligible?",
    options: ["A", "The lower administrative distance", "B", "The higher interface bandwidth", "C", "The route with the longer next-hop address", "D", "The number of hops in the Ethernet path"], correct: "A",
    explanation: "Administrative distance is used to select between route sources for the same prefix. A lower value is preferred. Metrics such as OSPF cost compare paths within the same routing protocol after route-source selection.",
  },
  {
    id: "ccna-q-02", certification: "ccna", domain: "Network Access", difficulty: Difficulty.EASY,
    prompt: "Which switch feature carries traffic for multiple VLANs across a single link between switches?",
    options: ["A", "Access port", "B", "Trunk port", "C", "SPAN destination", "D", "Routed loopback"], correct: "B",
    explanation: "A trunk link carries frames for multiple VLANs, typically using 802.1Q tags. An access port normally belongs to a single VLAN.",
  },
  {
    id: "ccna-q-03", certification: "ccna", domain: "IP Services", difficulty: Difficulty.HARD,
    prompt: "A network uses PAT for outbound IPv4 connections. How does PAT allow many inside hosts to share one public IPv4 address?",
    options: ["A", "It maps each host to a different public subnet", "B", "It distinguishes flows by translating transport-layer port numbers", "C", "It replaces IPv4 with IPv6 at the edge", "D", "It assigns a unique MAC address to each session"], correct: "B",
    explanation: "Port Address Translation differentiates concurrent sessions by mapping inside address-and-port tuples to unique translated port numbers on a shared public address. It does not create additional public subnets or change MAC addresses.",
  },
];

type AdditionalQuestion = [string, Difficulty, string, string, string, string, string, string];

function buildAdditionalQuestions(prefix: string, certification: string, entries: AdditionalQuestion[]) {
  return entries.map(([domain, difficulty, prompt, correct, distractorOne, distractorTwo, distractorThree, explanation], index) => {
    const correctIndex = index % 4;
    const choices = [correct, distractorOne, distractorTwo, distractorThree];
    const orderedChoices = choices.map((choice, choiceIndex) => choices[(choiceIndex - correctIndex + 4) % 4]);
    const correctLabel = ["A", "B", "C", "D"][correctIndex];
    return {
      id: `${prefix}-q-${String(index + 4).padStart(2, "0")}`,
      certification,
      domain,
      difficulty,
      prompt,
      options: ["A", orderedChoices[0], "B", orderedChoices[1], "C", orderedChoices[2], "D", orderedChoices[3]],
      correct: correctLabel,
      explanation,
    };
  });
}

const additionalQuestions = [
  ...buildAdditionalQuestions("sec", "security-plus", [
    ["General Security Concepts", Difficulty.EASY, "Which principle gives a subject only the permissions required to complete an assigned task?", "Least privilege", "Defense in depth", "Open access", "Job rotation", "Least privilege limits permissions to what a task requires, reducing the impact of misuse or compromise."],
    ["General Security Concepts", Difficulty.MEDIUM, "Which security property ensures a message was not changed while in transit?", "Integrity", "Availability", "Confidentiality", "Non-repudiation", "Integrity protects data from unauthorized alteration. Hashes and digital signatures can help detect changes."],
    ["General Security Concepts", Difficulty.EASY, "What is the primary purpose of multifactor authentication?", "Require two or more independent authentication factors", "Encrypt every file on a device", "Replace authorization with accounting", "Block all remote access", "MFA combines independent factors such as a password and a hardware token, reducing reliance on one compromised credential."],
    ["General Security Concepts", Difficulty.MEDIUM, "Which control type is a written policy requiring annual security awareness training?", "Administrative", "Physical", "Technical", "Environmental", "Policies and training are administrative controls because they govern people and processes."],
    ["General Security Concepts", Difficulty.EASY, "Which item is something a user possesses in an authentication flow?", "A smart card", "A memorized PIN", "A fingerprint", "A security question answer", "A smart card is a possession factor. A PIN and answer are knowledge factors, while a fingerprint is inherence."],
    ["General Security Concepts", Difficulty.MEDIUM, "What does non-repudiation help prove?", "That a party cannot credibly deny performing an action", "That a system can survive a power outage", "That a password is sufficiently complex", "That traffic is always encrypted", "Digital signatures and audit records can support non-repudiation by linking an action to its originator."],
    ["General Security Concepts", Difficulty.EASY, "Which cryptographic approach uses the same secret key to encrypt and decrypt data?", "Symmetric encryption", "Asymmetric encryption", "Hashing", "Tokenization", "Symmetric encryption uses a shared secret key and is generally efficient for bulk data."],
    ["General Security Concepts", Difficulty.MEDIUM, "A company separates a sensitive payment network from office workstations. Which concept is this?", "Segmentation", "Aggregation", "Normalization", "Repudiation", "Segmentation limits communication paths and helps contain a compromise between trust zones."],
    ["General Security Concepts", Difficulty.MEDIUM, "What is the main security purpose of salting passwords before hashing?", "Make identical passwords produce different hashes", "Allow passwords to be decrypted", "Reduce password length", "Move password storage into logs", "A unique salt defeats precomputed rainbow tables and prevents identical passwords from sharing a stored hash."],
    ["General Security Concepts", Difficulty.HARD, "Which statement best describes a zero trust architecture?", "Every access request is explicitly verified and continuously evaluated", "All internal traffic is trusted after VPN login", "Only internet traffic requires authentication", "Users receive permanent network access after enrollment", "Zero trust removes implicit trust and evaluates identity, device, context, and authorization for each request."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.EASY, "A fake invoice email directs an employee to a lookalike login page. What attack is this?", "Phishing", "Tailgating", "Baiting with removable media", "Shoulder surfing", "Phishing uses deceptive messages to trick victims into revealing information or taking an unsafe action."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.MEDIUM, "An attacker places a malicious script in a comment that executes in other users' browsers. What vulnerability is involved?", "Cross-site scripting", "SQL injection", "Buffer overflow", "Directory traversal", "Cross-site scripting injects active content into pages viewed by other users."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.HARD, "An application builds a database query by concatenating untrusted input. What is the strongest mitigation?", "Use parameterized queries", "Increase the database server memory", "Hide the database hostname", "Disable all database indexes", "Parameterized queries keep data separate from SQL instructions and prevent input from changing query structure."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.MEDIUM, "Which attack attempts to exhaust a service by sending more requests than it can handle?", "Denial of service", "Credential stuffing", "Pass-the-hash", "Evil twin", "A denial-of-service attack targets availability by exhausting bandwidth, compute, connections, or another service resource."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.EASY, "What is credential stuffing?", "Trying reused username and password pairs from another breach", "Guessing every possible password combination", "Stealing a server's encryption key", "Redirecting traffic through a proxy", "Credential stuffing exploits password reuse by automating known username and password pairs against another service."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.MEDIUM, "Which malware type encrypts files and demands payment for recovery?", "Ransomware", "Spyware", "Rootkit", "Worm", "Ransomware denies access to data, commonly through encryption, and demands payment from the victim."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.MEDIUM, "A vulnerability is actively exploited before a vendor has released a patch. How is it classified?", "Zero-day", "Legacy", "False positive", "Known issue", "A zero-day is unknown or unpatched to the defender when exploitation occurs, leaving no vendor fix available at that time."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.HARD, "Which assessment uses simulated attacks to identify exploitable weaknesses?", "Penetration test", "Vulnerability scan only", "Compliance checklist", "Asset inventory", "A penetration test safely attempts exploitation to validate whether vulnerabilities can be used and what impact they have."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.MEDIUM, "What does a vulnerability scanner typically report?", "Potential weaknesses identified from signatures and checks", "Guaranteed successful exploits against every host", "A complete incident timeline", "The identity of every attacker", "Scanners identify likely weaknesses, but findings require validation and do not guarantee exploitability."],
    ["Threats, Vulnerabilities & Mitigations", Difficulty.HARD, "Which mitigation most directly reduces risk from a vulnerable public web server while a patch is unavailable?", "Place a tuned web application firewall in front of it and restrict exposure", "Publish the server address in documentation", "Disable log collection", "Give the server broader network access", "A WAF and reduced exposure provide compensating controls while the organization plans and tests the permanent patch."],
    ["Security Architecture", Difficulty.MEDIUM, "Which cloud model provides a provider-managed application delivered over the internet?", "Software as a service", "Infrastructure as a service", "Platform as a service", "Colocation", "SaaS delivers a complete application, while IaaS provides infrastructure and PaaS provides an application platform."],
    ["Security Architecture", Difficulty.EASY, "What is the purpose of a DMZ?", "Host public-facing services in an isolated network zone", "Store only offline backups", "Replace endpoint antivirus", "Provide unrestricted access to internal systems", "A DMZ reduces exposure by placing internet-facing services between external and trusted internal networks."],
    ["Security Architecture", Difficulty.MEDIUM, "Which design uses multiple independent controls so one failure does not expose the whole environment?", "Defense in depth", "Single sign-on", "Data minimization", "Risk acceptance", "Defense in depth layers preventive, detective, and corrective controls across different points of the system."],
    ["Security Architecture", Difficulty.HARD, "A service account should access one database table but not the rest of the database. Which authorization model best fits?", "Fine-grained role-based access with a narrowly scoped role", "A global administrator role", "Anonymous access", "A shared root credential", "A narrowly scoped role applies least privilege at the table or object level without granting unrelated administrative rights."],
    ["Security Architecture", Difficulty.MEDIUM, "Which technology creates an encrypted tunnel between a remote user and a private network?", "VPN", "NAT", "DNS", "DHCP", "A VPN provides an authenticated, encrypted tunnel over an untrusted network. NAT and the other choices do not provide that tunnel."],
    ["Security Architecture", Difficulty.EASY, "What is the purpose of a hardware security module?", "Protect and perform operations with cryptographic keys", "Balance web traffic", "Scan email attachments", "Assign IP addresses", "An HSM is designed to generate, store, and use cryptographic keys in a protected hardware boundary."],
    ["Security Architecture", Difficulty.HARD, "Which approach best protects sensitive data stored in a database from a stolen disk?", "Encrypt the data at rest and protect the key separately", "Only rename the database file", "Disable database auditing", "Store the key in the same plaintext table", "Encryption at rest protects data on stolen media, but the key must be managed separately to preserve the security boundary."],
    ["Security Architecture", Difficulty.MEDIUM, "What is a major benefit of microservices network policies?", "They limit service-to-service communication to explicitly allowed paths", "They eliminate the need for authentication", "They force all services onto one host", "They make backups unnecessary", "Network policies reduce lateral movement by allowing only required service communication."],
    ["Security Architecture", Difficulty.MEDIUM, "Which recovery site is generally ready with systems and current data for rapid failover?", "Hot site", "Cold site", "Archive site", "Development site", "A hot site is provisioned and synchronized for quick recovery; a cold site requires substantial setup before use."],
    ["Security Operations", Difficulty.MEDIUM, "Which log source is most useful for investigating repeated authentication failures?", "Identity provider and authentication logs", "Printer toner logs", "CPU temperature alone", "Marketing analytics", "Authentication logs contain usernames, source context, timestamps, and failure reasons needed to investigate sign-in abuse."],
    ["Security Operations", Difficulty.EASY, "What is the first phase of a standard incident response process after preparation?", "Detection and analysis", "Lessons learned", "System disposal", "Contract renewal", "After preparation, responders detect and analyze activity to determine whether an incident is occurring and its scope."],
    ["Security Operations", Difficulty.MEDIUM, "Why should an incident responder preserve a chain of custody?", "To document who handled evidence and how it was protected", "To improve Wi-Fi speed", "To rotate user passwords automatically", "To reduce storage costs", "Chain-of-custody records support evidence integrity and demonstrate that it was handled appropriately."],
    ["Security Operations", Difficulty.HARD, "Which action best contains a confirmed compromised workstation while preserving evidence?", "Isolate it from the network and document the action", "Immediately wipe it without collecting data", "Connect it to more production systems", "Disable all organization-wide logging", "Network isolation limits spread while documentation and preservation support later analysis."],
    ["Security Operations", Difficulty.MEDIUM, "What does a SIEM primarily provide?", "Centralized security event collection, correlation, and analysis", "Physical door access only", "Database schema migration", "Endpoint hardware replacement", "A SIEM aggregates and correlates events from many sources to support detection, investigation, and reporting."],
    ["Security Operations", Difficulty.EASY, "Which backup type copies all selected data each time it runs?", "Full backup", "Incremental backup", "Differential backup", "Snapshot pointer only", "A full backup copies the complete selected dataset. Incremental and differential backups copy subsets based on prior backups."],
    ["Security Operations", Difficulty.MEDIUM, "What is the purpose of endpoint detection and response tooling?", "Detect suspicious endpoint activity and support investigation and response", "Replace network routing", "Issue public certificates", "Manage physical inventory only", "EDR collects endpoint telemetry and provides detection, investigation, containment, and response capabilities."],
    ["Security Operations", Difficulty.HARD, "An analyst needs to inspect a suspicious file without allowing it to affect production. What should be used?", "An isolated sandbox", "A production file share", "A public chat room", "A domain controller", "A sandbox isolates execution and observation from production systems while analysts assess behavior."],
    ["Security Operations", Difficulty.MEDIUM, "Which control helps ensure system clocks support accurate event correlation?", "Network time synchronization", "A larger monitor", "A static web page", "A password hint", "Consistent time synchronization lets analysts align events from different systems during investigations."],
    ["Security Operations", Difficulty.EASY, "What is the main purpose of secure configuration baselines?", "Define an approved minimum security configuration", "Guarantee zero vulnerabilities", "Replace all monitoring", "Allow every service by default", "A baseline gives administrators a documented secure starting point and a standard against which drift can be measured."],
    ["Security Program Management", Difficulty.MEDIUM, "What does a risk register record?", "Identified risks, owners, likelihood, impact, and treatment plans", "Only completed help desk tickets", "Employee vacation schedules", "The encryption key for every system", "A risk register tracks risks and decisions so owners can monitor treatment and residual exposure."],
    ["Security Program Management", Difficulty.EASY, "Which policy describes how an organization handles company-owned computing resources?", "Acceptable use policy", "Change control ticket", "Network topology", "Incident artifact", "An acceptable use policy defines permitted and prohibited behavior for organizational technology."],
    ["Security Program Management", Difficulty.MEDIUM, "What is a vendor risk assessment intended to evaluate?", "The security risk introduced by a third party", "The vendor's office furniture", "The color of a vendor logo", "The number of vendor meetings", "Vendor assessments examine controls, data handling, access, resilience, and other risks introduced by the relationship."],
    ["Security Program Management", Difficulty.HARD, "Which metric best demonstrates whether a patching program is improving?", "The percentage of critical vulnerabilities remediated within the target time", "The number of security posters printed", "The number of unused licenses", "The length of the security policy", "A time-bound remediation percentage measures whether the program reduces meaningful exposure."],
    ["Security Program Management", Difficulty.MEDIUM, "What is the purpose of a business impact analysis?", "Identify critical processes and the effect of their disruption", "Select a password manager", "Configure a firewall rule", "Classify every email as spam", "A BIA identifies critical functions, dependencies, impacts, and recovery priorities."],
    ["Security Program Management", Difficulty.EASY, "Which document defines the order and strategy for restoring IT services after a major disruption?", "Disaster recovery plan", "Password policy", "Code style guide", "Procurement catalog", "A disaster recovery plan coordinates technical recovery activities and priorities after a disruptive event."],
    ["Security Program Management", Difficulty.MEDIUM, "What is the purpose of security awareness training?", "Reduce unsafe user behavior and improve recognition of threats", "Guarantee that malware cannot run", "Replace access control systems", "Eliminate the need for policies", "Training helps users recognize social engineering, report issues, and follow required security practices."],
    ["Security Program Management", Difficulty.HARD, "Which activity best validates that an incident response plan works under realistic conditions?", "A documented tabletop or technical exercise with follow-up actions", "Reading the plan once without recording findings", "Deleting old incident records", "Waiting for a real breach to reveal gaps", "Exercises test roles, communications, dependencies, and decision points before a real incident, and the findings should become tracked improvements."],
  ]),
  ...buildAdditionalQuestions("srv", "server-plus", [
    ["Server Hardware Installation & Management", Difficulty.EASY, "Which component temporarily stores data and instructions actively used by a server?", "RAM", "Power supply", "Rack rail", "Chassis fan", "RAM provides fast volatile working storage for active processes."],
    ["Server Hardware Installation & Management", Difficulty.MEDIUM, "Which RAID level mirrors data across two disks?", "RAID 1", "RAID 0", "RAID 5", "RAID 6", "RAID 1 duplicates data on mirrored disks, providing redundancy but no capacity efficiency."],
    ["Server Hardware Installation & Management", Difficulty.HARD, "Which RAID level commonly uses distributed parity and can tolerate one disk failure?", "RAID 5", "RAID 0", "RAID 1", "RAID 10 only", "RAID 5 distributes parity and data across disks and can tolerate one failed member, subject to rebuild risk."],
    ["Server Hardware Installation & Management", Difficulty.MEDIUM, "What is the purpose of ECC memory?", "Detect and correct certain memory errors", "Increase network bandwidth", "Provide disk encryption", "Route traffic between VLANs", "ECC adds error-checking information and can correct certain single-bit memory errors."],
    ["Server Hardware Installation & Management", Difficulty.EASY, "Which form factor is commonly used for servers installed in a rack?", "Rack unit", "Desktop tower only", "SO-DIMM", "PCIe lane", "Rack servers are specified by rack-unit height, such as 1U or 2U."],
    ["Server Hardware Installation & Management", Difficulty.MEDIUM, "What is the primary role of a server's BMC or remote management controller?", "Provide out-of-band hardware monitoring and management", "Compile application source code", "Act as the only DNS server", "Store user passwords in plaintext", "A BMC can provide remote console, power, sensor, and firmware management independent of the host OS."],
    ["Server Hardware Installation & Management", Difficulty.HARD, "A server's storage controller has a battery-backed write cache. What benefit does it provide?", "It safely acknowledges writes before they reach disks during normal operation", "It replaces all backups", "It doubles CPU clock speed", "It prevents every disk failure", "Protected write cache can improve write performance while preserving pending data during a power interruption."],
    ["Server Hardware Installation & Management", Difficulty.MEDIUM, "Which connector is designed for high-speed server storage and supports SAS drives?", "Mini-SAS", "VGA", "RJ-11", "USB-A only", "Mini-SAS connectors provide high-speed storage connectivity for SAS backplanes and controllers."],
    ["Server Hardware Installation & Management", Difficulty.EASY, "Why should airflow direction be planned when installing rack servers?", "To prevent hot exhaust air from being recirculated into intakes", "To increase disk capacity", "To bypass authentication", "To remove the need for monitoring", "Correct hot-aisle and cold-aisle airflow keeps intake temperatures within operating limits."],
    ["Server Hardware Installation & Management", Difficulty.MEDIUM, "What does hot-swappable hardware allow an administrator to do?", "Replace supported components while the system remains running", "Install any component without compatibility checks", "Skip all maintenance windows forever", "Change a CPU architecture without rebooting", "Hot-swap support permits replacement of designed components, such as drives or power supplies, during operation."],
    ["Server Hardware Installation & Management", Difficulty.HARD, "Which storage technology generally provides the lowest latency for local server workloads?", "NVMe SSD", "Tape", "5400 RPM hard disk", "Optical disc", "NVMe SSDs use PCIe and a protocol designed for flash storage, typically providing lower latency than spinning or removable media."],
    ["Server Hardware Installation & Management", Difficulty.MEDIUM, "What should be verified before adding a memory module to a production server?", "Supported type, capacity, speed, and population rules", "Only the color of the heat spreader", "Whether the monitor is powered on", "The email retention period", "Compatibility and population rules prevent instability and ensure the server recognizes the intended capacity."],
    ["Server Administration", Difficulty.EASY, "Which protocol securely provides command-line administration over a network?", "SSH", "Telnet", "FTP", "TFTP", "SSH encrypts remote command-line sessions. Telnet and the basic file transfer protocols do not provide equivalent protection."],
    ["Server Administration", Difficulty.MEDIUM, "Which service resolves hostnames to IP addresses?", "DNS", "DHCP", "NTP", "LDAP only", "DNS translates names to IP addresses and can provide other naming records."],
    ["Server Administration", Difficulty.EASY, "Which protocol synchronizes system clocks?", "NTP", "SMTP", "SNMP", "IMAP", "NTP synchronizes clocks, which is important for authentication, logs, and distributed systems."],
    ["Server Administration", Difficulty.MEDIUM, "What is the purpose of a directory service such as LDAP?", "Centralize identity, resource, and organizational information", "Compress server logs", "Provide disk parity", "Monitor CPU temperature only", "Directory services provide a structured store for identities, groups, and related access information."],
    ["Server Administration", Difficulty.HARD, "Which change is safest before modifying a production service configuration?", "Test the change, document it, and schedule an approved change window", "Edit the file without a backup", "Disable monitoring during the change", "Apply the same change to every server immediately", "Testing, documentation, approval, and rollback planning reduce service and configuration risk."],
    ["Server Administration", Difficulty.MEDIUM, "What is a hypervisor responsible for?", "Managing virtual machines and sharing physical resources", "Filtering all email spam", "Replacing a backup catalog", "Providing domain names to clients", "A hypervisor abstracts CPU, memory, storage, and networking resources for virtual machines."],
    ["Server Administration", Difficulty.EASY, "What does a service manager do on an operating system?", "Start, stop, and monitor background services", "Partition every disk automatically", "Encrypt all network traffic", "Assign public IP addresses", "Service managers control the lifecycle and status of operating-system services."],
    ["Server Administration", Difficulty.MEDIUM, "Which practice limits an administrator's exposure to privileged credentials?", "Use separate standard and administrative accounts", "Share one root password among the team", "Put passwords in source code", "Disable audit logging", "Separate accounts reduce accidental privileged actions and make administrative activity easier to audit."],
    ["Server Administration", Difficulty.HARD, "What is the main purpose of configuration management?", "Maintain consistent, documented, and repeatable system state", "Replace physical security", "Guarantee that bugs cannot exist", "Remove the need for testing", "Configuration management reduces drift and makes approved infrastructure changes reproducible."],
    ["Server Administration", Difficulty.MEDIUM, "Which technology packages an application and its dependencies into an isolated unit?", "Container", "RAID array", "Firmware image", "Rack enclosure", "Containers package application dependencies while sharing a host kernel, making deployment more consistent."],
    ["Server Administration", Difficulty.EASY, "What does a server's default gateway provide?", "A next hop for traffic leaving the local subnet", "A local disk mirror", "A user directory", "A certificate authority", "The default gateway forwards traffic destined for networks outside the local subnet."],
    ["Server Administration", Difficulty.MEDIUM, "Which record type identifies a mail server for a domain?", "MX", "A", "PTR", "TXT only", "An MX record identifies mail exchange hosts responsible for receiving email for a domain."],
    ["Server Administration", Difficulty.HARD, "Why should administrative interfaces be placed on a management network?", "To limit management access to authorized paths separate from client traffic", "To make the interfaces publicly searchable", "To avoid applying patches", "To disable access logging", "A management network reduces exposure and allows stronger access controls around administrative protocols."],
    ["Security & Disaster Recovery", Difficulty.MEDIUM, "What does a recovery point objective define?", "The maximum acceptable amount of data loss measured in time", "How long a server may remain offline", "The number of recovery staff", "The maximum password age", "RPO expresses how much recent data the organization can afford to lose."],
    ["Security & Disaster Recovery", Difficulty.MEDIUM, "What does a recovery time objective define?", "The target time to restore a service after disruption", "The amount of data stored per disk", "The number of backup copies", "The time needed to rotate a password", "RTO expresses how quickly a service should be restored after an outage."],
    ["Security & Disaster Recovery", Difficulty.EASY, "Which backup should be stored away from the primary server room?", "An off-site backup", "A temporary cache", "A local page file", "A monitoring dashboard", "Off-site backups protect recovery data from a local fire, flood, or other site-wide event."],
    ["Security & Disaster Recovery", Difficulty.HARD, "Which control best protects backups from ransomware that compromises server credentials?", "Immutable or offline backups with separate administrative access", "Mount every backup read-write to production", "Use the same administrator password everywhere", "Disable backup verification", "Immutable or offline copies create a recovery point that malware cannot easily alter or encrypt."],
    ["Security & Disaster Recovery", Difficulty.MEDIUM, "Why should a disaster recovery plan be tested periodically?", "To verify procedures, dependencies, contacts, and recovery targets", "To eliminate the need for backups", "To guarantee no outage will occur", "To reduce the number of administrators", "Testing reveals stale procedures and unmet dependencies before a real incident occurs."],
    ["Security & Disaster Recovery", Difficulty.EASY, "Which security measure most directly protects a server room from unauthorized entry?", "Badge-controlled access", "A larger disk cache", "A DNS alias", "A software compiler", "Badge-controlled physical access limits entry to authorized personnel and creates an access record."],
    ["Security & Disaster Recovery", Difficulty.MEDIUM, "What is the purpose of a UPS?", "Provide short-term power and allow graceful shutdown during an outage", "Provide internet service", "Replace a firewall", "Increase RAM capacity", "A UPS bridges short outages and power events and can give systems time to shut down safely."],
    ["Security & Disaster Recovery", Difficulty.HARD, "Which recovery design provides geographically separate active systems that can take traffic quickly?", "Active-active", "Single-site cold storage", "Manual tape-only recovery", "A single unmonitored server", "An active-active design runs workloads at multiple sites and can provide fast continuity when one site fails."],
    ["Security & Disaster Recovery", Difficulty.MEDIUM, "What is the purpose of a server certificate?", "Authenticate a server and support encrypted communications", "Allocate storage blocks", "Detect failed fans", "Assign a MAC address", "Certificates bind an identity to a public key and support authentication and TLS encryption."],
    ["Security & Disaster Recovery", Difficulty.EASY, "Which action helps protect sensitive data on a retired disk?", "Secure erasure or physical destruction", "Place it in an unlocked drawer", "Rename the volume", "Remove only the desktop shortcut", "Secure erasure or destruction prevents recovery of data from retired media."],
    ["Security & Disaster Recovery", Difficulty.HARD, "A server is restored from backup after compromise. What should happen before reconnecting it to production?", "Patch, validate, scan, and verify the restored configuration", "Immediately reconnect it with old credentials", "Disable all security tools", "Delete the recovery documentation", "Validation ensures the restored system is not still compromised and meets the required baseline before exposure."],
    ["Troubleshooting", Difficulty.EASY, "A server cannot boot after a hardware change. What should be checked first?", "POST messages and the recent hardware change", "The email archive", "The DNS MX record", "The office printer queue", "POST and the last hardware change provide the most direct evidence for a boot failure."],
    ["Troubleshooting", Difficulty.MEDIUM, "A server has high CPU usage from one process. What should an administrator do first?", "Identify the process, review its behavior and logs, and confirm impact", "Immediately add public access", "Delete all system logs", "Replace every disk", "Identification and evidence collection distinguish a runaway workload, attack, or expected process before remediation."],
    ["Troubleshooting", Difficulty.MEDIUM, "Which metric best indicates memory pressure on a virtual machine?", "Paging or swapping activity", "Monitor brightness", "DNS TTL", "Rack height", "Excessive paging or swapping indicates the workload lacks available memory or has unsuitable allocation."],
    ["Troubleshooting", Difficulty.HARD, "A server responds to local requests but not remote clients. Which check is most useful next?", "Review interface status, routes, firewall rules, and listening sockets", "Replace the keyboard", "Change the server hostname only", "Delete the local user database", "The issue may be in network reachability, filtering, routing, or service binding, so those checks narrow the fault domain."],
    ["Troubleshooting", Difficulty.EASY, "Which tool displays active TCP listening ports on a server?", "A socket or network connection inspection tool", "A disk defragmenter", "A word processor", "A backup tape labeler", "Socket inspection tools show listening ports and established connections that help verify service exposure."],
    ["Troubleshooting", Difficulty.MEDIUM, "A disk reports increasing bad sectors. What is the safest response?", "Verify backups and replace the disk according to the hardware procedure", "Ignore the alert until the disk stops responding", "Format every server", "Disable SMART monitoring", "Increasing bad sectors indicate possible media failure; protect data and replace the affected disk."],
    ["Troubleshooting", Difficulty.HARD, "A service fails after a configuration deployment. Which recovery step is usually fastest and safest?", "Roll back to the last known-good configuration", "Make several unrelated changes at once", "Delete the service account", "Disable all health checks", "A controlled rollback restores service while preserving the failed change for later analysis."],
    ["Troubleshooting", Difficulty.MEDIUM, "Which log level is most useful temporarily when diagnosing a reproducible application failure?", "A more verbose level approved for the troubleshooting window", "No logging", "Only emergency messages forever", "Random log deletion", "Temporarily increased verbosity captures context, but it should be controlled because it can increase cost and expose data."],
    ["Troubleshooting", Difficulty.EASY, "What does a repeated DNS lookup timeout most directly indicate?", "A name-resolution path or DNS service problem", "A failed power supply", "A full backup", "A damaged rack rail", "Timeouts point toward network reachability, resolver configuration, or DNS service availability."],
    ["Troubleshooting", Difficulty.MEDIUM, "A server is slow immediately after a storage migration. Which comparison is most useful?", "Compare storage latency, queue depth, and throughput before and after migration", "Compare monitor resolution", "Compare user birthdays", "Compare keyboard layouts", "Before-and-after storage metrics help isolate whether the migration introduced latency or contention."],
    ["Troubleshooting", Difficulty.HARD, "What is the purpose of changing one variable at a time during troubleshooting?", "It makes the effect of each change observable", "It guarantees the first theory is correct", "It prevents documentation", "It increases the number of unknowns", "Controlled changes preserve cause-and-effect information and make rollback easier."],
    ["Troubleshooting", Difficulty.MEDIUM, "A server's network interface shows errors and dropped packets. What should be checked?", "Cabling, transceiver compatibility, speed, duplex, and switch port counters", "The backup retention label", "The CPU product name", "The office calendar", "Physical and link-layer issues commonly cause interface errors and drops, so both ends and their counters should be inspected."],
  ]),
  ...buildAdditionalQuestions("ccna", "ccna", [
    ["Network Fundamentals", Difficulty.EASY, "Which OSI layer provides logical addressing and routing between networks?", "Network layer", "Physical layer", "Presentation layer", "Application layer", "The network layer provides logical addressing and path selection between networks."],
    ["Network Fundamentals", Difficulty.EASY, "How many usable host addresses are in a /24 IPv4 subnet?", "254", "128", "256", "512", "A /24 has 256 total addresses; subtracting network and broadcast addresses leaves 254 usable hosts."],
    ["Network Fundamentals", Difficulty.MEDIUM, "Which IPv4 address is in a private RFC 1918 range?", "10.20.30.40", "8.8.8.8", "172.40.1.1", "198.51.100.10", "10.0.0.0/8 is private. 8.8.8.8 is public, 172.40.0.0/16 is outside the private 172.16.0.0/12 range, and 198.51.100.0/24 is documentation space."],
    ["Network Fundamentals", Difficulty.MEDIUM, "What is the IPv6 loopback address?", "::1", "fe80::1", "ff02::1", "2001:db8::1", "The IPv6 loopback address is ::1, equivalent to 127.0.0.1 in IPv4."],
    ["Network Fundamentals", Difficulty.EASY, "Which device forwards frames based on destination MAC addresses?", "Layer 2 switch", "Router", "DNS server", "Wireless controller only", "A Layer 2 switch learns MAC addresses and forwards Ethernet frames within a broadcast domain."],
    ["Network Fundamentals", Difficulty.MEDIUM, "What is the purpose of an IPv4 subnet mask?", "Identify the network and host portions of an address", "Encrypt the payload", "Assign a DNS name", "Select a wireless channel", "The mask determines which bits identify the subnet and which identify hosts."],
    ["Network Fundamentals", Difficulty.EASY, "Which transport protocol provides reliable, connection-oriented delivery?", "TCP", "UDP", "ICMP", "ARP", "TCP establishes a connection, sequences data, acknowledges delivery, and retransmits when needed."],
    ["Network Fundamentals", Difficulty.MEDIUM, "Which medium is least affected by electromagnetic interference?", "Fiber optic cable", "Unshielded twisted pair", "Coaxial copper", "Analog telephone cable", "Fiber carries light rather than electrical signals and is highly resistant to electromagnetic interference."],
    ["Network Fundamentals", Difficulty.HARD, "What is the purpose of the default gateway on a host?", "Forward traffic destined for remote networks", "Resolve all hostnames", "Assign the host's MAC address", "Provide local loopback", "The default gateway is the next hop for destinations outside the host's local subnet."],
    ["Network Fundamentals", Difficulty.MEDIUM, "Which IPv6 address type is automatically configured from a local link?", "Link-local", "Global unicast only", "Anycast only", "Multicast loopback", "Link-local IPv6 addresses begin with fe80::/10 and support communication on the local link."],
    ["Network Fundamentals", Difficulty.EASY, "What does ARP map in IPv4 networks?", "An IPv4 address to a MAC address", "A hostname to a public certificate", "A port to a VLAN", "A MAC address to a DNS zone", "ARP discovers the Layer 2 address associated with a local IPv4 next hop."],
    ["Network Fundamentals", Difficulty.MEDIUM, "Which topology provides a dedicated link between every pair of devices?", "Full mesh", "Bus", "Single star", "Ring with one break", "A full mesh connects every pair directly, providing redundancy at the cost of many links."],
    ["Network Access", Difficulty.MEDIUM, "What is the purpose of a VLAN?", "Create separate logical Layer 2 broadcast domains", "Encrypt every packet", "Replace IP routing", "Increase cable length without repeaters", "VLANs logically separate broadcast domains on shared switching infrastructure."],
    ["Network Access", Difficulty.EASY, "Which protocol adds VLAN tags to Ethernet frames on a trunk?", "802.1Q", "802.11ax", "802.3af", "802.1X only", "IEEE 802.1Q identifies the VLAN tag used on trunk links."],
    ["Network Access", Difficulty.MEDIUM, "What is the purpose of a native VLAN on an 802.1Q trunk?", "Carry frames that are sent without a VLAN tag", "Block all broadcast traffic", "Provide wireless encryption", "Assign a routed IP address to every switch port", "The native VLAN carries untagged frames on a trunk and should be consistently configured at both ends."],
    ["Network Access", Difficulty.HARD, "What problem does Spanning Tree Protocol prevent?", "Layer 2 switching loops", "Duplicate IP addresses from DHCP", "DNS cache poisoning", "TCP port exhaustion", "STP blocks redundant Layer 2 paths to prevent broadcast storms and MAC table instability."],
    ["Network Access", Difficulty.MEDIUM, "Which STP port state learns MAC addresses but does not forward user frames?", "Learning", "Blocking", "Forwarding", "Disabled", "In the learning state, a switch builds its MAC table without forwarding normal user traffic."],
    ["Network Access", Difficulty.EASY, "What is a switch access port normally assigned to?", "One VLAN", "Every VLAN", "A routing protocol", "Only the native VLAN on every trunk", "An access port carries untagged traffic for a single configured VLAN."],
    ["Network Access", Difficulty.MEDIUM, "Which feature protects a switch port by limiting allowed source MAC addresses?", "Port security", "Port mirroring", "EtherChannel", "DHCP relay", "Port security can restrict learned or configured source MAC addresses and define violation actions."],
    ["Network Access", Difficulty.HARD, "What is the primary purpose of EtherChannel?", "Bundle multiple physical links into one logical link", "Encrypt access-point traffic", "Translate IPv4 addresses", "Replace the routing table", "EtherChannel increases bandwidth and resiliency by treating compatible parallel links as one logical channel."],
    ["Network Access", Difficulty.MEDIUM, "Which wireless security standard uses WPA3-Personal's password-based authentication?", "SAE", "WEP shared key", "PAP", "Telnet", "WPA3-Personal uses Simultaneous Authentication of Equals, or SAE, rather than the older WPA2-PSK exchange."],
    ["Network Access", Difficulty.EASY, "What does PoE provide over a suitable Ethernet cable?", "Electrical power to network devices", "A second DNS namespace", "Disk redundancy", "A routing protocol", "Power over Ethernet supplies power to devices such as access points, phones, and cameras over Ethernet cabling."],
    ["Network Access", Difficulty.MEDIUM, "Which mechanism dynamically assigns a switch port to a VLAN based on a device identity or policy?", "Network access control", "Static trunking only", "ARP inspection only", "Route redistribution", "Network access control can authenticate devices and apply policy such as VLAN placement."],
    ["Network Access", Difficulty.HARD, "Why should an unused switch port be disabled?", "To reduce an unnecessary physical access path", "To increase its broadcast capacity", "To make it a default route", "To enable all VLANs", "Disabling unused ports reduces the opportunity for an unauthorized device to connect."],
    ["IP Connectivity", Difficulty.EASY, "Which routing table entry represents a route to all destinations not otherwise matched?", "0.0.0.0/0", "127.0.0.0/8", "255.255.255.255/32", "224.0.0.0/4", "0.0.0.0/0 is the IPv4 default route and matches destinations without a more specific route."],
    ["IP Connectivity", Difficulty.MEDIUM, "What does longest-prefix matching select?", "The most specific matching route", "The route with the oldest timestamp", "The route with the highest metric from any protocol", "The route with the shortest interface name", "Routers prefer the matching route with the greatest prefix length before forwarding."],
    ["IP Connectivity", Difficulty.MEDIUM, "Which protocol is a link-state interior gateway protocol?", "OSPF", "BGP", "RIP only", "ARP", "OSPF is a link-state IGP that builds a topology database and calculates paths with SPF."],
    ["IP Connectivity", Difficulty.EASY, "What does a router do when it receives a packet for an unreachable network and has no default route?", "Discard the packet and may send an ICMP unreachable message", "Flood it out every interface", "Convert it into a broadcast", "Send it to the DNS server", "Without a matching route or default, the router cannot forward the packet and may report the failure with ICMP."],
    ["IP Connectivity", Difficulty.HARD, "Which OSPF concept allows different areas to connect through a central backbone?", "Area 0", "The native VLAN", "The AP management SSID", "The DHCP pool", "OSPF area 0 is the backbone through which other areas exchange inter-area routing information."],
    ["IP Connectivity", Difficulty.MEDIUM, "What is the purpose of a static route?", "Provide a manually configured path to a destination", "Automatically discover every neighbor", "Translate all private addresses", "Assign switch port VLANs", "A static route gives an administrator explicit control over a destination path."],
    ["IP Connectivity", Difficulty.EASY, "Which command conceptually shows the path hops to a destination?", "Traceroute", "ARP flush", "VLAN database", "Interface reset", "Traceroute uses TTL behavior and responses from intermediate devices to display the path."],
    ["IP Connectivity", Difficulty.MEDIUM, "What is route redistribution?", "Sharing routes between different routing protocols or sources", "Encrypting a routing update", "Moving a switch to another rack", "Converting a MAC address to a username", "Redistribution imports routes from one routing source into another and requires careful filtering."],
    ["IP Connectivity", Difficulty.HARD, "Which BGP attribute is commonly used to influence outbound path selection within an autonomous system?", "Local preference", "Ethernet frame check sequence", "DNS priority", "Wireless channel width", "BGP local preference influences the preferred exit path for routes inside an autonomous system."],
    ["IP Services", Difficulty.EASY, "Which protocol automatically assigns IPv4 address configuration to clients?", "DHCP", "DNS", "NTP", "SSH", "DHCP supplies leases and options such as the address, mask, gateway, and DNS servers."],
    ["IP Services", Difficulty.MEDIUM, "What is the purpose of a DHCP relay?", "Forward DHCP messages between clients and a server on different subnets", "Encrypt DHCP leases", "Replace the default gateway", "Provide DNSSEC signatures", "A relay forwards client broadcast requests to a DHCP server across routed boundaries."],
    ["IP Services", Difficulty.EASY, "Which DNS record maps a hostname to an IPv4 address?", "A record", "AAAA record", "MX record", "NS record only", "An A record maps a name to an IPv4 address. AAAA is used for IPv6."],
    ["IP Services", Difficulty.MEDIUM, "What does NTP provide to network devices?", "Time synchronization", "Address translation", "VLAN tagging", "File encryption", "NTP keeps device clocks aligned for logs, certificates, authentication, and operations."],
    ["IP Services", Difficulty.HARD, "Which protocol is commonly used to collect network device monitoring data?", "SNMP", "SMTP", "SFTP", "SIP", "SNMP supports monitoring through managed objects, polling, and notifications."],
    ["IP Services", Difficulty.MEDIUM, "What is the primary purpose of a load balancer?", "Distribute client requests across available servers", "Assign MAC addresses", "Create a new VLAN for every request", "Replace all application logging", "Load balancers distribute work and can improve availability and service responsiveness."],
    ["IP Services", Difficulty.EASY, "Which technology translates private IPv4 addresses to a public address?", "NAT", "STP", "LACP", "LLDP", "NAT translates addresses between private and public addressing domains."],
    ["IP Services", Difficulty.MEDIUM, "What does a reverse proxy commonly do?", "Accept client requests and forward them to backend services", "Assign switch port costs", "Replace a routing protocol", "Generate physical fiber light", "A reverse proxy can centralize TLS, routing, caching, and access controls in front of backend services."],
    ["IP Services", Difficulty.HARD, "Which ICMP message is commonly used by ping to test reachability?", "Echo request and echo reply", "Router advertisement only", "Port unreachable only", "DHCP acknowledgment", "Ping uses ICMP echo requests and expects echo replies from a reachable destination."],
    ["Security Fundamentals", Difficulty.EASY, "Which device filters traffic based on configured security rules?", "Firewall", "Hub", "Patch panel", "Media converter only", "A firewall enforces traffic policy between interfaces or security zones."],
    ["Security Fundamentals", Difficulty.MEDIUM, "What does an access control list on a router or switch define?", "Permit and deny rules for matching traffic", "The device's power budget", "The DNS root zone", "The physical cable length", "An ACL evaluates traffic attributes such as addresses, protocols, and ports against ordered rules."],
    ["Security Fundamentals", Difficulty.MEDIUM, "Which attack sends forged source addresses to make traffic appear to come from a trusted host?", "IP spoofing", "VLAN pruning", "Route summarization", "Port mirroring", "IP spoofing falsifies the source address and can support reflection, evasion, or access-control abuse."],
    ["Security Fundamentals", Difficulty.HARD, "Which control helps prevent a rogue DHCP server from answering clients on a switch?", "DHCP snooping", "Port aggregation", "DNS recursion", "NAT overload", "DHCP snooping identifies trusted server-facing ports and filters unauthorized DHCP responses."],
    ["Security Fundamentals", Difficulty.EASY, "What is the purpose of a strong password policy?", "Reduce the likelihood of credential guessing and reuse", "Guarantee encryption of every packet", "Increase broadcast traffic", "Disable account auditing", "Password policy can require length, uniqueness, and other controls that reduce common credential attacks."],
    ["Security Fundamentals", Difficulty.MEDIUM, "Which security principle requires users to prove their identity before access?", "Authentication", "Accounting", "Availability", "Non-repudiation only", "Authentication verifies identity; authorization then determines what the authenticated identity may do."],
    ["Security Fundamentals", Difficulty.HARD, "What is the main benefit of a site-to-site IPsec VPN?", "Protect private network traffic across an untrusted transport", "Remove the need for routing", "Make every endpoint public", "Disable encryption at the edge", "Site-to-site IPsec creates an encrypted tunnel between network gateways across an untrusted network."],
    ["Automation & Programmability", Difficulty.MEDIUM, "Which data format is commonly used by REST APIs because it is lightweight and structured?", "JSON", "JPEG", "WAV", "BIOS", "JSON represents structured data in a lightweight text format widely used by REST APIs."],
    ["Automation & Programmability", Difficulty.EASY, "What HTTP method is commonly used to retrieve a resource from an API?", "GET", "POST", "DELETE", "PATCH only", "GET requests retrieve a resource without asking the server to create or modify it."],
    ["Automation & Programmability", Difficulty.MEDIUM, "What is the main value of infrastructure as code?", "Versioned, repeatable, and reviewable infrastructure changes", "Eliminating all monitoring", "Replacing network protocols", "Making configuration permanently manual", "Infrastructure as code makes changes consistent, auditable, and reproducible through source-controlled definitions."],
    ["Automation & Programmability", Difficulty.HARD, "Which characteristic of an idempotent automation task is desirable?", "Running it repeatedly produces the same intended end state", "Each run creates an additional duplicate resource", "It requires a different result every time", "It ignores the current device state", "Idempotence makes automation safe to rerun because the desired end state remains stable."],
    ["Automation & Programmability", Difficulty.MEDIUM, "What does a network controller commonly provide?", "Centralized policy and programmable management of network devices", "Physical cable termination", "A replacement for all endpoints", "A local disk partition", "Controllers centralize intent, policy, telemetry, and automation across network infrastructure."],
    ["Automation & Programmability", Difficulty.EASY, "Which format is designed to be human-readable and commonly used in configuration files?", "YAML", "MP3", "PNG", "EXE", "YAML is a human-readable data serialization format commonly used for configuration and automation."],
    ["Automation & Programmability", Difficulty.HARD, "Why should an automation script avoid embedding credentials directly in source code?", "Source code may be copied or exposed, causing credential compromise", "It makes scripts run faster", "It prevents JSON parsing", "It increases link bandwidth", "Secrets should be supplied through protected secret stores or environment mechanisms rather than committed to code."],
  ]),
];

questions.push(...additionalQuestions);

async function main() {
  const domainIds = new Map<string, string>();

  for (const item of certifications) {
    const certification = await prisma.certification.upsert({
      where: { slug: item.slug },
      update: { acronym: item.acronym, name: item.name, examCode: item.examCode, description: item.description, color: item.color },
      create: { slug: item.slug, acronym: item.acronym, name: item.name, examCode: item.examCode, description: item.description, color: item.color },
    });

    for (const domain of item.domains) {
      const record = await prisma.domain.upsert({
        where: { certificationId_name: { certificationId: certification.id, name: domain.name } },
        update: { objective: domain.objective, sortOrder: domain.sortOrder },
        create: { ...domain, certificationId: certification.id },
      });
      domainIds.set(`${item.slug}:${domain.name}`, record.id);
    }
  }

  for (const question of questions) {
    const domainId = domainIds.get(`${question.certification}:${question.domain}`);
    if (!domainId) throw new Error(`Missing domain for ${question.id}`);

    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        domainId, prompt: question.prompt, explanation: question.explanation, difficulty: question.difficulty,
        options: { deleteMany: {}, create: [0, 1, 2, 3].map((index) => ({ label: question.options[index * 2], text: question.options[index * 2 + 1], isCorrect: question.options[index * 2] === question.correct })) },
      },
      create: {
        id: question.id, domainId, prompt: question.prompt, explanation: question.explanation, difficulty: question.difficulty,
        options: { create: [0, 1, 2, 3].map((index) => ({ label: question.options[index * 2], text: question.options[index * 2 + 1], isCorrect: question.options[index * 2] === question.correct })) },
      },
    });
  }

  for (const certification of certifications) {
    const seededQuestions = await prisma.question.findMany({
      where: { domain: { certification: { slug: certification.slug } } },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    const excessQuestionIds = seededQuestions.slice(50).map((question) => question.id);
    if (excessQuestionIds.length) {
      await prisma.question.deleteMany({ where: { id: { in: excessQuestionIds } } });
    }
  }

  console.log(`Seeded ${certifications.length} certifications with 50 original questions each.`);
}

main().finally(() => prisma.$disconnect());