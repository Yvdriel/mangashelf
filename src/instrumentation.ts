export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./db/migrate");
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
  }
}
