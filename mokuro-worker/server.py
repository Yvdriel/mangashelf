"""
mokuro-worker: HTTP wrapper around the mokuro CLI.

Receives OCR jobs over HTTP, runs them serially in a single background
worker, and writes `<volume>.mokuro` JSON files alongside each volume folder.
Mokuro's own `_ocr/` cache makes re-runs nearly free.
"""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mokuro-worker")

DEVICE = os.environ.get("MOKURO_DEVICE", "cpu").lower()
JOB_TTL_SECONDS = int(os.environ.get("MOKURO_JOB_TTL", "3600"))
ALLOWED_ROOT = Path(os.environ.get("MOKURO_ALLOWED_ROOT", "/manga")).resolve()


@dataclass
class Job:
    id: str
    volume_path: str
    job_key: Optional[str]
    status: str = "queued"  # queued | running | done | failed
    error: Optional[str] = None
    mokuro_file: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None


jobs: dict[str, Job] = {}
job_keys: dict[str, str] = {}  # job_key -> job_id (for idempotent enqueue)
queue: asyncio.Queue[str] = asyncio.Queue()


class EnqueueBody(BaseModel):
    volumePath: str
    jobKey: Optional[str] = None


app = FastAPI(title="mangashelf-mokuro")


@app.get("/health")
async def health():
    return {"ok": True, "device": DEVICE, "queueDepth": queue.qsize()}


@app.post("/ocr")
async def enqueue(body: EnqueueBody):
    vol_path = Path(body.volumePath)
    if not vol_path.is_dir():
        raise HTTPException(400, f"volumePath is not a directory: {body.volumePath}")

    # Confine to MOKURO_ALLOWED_ROOT (defaults to /manga). Defence in depth
    # against misconfigured deployments that expose the worker beyond a
    # trusted internal network.
    try:
        resolved = vol_path.resolve()
        resolved.relative_to(ALLOWED_ROOT)
    except ValueError:
        raise HTTPException(
            400, f"volumePath is outside allowed root {ALLOWED_ROOT}"
        )
    vol_path = resolved

    if body.jobKey and body.jobKey in job_keys:
        existing_id = job_keys[body.jobKey]
        existing = jobs.get(existing_id)
        if existing and existing.status in ("queued", "running"):
            return {"jobId": existing.id, "status": existing.status, "deduplicated": True}

    job_id = uuid.uuid4().hex
    job = Job(id=job_id, volume_path=str(vol_path), job_key=body.jobKey)
    jobs[job_id] = job
    if body.jobKey:
        job_keys[body.jobKey] = job_id
    await queue.put(job_id)
    log.info("enqueued job %s for %s (key=%s)", job_id, vol_path, body.jobKey)
    return {"jobId": job_id, "status": "queued"}


@app.get("/ocr/{job_id}")
async def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "unknown jobId")
    return {
        "jobId": job.id,
        "status": job.status,
        "error": job.error,
        "mokuroFile": job.mokuro_file,
    }


def _run_mokuro(volume_path: Path) -> tuple[bool, Optional[str], Optional[str]]:
    """Invoke mokuro on a single volume folder.

    mokuro expects the parent directory of one or more volume folders. We pass
    `--parent_dir` set to the volume's parent and rely on mokuro to process
    every subdirectory there. To keep scope tight to the requested volume, we
    instead pass the volume folder itself as a positional argument; mokuro
    treats it as one volume and writes `<parent>/<volume>.mokuro`.
    """
    parent = volume_path.parent
    args = [
        "mokuro",
        str(volume_path),
        "--disable_html",
        "--disable_confirmation",
    ]
    if DEVICE != "cuda":
        args.append("--force_cpu")

    log.info("running: %s", " ".join(args))
    try:
        proc = subprocess.run(
            args,
            cwd=str(parent),
            capture_output=True,
            text=True,
            check=False,
            timeout=60 * 60,  # 1h ceiling per volume
        )
    except subprocess.TimeoutExpired:
        return False, "mokuro timed out after 1h", None
    except FileNotFoundError:
        return False, "mokuro CLI not installed in worker image", None

    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or "").strip()[-2000:]
        return False, f"mokuro exited {proc.returncode}: {msg}", None

    candidate = parent / f"{volume_path.name}.mokuro"
    if not candidate.is_file():
        return False, f"expected {candidate} but it was not created", None

    return True, None, str(candidate)


async def _worker_loop():
    log.info("worker loop started (device=%s)", DEVICE)
    while True:
        job_id = await queue.get()
        job = jobs.get(job_id)
        if not job:
            queue.task_done()
            continue

        job.status = "running"
        log.info("[%s] processing %s", job.id, job.volume_path)
        loop = asyncio.get_running_loop()
        try:
            ok, err, mokuro_file = await loop.run_in_executor(
                None, _run_mokuro, Path(job.volume_path)
            )
        except Exception as e:  # noqa: BLE001
            ok, err, mokuro_file = False, f"unhandled: {e}", None

        job.finished_at = time.time()
        if ok:
            job.status = "done"
            job.mokuro_file = mokuro_file
            log.info("[%s] done -> %s", job.id, mokuro_file)
        else:
            job.status = "failed"
            job.error = err
            log.error("[%s] failed: %s", job.id, err)
        queue.task_done()
        _gc_old_jobs()


def _gc_old_jobs():
    cutoff = time.time() - JOB_TTL_SECONDS
    stale = [jid for jid, j in jobs.items() if j.finished_at and j.finished_at < cutoff]
    for jid in stale:
        j = jobs.pop(jid, None)
        if j and j.job_key and job_keys.get(j.job_key) == jid:
            job_keys.pop(j.job_key, None)


@app.on_event("startup")
async def _on_startup():
    asyncio.create_task(_worker_loop())
