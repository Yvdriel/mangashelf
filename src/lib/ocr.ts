import fs from "fs";
import path from "path";
import { db } from "@/db";
import { manga, volume, volumeOcr } from "@/db/schema";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import {
  registerTask,
  taskStarted,
  taskCompleted,
  taskFailed,
  updateTaskNextRun,
} from "./background/task-registry";
import { enqueueOcr, getJobStatus, workerHealthy } from "./mokuro-client";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const DISPATCH_INTERVAL_MS =
  (parseInt(process.env.OCR_DISPATCH_INTERVAL || "15", 10) || 15) * 1000;

export type OcrPriority = "normal" | "low";
export type OcrStatus = "queued" | "running" | "ready" | "failed";

export function mokuroFilePath(
  mangaFolderName: string,
  volumeFolderName: string,
): string {
  return path.join(MANGA_DIR, mangaFolderName, `${volumeFolderName}.mokuro`);
}

export function volumeFolderPath(
  mangaFolderName: string,
  volumeFolderName: string,
): string {
  return path.join(MANGA_DIR, mangaFolderName, volumeFolderName);
}

/**
 * Upsert an entry in volume_ocr atomically. Idempotent and concurrency-safe:
 * - Already `ready` rows are left alone.
 * - `running` rows are left alone (let the dispatcher reconcile them).
 * - `queued`/`failed` rows are reset to `queued` at the requested priority,
 *   but only if the new priority is at least as high as the existing one
 *   (normal > low, so a low request never demotes a normal one).
 *
 * Implemented as a single `INSERT … ON CONFLICT DO UPDATE` so concurrent
 * callers (scanner + manual OCR-all click on the same volume) can't race on
 * the `volume_id` PK constraint.
 */
