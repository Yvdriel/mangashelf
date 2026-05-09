import fs from "fs";
import { resolveMokuroFile } from "@/lib/ocr";

export interface MokuroBlock {
  box: [number, number, number, number];
  vertical: boolean;
  font_size: number;
  lines: string[];
}

export interface MokuroPage {
  img_width: number;
  img_height: number;
  img_path?: string;
  blocks: MokuroBlock[];
}

export interface MokuroFile {
  version?: string;
  title?: string;
  volume?: string;
  pages: MokuroPage[];
}

export function loadMokuroFile(
  mangaId: number,
  volumeNumber: number,
): MokuroFile | null {
  const resolved = resolveMokuroFile(mangaId, volumeNumber);
  if (!resolved) return null;
  let raw: string;
  try {
    raw = fs.readFileSync(resolved.absolutePath, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as MokuroFile;
  } catch {
    return null;
  }
}
