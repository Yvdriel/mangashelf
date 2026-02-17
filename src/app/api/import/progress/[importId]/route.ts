import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/db";
import {
  managedManga,
  managedVolume,
  importHistory,
  importHistoryVolume,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getImportSession, updateSession } from "@/lib/import-session";
import {
  importVolume,
  importVolumeMove,
  findDirectImageFiles,
} from "@/lib/importer";
import { syncLibrary } from "@/lib/scanner";
import { getMangaDetail } from "@/lib/anilist";
import { cleanupTempDir } from "@/lib/extractor";

export const dynamic = "force-dynamic";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ importId: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return new Response("Unauthorized", { status: 403 });
  }

  const { importId } = await params;
  const importSession = getImportSession(importId);

  if (!importSession) {
    return new Response("Import session not found", { status: 404 });
  }

  if (!importSession.importConfig || !importSession.analysis) {
    return new Response("Import not configured", { status: 400 });
  }

  const config = importSession.importConfig;
  const analysis = importSession.analysis;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const volumesToImport = config.volumes.filter(
          (v) => v.action !== "skip",
        );
        const totalVolumes = volumesToImport.length;
        let completedVolumes = 0;
        let totalPagesImported = 0;
        let mangaId: number | null = null;
        const volumeResults: {
          volumeNumber: number;
          pageCount: number;
          sizeBytes: number;
          sourcePath: string;
          status: "imported" | "replaced" | "skipped" | "failed";
          errorMessage?: string;
        }[] = [];

        const title = config.title;
        const anilistId = config.anilistId;

        // Determine the import function based on mode
        const doImport =
          config.mode === "move" ? importVolumeMove : importVolume;

        for (const volConfig of config.volumes) {
          if (volConfig.action === "skip") continue;

          const analysisVolume = analysis.volumes.find(
            (v) => v.id === volConfig.id,
          );
          if (!analysisVolume) continue;

          send("volume_start", {
            volumeNumber: volConfig.volumeNumber,
            currentVolume: completedVolumes + 1,
            totalVolumes,
          });

          try {
            // Handle "replace" — move existing volume to trash
            if (volConfig.action === "replace" && anilistId) {
              const volLabel = `v${String(volConfig.volumeNumber).padStart(2, "0")}`;
              const existingDir = path.join(
                MANGA_DIR,
                `${title} [anilist-${anilistId}]`,
                volLabel,
              );

              if (fs.existsSync(existingDir)) {
                const trashDir = path.join(
                  MANGA_DIR,
                  ".trash",
                  `${Date.now()}`,
                  volLabel,
                );
                fs.mkdirSync(path.dirname(trashDir), { recursive: true });
                fs.renameSync(existingDir, trashDir);
              }
            }

            if (!anilistId) {
              // Import without AniList — use title-only folder name
              // For non-AniList imports, we need a different folder structure
              send("volume_failed", {
                volumeNumber: volConfig.volumeNumber,
                error: "Import without AniList ID is not yet supported",
              });
              continue;
            }

            const success = doImport(
              analysisVolume.sourcePath,
              title,
              anilistId,
              volConfig.volumeNumber,
            );

            if (success) {
              const pageCount = findDirectImageFiles(
                path.join(
                  MANGA_DIR,
                  `${title} [anilist-${anilistId}]`,
                  `v${String(volConfig.volumeNumber).padStart(2, "0")}`,
                ),
              ).length;

              completedVolumes++;
              totalPagesImported += pageCount;

              volumeResults.push({
                volumeNumber: volConfig.volumeNumber,
                pageCount,
                sizeBytes: analysisVolume.totalSizeBytes,
                sourcePath: analysisVolume.sourcePath,
                status:
                  volConfig.action === "replace" ? "replaced" : "imported",
              });

              send("volume_complete", {
                volumeNumber: volConfig.volumeNumber,
                pagesImported: pageCount,
                completedVolumes,
                totalVolumes,
              });
            } else {
              volumeResults.push({
                volumeNumber: volConfig.volumeNumber,
                pageCount: 0,
                sizeBytes: analysisVolume.totalSizeBytes,
                sourcePath: analysisVolume.sourcePath,
                status: "failed",
                errorMessage: "No image files found in volume folder",
              });

              send("volume_failed", {
                volumeNumber: volConfig.volumeNumber,
                error: "No image files found in volume folder",
              });
            }
          } catch (e) {
            volumeResults.push({
              volumeNumber: volConfig.volumeNumber,
              pageCount: 0,
              sizeBytes: 0,
              sourcePath: analysisVolume?.sourcePath || "",
              status: "failed",
              errorMessage: String(e),
            });

            send("volume_failed", {
              volumeNumber: volConfig.volumeNumber,
              error: String(e),
            });
          }
        }

        // Run library scan to pick up new volumes
        try {
          syncLibrary();
        } catch (e) {
          console.error("[IMPORT] Library sync failed after import:", e);
        }

        // Look up the reader manga ID
        if (anilistId) {
          const { manga } = await import("@/db/schema");
          const readerManga = db
            .select()
            .from(manga)
            .where(eq(manga.anilistId, anilistId))
            .get();
          if (readerManga) {
            mangaId = readerManga.id;
          }
        }

        // Add to manager if requested
        if (config.addToManager && anilistId) {
          try {
            let existing = db
              .select()
              .from(managedManga)
              .where(eq(managedManga.anilistId, anilistId))
              .get();

            if (!existing) {
              // Fetch full metadata from AniList
              const detail = await getMangaDetail(anilistId);
              existing = db
                .insert(managedManga)
                .values({
                  anilistId,
                  titleRomaji: detail.title.romaji,
                  titleEnglish: detail.title.english,
                  titleNative: detail.title.native,
                  synonyms: JSON.stringify(detail.synonyms || []),
                  coverImage:
                    detail.coverImage.extraLarge || detail.coverImage.large,
                  bannerImage: detail.bannerImage,
                  description: detail.description,
                  totalVolumes: detail.volumes,
                  status: detail.status,
                  genres: JSON.stringify(detail.genres || []),
                  averageScore: detail.averageScore,
                  staff: JSON.stringify(detail.staff?.edges || []),
                  monitored: config.monitor,
                })
                .returning()
                .get();
            } else if (config.monitor && !existing.monitored) {
              db.update(managedManga)
                .set({ monitored: true, updatedAt: new Date() })
                .where(eq(managedManga.id, existing.id))
                .run();
            }

            // Create/update managed volume records for imported volumes
            for (const volConfig of config.volumes) {
              if (volConfig.action === "skip") continue;

              const mv = db
                .select()
                .from(managedVolume)
                .where(
                  and(
                    eq(managedVolume.managedMangaId, existing.id),
                    eq(managedVolume.volumeNumber, volConfig.volumeNumber),
                  ),
                )
                .get();

              if (!mv) {
                db.insert(managedVolume)
                  .values({
                    managedMangaId: existing.id,
                    volumeNumber: volConfig.volumeNumber,
                    status: "imported",
                  })
                  .run();
              } else if (mv.status !== "imported") {
                db.update(managedVolume)
                  .set({ status: "imported", updatedAt: new Date() })
                  .where(eq(managedVolume.id, mv.id))
                  .run();
              }
            }
          } catch (e) {
            console.error("[IMPORT] Failed to add to manager:", e);
          }
        }

        // Clean up extraction temp dir if any
        if (importSession.extractionTempDir) {
          cleanupTempDir(importSession.extractionTempDir);
        }

        // Record import history
        try {
          const failedCount = volumeResults.filter(
            (v) => v.status === "failed",
          ).length;
          const historyStatus =
            completedVolumes === 0
              ? "failed"
              : failedCount > 0
                ? "partial"
                : "completed";
          const totalSizeBytes = volumeResults.reduce(
            (s, v) => s + v.sizeBytes,
            0,
          );

          const historyRecord = db
            .insert(importHistory)
            .values({
              mangaId,
              mangaTitle: title,
              sourceType: config.sourceType,
              sourcePath: analysis.sourcePath,
              volumesImported: completedVolumes,
              pagesImported: totalPagesImported,
              totalSizeBytes,
              mode: config.mode,
              status: historyStatus,
            })
            .returning()
            .get();

          for (const vol of volumeResults) {
            db.insert(importHistoryVolume)
              .values({
                importId: historyRecord.id,
                volumeNumber: vol.volumeNumber,
                pageCount: vol.pageCount,
                sizeBytes: vol.sizeBytes,
                sourcePath: vol.sourcePath,
                status: vol.status,
                errorMessage: vol.errorMessage || null,
              })
              .run();
          }
        } catch (e) {
          console.error("[IMPORT] Failed to record import history:", e);
        }

        updateSession(importId, { status: "complete" });

        send("complete", {
          totalVolumes: completedVolumes,
          totalPages: totalPagesImported,
          mangaId,
        });
      } catch (e) {
        updateSession(importId, { status: "failed" });
        send("error", { error: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
