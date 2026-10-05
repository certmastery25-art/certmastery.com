import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppHeader } from "@/components/app-header";
import { Providers } from "@/components/providers";
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
  title: { default: "Certmaster | IT certification practice", template: "%s | Certmaster" },
  description: "Prepare for Security+, Server+, and CCNA with focused practice questions, timed exams, and progress you can measure.",
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
        <Providers><AppHeader />{children}</Providers>
      </body>
    </html>
  );
}
