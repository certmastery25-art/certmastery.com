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
};

export type SeedModule = {
  slug: string;
  title: string;
  summary: string;
  weight: number;
  objectives: string[];
  notes: string;
  concepts: string[];
  exercise?: string;
  sources: string[];
  version?: string;
  questions: SeedQuestion[];
};

export type SeedPathway = {
  slug: string;
  level: number;
  track?: "SECURE_NETWORKING" | "SECURITY_OPERATIONS" | "SASE" | "CLOUD_SECURITY";
  title: string;
  summary: string;
  overview: string;
  prerequisites: string[];
  objectives: string[];
  officialExams: string[];
  officialPage: string;
  officialSpec?: string;
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
