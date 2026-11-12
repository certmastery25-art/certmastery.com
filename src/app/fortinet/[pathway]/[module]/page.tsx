import type { Metadata } from "next";
import { ModuleView, getModule } from "@/components/nse/module-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ pathway: string; module: string }> }): Promise<Metadata> {
  const { pathway, module } = await params;
  const found = await getModule("FORTINET", pathway, module);
  return { title: found?.title ?? "Practice topic", description: found?.summary };
}

export default async function ModulePage({ params }: { params: Promise<{ pathway: string; module: string }> }) {
  const { pathway, module } = await params;
  return <ModuleView programme="FORTINET" pathway={pathway} slug={module} />;
}
