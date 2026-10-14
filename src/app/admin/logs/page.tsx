import type { Metadata } from "next";
import { LogsView } from "@/components/admin/logs-view";

export const metadata: Metadata = { title: "Admin · Logs" };

export default function AdminLogsPage() {
  return <LogsView />;
}
