import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="main-content inner-page privacy-page">
      <div className="page-heading"><p className="eyebrow">PRIVACY</p><h1>How CertMastery uses your data.</h1></div>
      <div className="privacy-copy">
        <p><strong>We record anonymised usage analytics to improve the site.</strong> This covers which pages are visited, quiz settings such as certification, mode, and difficulty, the device type, the country, and the website that referred the visit.</p>
        <p>A random visitor ID is kept in a first-party cookie so we can count unique visitors. We do not store IP addresses, full browser details, or passwords in these analytics, and detailed records are deleted after 90 days. Only daily totals are kept after that.</p>
        <p>If you create an account, we store your name, email address, and your quiz answers and results so you can track your progress.</p>
      </div>
    </main>
  );
}
