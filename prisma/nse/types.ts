export type SeedDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

/** Answer entries: SINGLE/MULTIPLE [text, why] with `c` listing correct indexes; ORDERING [step, why] in the correct order; MATCHING [item, target, why]. */
export type SeedQuestion = {
  type?: "SINGLE" | "MULTIPLE" | "MATCHING" | "ORDERING";
  d: SeedDifficulty;
  topic: string;
  tech: string;
  p: string;
  x?: string;
  e: string;
  a: string[][];
  c?: number[];
  /** Slug of the vendor objective in this module that the question practises. */
  obj?: string;
};

export type SeedModule = {
  slug: string;
  title: string;
  summary: string;
  weight: number;
  objectives: string[];
  concepts: string[];
  exercise?: string;
  sources: string[];
  version?: string;
  /** The vendor's published share of the exam, in percent. */
  weightRange?: [min: number, max: number];
  /** Vendor objectives in this module, each with the skills it lists. */
  examObjectives?: { slug: string; title: string; skills: string[] }[];
  questions: SeedQuestion[];
};

export type SeedPathway = {
  slug: string;
  /** Defaults to FORTINET. */
  programme?: "FORTINET" | "AZURE";
  level: number;
  track?: "SECURE_NETWORKING" | "SECURITY_OPERATIONS" | "SASE" | "CLOUD_SECURITY";
  title: string;
  summary: string;
  overview: string;
  prerequisites: string[];
  objectives: string[];
  officialExams: string[];
  /** A Fortinet training page name; other vendors give officialUrl instead. */
  officialPage?: string;
  officialUrl?: string;
  officialSpec?: string;
  /** The vendor's "skills measured as of" date, YYYY-MM-DD. */
  skillsAsOf?: string;
  /** Defaults to PUBLISHED. A DRAFT pathway and its modules stay hidden from students. */
  status?: "DRAFT" | "PUBLISHED";
  requires?: { slug: string; kind: "REQUIRED" | "RECOMMENDED"; note?: string }[];
  version?: string;
  mock: [questions: number, minutes: number];
  target: number;
  modules: SeedModule[];
};

export const DOCS = {
  fortigate: "https://docs.fortinet.com/product/fortigate",
  fortimanager: "https://docs.fortinet.com/product/fortimanager",
  fortianalyzer: "https://docs.fortinet.com/product/fortianalyzer",
  fortisase: "https://docs.fortinet.com/product/fortisase",
  training: "https://training.fortinet.com/",
};
