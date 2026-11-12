import type { NseProgramme } from "@prisma/client";

// What differs between vendor programmes that share the pathway, exam and readiness engine.
export const PROGRAMMES = {
  FORTINET: { key: "FORTINET", base: "/fortinet", name: "Fortinet NSE Academy", vendor: "Fortinet", docs: "Fortinet's documentation", start: "/fortinet/nse-1" },
  AZURE: { key: "AZURE", base: "/azure", name: "Microsoft Azure", vendor: "Microsoft", docs: "Microsoft Learn", start: "/azure/az-104" },
} as const satisfies Record<NseProgramme, { key: NseProgramme; base: string; name: string; vendor: string; docs: string; start: string }>;

export type Programme = (typeof PROGRAMMES)[NseProgramme];

export const programmeOf = (key: NseProgramme | null | undefined): Programme => PROGRAMMES[key ?? "FORTINET"];
