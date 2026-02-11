# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MangaShelf is a self-hosted manga reader and manager with automatic download capabilities. It integrates with Jackett (torrent search) and Deluge (torrent client) to automatically download and import manga volumes.

**Stack:**
- Next.js 16 (App Router), React 19, TypeScript
- SQLite via Drizzle ORM (better-sqlite3, synchronous API)
- Tailwind v4 with OKLCH color space
- Docker with multi-stage build, standalone output mode

## Development Commands

```bash
npm run dev              # Start development server on port 3000
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate migrations from schema changes
npm run db:migrate       # Apply migrations to database
npm run db:studio        # Open Drizzle Studio (DB GUI)
```

## Architecture

### Two-Domain System

1. **Reader** (tables: `manga`, `volume`, `readingProgress`)
   - Scans filesystem for manga in `/manga` directory
   - Expects folder structure: `Title [anilist-ID]/v01/001.jpg`
   - Provides reading interface with progress tracking

2. **Manager** (tables: `managedManga`, `managedVolume`, `downloadHistory`)
   - Searches AniList for manga metadata
   - Searches Jackett for torrents
   - Sends torrents to Deluge for download
   - Auto-imports completed downloads into Reader library

### Key Patterns

- **Async params**: Next.js 16 route params are `Promise<{}>` — always `await params` before use
- **Server components**: Use for data fetching with direct `db` access from `@/db`
- **Force dynamic**: Add `export const dynamic = "force-dynamic"` to routes needing fresh data
- **Timestamps**: Drizzle uses `integer("col", { mode: "timestamp" })` with `default(sql\`(unixepoch())\`)`

### Service Modules (`src/lib/`)

- **scanner.ts**: Scans `/manga` directory, syncs filesystem to `manga`/`volume` tables
- **anilist.ts**: GraphQL API for manga metadata (titles, covers, volumes)
- **jackett.ts**: Torrent search aggregator API
- **deluge.ts**: Torrent client JSON-RPC interface
- **extractor.ts**: Extracts archives (.zip, .rar, .7z, .cbr, .cbz) before import
- **importer.ts**: Complex volume detection, numbering, page sorting, and library import
  - Handles fullwidth characters, CJK naming, batch ranges, duplicates
  - Recursive volume folder discovery, multi-volume detection
  - Pattern-based volume number extraction with ancestor fallback
- **monitor.ts**: Automatic background monitoring for missing volumes

### Folder Naming Conventions

**Manga folders**: `Title [anilist-123]` where 123 is the AniList ID
**Volume folders**: `v01`, `v02`, etc. (case-insensitive, zero-padded)
**Page files**: Image files (.jpg, .jpeg, .png, .webp) with numeric names (001.jpg, 002.jpg)

The importer supports diverse volume naming patterns (第XX巻, vol/volume, underscores, trailing numbers, CJK characters) and handles complex scenarios like batch ranges, duplicate volumes, and multi-volume torrents.

### Startup Behavior (`src/instrumentation.ts`)

On server start:
1. Run database migrations
2. Sync library (scan `/manga` directory)
3. Start background tasks:
   - Download progress monitoring (every 30s)
   - Auto-import completed downloads (every 30s)
   - Automatic volume monitoring (every 1h, if enabled)

### API Routes

**Reader APIs** (`/api/`):
- `/api/manga` - List all manga
- `/api/manga/[id]` - Get manga details
- `/api/manga/[id]/volume/[volumeNumber]/pages` - List pages
- `/api/manga/[id]/volume/[volumeNumber]/page/[pageNumber]` - Serve image
- `/api/progress/[mangaId]/[volumeId]` - Update reading progress
- `/api/library/scan` - Trigger library rescan

**Manager APIs** (`/api/manager/`):
- `/api/manager/search` - Search AniList for manga
- `/api/manager/manga` - Create/list managed manga
- `/api/manager/manga/[id]` - Get managed manga details
- `/api/manager/manga/[id]/search` - Search torrents for manga
- `/api/manager/manga/[id]/download` - Download torrent (single or bulk)
- `/api/manager/manga/[id]/monitor` - Toggle automatic monitoring
- `/api/manager/import` - Trigger manual import check
- `/api/manager/downloads` - Get download status
- `/api/downloads/status` - Get download indicator count

### Environment Variables

Required:
- `MANGA_DIR` - Path to manga library (default: `/manga`)
- `DATABASE_URL` - Path to SQLite database (default: `/data/mangashelf.db`)
- `JACKETT_URL` - Jackett instance URL
- `JACKETT_API_KEY` - Jackett API key
- `DELUGE_URL` - Deluge web UI URL
- `DELUGE_PASSWORD` - Deluge web UI password

Optional:
- `DELUGE_DOWNLOAD_DIR` - Download directory path (default: `/downloads`)
- `IMPORT_INTERVAL` - Import check interval in seconds (default: 30)
- `DOWNLOAD_CHECK_INTERVAL` - Download progress check interval in seconds (default: 30)
- `MONITOR_INTERVAL` - Automatic monitoring interval in seconds (default: 3600)
- `AUTO_DOWNLOAD` - Enable automatic downloads for monitored manga (default: false)

### Docker Setup

- Multi-stage build with node:22-alpine base
- Installs `libarchive-tools` (bsdtar for .rar/.cbr) and `7zip` for archive extraction
- `/manga` mounted read-write for imports
- `/downloads` mounted read-only for torrent access
- `/data` volume for persistent SQLite database
- Runs on `arrstack` network with Jackett and Deluge containers

### Color System

Uses Tailwind v4 with OKLCH colors:
- `surface-50` to `surface-900` - Dark grays for backgrounds/surfaces
- `accent-50` to `accent-600` - Pink/rose hue (350) for primary actions

### Database Schema

**Reader tables:**
- `manga` - Scanned manga with folder name and optional anilistId
- `volume` - Individual volumes with page count
- `readingProgress` - Per-user reading position (currentPage, isCompleted)

**Manager tables:**
- `managedManga` - Tracked manga with AniList metadata, monitoring settings
- `managedVolume` - Download status per volume (missing/downloading/downloaded/imported/failed)
- `downloadHistory` - Historical record of torrent downloads

All foreign keys use `onDelete: "cascade"` for automatic cleanup.

### Important Notes

- Database operations are synchronous (better-sqlite3) - use `.run()`, `.get()`, `.all()`
- Library scanner (`syncLibrary()`) preserves volume IDs to maintain reading progress
- Importer handles multi-volume torrents by detecting all volume folders recursively
- Page sorting is robust against watermarks, prefixes, and diverse naming schemes
- Archive extraction uses temp directory (`/tmp/mangashelf-extract`) with automatic cleanup
- Background tasks run continuously and are gracefully shut down on SIGTERM/SIGINT
