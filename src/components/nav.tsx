"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface NavProps {
  isAdmin?: boolean;
}

export function Nav({ isAdmin = false }: NavProps) {
  const pathname = usePathname();
  const isManager = pathname.startsWith("/manager");
  const isDownloads = pathname.startsWith("/downloads");
  const isLibrary =
    !isManager && !isDownloads && !pathname.startsWith("/manga/");

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/"
        className={clsx(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          isLibrary
            ? "bg-surface-700 text-accent-300"
            : "text-surface-200 hover:text-surface-50",
        )}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <span className="hidden sm:inline">Library</span>
      </Link>
      {isAdmin && (
        <Link
          href="/manager"
          className={clsx(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            isManager
              ? "bg-surface-700 text-accent-300"
              : "text-surface-200 hover:text-surface-50",
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span className="hidden sm:inline">Manager</span>
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/downloads"
          className={clsx(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            isDownloads
              ? "bg-surface-700 text-accent-300"
              : "text-surface-200 hover:text-surface-50",
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
            />
          </svg>
          <span className="hidden sm:inline">Downloads</span>
        </Link>
      )}
    </div>
  );
}
