/**
 * Build identity and GHCR update detection.
 *
 * Reads the commit SHA baked into the Docker image at build time, then
 * compares it against the :latest tag on GitHub Container Registry to
 * detect available updates.
 */

const GHCR_REGISTRY = "https://ghcr.io";
const GHCR_REPO = "yvdriel/mangashelf";
const CHECK_TIMEOUT = 10_000; // 10s per request
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const SHA_REGEX = /^[0-9a-f]{40}$/;

export interface BuildIdentity {
  commitSha: string;
  shortSha: string;
  buildDate: string | null;
}

export interface VersionCheckResult {
  current: BuildIdentity | null;
  latest: { commitSha: string; shortSha: string } | null;
  updateAvailable: boolean | null; // null = dev mode or check failed
  checkedAt: string | null;
}

// --- Build identity ---

export function getBuildIdentity(): BuildIdentity | null {
  const sha = process.env.BUILD_COMMIT_SHA;
  if (!sha || sha === "unknown" || !SHA_REGEX.test(sha)) {
    return null;
  }
  return {
    commitSha: sha,
    shortSha: sha.slice(0, 7),
    buildDate: process.env.BUILD_DATE || null,
  };
}

// --- GHCR update check ---

let cachedResult: VersionCheckResult | null = null;
let cachedAt = 0;

export async function checkForUpdates(
  force = false,
): Promise<VersionCheckResult> {
  const identity = getBuildIdentity();

  if (!identity) {
    return {
      current: null,
      latest: null,
      updateAvailable: null,
      checkedAt: null,
    };
  }

  if (!force && cachedResult && Date.now() - cachedAt < CACHE_TTL) {
    return cachedResult;
  }

  try {
    const result = await queryGhcr(identity);
    cachedResult = result;
    cachedAt = Date.now();
    return result;
  } catch {
    return {
      current: identity,
      latest: null,
      updateAvailable: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

// --- GHCR API helpers ---

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
].join(", ");

async function getGhcrToken(): Promise<string> {
  const res = await fetch(
    `${GHCR_REGISTRY}/token?service=ghcr.io&scope=repository:${GHCR_REPO}:pull`,
    { signal: AbortSignal.timeout(CHECK_TIMEOUT) },
  );
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function getManifestDigest(
  token: string,
  tag: string,
): Promise<string | null> {
  const res = await fetch(`${GHCR_REGISTRY}/v2/${GHCR_REPO}/manifests/${tag}`, {
    method: "HEAD",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: MANIFEST_ACCEPT,
    },
    signal: AbortSignal.timeout(CHECK_TIMEOUT),
  });
  if (!res.ok) return null;
  return res.headers.get("docker-content-digest");
}

async function listTags(token: string): Promise<string[]> {
  const res = await fetch(`${GHCR_REGISTRY}/v2/${GHCR_REPO}/tags/list`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(CHECK_TIMEOUT),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { tags?: string[] };
  return data.tags || [];
}

async function queryGhcr(identity: BuildIdentity): Promise<VersionCheckResult> {
  const token = await getGhcrToken();
  const checkedAt = new Date().toISOString();

  // Get digests for :latest and :<current-sha> in parallel
  const [latestDigest, currentDigest] = await Promise.all([
    getManifestDigest(token, "latest"),
    getManifestDigest(token, identity.commitSha),
  ]);

  // Can't determine update status without digests
  if (!latestDigest || !currentDigest) {
    return {
      current: identity,
      latest: null,
      updateAvailable: null,
      checkedAt,
    };
  }

  // Up to date
  if (latestDigest === currentDigest) {
    return {
      current: identity,
      latest: { commitSha: identity.commitSha, shortSha: identity.shortSha },
      updateAvailable: false,
      checkedAt,
    };
  }

  // Update available — try to find which SHA tag :latest points to
  let latestSha: { commitSha: string; shortSha: string } | null = null;
  try {
    const tags = await listTags(token);
    const shaTags = tags
      .filter((t) => SHA_REGEX.test(t) && t !== identity.commitSha)
      .slice(0, 20); // Limit to 20 most recent tags

    // Check all SHA tags in parallel
    const results = await Promise.all(
      shaTags.map(async (tag) => ({
        tag,
        digest: await getManifestDigest(token, tag),
      })),
    );

    const match = results.find((r) => r.digest === latestDigest);
    if (match) {
      latestSha = { commitSha: match.tag, shortSha: match.tag.slice(0, 7) };
    }
  } catch {
    // Best-effort: we already know an update is available
  }

  return {
    current: identity,
    latest: latestSha,
    updateAvailable: true,
    checkedAt,
  };
}
