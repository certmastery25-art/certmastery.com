import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminPage } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

// Non-admins get a 404 rather than a 403 so the admin area is not advertised.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <main className="main-content inner-page admin-page">
      <div className="page-heading admin-heading"><p className="eyebrow">CERTMASTERY / ADMIN</p><h1>Site analytics</h1></div>
      <Suspense><AdminNav /></Suspense>
      <Suspense>{children}</Suspense>
    </main>
  );
}
