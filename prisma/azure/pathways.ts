// Microsoft Azure pathways. Domains, weightings and objectives follow Microsoft's study guides, checked
// 12 November 2026. Microsoft updates these outlines, so re-check SOURCES before changing them.
import type { SeedModule, SeedPathway } from "../nse/types";
import { az104Questions } from "./az104";

const GUIDE = "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides";
const CERT = "https://learn.microsoft.com/en-us/credentials/certifications";
// Mock settings are CertMastery's own, set properly with the question banks in Phase 5.
const MOCK: [number, number] = [40, 60];

type Objective = NonNullable<SeedModule["examObjectives"]>[number];
const objective = (slug: string, title: string, skills: string[]): Objective => ({ slug, title, skills });

function domain(slug: string, title: string, summary: string, range: [number, number], guide: string, examObjectives: Objective[]): SeedModule {
  return {
    slug,
    title,
    summary,
    weight: Math.round((range[0] + range[1]) / 2),
    weightRange: range,
    objectives: examObjectives.map((item) => item.title),
    concepts: [],
    sources: [`${GUIDE}/${guide}`],
    examObjectives,
    questions: [],
  };
}

const az900: SeedPathway = {
  slug: "az-900",
  programme: "AZURE",
  level: 1,
  title: "AZ-900: Microsoft Azure Fundamentals",
  summary: "Cloud concepts, Azure's core services, and how Azure is secured, governed and paid for.",
  overview: "The starting point for Azure. It covers cloud models and service types, Azure's architecture and core services, and the tools for cost management, governance and monitoring. Microsoft doesn't require it before other Azure certifications.",
  prerequisites: ["None. Microsoft suggests experience in an area of IT such as infrastructure, databases or software development."],
  objectives: ["Explain cloud models and service types", "Describe Azure's architecture and core services", "Describe identity, access and security in Azure", "Describe cost management, governance and monitoring"],
  officialExams: ["Exam AZ-900: Microsoft Azure Fundamentals"],
  officialUrl: `${CERT}/azure-fundamentals/`,
  officialSpec: "A score of 700 or greater is required to pass. Domains: describe cloud concepts 25 to 30%, describe Azure architecture and services 35 to 40%, describe Azure management and governance 30 to 35%. Skills measured as of 20 July 2026. Checked 12 November 2026.",
  skillsAsOf: "2026-07-20",
  status: "DRAFT",
  mock: MOCK,
  target: 300,
  modules: [
    domain("cloud-concepts", "Describe cloud concepts", "Cloud computing, its benefits and the service types.", [25, 30], "az-900", [
      objective("cloud-computing", "Describe cloud computing", ["Define cloud computing", "Describe the shared responsibility model", "Define cloud models, including public, private, and hybrid", "Identify appropriate use cases for each cloud model", "Describe the consumption-based model", "Compare cloud pricing models", "Describe serverless"]),
      objective("cloud-benefits", "Describe the benefits of using cloud services", ["Describe the benefits of high availability and scalability in the cloud", "Describe the benefits of reliability and predictability in the cloud", "Describe the benefits of security and governance in the cloud", "Describe the benefits of manageability in the cloud"]),
      objective("service-types", "Describe cloud service types", ["Describe infrastructure as a service (IaaS)", "Describe platform as a service (PaaS)", "Describe software as a service (SaaS)", "Identify appropriate use cases for each cloud service type (IaaS, PaaS, and SaaS)"]),
    ]),
    domain("architecture-services", "Describe Azure architecture and services", "Regions and resource hierarchy, compute, networking, storage, identity and security.", [35, 40], "az-900", [
      objective("core-architecture", "Describe the core architectural components of Azure", ["Describe Azure regions, region pairs, and sovereign regions", "Describe availability zones", "Describe Azure datacenters", "Describe Azure resources and resource groups", "Describe subscriptions", "Describe management groups", "Describe the hierarchy of resource groups, subscriptions, and management groups"]),
      objective("compute-networking", "Describe Azure compute and networking services", ["Compare compute types, including containers, virtual machines, and functions", "Describe virtual machine options, including Azure virtual machines, Azure Virtual Machine Scale Sets, availability sets, and Azure Virtual Desktop", "Describe the resources required for virtual machines", "Describe application hosting options, including web apps, containers, and virtual machines", "Describe virtual networking, including the purpose of Azure virtual networks, subnets, peering, Azure DNS, Azure VPN Gateway, and ExpressRoute", "Define public and private endpoints"]),
      objective("storage", "Describe Azure storage services", ["Compare Azure Storage services", "Describe storage tiers", "Describe redundancy options", "Describe storage account options and storage types", "Identify options for moving files, including AzCopy, Azure Storage Explorer, and Azure File Sync", "Describe migration options, including Azure Migrate and Azure Data Box"]),
      objective("identity-security", "Describe Azure identity, access, and security", ["Describe directory services in Azure, including Microsoft Entra ID and Microsoft Entra Domain Services", "Describe authentication methods in Azure, including single sign-on (SSO), multifactor authentication (MFA), and passwordless", "Describe external identities in Azure", "Describe Microsoft Entra Conditional Access", "Describe Azure role-based access control (RBAC)", "Describe the concept of Zero Trust", "Describe the purpose of the defense-in-depth model", "Describe the purpose of Microsoft Defender for Cloud"]),
    ]),
    domain("management-governance", "Describe Azure management and governance", "Cost management, governance, deployment tools and monitoring.", [30, 35], "az-900", [
      objective("cost-management", "Describe cost management in Azure", ["Describe factors that can affect costs in Azure", "Explore the pricing calculator", "Describe cost management capabilities in Azure", "Describe the purpose of tags"]),
      objective("governance-compliance", "Describe features and tools in Azure for governance and compliance", ["Describe the purpose of Microsoft Purview in Azure", "Describe the purpose of Azure Policy", "Describe the purpose of resource locks"]),
      objective("managing-deploying", "Describe features and tools for managing and deploying Azure resources", ["Describe the Azure portal", "Describe Azure Cloud Shell, Azure CLI, and Azure PowerShell", "Describe the purpose of Azure Arc", "Describe infrastructure as code (IaC)", "Describe Azure Resource Manager (ARM) and ARM templates"]),
      objective("monitoring", "Describe monitoring tools in Azure", ["Describe the purpose of Azure Advisor", "Describe Azure Service Health", "Describe Azure Monitor, including Log Analytics, Azure Monitor alerts, and Azure Monitor Application Insights"]),
    ]),
  ],
};

