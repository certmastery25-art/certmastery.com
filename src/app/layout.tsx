import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppHeader } from "@/components/app-header";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: { default: "CertMastery | Prepare. Practice. Pass.", template: "%s | CertMastery" },
  description: "Prepare for Security+, Server+, CCNA, CCNP Enterprise, and Splunk Cloud Admin with focused practice questions, timed exams, and progress you can measure.",
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers><AppHeader />{children}<SiteFooter /></Providers>
      </body>
    </html>
  );
}
