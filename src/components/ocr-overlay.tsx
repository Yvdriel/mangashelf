"use client";

import { useMemo } from "react";

export interface MokuroBlock {
  box: [number, number, number, number]; // x1,y1,x2,y2 in source-image pixels
  vertical: boolean;
  font_size: number;
  lines: string[];
  // lines_coords ignored: per-line bbox precision is not needed for Yomitan
  // scanning, and skipping it keeps the DOM dramatically lighter.
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

interface OcrOverlayProps {
  page: MokuroPage | null | undefined;
  /** When true, renders the OCR text visibly (debugging). Defaults to false. */
  debugVisible?: boolean;
}

/**
 * Renders mokuro OCR blocks as absolutely-positioned, transparent-but-selectable
 * text on top of an image. Must be placed inside a `position: relative` parent
 * sized to match the displayed image (e.g. the same `<div>` that wraps the
 * `<Image>`). All positioning uses percentages so it scales with the image.
 *
 * The text is colored `transparent` by default so it's visually invisible but
 * remains real DOM text. Yomitan and similar dictionary popup extensions scan
 * for text by hit-testing coordinates, so transparent text works fine.
 */
export function OcrOverlay({ page, debugVisible = false }: OcrOverlayProps) {
  const sortedBlocks = useMemo(() => {
    if (!page) return [];
    // Render larger blocks first so smaller (likely on-top) blocks land last
    // in DOM order and visually cover the larger ones for hit-testing.
    return page.blocks
      .map((b, idx) => {
        const [x1, y1, x2, y2] = b.box;
        return { b, idx, area: Math.max(0, (x2 - x1) * (y2 - y1)) };
      })
      .sort((a, c) => c.area - a.area);
  }, [page]);

  if (!page || page.blocks.length === 0) return null;

  const { img_width, img_height } = page;
  if (!img_width || !img_height) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-ocr-overlay
      aria-hidden={!debugVisible}
    >
      {sortedBlocks.map(({ b, idx }) => {
        const [x1, y1, x2, y2] = b.box;
        const left = (x1 / img_width) * 100;
        const top = (y1 / img_height) * 100;
        const width = ((x2 - x1) / img_width) * 100;
        const height = ((y2 - y1) / img_height) * 100;
        // Scale font size with rendered image width.
        // mokuro font_size is in source pixels; we approximate with a ratio
        // expressed via cqw (container query width) so it scales naturally.
        const fontSizeCqw = (b.font_size / img_width) * 100;
        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              fontSize: `${fontSizeCqw}cqw`,
              lineHeight: 1.1,
              writingMode: b.vertical ? "vertical-rl" : "horizontal-tb",
              color: debugVisible ? "rgba(255, 60, 60, 0.95)" : "transparent",
              background: debugVisible
                ? "rgba(255, 255, 255, 0.6)"
                : "transparent",
              padding: 0,
              margin: 0,
              overflow: "hidden",
              whiteSpace: "pre",
              fontFamily: "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif",
              // Re-enable pointer events here so Yomitan can hit-test the text.
              pointerEvents: "auto",
              userSelect: "text",
              cursor: "text",
            }}
          >
            {b.lines.map((line, i) => (
              <span key={i} style={{ display: "block" }}>
                {line}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