const az104: SeedPathway = {
  slug: "az-104",
  programme: "AZURE",
  level: 2,
  title: "AZ-104: Microsoft Azure Administrator",
  summary: "Implement, manage and monitor identity, storage, compute, networking and backup in Azure.",
  overview: "The administrator's exam: Microsoft Entra users and groups, RBAC and governance, storage accounts, virtual machines and containers, virtual networking, monitoring and backup. Passing it earns the Azure Administrator Associate certification, which Microsoft requires for Azure Solutions Architect Expert.",
  prerequisites: ["None required by Microsoft. Microsoft expects experience with operating systems, networking, servers and virtualization, and with PowerShell, the Azure CLI, the Azure portal, ARM templates and Microsoft Entra ID."],
  objectives: ["Manage Microsoft Entra identities, RBAC and governance", "Configure storage accounts, Azure Files and Blob Storage", "Deploy virtual machines, containers and App Service", "Configure virtual networks, NSGs, DNS and load balancing", "Monitor resources and run backup and recovery"],
  officialExams: ["Exam AZ-104: Microsoft Azure Administrator"],
  officialUrl: `${CERT}/azure-administrator/`,
  officialSpec: "You have 100 minutes, and the exam may include interactive components. A score of 700 or greater is required to pass. Microsoft doesn't publish the number of questions. Domains: manage Azure identities and governance 20 to 25%, implement and manage storage 15 to 20%, deploy and manage Azure compute resources 20 to 25%, implement and manage virtual networking 15 to 20%, monitor and maintain Azure resources 10 to 15%. Skills measured as of 26 October 2023, still current when checked on 12 November 2026.",
  skillsAsOf: "2023-10-26",
  status: "PUBLISHED",
  // 100 minutes is Microsoft's published exam time; 50 questions is CertMastery's choice.
  mock: [50, 100],
  target: 500,
  requires: [{ slug: "az-900", kind: "RECOMMENDED", note: "CertMastery's suggested order. Microsoft doesn't require AZ-900." }],
  modules: [
    domain("identities-governance", "Manage Azure identities and governance", "Microsoft Entra users and groups, RBAC, subscriptions and governance.", [20, 25], "az-104", [
      objective("entra-users-groups", "Manage Microsoft Entra users and groups", ["Create users and groups", "Manage user and group properties", "Manage licenses in Microsoft Entra ID", "Manage external users", "Configure self-service password reset (SSPR)"]),
      objective("access-to-resources", "Manage access to Azure resources", ["Manage built-in Azure roles", "Assign roles at different scopes", "Interpret access assignments"]),
      objective("subscriptions-governance", "Manage Azure subscriptions and governance", ["Implement and manage Azure Policy", "Configure resource locks", "Apply and manage tags on resources", "Manage resource groups", "Manage subscriptions", "Manage costs by using alerts, budgets, and Azure Advisor recommendations", "Configure management groups"]),
    ]),
    domain("storage", "Implement and manage storage", "Storage access, storage accounts, Azure Files and Blob Storage.", [15, 20], "az-104", [
      objective("storage-access", "Configure access to storage", ["Configure Azure Storage firewalls and virtual networks", "Create and use shared access signature (SAS) tokens", "Configure stored access policies", "Manage access keys", "Configure identity-based access for Azure Files"]),
      objective("storage-accounts", "Configure and manage storage accounts", ["Create and configure storage accounts", "Configure Azure Storage redundancy", "Configure object replication", "Configure storage account encryption", "Manage data by using Azure Storage Explorer and AzCopy"]),
      objective("files-blob", "Configure Azure Files and Azure Blob Storage", ["Create and configure a file share in Azure Storage", "Create and configure a container in Blob Storage", "Configure storage tiers", "Configure snapshots and soft delete for Azure Files", "Configure blob lifecycle management", "Configure blob versioning"]),
    ]),
    domain("compute", "Deploy and manage Azure compute resources", "ARM templates and Bicep, virtual machines, containers and App Service.", [20, 25], "az-104", [
      objective("arm-bicep", "Automate deployment of resources by using Azure Resource Manager (ARM) templates or Bicep files", ["Interpret an Azure Resource Manager template or a Bicep file", "Modify an existing Azure Resource Manager template", "Modify an existing Bicep file", "Deploy resources by using an Azure Resource Manager template or a Bicep file", "Export a deployment as an Azure Resource Manager template or convert an Azure Resource Manager template to a Bicep file"]),
      objective("virtual-machines", "Create and configure virtual machines", ["Create a virtual machine", "Configure Azure Disk Encryption", "Move a virtual machine to another resource group, subscription, or region", "Manage virtual machine sizes", "Manage virtual machine disks", "Deploy virtual machines to availability zones and availability sets", "Deploy and configure an Azure Virtual Machine Scale Sets"]),
      objective("containers", "Provision and manage containers in the Azure portal", ["Create and manage an Azure container registry", "Provision a container by using Azure Container Instances", "Provision a container by using Azure Container Apps", "Manage sizing and scaling for containers, including Azure Container Instances and Azure Container Apps"]),
      objective("app-service", "Create and configure Azure App Service", ["Provision an App Service plan", "Configure scaling for an App Service plan", "Create an App Service", "Configure certificates and Transport Layer Security (TLS) for an App Service", "Map an existing custom DNS name to an App Service", "Configure backup for an App Service", "Configure networking settings for an App Service", "Configure deployment slots for an App Service"]),
    ]),
    domain("networking", "Implement and manage virtual networking", "Virtual networks, secure access, name resolution and load balancing.", [15, 20], "az-104", [
      objective("virtual-networks", "Configure and manage virtual networks in Azure", ["Create and configure virtual networks and subnets", "Create and configure virtual network peering", "Configure public IP addresses", "Configure user-defined network routes", "Troubleshoot network connectivity"]),
      objective("secure-access", "Configure secure access to virtual networks", ["Create and configure network security groups (NSGs) and application security groups", "Evaluate effective security rules in NSGs", "Implement Azure Bastion", "Configure service endpoints for Azure platform as a service (PaaS)", "Configure private endpoints for Azure PaaS"]),
      objective("dns-load-balancing", "Configure name resolution and load balancing", ["Configure Azure DNS", "Configure an internal or public load balancer", "Troubleshoot load balancing"]),
    ]),
    domain("monitor-maintain", "Monitor and maintain Azure resources", "Azure Monitor, Network Watcher, backup and Site Recovery.", [10, 15], "az-104", [
      objective("monitor-resources", "Monitor resources in Azure", ["Interpret metrics in Azure Monitor", "Configure log settings in Azure Monitor", "Query and analyze logs in Azure Monitor", "Set up alert rules, action groups, and alert processing rules in Azure Monitor", "Configure and interpret monitoring of virtual machines, storage accounts, and networks by using Azure Monitor Insights", "Use Azure Network Watcher and Connection Monitor"]),
      objective("backup-recovery", "Implement backup and recovery", ["Create a Recovery Services vault", "Create an Azure Backup vault", "Create and configure a backup policy", "Perform backup and restore operations by using Azure Backup", "Configure Azure Site Recovery for Azure resources", "Perform a failover to a secondary region by using Site Recovery", "Configure and interpret reports and alerts for backups"]),
    ]),
  ],
};

