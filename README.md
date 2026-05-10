# MangaShelf

Self-hosted manga reader, automated download manager, OCR pipeline, dictionary lookup, and Anki mining. One stack. Built for people who read Japanese manga and don't want to juggle five separate tools to do it.

## What you get

Two domains share the same database and UI.

The **Reader** scans a folder on disk, indexes every volume it finds, and serves pages with progress tracking. Folder structure is fixed: `Title [anilist-123]/v01/001.jpg`. Anything else, the scanner will skip. Page sorting is tolerant of watermarks and prefixes, but folder layout isn't.

The **Manager** turns that read-only library into a self-filling one. Add a manga by AniList ID, and MangaShelf will keep checking Jackett for missing volumes, hand torrents to Deluge, watch them complete, extract archives, and import the result into the Reader. You can run it fully manual (search, pick, download) or flip a switch and let it work the queue on its own.

On top of that, a learning stack: Mokuro runs OCR on every imported volume and writes a `.mokuro` JSON sidecar next to each page. The Reader overlays those text blocks on the page. Tap a block, get a popup of dictionary results from Yomitan-format dictionaries you've installed in the browser. Pick a definition, and a card flies into Anki via AnkiConnect with the original sentence and a cropped image of the bubble.

That's the whole pitch. If you only want to read manga off disk, the Reader works alone. If you don't want OCR, you can skip Mokuro and the rest still runs.

## Stack

Next.js 16 (App Router), React 19, TypeScript. SQLite through Drizzle ORM with the synchronous `better-sqlite3` driver. Tailwind v4 in OKLCH. Sharp for image cropping (Anki captures), `fflate` for unzipping Yomitan dictionaries in-browser, `idb` for the client-side dictionary store. Authentication runs on `better-auth` with passkey and TOTP plugins. Container image is `node:22-alpine` with `libarchive-tools` and `7zip` baked in for `.rar`/`.cbr`/`.7z` extraction.

One web worker lives in `src/workers/dict-worker.ts`. It does Yomitan ZIP parsing and term/kanji/frequency lookups so the main thread stays responsive while you flip pages.

## What you need before installing

Three external services have to be reachable from the MangaShelf container:

- **Jackett** for torrent search aggregation. You'll plug in your own indexers there.
- **Deluge** with the Web UI enabled. JSON-RPC goes through that endpoint.
- **Mokuro worker** for OCR. Bundled in this repo as `./mokuro-worker` and built from local source by Compose. If you don't want OCR, drop the service and unset `MOKURO_URL`.

Optional but recommended: an Anki desktop instance with the AnkiConnect addon if you want card mining. AnkiConnect runs on `http://localhost:8765` by default and lives outside the container, so you talk to it from your own machine.

A reverse proxy in front (Caddy, nginx, Traefik) is your problem. The container exposes port 3000 plain HTTP.

## Quick start with Docker Compose

The repo ships a `compose.yaml` that wires up Jackett, Deluge, MangaShelf, and the Mokuro worker on a shared `arrstack` bridge network. Pull it down and edit:

```yaml
services:
  jackett:
    image: lscr.io/linuxserver/jackett
    ports: ["9117:9117"]
    volumes: ["./config/jackett:/config"]
    networks: [arrstack]

  deluge:
    image: lscr.io/linuxserver/deluge
    ports: ["8112:8112", "58846:58846", "58946:58946", "58946:58946/udp"]
    volumes:
      - ./config/deluge:/config
      - ./downloads:/media/downloads
    networks: [arrstack]

  mokuro-worker:
    build: ./mokuro-worker
    environment:
      - MOKURO_DEVICE=cpu      # set "cuda" if you wired the NVIDIA runtime
      - MOKURO_ALLOWED_ROOT=/manga
    volumes:
      - ./media/manga:/manga   # read-write, sidecar files land here
      - mokuro-models:/models
    networks: [arrstack]

  mangashelf:
    build: .
    ports: ["3000:3000"]
    environment:
      - MANGA_DIR=/manga
      - DATABASE_URL=/data/mangashelf.db
      - JACKETT_URL=http://jackett:9117
      - JACKETT_API_KEY=${JACKETT_API_KEY}
      - DELUGE_URL=http://deluge:8112
      - DELUGE_PASSWORD=${DELUGE_PASSWORD}
      - DELUGE_DOWNLOAD_DIR=/downloads
      - MOKURO_URL=http://mokuro-worker:8000
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - AUTH_RP_ID=${AUTH_RP_ID}
      - AUTH_ORIGIN=${AUTH_ORIGIN}
    volumes:
      - ./media/manga:/manga
      - mangashelf-data:/data
      - ./downloads:/downloads:ro
    depends_on: [mokuro-worker]
    networks: [arrstack]

networks:
  arrstack:
    driver: bridge

volumes:
  mangashelf-data:
  mokuro-models:
```

