import type { Metadata } from "next";
import { DashboardView } from "@/components/nse/dashboard-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fortinet NSE dashboard", robots: { index: false, follow: false } };

export default function NseDashboardPage() {
  return <DashboardView programme="FORTINET" />;
}
