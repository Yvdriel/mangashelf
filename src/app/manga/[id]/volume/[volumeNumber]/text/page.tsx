import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { loadMokuroFile, type MokuroFile } from "@/lib/mokuro";

export const dynamic = "force-dynamic";

export default async function VolumeTextPage({
  params,
}: {
  params: Promise<{ id: string; volumeNumber: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, volumeNumber } = await params;
  const mangaId = parseInt(id, 10);
  const volNum = parseInt(volumeNumber, 10);
  if (Number.isNaN(mangaId) || Number.isNaN(volNum)) notFound();

  const mangaRow = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaRow) notFound();

  const volRow = db
    .select()
    .from(volume)
    .where(and(eq(volume.mangaId, mangaId), eq(volume.volumeNumber, volNum)))
    .get();
  if (!volRow) notFound();

  const mokuro = loadMokuroFile(mangaId, volNum);

  return (
    <article className="prose-text">
      <header className="mb-6">
        <Link
          href={`/manga/${mangaId}`}
          className="text-sm text-accent-400 hover:underline"
        >
          ← {mangaRow.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {mangaRow.title} — Volume {volNum}
        </h1>
        <p className="mt-1 text-xs text-surface-300">
          OCR text in reading order. Hover with{" "}
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

      {mokuro ? (
        <VolumeText file={mokuro} />
      ) : (
        <p className="text-sm text-surface-300">
          No OCR data is available for this volume yet.
        </p>
      )}
    </article>
  );
}

function VolumeText({ file }: { file: MokuroFile }) {
  return (
    <div lang="ja">
      {file.pages.map((page, i) => (
        <section
          key={i}
          aria-label={`Page ${i + 1}`}
          className="mb-8 border-t border-surface-700 pt-4"
        >
          <h2 className="mb-3 text-xs font-medium text-surface-400">
            Page {i + 1}
          </h2>
          {page.blocks.length === 0 ? (
            <p className="text-xs text-surface-500">No text on this page.</p>
          ) : (
            page.blocks.map((b, j) => (
              <p
                key={j}
                lang="ja"
                data-ocr-block
                className="mb-3 leading-relaxed"
                style={{
                  writingMode: b.vertical ? "vertical-rl" : "horizontal-tb",
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
  );
}
