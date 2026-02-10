const ANILIST_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 20) {
    media(search: $search, type: MANGA, format_in: [MANGA, ONE_SHOT], isAdult: false) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      description(asHtml: false)
      volumes
      chapters
      status
      genres
      averageScore
      startDate { year month }
      endDate { year month }
    }
  }
}
`;

const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    title { romaji english native }
    coverImage { large extraLarge }
    bannerImage
    description(asHtml: false)
    volumes
    chapters
    status
    genres
    averageScore
    startDate { year month }
    endDate { year month }
    synonyms
    staff(sort: RELEVANCE, perPage: 5) {
      edges {
        role
        node { name { full } }
      }
    }
  }
}
`;

export interface AniListManga {
  id: number;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    large: string | null;
    extraLarge: string | null;
  };
  bannerImage: string | null;
  description: string | null;
  volumes: number | null;
  chapters: number | null;
  status: string | null;
  genres: string[];
  averageScore: number | null;
  startDate: { year: number | null; month: number | null } | null;
  endDate: { year: number | null; month: number | null } | null;
}

export interface AniListMangaDetail extends AniListManga {
  synonyms: string[];
  staff: {
    edges: {
      role: string;
      node: { name: { full: string } };
    }[];
  };
}

async function queryAniList<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`AniList API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`AniList query error: ${json.errors[0]?.message}`);
  }

  return json.data;
}

export async function searchManga(search: string): Promise<AniListManga[]> {
  const data = await queryAniList<{ Page: { media: AniListManga[] } }>(
    SEARCH_QUERY,
    { search },
  );
  return data.Page.media;
}

export async function getMangaDetail(id: number): Promise<AniListMangaDetail> {
  const data = await queryAniList<{ Media: AniListMangaDetail }>(DETAIL_QUERY, {
    id,
  });
  return data.Media;
}
