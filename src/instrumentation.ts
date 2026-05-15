export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./db/migrate");

    if (process.env.E2E === "1") {
      console.log("[MangaShelf] E2E mode: skipping scan + background tasks");
      return;
    }

    const { syncLibrary } = await import("./lib/scanner");
    try {
      const result = syncLibrary();
      console.log(
        `[MangaShelf] Library scan: +${result.added} added, ${result.updated} updated`,
      );
    } catch (e) {
      console.error("[MangaShelf] Library scan failed:", e);
    }

    // Start background tasks (download progress + auto-import)
    const { startBackgroundTasks } = await import("./lib/importer");
    startBackgroundTasks();

    // Start automatic monitoring (search & download missing volumes)
    const { startMonitorInterval } = await import("./lib/monitor");
    startMonitorInterval();

    // Start OCR dispatcher (mokuro sidecar)
    const { startOcrDispatcher } = await import("./lib/ocr");
    startOcrDispatcher();

    // Clean up stale import sessions from previous runs
    const { cleanupStaleSessions } = await import("./lib/import-session");
    cleanupStaleSessions({ startup: true });
  }
}
