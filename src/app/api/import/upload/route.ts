import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createSession } from "@/lib/import-session";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = parseInt(
  process.env.IMPORT_MAX_UPLOAD_SIZE || "2147483648",
  10,
);

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const contentLength = parseInt(
    request.headers.get("content-length") || "0",
    10,
  );
  if (contentLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      {
        error: `Upload too large. Maximum size is ${(MAX_UPLOAD_SIZE / (1024 * 1024 * 1024)).toFixed(1)} GB`,
      },
      { status: 413 },
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  try {
    const importSession = createSession();
    const stagingPath = importSession.stagingPath;

    const formData = await request.formData();
    const files: { name: string; size: number; path: string }[] = [];
    let totalSize = 0;

    for (const [key, value] of formData.entries()) {
      if (!(value instanceof File)) continue;

      const file = value;
      totalSize += file.size;

      if (totalSize > MAX_UPLOAD_SIZE) {
        // Clean up what we've written so far
        fs.rmSync(stagingPath, { recursive: true, force: true });
        return NextResponse.json(
          { error: "Total upload size exceeds maximum" },
          { status: 413 },
        );
      }

      // Preserve directory structure from webkitRelativePath if present
      // The key contains the relative path for directory uploads
      const relativePath = key !== "files" ? key : file.name;

      const targetPath = path.join(stagingPath, relativePath);
      const targetDir = path.dirname(targetPath);

      fs.mkdirSync(targetDir, { recursive: true });

      // Write file to disk
      const arrayBuffer = await file.arrayBuffer();
      fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));

      files.push({
        name: relativePath,
        size: file.size,
        path: targetPath,
      });
    }

    if (files.length === 0) {
      fs.rmSync(stagingPath, { recursive: true, force: true });
      return NextResponse.json(
        { error: "No files were uploaded" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      sessionId: importSession.id,
      stagingPath,
      files: files.map((f) => ({ name: f.name, size: f.size })),
      totalSize,
    });
  } catch (e) {
    return NextResponse.json({ error: `Upload failed: ${e}` }, { status: 500 });
  }
}
