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

    // Read the raw body and write to a temp file, then parse multipart manually
    const body = request.body;
    if (!body) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 },
      );
    }

    // Extract boundary from content-type
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      return NextResponse.json(
        { error: "Missing multipart boundary" },
        { status: 400 },
      );
    }
    const boundary = boundaryMatch[1].replace(/;.*$/, "").trim();

    // Read entire body into a buffer by streaming chunks
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const reader = body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_UPLOAD_SIZE) {
        fs.rmSync(stagingPath, { recursive: true, force: true });
        return NextResponse.json(
          { error: "Total upload size exceeds maximum" },
          { status: 413 },
        );
      }
      chunks.push(value);
    }

    const fullBuffer = Buffer.concat(chunks);

    // Parse multipart form data from the buffer
    const files = parseMultipartFiles(fullBuffer, boundary, stagingPath);

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

interface ParsedFile {
  name: string;
  size: number;
  path: string;
}

function parseMultipartFiles(
  buffer: Buffer,
  boundary: string,
  stagingPath: string,
): ParsedFile[] {
  const files: ParsedFile[] = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const endBoundaryBuf = Buffer.from(`--${boundary}--`);

  // Split by boundary
  let start = 0;
  const parts: { start: number; end: number }[] = [];

  while (true) {
    const idx = buffer.indexOf(boundaryBuf, start);
    if (idx === -1) break;

    if (parts.length > 0) {
      // The previous part ends just before this boundary (minus the \r\n before boundary)
      parts[parts.length - 1].end = idx - 2;
    }

    const afterBoundary = idx + boundaryBuf.length;
    // Check if this is the end boundary
    if (buffer[afterBoundary] === 0x2d && buffer[afterBoundary + 1] === 0x2d) {
      break;
    }

    // Skip past the \r\n after the boundary
    const headerStart = afterBoundary + 2;
    parts.push({ start: headerStart, end: buffer.length });

    start = headerStart;
  }

  for (const part of parts) {
    const partData = buffer.subarray(part.start, part.end);

    // Find the end of headers (double \r\n)
    const headerEnd = partData.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerStr = partData.subarray(0, headerEnd).toString("utf-8");
    const fileContent = partData.subarray(headerEnd + 4);

    // Parse Content-Disposition to get filename and field name
    const dispositionMatch = headerStr.match(
      /Content-Disposition:\s*form-data;\s*name="([^"]*)"(?:;\s*filename="([^"]*)")?/i,
    );
    if (!dispositionMatch || !dispositionMatch[2]) continue;

    const fieldName = dispositionMatch[1];
    const filename = dispositionMatch[2];

    // Use field name as relative path if it differs from "files", otherwise use filename
    const relativePath = fieldName !== "files" ? fieldName : filename;

    const targetPath = path.join(stagingPath, relativePath);
    const targetDir = path.dirname(targetPath);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetPath, fileContent);

    files.push({
      name: relativePath,
      size: fileContent.length,
      path: targetPath,
    });
  }

  return files;
}
