"use client";

import { useState, useCallback } from "react";

export function useMultiSelect<T extends number>() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  return {
    selectMode,
    selectedIds,
    toggle,
    selectAll,
    clearSelection,
    enterSelectMode,
    exitSelectMode,
  };
}
