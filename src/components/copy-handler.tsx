"use client";

import { useEffect } from "react";
import { useSettings } from "@/contexts/settings";
import { stripLinebreaks } from "@/lib/copy/strip-linebreaks";

export function CopyHandler() {
  const { settings } = useSettings();
  const enabled = settings.copyStripLinebreaks;

  useEffect(() => {
    if (!enabled) return;

    function onCopy(event: ClipboardEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('[lang="ja"]')) return;

      const selection = window.getSelection();
      const raw = selection?.toString() ?? "";
      if (!raw) return;

      event.preventDefault();
      event.clipboardData?.setData("text/plain", stripLinebreaks(raw));
    }

    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [enabled]);

  return null;
}
