"use client";

import { useState } from "react";

interface ConfirmDialogOption {
  value: string;
  label: string;
  description?: string;
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  items?: string[];
  options?: ConfirmDialogOption[];
  defaultOption?: string;
  confirmLabel: string;
  onConfirm: (selectedOption?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  items,
  options,
  defaultOption,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  const [selected, setSelected] = useState(
    defaultOption ?? options?.[0]?.value ?? "",
  );

  const displayItems = items?.slice(0, 5);
  const remainingCount = items ? items.length - 5 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[20vh]">
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-xl border border-surface-600 bg-surface-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-600 px-5 py-4">
          <h3 className="text-sm font-semibold text-surface-50">{title}</h3>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-surface-300 hover:bg-surface-700 hover:text-surface-50"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-surface-200">{message}</p>

          {/* Item list */}
          {displayItems && displayItems.length > 0 && (
            <div className="rounded-lg bg-surface-700 px-3 py-2">
              <ul className="space-y-1">
                {displayItems.map((item) => (
                  <li key={item} className="truncate text-sm text-surface-100">
                    {item}
                  </li>
                ))}
              </ul>
              {remainingCount > 0 && (
                <p className="mt-1 text-xs text-surface-300">
                  +{remainingCount} more
                </p>
              )}
            </div>
          )}

          {/* Radio options */}
          {options && options.length > 0 && (
            <div className="space-y-2">
              {options.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    selected === option.value
                      ? "border-accent-400/50 bg-accent-400/5"
                      : "border-surface-600 hover:border-surface-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="confirm-option"
                    value={option.value}
                    checked={selected === option.value}
                    onChange={() => setSelected(option.value)}
                    className="mt-0.5 accent-accent-400"
                  />
                  <div>
                    <span className="text-sm font-medium text-surface-50">
                      {option.label}
                    </span>
                    {option.description && (
                      <p className="mt-0.5 text-xs text-surface-300">
                        {option.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-surface-600 px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-surface-500 px-4 py-2 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(options ? selected : undefined)}
            disabled={loading}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
