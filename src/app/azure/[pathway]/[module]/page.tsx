import type { Metadata } from "next";
import { ModuleView, getModule } from "@/components/nse/module-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ pathway: string; module: string }> }): Promise<Metadata> {
  const { pathway, module } = await params;
  const found = await getModule("AZURE", pathway, module);
  return { title: found ? `${found.title}: ${pathway.toUpperCase()} practice` : "Azure practice", description: found?.summary };
}

export default async function AzureModulePage({ params }: { params: Promise<{ pathway: string; module: string }> }) {
  const { pathway, module } = await params;
  return <ModuleView programme="AZURE" pathway={pathway} slug={module} />;
}
