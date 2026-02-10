"use client";

import { useState } from "react";

const TRUNCATE_LENGTH = 300;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function MangaDescription({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const text = stripHtml(html).trim();

  if (!text) return null;

  const needsTruncation = text.length > TRUNCATE_LENGTH;
  const displayed =
    needsTruncation && !expanded
      ? text.slice(0, TRUNCATE_LENGTH) + "..."
      : text;

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-surface-200">Synopsis</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-surface-100">
        {displayed}
      </p>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
