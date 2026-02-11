"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

interface ActiveDownload {
  managedVolumeId: number;
  mangaTitle: string;
  mangaId: number;
  anilistId: number;
  coverImage: string | null;
  volumeNumber: number;
  progress: number;
  downloadSpeed: number;
  status: string;
}

interface BulkDownload {
  mangaId: number;
  anilistId: number;
  mangaTitle: string;
  coverImage: string | null;
  progress: number;
  downloadSpeed: number;
}

interface RecentDownload {
  mangaTitle: string;
  mangaId: number;
  anilistId: number;
  volumeNumber: number;
  status: string;
  completedAt: string;
}

interface DownloadStatusData {
  active: ActiveDownload[];
  bulk: BulkDownload[];
  recent: RecentDownload[];
  hasActiveDownloads: boolean;
  summary: { activeCount: number; bulkCount: number; recentCount: number };
}

interface DownloadStatus extends DownloadStatusData {
  refresh: () => void;
}

const DownloadStatusContext = createContext<DownloadStatus>({
  active: [],
  bulk: [],
  recent: [],
  hasActiveDownloads: false,
  summary: { activeCount: 0, bulkCount: 0, recentCount: 0 },
  refresh: () => {},
});

export function useDownloadStatus() {
  return useContext(DownloadStatusContext);
}

const POLL_FAST = 2_000;
const POLL_SLOW = 10_000;

export function DownloadStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<DownloadStatusData>({
    active: [],
    bulk: [],
    recent: [],
    hasActiveDownloads: false,
    summary: { activeCount: 0, bulkCount: 0, recentCount: 0 },
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/downloads/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        return data.hasActiveDownloads as boolean;
      }
    } catch {
      // silently fail — will retry next interval
    }
    return false;
  }, []);

  const scheduleNext = useCallback(
    (hasActive: boolean) => {
      if (!visibleRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const interval = hasActive ? POLL_FAST : POLL_SLOW;
      timerRef.current = setTimeout(async () => {
        const active = await fetchStatus();
        scheduleNext(active);
      }, interval);
    },
    [fetchStatus],
  );

  // Refresh: immediately fetch and restart polling at fast speed
  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    (async () => {
      const hasActive = await fetchStatus();
      scheduleNext(hasActive);
    })();
  }, [fetchStatus, scheduleNext]);

  useEffect(() => {
    // Initial fetch then start adaptive polling
    (async () => {
      const hasActive = await fetchStatus();
      scheduleNext(hasActive);
    })();

    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        visibleRef.current = true;
        const hasActive = await fetchStatus();
        scheduleNext(hasActive);
      } else {
        visibleRef.current = false;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchStatus, scheduleNext]);

  const value = useCallback(() => ({ ...status, refresh }), [status, refresh]);

  return (
    <DownloadStatusContext.Provider value={value()}>
      {children}
    </DownloadStatusContext.Provider>
  );
}
