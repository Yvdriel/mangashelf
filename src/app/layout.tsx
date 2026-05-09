import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { ScanButton } from "@/components/scan-button";
import { Nav } from "@/components/nav";
import { DownloadIndicator } from "@/components/download-indicator";
import { GlobalDownloadProgress } from "@/components/global-download-progress";
import { DownloadStatusProvider } from "@/contexts/download-status";
import { ThemeProvider } from "@/contexts/theme";
import { SettingsProvider } from "@/contexts/settings";
import { SwRegister } from "@/components/sw-register";
import { UserMenu } from "@/components/user-menu";
import { getSession } from "@/lib/auth-helpers";
import {
  THEME_COOKIE,
  THEME_META_COLORS,
  isTheme,
  isThemePreference,
} from "@/lib/theme";
import type { Theme, ThemePreference } from "@/lib/theme";
import { Logo } from "@/components/logo";
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
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MangaShelf",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(THEME_COOKIE)?.value;
  const resolved: Theme = raw && isTheme(raw) ? raw : "dark";

  return {
    themeColor: THEME_META_COLORS[resolved],
    viewportFit: "cover",
  };
}

/** Inline script that runs before first paint to handle "system" preference */
const THEME_INIT_SCRIPT = `
(function(){
  var t=document.documentElement.getAttribute("data-theme");
  if(!t){
    var d=window.matchMedia("(prefers-color-scheme:dark)").matches;
    document.documentElement.setAttribute("data-theme",d?"dark":"chalk");
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const isAdmin = session?.user?.role === "admin";

  // Read theme preference from cookie
  const cookieStore = await cookies();
  const rawPreference = cookieStore.get(THEME_COOKIE)?.value;
  const preference: ThemePreference =
    rawPreference && isThemePreference(rawPreference) ? rawPreference : "dark";

  // Resolve data-theme attribute for SSR
  // "system" can't be resolved server-side — the inline script handles it
  const dataTheme: string | undefined =
    preference !== "system" ? preference : undefined;

  return (
    <html lang="en" data-theme={dataTheme} data-no-transition="">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geist.variable} font-[family-name:var(--font-geist)] bg-surface-900 text-surface-50 antialiased`}
      >
        <ThemeProvider initialPreference={preference}>
         <SettingsProvider>
          <DownloadStatusProvider>
            <nav className="sticky top-0 z-50 border-b border-surface-600 bg-surface-900/80 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-[max(1rem,env(safe-area-inset-left))] min-w-0">
                <div className="flex items-center gap-6">
                  <Link
                    href="/"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Logo className="h-8 w-8" />
                  </Link>
                  {session && <Nav isAdmin={isAdmin} />}
                </div>
                <div className="flex items-center gap-2">
                  {session && isAdmin && (
                    <>
                      <DownloadIndicator />
                      <ScanButton />
                    </>
                  )}
                  {session && (
                    <UserMenu
                      userName={session.user.name}
                      userEmail={session.user.email}
                      isAdmin={isAdmin}
                    />
                  )}
                </div>
              </div>
            </nav>
            {session && isAdmin && <GlobalDownloadProgress />}
            <main className="mx-auto max-w-7xl px-[max(1rem,env(safe-area-inset-left))] py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {children}
            </main>
          </DownloadStatusProvider>
         </SettingsProvider>
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