The committed `compose.yaml` has default values inlined for convenience. Don't ship those defaults to anything resembling production. Override `JACKETT_API_KEY`, `DELUGE_PASSWORD`, and `BETTER_AUTH_SECRET` through a `.env` file or your secret manager. Generate a session secret with `openssl rand -base64 32`.

Bring it up:

```bash
docker compose up -d --build
```

First boot, MangaShelf runs migrations against the SQLite file in the `mangashelf-data` volume, scans `/manga`, and starts the background workers. Watch logs with `docker compose logs -f mangashelf`. Then open `http://localhost:3000` and create the first user. That account becomes admin and registration closes after.

## Bare-metal dev

```bash
npm ci
cp .env.example .env       # if one exists; otherwise build it from the table below
npm run dev                # localhost:3000
```

Migrations run automatically at server boot through `src/instrumentation.ts`. You don't need to call `npm run db:migrate` by hand unless you want to apply migrations without booting Next. Use `npm run db:studio` to poke at the SQLite file through Drizzle's GUI. `npm run lint` and `npm test` (Vitest) round out the dev loop.

You'll still need Jackett, Deluge, and Mokuro reachable from your dev machine. Easiest path: keep them in Compose and point your local `.env` at the exposed ports.

## Configuration

All configuration is environment variables. No config files.

### Required

| Variable | What it does |
|---|---|
| `JACKETT_URL` | Base URL of your Jackett instance, e.g. `http://jackett:9117` |
| `JACKETT_API_KEY` | API key from Jackett's dashboard |
| `DELUGE_URL` | Deluge Web UI URL, e.g. `http://deluge:8112` |
| `DELUGE_PASSWORD` | Deluge Web UI password |
| `BETTER_AUTH_SECRET` | Session signing secret. Generate with `openssl rand -base64 32` |

### Directories

