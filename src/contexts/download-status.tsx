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

interface RecentDownload {
  mangaTitle: string;
  mangaId: number;
  anilistId: number;
  volumeNumber: number;
  status: string;
  completedAt: string;
}

interface DownloadStatus {
  active: ActiveDownload[];
  recent: RecentDownload[];
  summary: { activeCount: number; recentCount: number };
}

const DownloadStatusContext = createContext<DownloadStatus>({
  active: [],
  recent: [],
  summary: { activeCount: 0, recentCount: 0 },
});

export function useDownloadStatus() {
  return useContext(DownloadStatusContext);
}

const POLL_INTERVAL = 10_000;

export function DownloadStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<DownloadStatus>({
    active: [],
    recent: [],
    summary: { activeCount: 0, recentCount: 0 },
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/downloads/status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // silently fail — will retry next interval
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    const startPolling = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchStatus(); // immediate refresh when tab becomes visible
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchStatus]);

  return (
    <DownloadStatusContext.Provider value={status}>
      {children}
    </DownloadStatusContext.Provider>
  );
}
