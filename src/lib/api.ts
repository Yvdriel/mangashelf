export async function updateProgress(
  mangaId: number,
  volumeId: number,
  currentPage: number,
) {
  return fetch(`/api/progress/${mangaId}/${volumeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPage }),
  });
}

export function getPageImageUrl(
  mangaId: number,
  volumeNumber: number,
  pageIndex: number,
) {
  return `/api/manga/${mangaId}/volume/${volumeNumber}/page/${pageIndex}`;
}
