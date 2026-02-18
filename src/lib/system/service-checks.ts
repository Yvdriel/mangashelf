/**
 * Service connectivity checks for Deluge, Jackett, and AniList.
 * Each check has a 5-second timeout. Results are cached for 60 seconds.
 */

const DELUGE_URL = process.env.DELUGE_URL || "http://deluge:8112";
const DELUGE_PASSWORD = process.env.DELUGE_PASSWORD || "deluge";
const JACKETT_URL = process.env.JACKETT_URL || "http://jackett:9117";
const JACKETT_API_KEY = process.env.JACKETT_API_KEY || "";
const ANILIST_URL = "https://graphql.anilist.co";

const CHECK_TIMEOUT = 5000;

export interface ServiceStatus {
  name: string;
  status: "connected" | "unreachable" | "error" | "degraded";
  message?: string;
  responseTimeMs?: number;
  version?: string;
  details?: Record<string, unknown>;
  lastChecked: string;
}

export interface ServiceCheckResult {
  deluge: ServiceStatus;
  jackett: ServiceStatus;
  anilist: ServiceStatus;
}

// --- Deluge check ---

async function delugeRpc(
  method: string,
  params: unknown[],
  cookie: string | null,
  signal: AbortSignal,
): Promise<{ result: unknown; cookie: string | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${DELUGE_URL}/json`, {
    method: "POST",
    headers,
    body: JSON.stringify({ method, params, id: 1 }),
    signal,
  });

  let newCookie = cookie;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/(_session_id=[^;]+)/);
    if (match) newCookie = match[1];
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Deluge RPC error");
  }
  return { result: data.result, cookie: newCookie };
}

async function checkDeluge(): Promise<ServiceStatus> {
  const start = Date.now();
  const signal = AbortSignal.timeout(CHECK_TIMEOUT);

  try {
    // Auth
    let cookie: string | null = null;
    const loginRes = await delugeRpc(
      "auth.login",
      [DELUGE_PASSWORD],
      cookie,
      signal,
    );
    if (!loginRes.result) {
      return {
        name: "Deluge",
        status: "error",
        message: "Authentication failed",
        responseTimeMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }
    cookie = loginRes.cookie;

    // Connect to daemon
    const hostsRes = await delugeRpc("web.get_hosts", [], cookie, signal);
    const hosts = hostsRes.result as string[][];
    cookie = hostsRes.cookie;
    if (hosts && hosts.length > 0) {
      const connectRes = await delugeRpc(
        "web.connect",
        [hosts[0][0]],
        cookie,
        signal,
      );
      cookie = connectRes.cookie;
    }

    // Gather info in parallel
    const [freeSpaceRes, sessionRes, torrentsRes, versionRes] =
      await Promise.all([
        delugeRpc("core.get_free_space", [], cookie, signal),
        delugeRpc(
          "core.get_session_status",
          [["download_rate", "upload_rate"]],
          cookie,
          signal,
        ),
        delugeRpc("core.get_torrents_status", [{}, ["state"]], cookie, signal),
        delugeRpc("daemon.info", [], cookie, signal).catch(() => ({
          result: null,
          cookie,
        })),
      ]);

    const sessionStatus = sessionRes.result as Record<string, number>;
    const torrents = torrentsRes.result as Record<string, unknown> | null;
    const activeTorrents = torrents ? Object.keys(torrents).length : 0;

    return {
      name: "Deluge",
      status: "connected",
      responseTimeMs: Date.now() - start,
      version: (versionRes.result as string) || undefined,
      details: {
        freeBytes: freeSpaceRes.result as number,
        activeTorrents,
        downloadSpeed: sessionStatus?.download_rate ?? 0,
        uploadSpeed: sessionStatus?.upload_rate ?? 0,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "Deluge",
      status: "unreachable",
      message: e instanceof Error ? e.message : String(e),
      responseTimeMs: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  }
}

// --- Jackett check ---

async function checkJackett(): Promise<ServiceStatus> {
  const start = Date.now();
  const signal = AbortSignal.timeout(CHECK_TIMEOUT);

  try {
    const res = await fetch(
      `${JACKETT_URL}/api/v2.0/indexers?configured=true&apikey=${JACKETT_API_KEY}`,
      { signal },
    );

    if (res.status === 401 || res.status === 403) {
      return {
        name: "Jackett",
        status: "error",
        message: "API key invalid",
        responseTimeMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }

    if (!res.ok) {
      return {
        name: "Jackett",
        status: "error",
        message: `HTTP ${res.status}`,
        responseTimeMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }

    const indexers = (await res.json()) as unknown[];
    return {
      name: "Jackett",
      status: indexers.length === 0 ? "degraded" : "connected",
      message: indexers.length === 0 ? "No indexers configured" : undefined,
      responseTimeMs: Date.now() - start,
      details: { configuredIndexers: indexers.length },
      lastChecked: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "Jackett",
      status: "unreachable",
      message: e instanceof Error ? e.message : String(e),
      responseTimeMs: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  }
}

// --- AniList check ---

async function checkAniList(): Promise<ServiceStatus> {
  const start = Date.now();
  const signal = AbortSignal.timeout(CHECK_TIMEOUT);

  try {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query { Media(id: 1, type: MANGA) { id } }",
      }),
      signal,
    });

    const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
    const rateLimitLimit = res.headers.get("x-ratelimit-limit");

    if (res.status === 429) {
      return {
        name: "AniList",
        status: "degraded",
        message: "Rate limited",
        responseTimeMs: Date.now() - start,
        details: {
          rateLimitRemaining: rateLimitRemaining
            ? parseInt(rateLimitRemaining, 10)
            : 0,
          rateLimitLimit: rateLimitLimit
            ? parseInt(rateLimitLimit, 10)
            : undefined,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    // Any response (even errors) proves reachability
    return {
      name: "AniList",
      status: "connected",
      responseTimeMs: Date.now() - start,
      details: {
        rateLimitRemaining: rateLimitRemaining
          ? parseInt(rateLimitRemaining, 10)
          : undefined,
        rateLimitLimit: rateLimitLimit
          ? parseInt(rateLimitLimit, 10)
          : undefined,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "AniList",
      status: "unreachable",
      message: e instanceof Error ? e.message : String(e),
      responseTimeMs: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  }
}

// --- Caching ---

let cachedResult: ServiceCheckResult | null = null;
let cachedAt = 0;
const CACHE_TTL = 60_000;

export async function checkAllServices(
  force = false,
): Promise<ServiceCheckResult> {
  if (!force && cachedResult && Date.now() - cachedAt < CACHE_TTL) {
    return cachedResult;
  }

  const [deluge, jackett, anilist] = await Promise.allSettled([
    checkDeluge(),
    checkJackett(),
    checkAniList(),
  ]);

  const result: ServiceCheckResult = {
    deluge:
      deluge.status === "fulfilled"
        ? deluge.value
        : {
            name: "Deluge",
            status: "unreachable",
            message: "Check failed",
            lastChecked: new Date().toISOString(),
          },
    jackett:
      jackett.status === "fulfilled"
        ? jackett.value
        : {
            name: "Jackett",
            status: "unreachable",
            message: "Check failed",
            lastChecked: new Date().toISOString(),
          },
    anilist:
      anilist.status === "fulfilled"
        ? anilist.value
        : {
            name: "AniList",
            status: "unreachable",
            message: "Check failed",
            lastChecked: new Date().toISOString(),
          },
  };

  cachedResult = result;
  cachedAt = Date.now();
  return result;
}

export async function checkSingleService(
  name: string,
): Promise<ServiceStatus | null> {
  switch (name) {
    case "deluge":
      return checkDeluge();
    case "jackett":
      return checkJackett();
    case "anilist":
      return checkAniList();
    default:
      return null;
  }
}