export function enqueueVolumeOcr(
  volumeId: number,
  priority: OcrPriority = "normal",
): void {
  db.insert(volumeOcr)
    .values({ volumeId, status: "queued", priority })
    .onConflictDoUpdate({
      target: volumeOcr.volumeId,
      set: {
        status: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.status} ELSE 'queued' END`,
        priority: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.priority} WHEN ${volumeOcr.priority} = 'normal' THEN 'normal' ELSE ${priority} END`,
        jobId: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.jobId} ELSE NULL END`,
        errorMessage: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.errorMessage} ELSE NULL END`,
        queuedAt: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.queuedAt} ELSE (unixepoch()) END`,
        updatedAt: sql`(unixepoch())`,
      },
    })
    .run();
}

/**
 * Bulk-enqueue every volume of a manga at the given priority. Returns counts.
 *
 * Reads existing rows once, decides eligibility in JS, then does one bulk
 * upsert for the eligible volumes — no per-volume SELECT.
 */
export function enqueueOcrForManga(
  mangaId: number,
  priority: OcrPriority = "low",
): { queued: number; alreadyReady: number; running: number } {
  const volumes = db
    .select({ id: volume.id })
    .from(volume)
    .where(eq(volume.mangaId, mangaId))
    .all();

  if (volumes.length === 0) {
    return { queued: 0, alreadyReady: 0, running: 0 };
  }

  const existing = db
    .select({ volumeId: volumeOcr.volumeId, status: volumeOcr.status })
    .from(volumeOcr)
    .where(
      inArray(
        volumeOcr.volumeId,
        volumes.map((v) => v.id),
      ),
    )
    .all();
  const statusByVolumeId = new Map(existing.map((r) => [r.volumeId, r.status]));

  const eligible: number[] = [];
  let alreadyReady = 0;
  let running = 0;

  for (const v of volumes) {
    const status = statusByVolumeId.get(v.id);
    if (status === "ready") {
      alreadyReady++;
      continue;
    }
    if (status === "running") {
      running++;
      continue;
    }
    eligible.push(v.id);
  }

  if (eligible.length > 0) {
    db.insert(volumeOcr)
      .values(
        eligible.map((volumeId) => ({
          volumeId,
          status: "queued" as const,
          priority,
        })),
      )
      .onConflictDoUpdate({
        target: volumeOcr.volumeId,
        set: {
          status: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.status} ELSE 'queued' END`,
          priority: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.priority} WHEN ${volumeOcr.priority} = 'normal' THEN 'normal' ELSE ${priority} END`,
          jobId: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.jobId} ELSE NULL END`,
          errorMessage: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.errorMessage} ELSE NULL END`,
          queuedAt: sql`CASE WHEN ${volumeOcr.status} IN ('ready','running') THEN ${volumeOcr.queuedAt} ELSE (unixepoch()) END`,
          updatedAt: sql`(unixepoch())`,
        },
      })
      .run();
  }

  return { queued: eligible.length, alreadyReady, running };
}

interface DispatchableRow {
  volumeId: number;
  status: OcrStatus;
  priority: OcrPriority;
  jobId: string | null;
  mangaFolderName: string;
  volumeFolderName: string;
}

function nextDispatchable(): DispatchableRow | null {
  // First: any row already in flight on the worker. Always reconcile before
  // dispatching new work.
  const running = db
    .select({
      volumeId: volumeOcr.volumeId,
      status: volumeOcr.status,
      priority: volumeOcr.priority,
      jobId: volumeOcr.jobId,
      mangaFolderName: manga.folderName,
      volumeFolderName: volume.folderName,
    })
    .from(volumeOcr)
    .innerJoin(volume, eq(volumeOcr.volumeId, volume.id))
    .innerJoin(manga, eq(volume.mangaId, manga.id))
    .where(eq(volumeOcr.status, "running"))
    .orderBy(asc(volumeOcr.queuedAt))
    .limit(1)
    .get();

  if (running) {
    return {
      volumeId: running.volumeId,
      status: "running",
      priority: running.priority as OcrPriority,
      jobId: running.jobId,
      mangaFolderName: running.mangaFolderName,
      volumeFolderName: running.volumeFolderName,
    };
  }

  // Otherwise pick the next queued row. `'normal' > 'low'` lexicographically,
  // so `priority DESC` puts normal-priority jobs ahead of the low-priority
  // backfill drip; `queuedAt ASC` is the FIFO tiebreaker within a priority.
  const queued = db
    .select({
      volumeId: volumeOcr.volumeId,
      status: volumeOcr.status,
      priority: volumeOcr.priority,
      jobId: volumeOcr.jobId,
      mangaFolderName: manga.folderName,
      volumeFolderName: volume.folderName,
    })
    .from(volumeOcr)
    .innerJoin(volume, eq(volumeOcr.volumeId, volume.id))
    .innerJoin(manga, eq(volume.mangaId, manga.id))
    .where(eq(volumeOcr.status, "queued"))
    .orderBy(desc(volumeOcr.priority), asc(volumeOcr.queuedAt))
    .limit(1)
    .get();

  if (!queued) return null;
  return {
    volumeId: queued.volumeId,
    status: "queued",
    priority: queued.priority as OcrPriority,
    jobId: queued.jobId,
    mangaFolderName: queued.mangaFolderName,
    volumeFolderName: queued.volumeFolderName,
  };
}

function markFailed(volumeId: number, error: string) {
  db.update(volumeOcr)
    .set({
      status: "failed",
      errorMessage: error.slice(0, 1000),
      updatedAt: new Date(),
    })
    .where(eq(volumeOcr.volumeId, volumeId))
    .run();
}

function markReady(volumeId: number) {
  db.update(volumeOcr)
    .set({
      status: "ready",
      errorMessage: null,
      jobId: null,
      updatedAt: new Date(),
    })
    .where(eq(volumeOcr.volumeId, volumeId))
    .run();
}

function markRunning(volumeId: number, jobId: string) {
  db.update(volumeOcr)
    .set({ status: "running", jobId, updatedAt: new Date() })
    .where(eq(volumeOcr.volumeId, volumeId))
    .run();
}

async function processOnce(): Promise<string> {
  const row = nextDispatchable();
  if (!row) return "idle";

  const mokuroPath = mokuroFilePath(row.mangaFolderName, row.volumeFolderName);
  const volPath = volumeFolderPath(row.mangaFolderName, row.volumeFolderName);

  // Authoritative: if the file exists, mark ready regardless of DB state.
  if (fs.existsSync(mokuroPath)) {
    markReady(row.volumeId);
    return `ready: vol#${row.volumeId} (file existed)`;
  }

  if (row.status === "queued") {
    if (!fs.existsSync(volPath)) {
      markFailed(row.volumeId, `volume folder missing: ${volPath}`);
      return `failed: vol#${row.volumeId} (folder missing)`;
    }
    if (!(await workerHealthy())) {
      // Leave row queued; try again on next tick. Don't spam logs.
      return "worker offline";
    }
    const jobKey = `vol-${row.volumeId}`;
    const result = await enqueueOcr(volPath, jobKey);
    markRunning(row.volumeId, result.jobId);
    return `dispatched: vol#${row.volumeId} job=${result.jobId} (${row.priority})`;
  }

  // running: poll worker
  if (!row.jobId) {
    // Lost track — re-queue.
    db.update(volumeOcr)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(volumeOcr.volumeId, row.volumeId))
      .run();
    return `requeued: vol#${row.volumeId} (no jobId)`;
  }

  const status = await getJobStatus(row.jobId).catch(() => null);
  if (!status) {
    // Worker forgot the job. If file landed, mark ready; otherwise re-queue.
    if (fs.existsSync(mokuroPath)) {
      markReady(row.volumeId);
      return `ready: vol#${row.volumeId} (worker amnesia, file present)`;
    }
    db.update(volumeOcr)
      .set({ status: "queued", jobId: null, updatedAt: new Date() })
      .where(eq(volumeOcr.volumeId, row.volumeId))
      .run();
    return `requeued: vol#${row.volumeId} (worker amnesia)`;
  }

  if (status.status === "done") {
    if (fs.existsSync(mokuroPath)) {
      markReady(row.volumeId);
      return `ready: vol#${row.volumeId}`;
    }
    markFailed(
      row.volumeId,
      `worker reported done but ${path.basename(mokuroPath)} not found`,
    );
    return `failed: vol#${row.volumeId} (file missing)`;
  }
  if (status.status === "failed") {
    markFailed(row.volumeId, status.error ?? "unknown worker error");
    return `failed: vol#${row.volumeId}`;
  }
  // queued / running on worker — leave alone.
  return `polling: vol#${row.volumeId} (${status.status})`;
}

