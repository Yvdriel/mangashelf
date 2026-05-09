import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { loadMokuroFile, type MokuroFile } from "@/lib/mokuro";

export const dynamic = "force-dynamic";

export default async function MangaTextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const mangaId = parseInt(id, 10);
  if (Number.isNaN(mangaId)) notFound();

  const mangaRow = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaRow) notFound();

  const volumes = db
    .select()
    .from(volume)
    .where(eq(volume.mangaId, mangaId))
    .orderBy(volume.volumeNumber)
    .all();

  const loaded = volumes.map((v) => ({
    volumeNumber: v.volumeNumber,
    file: loadMokuroFile(mangaId, v.volumeNumber),
  }));

  return (
    <article className="prose-text">
      <header className="mb-6">
        <Link
          href={`/manga/${mangaId}`}
          className="text-sm text-accent-400 hover:underline"
        >
          ← {mangaRow.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{mangaRow.title}</h1>
        <p className="mt-1 text-xs text-surface-300">
          OCR text from all volumes in reading order. Hover with{" "}
          <a
            href="https://yomitan.wiki/"
            target="_blank"
            rel="noreferrer"
            className="text-accent-400 hover:underline"
          >
            Yomitan
          </a>{" "}
          for definitions.
        </p>
      </header>

      {loaded.every((v) => !v.file) ? (
        <p className="text-sm text-surface-300">
          No OCR data is available yet for any volume.
        </p>
      ) : (
        loaded.map(({ volumeNumber, file }) => (
          <VolumeBlock
            key={volumeNumber}
            mangaId={mangaId}
            volumeNumber={volumeNumber}
            file={file}
          />
        ))
      )}
    </article>
  );
}

function VolumeBlock({
  mangaId,
  volumeNumber,
  file,
}: {
  mangaId: number;
  volumeNumber: number;
  file: MokuroFile | null;
}) {
  return (
    <section
      aria-label={`Volume ${volumeNumber}`}
      className="mb-12 border-t border-surface-600 pt-6"
    >
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Volume {volumeNumber}</h2>
        <Link
          href={`/manga/${mangaId}/volume/${volumeNumber}/text`}
          className="text-xs text-accent-400 hover:underline"
        >
          Open in isolation →
        </Link>
      </header>

      {!file ? (
        <p className="text-xs text-surface-500">
          No OCR data for this volume yet.
        </p>
      ) : (
        <div lang="ja">
          {file.pages.map((page, i) => (
            <section
              key={i}
              aria-label={`Volume ${volumeNumber} page ${i + 1}`}
              className="mb-6 border-t border-surface-700 pt-3"
            >
              <h3 className="mb-2 text-xs font-medium text-surface-400">
                Page {i + 1}
              </h3>
              {page.blocks.length === 0 ? (
                <p className="text-xs text-surface-500">
                  No text on this page.
                </p>
              ) : (
                page.blocks.map((b, j) => (
                  <p
                    key={j}
                    lang="ja"
                    data-ocr-block
                    className="mb-3 leading-relaxed"
                    style={{
                      writingMode: b.vertical
                        ? "vertical-rl"
                        : "horizontal-tb",
                      textOrientation: b.vertical ? "mixed" : undefined,
                    }}
                  >
                    {b.lines.join("")}
                  </p>
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
