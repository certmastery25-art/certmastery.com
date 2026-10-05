"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ArrowUpRight, BookOpenCheck, ChevronDown, CircleUserRound, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview" },
  { href: "/certifications", label: "Certifications" },
  { href: "/history", label: "My progress" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Certmaster home">
          <span className="brand-mark"><BookOpenCheck size={19} strokeWidth={2.2} /></span>
          <span>cert<span className="brand-light">master</span></span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return <Link key={link.href} href={link.href} className={cn("nav-link", active && "nav-link-active")}>{link.label}</Link>;
          })}
        </nav>
        <div className="header-actions">
          {status === "loading" ? <span className="user-skeleton" aria-label="Loading account" /> : session?.user ? (
            <div className="account-menu">
              <span className="account-name">{session.user.name?.split(" ")[0] ?? "My account"}</span>
              <button className="icon-button account-button" type="button" aria-label="Sign out" title="Sign out" onClick={() => signOut({ callbackUrl: "/" })}>
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link className="header-login" href="/login"><CircleUserRound size={17} /> Sign in <ArrowUpRight size={14} /></Link>
          )}
          <span className="free-label">Always free</span>
          <ChevronDown className="mobile-chevron" size={15} aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}