let dispatcherStarted = false;
let dispatcherInFlight = false;

// Single-flight wrapper around processOnce(). Synchronously claims the
// inFlight flag before any await so concurrent callers (interval tick + admin
// triggerTask) can never overlap.
async function singleFlightProcessOnce(): Promise<string> {
  if (dispatcherInFlight) return "skipped: already in flight";
  dispatcherInFlight = true;
  try {
    return await processOnce();
  } finally {
    dispatcherInFlight = false;
  }
}

async function intervalTick(): Promise<void> {
  if (dispatcherInFlight) return;
  taskStarted("ocr-dispatcher");
  try {
    const result = await singleFlightProcessOnce();
    taskCompleted("ocr-dispatcher", result);
  } catch (e) {
    taskFailed("ocr-dispatcher", e instanceof Error ? e.message : String(e));
  } finally {
    updateTaskNextRun(
      "ocr-dispatcher",
      new Date(Date.now() + DISPATCH_INTERVAL_MS),
    );
  }
}

export function startOcrDispatcher() {
  if (dispatcherStarted) return;
  dispatcherStarted = true;

  registerTask("ocr-dispatcher", {
    description: "Dispatch & poll mokuro OCR jobs",
    intervalMs: DISPATCH_INTERVAL_MS,
    run: singleFlightProcessOnce,
  });

  setInterval(intervalTick, DISPATCH_INTERVAL_MS);
}

export interface MangaOcrSummary {
  total: number;
  ready: number;
  queued: number;
  running: number;
  failed: number;
}

export function getMangaOcrSummary(mangaId: number): MangaOcrSummary {
  const totalRow = db
    .select({ c: sql<number>`count(*)` })
    .from(volume)
    .where(eq(volume.mangaId, mangaId))
    .get();
  const total = totalRow?.c ?? 0;

  const rows = db
    .select({ status: volumeOcr.status })
    .from(volumeOcr)
    .innerJoin(volume, eq(volumeOcr.volumeId, volume.id))
    .where(eq(volume.mangaId, mangaId))
    .all();

  let ready = 0;
  let queued = 0;
  let running = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.status === "ready") ready++;
    else if (r.status === "queued") queued++;
    else if (r.status === "running") running++;
    else if (r.status === "failed") failed++;
  }
  return { total, ready, queued, running, failed };
}

export function getVolumeOcrStatuses(
  mangaId: number,
): Map<number, OcrStatus> {
  const rows = db
    .select({ volumeId: volumeOcr.volumeId, status: volumeOcr.status })
    .from(volumeOcr)
    .innerJoin(volume, eq(volumeOcr.volumeId, volume.id))
    .where(eq(volume.mangaId, mangaId))
    .all();
  return new Map(rows.map((r) => [r.volumeId, r.status as OcrStatus]));
}

/**
 * Resolve a volume's `.mokuro` file path on disk. Returns null if the volume
 * is not in the DB or the file isn't present.
 */
export function resolveMokuroFile(
  mangaId: number,
  volumeNumber: number,
): { absolutePath: string; volumeId: number } | null {
  const row = db
    .select({
      volumeId: volume.id,
      mangaFolder: manga.folderName,
      volumeFolder: volume.folderName,
    })
    .from(volume)
    .innerJoin(manga, eq(volume.mangaId, manga.id))
    .where(
      and(eq(volume.mangaId, mangaId), eq(volume.volumeNumber, volumeNumber)),
    )
    .get();
  if (!row) return null;
  const p = mokuroFilePath(row.mangaFolder, row.volumeFolder);
  if (!fs.existsSync(p)) return null;
  return { absolutePath: p, volumeId: row.volumeId };
}
