import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-brand">
          <Link href="/" className="brand" aria-label="CertMastery home">
            <Image className="brand-mark" src="/brand/certmastery-mark.png" alt="" width={32} height={32} unoptimized />
            <span className="brand-name">CERT<span className="brand-light">MASTERY</span></span>
          </Link>
          <p>Prepare. Practise. Pass. Independent practice for IT certification exams.</p>
        </div>
        <nav className="site-footer-links" aria-label="Footer">
          <div><strong>Learn</strong><Link href="/certifications">Certifications</Link><Link href="/practice">Practice tests</Link><Link href="/labs">Hands-on labs</Link></div>
          <div><strong>Account</strong><Link href="/history">My progress</Link><Link href="/login">Sign in</Link><Link href="/register">Create free account</Link></div>
          <div><strong>About</strong><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link></div>
        </nav>
      </div>
      <div className="container site-footer-legal">
        <span>© {new Date().getFullYear()} CertMastery</span>
        <span>Not affiliated with CompTIA, Cisco or Splunk. Exam names are trademarks of their owners.</span>
      </div>
    </footer>
  );
}
