"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdminFilters } from "./admin-kit";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/content", label: "Content & usage" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/logs", label: "Logs" },
];

export function AdminNav() {
  const pathname = usePathname();
  const { rangeQuery } = useAdminFilters();
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return <Link key={tab.href} href={rangeQuery ? `${tab.href}?${rangeQuery}` : tab.href} className={cn("admin-nav-link", active && "admin-nav-active")} aria-current={active ? "page" : undefined}>{tab.label}</Link>;
      })}
    </nav>
  );
}
