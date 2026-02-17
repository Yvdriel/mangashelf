"use client";

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function SelectionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onCancel,
  onDelete,
}: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-surface-600 bg-surface-800/95 backdrop-blur-sm animate-in slide-in-from-bottom duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-surface-50">
            {selectedCount} selected
          </span>
          {selectedCount < totalCount && (
            <button
              onClick={onSelectAll}
              className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
            >
              Select all ({totalCount})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-surface-500 px-4 py-2 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
}
