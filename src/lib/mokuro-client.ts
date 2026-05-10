const MOKURO_URL = process.env.MOKURO_URL || "http://mokuro-worker:8000";

export interface EnqueueResult {
  jobId: string;
  status: "queued" | "running" | "done" | "failed";
  deduplicated?: boolean;
}

export interface JobStatus {
  jobId: string;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  mokuroFile: string | null;
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? 10_000,
  );
  try {
    const res = await fetch(`${MOKURO_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`mokuro ${res.status}: ${body.slice(0, 500)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enqueueOcr(
  volumePath: string,
  jobKey?: string,
): Promise<EnqueueResult> {
  return fetchJson<EnqueueResult>("/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volumePath, jobKey }),
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    return await fetchJson<JobStatus>(`/ocr/${encodeURIComponent(jobId)}`);
  } catch (e) {
    // 404 = worker has GC'd the job (TTL elapsed). Treat as unknown.
    if (e instanceof Error && /\b404\b/.test(e.message)) return null;
    throw e;
  }
}

export async function workerHealthy(): Promise<boolean> {
  try {
    await fetchJson<{ ok: boolean }>("/health", { timeoutMs: 3000 });
    return true;
  } catch {
    return false;
  }
}
