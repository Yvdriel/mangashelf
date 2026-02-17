"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./confirm-dialog";

interface DeleteMangaButtonProps {
  mangaId: number;
  title: string;
  totalVolumes: number;
}

export function DeleteMangaButton({
  mangaId,
  title,
  totalVolumes,
}: DeleteMangaButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setShowDialog(false);
    try {
      await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mangaIds: [mangaId],
          deleteFiles: true,
        }),
      });
      router.push("/");
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }, [mangaId, router]);

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        disabled={deleting}
        className="rounded-md border border-surface-500 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>

      {showDialog && (
        <ConfirmDialog
          title="Delete Manga"
          message={`Delete "${title}" and all ${totalVolumes} volume${totalVolumes !== 1 ? "s" : ""} from disk? This will also remove it from the manager if tracked.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDialog(false)}
          loading={deleting}
        />
      )}
    </>
  );
}
