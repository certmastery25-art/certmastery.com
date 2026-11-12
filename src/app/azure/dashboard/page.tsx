import type { Metadata } from "next";
import { DashboardView } from "@/components/nse/dashboard-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Azure dashboard", robots: { index: false, follow: false } };

export default function AzureDashboardPage() {
  return <DashboardView programme="AZURE" />;
}