| Variable | Default | What it does |
|---|---|---|
| `MANGA_DIR` | `/manga` | Library root the scanner walks |
| `DATABASE_URL` | `/data/mangashelf.db` | SQLite file path |
| `DELUGE_DOWNLOAD_DIR` | `/downloads` | Where Deluge drops finished torrents (must match Deluge's view) |
| `EXTRACT_DIR` | `/tmp/mangashelf-extract` | Temp staging for archive extraction |
| `IMPORT_STAGING_DIR` | `/tmp/mangashelf-import` | Temp staging for import sessions |

### Background intervals (seconds)

| Variable | Default | What it does |
|---|---|---|
| `DOWNLOAD_CHECK_INTERVAL` | `30` | How often to poll Deluge for download progress |
| `IMPORT_INTERVAL` | `30` | How often to check for finished torrents to import |
| `MONITOR_INTERVAL` | `3600` | How often to re-scan AniList/Jackett for missing volumes on watched series |
| `OCR_DISPATCH_INTERVAL` | `15` | How often the OCR queue drains |
| `AUTO_DOWNLOAD` | `false` | Set `true` to let monitoring queue downloads on its own |

### Auth

| Variable | Default | What it does |
|---|---|---|
| `AUTH_RP_ID` | `localhost` | Passkey/WebAuthn relying party ID. Set to your hostname in production |
| `AUTH_ORIGIN` | `http://localhost:3000` | Origin used for passkey ceremony validation |
| `BETTER_AUTH_BASE_URL` | `http://localhost:3000` | Public base URL of the app |

### OCR / Mokuro

| Variable | Default | What it does |
|---|---|---|
| `MOKURO_URL` | none | Mokuro worker base URL. Unset to disable OCR entirely |
| `MOKURO_DEVICE` | `cpu` | Set to `cuda` on the worker side if you have a GPU and the NVIDIA runtime configured |

### Import UI (optional)

| Variable | Default | What it does |
|---|---|---|
| `IMPORT_BROWSE_ROOTS` | unset | Comma-separated list of directories the manual import browser is allowed to walk |
| `IMPORT_MAX_UPLOAD_SIZE` | `2147483648` | Upload size cap in bytes (2 GB default) |

## Folder layout

The Reader expects this exact shape under `MANGA_DIR`:

```
/manga/
  Berserk [anilist-30002]/
    v01/
      001.jpg
      002.jpg
      ...
    v02/
      001.png
      ...
    .covers/                  # auto-generated, ignore
  Yotsuba&! [anilist-30094]/
    第01巻/
      page_001.webp
      ...
```

Two rules. The manga folder name needs `[anilist-NNNN]` somewhere in it so metadata can be looked up. Volume folders need a recognisable volume number, but they can show up in many forms: `v01`, `vol01`, `volume01`, `第01巻`, `Vol. 1`, `Ch01-05`, with or without zero-padding, with CJK characters or ASCII. The importer's pattern matcher in `src/lib/importer.ts` handles all of those plus batch ranges and multi-volume torrents nested arbitrarily deep.

Pages can be `.jpg`, `.jpeg`, `.png`, or `.webp`. Sort order is filename-driven and survives weird prefixes.

When the Manager pulls a torrent, it lands as an archive in `DELUGE_DOWNLOAD_DIR`. The importer extracts `.zip`, `.cbz`, `.rar`, `.cbr`, and `.7z` into `EXTRACT_DIR`, walks the result for volume folders, normalises naming, and copies pages into the right `Title [anilist-N]/vXX/` slot in `MANGA_DIR`. The original archive is left where Deluge dropped it.

## Using it

After first boot you'll land on a login page. Make an account. You're now admin and registration is closed.

The Reader tab shows everything the scanner found on disk. Click a manga, click a volume, read. Reading position is saved per user, per volume.

The Manager tab is where you wire up automation. Search AniList from inside the app, pick a series, and it gets added as a managed manga with all volumes marked `missing`. Click search and MangaShelf hits Jackett for each missing volume and shows you torrent results. Pick one (or click bulk download to take everything at once) and it gets handed off to Deluge. Status flips through `downloading → downloaded → imported` on its own as the background workers run. Flip the monitor toggle on a series and the same loop runs without you, on the schedule set by `MONITOR_INTERVAL`. Set `AUTO_DOWNLOAD=true` if you want it to also pick the best torrent and queue it without asking.

For Japanese learners: install dictionaries from Settings before mining. The dict catalog has Jitendex (JMdict-derived definitions), KANJIDIC2, JPDB frequency, BCCWJ frequency, and Innocent Corpus frequency. Click install on each one. The browser worker downloads the Yomitan ZIP through `/api/dict/install` (server-proxied to dodge CORS), parses bank JSON files, and writes them into IndexedDB. Progress shows live for download, parse, and insert phases. Uninstall is a button next to each installed dict.

Once dictionaries are in and a volume has its `.mokuro` sidecar, open it in the Reader. Text bubbles get an overlay you can tap. Picking a block opens the Anki card dialog with the OCR text pre-filled. Highlight a word, see ranked dictionary results (sorted by frequency rank, then dict priority), pick a definition, and click Send to Anki. The server crops the bubble image with Sharp, ships the crop to Anki as a media file via AnkiConnect, and adds a card with sentence, image, definition, and source fields. Field templates are configurable in Settings. There's also an update-last-card mode if you want to attach a new screenshot to the most recent note in a deck.

## Background workers

Server-side, four loops kick off in `src/instrumentation.ts` when the Node runtime boots:

1. Library scan once at startup (`syncLibrary()` in `src/lib/scanner.ts`).
2. Download progress + auto-import poll on `DOWNLOAD_CHECK_INTERVAL`/`IMPORT_INTERVAL` (`startBackgroundTasks()` in `src/lib/importer.ts`).
3. Monitor loop on `MONITOR_INTERVAL` (`startMonitorInterval()` in `src/lib/monitor.ts`). Re-checks AniList for new volumes and asks Jackett to find them.
4. OCR dispatcher on `OCR_DISPATCH_INTERVAL` (`startOcrDispatcher()` in `src/lib/ocr.ts`). Reads the `volumeOcr` queue, hits the Mokuro worker, writes sidecars.

Stale import sessions from the previous run get cleaned up at boot too.

Browser-side, a single Web Worker (`src/workers/dict-worker.ts`) handles Yomitan dictionary install (download, unzip, bank parse, IndexedDB bulk insert with progress events) and lookups (deinflection through the Japanese transform rules in `src/lib/dict/transforms/`, then ranked search across `terms`, `kanji`, and `frequency` IndexedDB stores). Lookup results merge frequency rankings and pitch metadata before they hit the UI.

## Database

SQLite, one file, default location `/data/mangashelf.db`. Schema in `src/db/schema.ts`. Migrations live under `drizzle/` and run automatically on boot through `src/db/migrate.ts`.

Reader tables: `manga`, `volume`, `readingProgress`. Manager tables: `managedManga`, `managedVolume`, `downloadHistory`. OCR queue: `volumeOcr`. Manual import audit: `importHistory`, `importHistoryVolume`. Auth (better-auth): `user`, `session`, `account`, `verification`, `twoFactor`, `passkey`. User preferences: `userPreferences` (theme, OCR settings, Anki config). All foreign keys cascade on delete.

`npm run db:studio` gives you a GUI if you want to poke around without writing SQL.

Dictionary data does not live in SQLite. It's in browser IndexedDB, so each user installs the dicts they want into their own browser. There's no server-side dict store and no shared dict state between users.

## Auth

`better-auth` with the passkey and TOTP plugins. Email + password works as a fallback. First account that registers becomes admin and after that registration is closed. To re-open it, edit the user row directly in `db:studio` or wipe the auth tables.

Sessions last 30 days, with a 5-minute cookie cache. `AUTH_RP_ID` has to match the hostname you serve from in production, or passkey enrollment will fail with a relying-party mismatch.

## Credits

This thing is mostly other people's hard work glued together. Acknowledgments where they're due:

**Mokuro** does the OCR. The `.mokuro` JSON format and the bundled worker container both come from that project. Without it, none of the text overlay or mining flow would exist. https://github.com/kha-white/mokuro

**Yomitan** is the dictionary format. MangaShelf reads Yomitan v3 ZIPs directly: term banks, kanji banks, frequency banks, structured-content glossaries. The deinflection engine in `src/lib/dict/transforms/` follows Yomitan's rule-based approach for Japanese conjugation. https://github.com/yomidevs/yomitan

**JMdict** (via **Jitendex**) for Japanese-to-English term definitions. https://jitendex.org

**KANJIDIC2** for kanji readings, meanings, and JLPT levels. https://www.edrdg.org/wiki/index.php/KANJIDIC_Project

**JPDB**, **BCCWJ**, and **Innocent Corpus** supply the three frequency dictionaries shipped in the catalog. They rank what's common in modern Japanese, balanced corpora, and fiction respectively.

**AnkiConnect** is the bridge to Anki. Card creation goes through its v6 JSON-RPC API. https://github.com/FooSoft/anki-connect

**AniList** for manga metadata, served over their public GraphQL API. https://anilist.co

**Jackett** as the torrent indexer aggregator. **Deluge** as the torrent client.

**Sharp** does the per-page image crop when an Anki card is being built.

If you're using MangaShelf to read manga in Japanese, please consider donating to or otherwise supporting Mokuro and Yomitan. They're the load-bearing pieces here.

## Status

Personal project. No license, no public release commitment, no support. The code is here, the Compose file is here, you can run it. If something breaks, you're on your own. Don't expose the raw container to the public internet without a reverse proxy and a real session secret.
