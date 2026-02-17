import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { isArchive } from "@/lib/extractor";

export const dynamic = "force-dynamic";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function getAllowedRoots(): string[] {
  const envRoots = process.env.IMPORT_BROWSE_ROOTS;
  if (envRoots) {
    return envRoots
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => path.resolve(r));
  }
  // Default: parent of MANGA_DIR + /downloads if it exists
  const roots = [path.dirname(path.resolve(MANGA_DIR))];
  if (fs.existsSync("/downloads")) {
    roots.push("/downloads");
  }
  return roots;
}

function isPathAllowed(requestedPath: string): boolean {
  const resolved = path.resolve(requestedPath);
  const roots = getAllowedRoots();
  return roots.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep),
  );
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  let requestedPath = searchParams.get("path");

  // Default to the first allowed root
  if (!requestedPath) {
    const roots = getAllowedRoots();
    requestedPath = roots[0] || "/";
  }

  const resolved = path.resolve(requestedPath);

  if (!isPathAllowed(resolved)) {
    return NextResponse.json(
      { error: "Path is outside allowed browse roots" },
      { status: 403 },
    );
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return NextResponse.json(
      { error: "Path does not exist or is not a directory" },
      { status: 404 },
    );
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });

    const items: {
      name: string;
      type: "directory" | "file";
      size: number;
      childCount?: number;
      contentHint?: "images" | "archives" | "mixed" | null;
    }[] = [];

    for (const entry of entries) {
      // Skip hidden files/dirs
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(resolved, entry.name);

      if (entry.isDirectory()) {
        let childCount = 0;
        let hasImages = false;
        let hasArchives = false;

        try {
          const children = fs.readdirSync(fullPath, { withFileTypes: true });
          childCount = children.filter((c) => !c.name.startsWith(".")).length;
          for (const child of children) {
            if (child.isFile()) {
              if (isImageFile(child.name)) hasImages = true;
              if (isArchive(fullPath + "/" + child.name)) hasArchives = true;
            }
            if (hasImages && hasArchives) break;
          }
        } catch {
          // Permission denied — show folder but no details
        }

        const contentHint =
          hasImages && hasArchives
            ? "mixed"
            : hasImages
              ? "images"
              : hasArchives
                ? "archives"
                : null;

        items.push({
          name: entry.name,
          type: "directory",
          size: 0,
          childCount,
          contentHint,
        });
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          items.push({
            name: entry.name,
            type: "file",
            size: stat.size,
          });
        } catch {
          items.push({
            name: entry.name,
            type: "file",
            size: 0,
          });
        }
      }
    }

    // Sort: directories first, then alphabetical
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Build breadcrumbs
    const roots = getAllowedRoots();
    const breadcrumbs: { name: string; path: string }[] = [];

    // Find which root this path belongs to
    const matchingRoot = roots.find(
      (root) => resolved === root || resolved.startsWith(root + path.sep),
    );

    if (matchingRoot) {
      breadcrumbs.push({
        name: path.basename(matchingRoot) || matchingRoot,
        path: matchingRoot,
      });

      if (resolved !== matchingRoot) {
        const relative = path.relative(matchingRoot, resolved);
        const parts = relative.split(path.sep);
        let current = matchingRoot;
        for (const part of parts) {
          current = path.join(current, part);
          breadcrumbs.push({ name: part, path: current });
        }
      }
    }

    return NextResponse.json({
      currentPath: resolved,
      entries: items,
      breadcrumbs,
      allowedRoots: roots.map((r) => ({
        name: path.basename(r) || r,
        path: r,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read directory: ${e}` },
      { status: 500 },
    );
  }
}
