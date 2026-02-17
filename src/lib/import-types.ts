export interface ImportAnalysis {
  sessionId: string;
  sourcePath: string;
  detectedType: "single_manga" | "multiple_manga" | "unknown";
  volumes: DetectedVolume[];
  warnings: ImportWarning[];
  suggestedMatch?: {
    anilistId: number;
    title: string;
    coverUrl: string;
    totalVolumes: number | null;
  };
  /** Title guessed from folder/file name — used to pre-fill AniList search */
  titleGuess?: string;
}

export interface DetectedVolume {
  id: string;
  sourcePath: string;
  detectedVolumeNumber: number | null;
  pageCount: number;
  totalSizeBytes: number;
  previewPages: string[];
  existsInLibrary: boolean;
  existingPageCount?: number;
  sourceLabel: string;
}

export interface ImportWarning {
  type:
    | "duplicate_volume"
    | "no_volume_number"
    | "low_page_count"
    | "no_images_found"
    | "archive_extraction_failed";
  message: string;
  volumeId?: string;
}

export interface ImportProgressEvent {
  type:
    | "volume_start"
    | "volume_complete"
    | "volume_failed"
    | "complete"
    | "error";
  volumeNumber?: number;
  pagesImported?: number;
  totalVolumes?: number;
  totalPages?: number;
  currentVolume?: number;
  mangaId?: number;
  error?: string;
}
