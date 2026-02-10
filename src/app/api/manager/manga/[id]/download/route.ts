import { NextResponse } from "next/server";
import { db } from "@/db";
import { managedManga, managedVolume, downloadHistory } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { addTorrent } from "@/lib/deluge";

const DOWNLOAD_DIR = process.env.DELUGE_DOWNLOAD_DIR || "/downloads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mangaId = parseInt(id, 10);
  const body = await request.json();
  const { magnetLink, volumeNumber } = body;

  if (!magnetLink || typeof magnetLink !== "string") {
    return NextResponse.json(
      { error: "magnetLink is required" },
      { status: 400 },
    );
  }

  const manga = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.id, mangaId))
    .get();

  if (!manga) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find the managed volume if volume number specified
  let volume = null;
  if (volumeNumber != null) {
    volume = db
      .select()
      .from(managedVolume)
      .where(
        and(
          eq(managedVolume.managedMangaId, mangaId),
          eq(managedVolume.volumeNumber, volumeNumber),
        ),
      )
      .get();
  }

  try {
    const torrentId = await addTorrent(magnetLink, DOWNLOAD_DIR);

    // Create download history entry
    const torrentName =
      magnetLink.match(/dn=([^&]+)/)?.[1]?.replace(/\+/g, " ") ||
      "Unknown torrent";

    db.insert(downloadHistory)
      .values({
        managedMangaId: mangaId,
        managedVolumeId: volume?.id || null,
        torrentName: decodeURIComponent(torrentName),
        magnetLink,
        status: "sent",
      })
      .run();

    // Update volume status if we have one
    if (volume && torrentId) {
      db.update(managedVolume)
        .set({
          status: "downloading",
          torrentId,
          updatedAt: new Date(),
        })
        .where(eq(managedVolume.id, volume.id))
        .run();
    }

    return NextResponse.json({ success: true, torrentId });
  } catch (e) {
    console.error("[Manager] Deluge download error:", e);
    return NextResponse.json(
      { error: "Failed to send to Deluge" },
      { status: 500 },
    );
  }
}
