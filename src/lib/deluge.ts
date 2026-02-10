const DELUGE_URL = process.env.DELUGE_URL || "http://deluge:8112";
const DELUGE_PASSWORD = process.env.DELUGE_PASSWORD || "deluge";

let sessionCookie: string | null = null;
let rpcId = 0;

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  const res = await fetch(`${DELUGE_URL}/json`, {
    method: "POST",
    headers,
    body: JSON.stringify({ method, params, id: ++rpcId }),
  });

  // Capture session cookie
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/(_session_id=[^;]+)/);
    if (match) sessionCookie = match[1];
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Deluge RPC error: ${data.error.message}`);
  }

  return data.result;
}

async function ensureAuth(): Promise<void> {
  try {
    const connected = await rpc("auth.check_session");
    if (connected) return;
  } catch {
    // Session expired or invalid
  }

  sessionCookie = null;
  const result = await rpc("auth.login", [DELUGE_PASSWORD]);
  if (!result) {
    throw new Error("Deluge authentication failed");
  }

  // Connect to the first available host
  const hosts = (await rpc("web.get_hosts")) as string[][];
  if (hosts && hosts.length > 0) {
    await rpc("web.connect", [hosts[0][0]]);
  }
}

export async function addTorrent(
  magnetLink: string,
  downloadDir?: string,
): Promise<string | null> {
  await ensureAuth();

  const options: Record<string, unknown> = {};
  if (downloadDir) {
    options.download_location = downloadDir;
  }

  const result = await rpc("core.add_torrent_magnet", [magnetLink, options]);
  return result as string | null;
}

export interface TorrentStatus {
  hash: string;
  name: string;
  state: string;
  progress: number;
  downloadLocation: string;
  totalSize: number;
}

export async function getTorrentStatus(
  torrentId: string,
): Promise<TorrentStatus | null> {
  await ensureAuth();

  const result = (await rpc("core.get_torrent_status", [
    torrentId,
    ["name", "state", "progress", "download_location", "total_size"],
  ])) as Record<string, unknown> | null;

  if (!result || Object.keys(result).length === 0) return null;

  return {
    hash: torrentId,
    name: result.name as string,
    state: result.state as string,
    progress: result.progress as number,
    downloadLocation: result.download_location as string,
    totalSize: result.total_size as number,
  };
}

export async function getActiveTorrents(): Promise<TorrentStatus[]> {
  await ensureAuth();

  const result = (await rpc("core.get_torrents_status", [
    {},
    ["name", "state", "progress", "download_location", "total_size"],
  ])) as Record<string, Record<string, unknown>> | null;

  if (!result) return [];

  return Object.entries(result).map(([hash, t]) => ({
    hash,
    name: t.name as string,
    state: t.state as string,
    progress: t.progress as number,
    downloadLocation: t.download_location as string,
    totalSize: t.total_size as number,
  }));
}
