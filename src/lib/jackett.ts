const JACKETT_URL = process.env.JACKETT_URL || "http://jackett:9117";
const JACKETT_API_KEY = process.env.JACKETT_API_KEY || "";

export interface TorrentResult {
  title: string;
  size: number;
  seeders: number;
  leechers: number;
  publishDate: string;
  magnetLink: string | null;
  downloadLink: string | null;
  indexer: string;
  categoryIds: number[];
}

interface JackettResult {
  Title: string;
  Size: number;
  Seeders: number;
  Peers: number;
  PublishDate: string;
  MagnetUri: string | null;
  Link: string | null;
  Tracker: string;
  CategoryDesc: string;
  Category: number[];
}

export async function searchTorrents(
  query: string,
  categories: number[] = [8000],
): Promise<TorrentResult[]> {
  const params = new URLSearchParams({
    apikey: JACKETT_API_KEY,
    Query: query,
  });

  for (const cat of categories) {
    params.append("Category[]", String(cat));
  }

  const res = await fetch(
    `${JACKETT_URL}/api/v2.0/indexers/all/results?${params}`,
  );

  if (!res.ok) {
    throw new Error(`Jackett API error: ${res.status}`);
  }

  const data = await res.json();
  const results: JackettResult[] = data.Results || [];

  return results
    .map((r) => ({
      title: r.Title,
      size: r.Size,
      seeders: r.Seeders,
      leechers: r.Peers,
      publishDate: r.PublishDate,
      magnetLink: r.MagnetUri,
      downloadLink: r.Link,
      indexer: r.Tracker,
      categoryIds: r.Category,
    }))
    .sort((a, b) => b.seeders - a.seeders);
}

export async function searchMangaVolumes(
  titles: { native: string | null; romaji: string | null; synonyms: string[] },
  volumeNumber?: number,
): Promise<TorrentResult[]> {
  const queries: string[] = [];

  if (titles.native) queries.push(titles.native);
  if (titles.romaji) queries.push(titles.romaji);
  for (const syn of titles.synonyms) {
    queries.push(syn);
  }

  if (queries.length === 0) return [];

  const allResults: TorrentResult[] = [];
  const seenTitles = new Set<string>();

  for (const query of queries) {
    const searchQuery =
      volumeNumber != null ? `${query} ${volumeNumber}` : query;
    try {
      const results = await searchTorrents(searchQuery);
      for (const r of results) {
        if (!seenTitles.has(r.title)) {
          seenTitles.add(r.title);
          allResults.push(r);
        }
      }
      // If we got results with the first title, that's usually enough
      if (allResults.length > 0) break;
    } catch {
      continue;
    }
  }

  return allResults.sort((a, b) => b.seeders - a.seeders);
}
