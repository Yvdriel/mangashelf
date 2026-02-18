import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { ImportAnalysis } from "./import-types";
import { registerTask } from "./background/task-registry";

const STAGING_DIR = process.env.IMPORT_STAGING_DIR || "/tmp/mangashelf-import";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ImportSession {
  id: string;
  createdAt: number;
  stagingPath: string;
  status:
    | "uploading"
    | "created"
    | "analyzing"
    | "ready"
    | "importing"
    | "complete"
    | "failed";
  analysis?: ImportAnalysis;
  importConfig?: ImportConfig;
  /** Temp dir from archive extraction (needs cleanup) */
  extractionTempDir?: string | null;
  /** Upload progress tracking */
  uploadBytesReceived?: number;
  uploadBytesTotal?: number;
}

export interface ImportConfig {
  title: string;
  anilistId?: number;
  volumes: {
    id: string;
    volumeNumber: number;
    action: "import" | "skip" | "replace";
  }[];
  mode: "copy" | "move";
  addToManager: boolean;
  monitor: boolean;
  sourceType: "filesystem" | "upload";
}

// Use globalThis to share sessions across Next.js module instances
const _g = globalThis as unknown as {
  __mangashelf_import_sessions?: Map<string, ImportSession>;
};

function getSessions(): Map<string, ImportSession> {
  if (!_g.__mangashelf_import_sessions) {
    _g.__mangashelf_import_sessions = new Map();
  }
  return _g.__mangashelf_import_sessions;
}

export function createSession(): ImportSession {
  const id = crypto.randomUUID();
  const stagingPath = path.join(STAGING_DIR, id);
  fs.mkdirSync(stagingPath, { recursive: true });

  const session: ImportSession = {
    id,
    createdAt: Date.now(),
    stagingPath,
    status: "created",
  };

  getSessions().set(id, session);
  return session;
}

export function getImportSession(id: string): ImportSession | undefined {
  return getSessions().get(id);
}

export function updateSession(
  id: string,
  updates: Partial<ImportSession>,
): ImportSession | undefined {
  const session = getSessions().get(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  return session;
}

export function deleteSession(id: string): void {
  const session = getSessions().get(id);
  if (!session) return;

  // Clean up staging directory
  try {
    if (fs.existsSync(session.stagingPath)) {
      fs.rmSync(session.stagingPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.error(
      `[IMPORT] Failed to clean up staging dir for session ${id}:`,
      e,
    );
  }

  getSessions().delete(id);
}

export function getActiveImportSession(): ImportSession | undefined {
  for (const session of getSessions().values()) {
    if (session.status === "importing") return session;
  }
  return undefined;
}

export function countUploadingSessions(): number {
  let count = 0;
  for (const session of getSessions().values()) {
    if (session.status === "uploading") count++;
  }
  return count;
}

export function cleanupStaleSessions(
  options: { startup?: boolean } = {},
): void {
  const now = Date.now();
  for (const [id, session] of getSessions()) {
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
      console.log(`[IMPORT] Cleaning up stale session ${id}`);
      deleteSession(id);
    }
  }

  // Also clean up orphaned staging directories.
  // On startup, remove all orphaned dirs regardless of age since no
  // in-memory sessions survive a restart — every dir on disk is orphaned.
  try {
    if (fs.existsSync(STAGING_DIR)) {
      const entries = fs.readdirSync(STAGING_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!getSessions().has(entry.name)) {
          const dirPath = path.join(STAGING_DIR, entry.name);
          if (!options.startup) {
            const stat = fs.statSync(dirPath);
            if (now - stat.mtimeMs <= SESSION_MAX_AGE_MS) continue;
          }
          console.log(
            `[IMPORT] Cleaning up orphaned staging dir: ${entry.name}`,
          );
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      }
    }
  } catch (e) {
    console.error("[IMPORT] Failed to clean up orphaned staging dirs:", e);
  }
}

registerTask("staging-cleanup", {
  description: "Clean up orphaned import staging directories",
  intervalMs: 0, // on-demand only
  run: () => {
    cleanupStaleSessions();
    return "Staging cleanup completed";
  },
});
