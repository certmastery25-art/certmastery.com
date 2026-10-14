import { Activity, BookOpenCheck, Network, ShieldCheck, Waypoints, type LucideIcon } from "lucide-react";

// Icons are keyed by slug so adding a certification never shifts the others' icons.
const ICONS: Record<string, LucideIcon> = {
  ccna: ShieldCheck,
  "ccnp-enterprise": Network,
  "security-plus": Waypoints,
  "server-plus": BookOpenCheck,
  "splunk-cloud-admin": Activity,
};

export function certificationIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? BookOpenCheck;
}
