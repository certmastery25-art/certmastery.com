"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { CircleUserRound, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/certifications", label: "Certifications" },
  { href: "/practice", label: "Practice tests" },
  { href: "/labs", label: "Hands-on labs" },
  { href: "/history", label: "My progress" },
  { href: "/contact", label: "Contact" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const navLinks = session?.user.role === "ADMIN" ? [...links, { href: "/admin", label: "Admin" }] : links;

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="CertMastery home">
          <Image className="brand-mark" src="/brand/certmastery-mark.png" alt="" width={36} height={36} priority unoptimized />
          <span className="brand-name">CERT<span className="brand-light">MASTERY</span></span>
        </Link>
        <nav id="main-nav" className={cn("main-nav", menuOpen && "main-nav-open")} aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} className={cn("nav-link", active && "nav-link-active")} aria-current={active ? "page" : undefined}>{link.label}</Link>;
          })}
        </nav>
        <div className="header-actions">
          {status === "loading" ? <span className="user-skeleton" aria-label="Loading account" /> : session?.user ? (
            <div className="account-menu">
              <span className="account-name">{session.user.name?.split(" ")[0] ?? "My account"}</span>
              <button className="icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={() => signOut({ callbackUrl: "/" })}>
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <>
              <Link className="header-login" href="/login"><CircleUserRound size={17} /> Sign in</Link>
              <Link className="button button-primary button-small header-register" href="/register">Create free account</Link>
            </>
          )}
          <button className="icon-button menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-nav" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