const az700: SeedPathway = {
  slug: "az-700",
  programme: "AZURE",
  level: 3,
  title: "AZ-700: Designing and Implementing Microsoft Azure Networking Solutions",
  summary: "Core networking, hybrid connectivity, application delivery, private access and network security.",
  overview: "An optional networking specialisation alongside the Solutions Architect path. It covers IP addressing, DNS and routing, VPN, ExpressRoute and Virtual WAN, load balancing and Front Door, Private Link, NSGs, Azure Firewall and WAF. Passing it earns the Azure Network Engineer Associate certification.",
  prerequisites: ["None required by Microsoft. Microsoft expects experience creating and managing compute, storage and networking resources in Azure, and an understanding of name resolution, network protocols and address management."],
  objectives: ["Design IP addressing, name resolution and routing", "Implement VPN, ExpressRoute and Virtual WAN", "Deliver applications with Load Balancer, Application Gateway and Front Door", "Provide private access with Private Link and service endpoints", "Secure networks with NSGs, Azure Firewall and WAF"],
  officialExams: ["Exam AZ-700: Designing and Implementing Microsoft Azure Networking Solutions"],
  officialUrl: `${CERT}/azure-network-engineer-associate/`,
  officialSpec: "A score of 700 or greater is required to pass. Domains: design and implement core networking infrastructure 25 to 30%, design, implement, and manage connectivity services 20 to 25%, design and implement application delivery services 15 to 20%, design and implement private access to Azure services 10 to 15%, design and implement Azure network security services 15 to 20%. Skills measured as of 27 July 2026. Checked 12 November 2026.",
  skillsAsOf: "2026-07-27",
  status: "DRAFT",
  mock: MOCK,
  target: 400,
  requires: [{ slug: "az-104", kind: "RECOMMENDED", note: "CertMastery's suggested order. Microsoft doesn't require AZ-104 for AZ-700." }],
  modules: [
    domain("core-networking", "Design and implement core networking infrastructure", "IP addressing, name resolution, VNet connectivity and routing, and monitoring.", [25, 30], "az-700", [
      objective("ip-addressing", "Design and implement IP addressing for Azure resources", ["Plan and implement network segmentation and address spaces", "Create a virtual network (VNet)", "Plan and configure subnetting for services, including virtual network gateways, private endpoints, service endpoints, firewalls, application gateways, VNet-integrated platform services, and Azure Bastion", "Plan and configure subnet delegation", "Plan and configure shared or dedicated subnets", "Create a Public IP Prefix", "Choose when to use a public IP address prefix", "Plan and implement a Custom IP address prefix (bring your own IP)", "Create a public IP address", "Associate public IP addresses to resources"]),
      objective("name-resolution", "Design and implement name resolution", ["Design name resolution inside a VNet", "Configure DNS settings for a VNet", "Design public DNS zones", "Design private DNS zones", "Configure public and private DNS zones", "Link a private DNS zone to a VNet", "Design and implement Azure DNS Private Resolver"]),
      objective("vnet-routing", "Design and implement VNet connectivity and routing", ["Design service chaining, including gateway transit", "Implement VNet peering", "Implement and manage virtual network connectivity by using Azure Virtual Network Manager", "Design and implement user-defined routes (UDRs)", "Associate a route table with a subnet", "Configure forced tunneling", "Diagnose and resolve routing issues", "Design and implement Azure Route Server", "Identify appropriate use cases for Azure NAT Gateway", "Implement Azure NAT Gateway"]),
      objective("monitor-networks", "Monitor networks", ["Configure monitoring, network diagnostics, and logs in Azure Network Watcher", "Monitor and troubleshoot network health by using Azure Network Watcher", "Monitor and troubleshoot networks by using Azure Monitor for Networks", "Activate and monitor distributed denial-of-service (DDoS) protection", "Evaluate network security recommendations identified by Microsoft Defender for Cloud Secure Score", "Evaluate network security recommendations identified by Microsoft Defender for Cloud attack path analysis", "Identify network resources by using Cloud Security Explorer in Microsoft Defender for Cloud"]),
    ]),
    domain("connectivity-services", "Design, implement, and manage connectivity services", "Site-to-site and point-to-site VPN, ExpressRoute and Virtual WAN.", [20, 25], "az-700", [
      objective("site-to-site-vpn", "Design, implement, and manage a site-to-site VPN connection", ["Design a site-to-site VPN connection, including for high availability", "Select an appropriate virtual network gateway stock-keeping unit (SKU) for site-to-site VPN requirements", "Implement a site-to-site VPN connection", "Identify when to use a policy-based VPN versus a route-based VPN connection", "Create and configure a local network gateway", "Create and configure an IPsec/Internet Key Exchange (IKE) policy", "Create and configure a virtual network gateway", "Diagnose and resolve virtual network gateway connectivity issues", "Implement Azure Extended Network"]),
      objective("point-to-site-vpn", "Design, implement, and manage a point-to-site VPN connection", ["Select an appropriate virtual network gateway SKU for point-to-site VPN requirements", "Select and configure a tunnel type", "Select an appropriate authentication method", "Configure RADIUS authentication", "Configure authentication by using Microsoft Entra ID", "Implement a VPN client configuration file", "Diagnose and resolve client-side and authentication issues", "Specify Azure requirements for Always On VPN", "Specify Azure requirements for Azure Network Adapter"]),
      objective("expressroute", "Design, implement, and manage Azure ExpressRoute", ["Select an ExpressRoute connectivity model", "Select an appropriate ExpressRoute SKU and tier", "Design and implement ExpressRoute to meet requirements, including cross-region connectivity, redundancy, and disaster recovery", "Design and implement ExpressRoute options, including Global Reach, FastPath, and ExpressRoute Direct", "Choose between Azure private peering only, Microsoft peering only, or both", "Configure Azure private peering", "Configure Microsoft peering", "Create and configure an ExpressRoute gateway", "Connect a virtual network to an ExpressRoute circuit", "Recommend a route advertisement configuration", "Configure encryption over ExpressRoute", "Implement Bidirectional Forwarding Detection", "Diagnose and resolve ExpressRoute connection issues"]),
      objective("virtual-wan", "Design and implement an Azure Virtual WAN architecture", ["Select a Virtual WAN SKU", "Design a Virtual WAN architecture, including selecting types and services", "Create a virtual hub in Virtual WAN", "Choose an appropriate scale unit for each gateway type", "Deploy a gateway into a virtual hub", "Configure virtual hub routing", "Integrate a virtual hub with a third-party NVA for cloud connectivity"]),
    ]),
    domain("application-delivery", "Design and implement application delivery services", "Load Balancer, Traffic Manager, Application Gateway and Front Door.", [15, 20], "az-700", [
      objective("load-balancer-traffic-manager", "Design and implement Azure Load Balancer and Azure Traffic Manager", ["Map requirements to features and capabilities of Azure Load Balancer", "Identify appropriate use cases for Azure Load Balancer", "Choose an Azure Load Balancer SKU and tier", "Choose between public and internal load balancers", "Choose between regional and cross-region load balancers", "Create and configure an Azure Load Balancer", "Implement Azure Traffic Manager", "Implement Gateway Load Balancer", "Implement a load balancing rule", "Create and configure inbound NAT rules", "Create and configure explicit outbound rules, including source network address translation (SNAT)"]),
      objective("application-gateway", "Design and implement Azure Application Gateway", ["Map requirements to features and capabilities of Azure Application Gateway", "Identify appropriate use cases for Azure Application Gateway", "Choose between manual and autoscale", "Create a backend pool", "Configure health probes", "Configure listeners", "Configure routing rules", "Configure HTTP settings", "Configure Transport Layer Security (TLS)", "Configure rewrite rule sets"]),
      objective("front-door", "Design and implement Azure Front Door", ["Map requirements to features and capabilities of Azure Front Door", "Identify appropriate use cases for Azure Front Door", "Choose an appropriate tier", "Configure an Azure Front Door, including routing, origins, and endpoints", "Configure TLS termination and end-to-end TLS encryption", "Configure caching", "Configure traffic acceleration", "Implement rules, URL rewrite, and URL redirect", "Secure an origin by using Azure Private Link in Azure Front Door"]),
    ]),
    domain("private-access", "Design and implement private access to Azure services", "Private Link, private endpoints and service endpoints.", [10, 15], "az-700", [
      objective("private-link", "Design and implement Azure Private Link service and Azure private endpoints", ["Plan private endpoints", "Create private endpoints", "Configure access to private endpoints", "Create a Private Link service", "Integrate Private Link and Private Endpoint with DNS", "Integrate a Private Link service with on-premises clients"]),
      objective("service-endpoints", "Design and implement service endpoints", ["Choose when to use a service endpoint", "Create service endpoints", "Configure service endpoint policies", "Configure access to service endpoints"]),
    ]),
    domain("network-security", "Design and implement Azure network security services", "NSGs and ASGs, Azure Firewall and Firewall Manager, and WAF.", [15, 20], "az-700", [
      objective("nsgs", "Implement and manage network security groups", ["Create a network security group (NSG)", "Associate a NSG to a subnet or network interface", "Create an application security group (ASG)", "Associate an ASG to a network interface", "Create and configure NSG inbound and outbound security rules", "Implement virtual network flow logs", "Interpret virtual network flow logs", "Verify IP flow", "Configure an NSG for remote server administration, including Azure Bastion", "Implement and manage virtual network security by using Azure Virtual Network Manager"]),
      objective("azure-firewall", "Design and implement Azure Firewall and Azure Firewall Manager", ["Map requirements to features and capabilities of Azure Firewall", "Select an appropriate Azure Firewall SKU", "Design an Azure Firewall deployment", "Create and implement an Azure Firewall deployment", "Configure Azure Firewall rules", "Create and implement Azure Firewall Manager policies", "Create a secure hub by deploying Azure Firewall inside an Azure Virtual WAN hub"]),
      objective("waf", "Design and implement a Web Application Firewall (WAF) deployment", ["Map requirements to features and capabilities of WAF", "Design a WAF deployment", "Configure detection or prevention mode", "Configure rule sets for WAF on Azure Front Door", "Configure rule sets for WAF on Application Gateway", "Implement a WAF policy", "Associate a WAF policy"]),
    ]),
  ],
};

