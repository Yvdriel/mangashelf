import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ScanButton } from "@/components/scan-button";
import { Nav } from "@/components/nav";
import { DownloadIndicator } from "@/components/download-indicator";
import { DownloadStatusProvider } from "@/contexts/download-status";
import { SwRegister } from "@/components/sw-register";
import Link from "next/link";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MangaShelf",
  description: "Self-hosted manga reader",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MangaShelf",
  },
  other: {
    "apple-touch-icon": "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1e",
  viewportFit: "cover",
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
        <DownloadStatusProvider>
          <nav className="sticky top-0 z-50 border-b border-surface-600 bg-surface-900/80 backdrop-blur-sm">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
              <div className="flex items-center gap-6">
                <Link
                  href="/"
                  className="text-lg font-semibold tracking-tight text-accent-300 hover:text-accent-200 transition-colors"
                >
                  MangaShelf
                </Link>
                <Nav />
              </div>
              <div className="flex items-center gap-2">
                <DownloadIndicator />
                <ScanButton />
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </DownloadStatusProvider>
        <SwRegister />
      </body>
    </html>
  );
}
