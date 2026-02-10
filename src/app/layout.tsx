import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ScanButton } from "@/components/scan-button";
import Link from "next/link";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MangaShelf",
  description: "Self-hosted manga reader",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} font-[family-name:var(--font-geist)] bg-surface-900 text-surface-50 antialiased`}
      >
        <nav className="sticky top-0 z-50 border-b border-surface-600 bg-surface-900/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-accent-300 hover:text-accent-200 transition-colors"
            >
              MangaShelf
            </Link>
            <ScanButton />
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