const az305: SeedPathway = {
  slug: "az-305",
  programme: "AZURE",
  level: 4,
  title: "AZ-305: Designing Microsoft Azure Infrastructure Solutions",
  summary: "Design identity, governance, data, business continuity and infrastructure solutions on Azure.",
  overview: "The design exam for the Azure Solutions Architect Expert certification. It tests recommendations rather than configuration: identity and governance, data storage, business continuity and infrastructure, aligned with the Azure Well-Architected Framework and the Cloud Adoption Framework.",
  prerequisites: ["Microsoft Certified: Azure Administrator Associate (earned by passing AZ-104) is required for the Azure Solutions Architect Expert certification.", "Microsoft expects advanced experience across IT operations, plus experience with Azure administration, Azure development and DevOps processes."],
  objectives: ["Design logging, monitoring, identity and governance", "Design relational, semi-structured and unstructured data storage", "Design backup, disaster recovery and high availability", "Design compute, application architecture, migrations and networks"],
  officialExams: ["Exam AZ-305: Designing Microsoft Azure Infrastructure Solutions"],
  officialUrl: `${CERT}/azure-solutions-architect/`,
  officialSpec: "Earns Microsoft Certified: Azure Solutions Architect Expert, which also requires the Azure Administrator Associate certification. A score of 700 or greater is required to pass. Domains: design identity, governance, and monitoring solutions 25 to 30%, design data storage solutions 20 to 25%, design business continuity solutions 15 to 20%, design infrastructure solutions 30 to 35%. Skills measured as of 17 April 2026. Checked 12 November 2026.",
  skillsAsOf: "2026-04-17",
  status: "DRAFT",
  mock: MOCK,
  target: 500,
  requires: [{ slug: "az-104", kind: "REQUIRED", note: "Microsoft requires the Azure Administrator Associate certification for Azure Solutions Architect Expert." }],
  modules: [
    domain("identity-governance-monitoring", "Design identity, governance, and monitoring solutions", "Logging and monitoring, authentication and authorization, and governance.", [25, 30], "az-305", [
      objective("logging-monitoring", "Design solutions for logging and monitoring", ["Recommend a logging solution", "Recommend a solution for routing logs", "Recommend a monitoring solution"]),
      objective("authentication-authorization", "Design authentication and authorization solutions", ["Recommend an authentication solution", "Recommend an identity management solution", "Recommend a solution for authorizing access to Azure resources", "Recommend a solution for authorizing access to on-premises resources", "Recommend a solution to manage secrets, certificates, and keys"]),
      objective("governance", "Design governance", ["Recommend a structure for management groups, subscriptions, and resource groups, and a strategy for resource tagging", "Recommend a solution for managing compliance", "Recommend a solution for identity governance"]),
    ]),
    domain("data-storage", "Design data storage solutions", "Relational, semi-structured and unstructured data, and data integration.", [20, 25], "az-305", [
      objective("relational-data", "Design data storage solutions for relational data", ["Recommend a solution for storing relational data", "Recommend a database service tier and compute tier", "Recommend a solution for database scalability", "Recommend a solution for data protection"]),
      objective("semi-unstructured-data", "Design data storage solutions for semi-structured and unstructured data", ["Recommend a solution for storing semi-structured data", "Recommend a solution for storing unstructured data", "Recommend a data storage solution to balance features, performance, and costs", "Recommend a data solution for protection and durability"]),
      objective("data-integration", "Design data integration", ["Recommend a solution for data integration", "Recommend a solution for data analysis"]),
    ]),
    domain("business-continuity", "Design business continuity solutions", "Backup and disaster recovery, and high availability.", [15, 20], "az-305", [
      objective("backup-dr", "Design solutions for backup and disaster recovery", ["Recommend a recovery solution for Azure and hybrid workloads that meets recovery objectives", "Recommend a backup and recovery solution for compute", "Recommend a backup and recovery solution for databases", "Recommend a backup and recovery solution for unstructured data"]),
      objective("high-availability", "Design for high availability", ["Recommend a high availability solution for compute", "Recommend a high availability solution for relational data", "Recommend a high availability solution for semi-structured and unstructured data"]),
    ]),
    domain("infrastructure", "Design infrastructure solutions", "Compute, application architecture, migrations and network solutions.", [30, 35], "az-305", [
      objective("compute", "Design compute solutions", ["Specify components of a compute solution based on workload requirements", "Recommend a virtual machine-based solution", "Recommend a container-based solution", "Recommend a serverless-based solution", "Recommend a compute solution for batch processing"]),
      objective("application-architecture", "Design an application architecture", ["Recommend a messaging architecture", "Recommend an event-driven architecture", "Recommend a solution for API integration", "Recommend a caching solution for applications", "Recommend an application configuration management solution", "Recommend an automated deployment solution for applications"]),
      objective("migrations", "Design migrations", ["Evaluate a migration solution that leverages the Microsoft Cloud Adoption Framework for Azure", "Evaluate on-premises servers, data, and applications for migration", "Recommend a solution for migrating workloads to infrastructure as a service (IaaS) and platform as a service (PaaS)", "Recommend a solution for migrating databases", "Recommend a solution for migrating unstructured data"]),
      objective("network-solutions", "Design network solutions", ["Recommend a connectivity solution that connects Azure resources to the internet", "Recommend a connectivity solution that connects Azure resources to on-premises networks", "Recommend a solution to optimize network performance", "Recommend a solution to optimize network security", "Recommend a load-balancing and routing solution"]),
    ]),
  ],
};

// Questions are appended to each domain, because a question's seed key comes from its position.
az104.modules = az104.modules.map((module) => ({ ...module, questions: az104Questions[module.slug] ?? [] }));

export const azurePathways: SeedPathway[] = [az900, az104, az700, az305];
