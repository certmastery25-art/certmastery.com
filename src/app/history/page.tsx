import type { Metadata } from "next";
import { ProgressDashboard } from "@/components/progress-dashboard";

export const metadata: Metadata = { title: "My progress" };

export default function HistoryPage() {
  return <main className="main-content inner-page history-page"><div className="page-heading"><p className="eyebrow">THE LONG GAME</p><h1>Your progress, in focus.</h1><p>See what is sticking, spot the gaps, and decide where to put your next study block.</p></div><ProgressDashboard /></main>;
}