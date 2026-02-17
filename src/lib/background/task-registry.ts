/**
 * In-memory registry for background task status tracking.
 * Resets on server restart — only current-session state matters.
 */

export interface TaskLastRun {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result: string;
  success: boolean;
  error?: string;
}

export interface TaskState {
  name: string;
  description: string;
  intervalMs: number;
  enabled: boolean;
  status: "idle" | "running" | "disabled";
  lastRun?: TaskLastRun;
  nextRun?: string;
  stats?: Record<string, unknown>;
}

interface RegisteredTask extends TaskState {
  run: () => Promise<string> | string;
  startedAt?: number;
}

const _g = globalThis as unknown as {
  __mangashelf_task_registry?: Map<string, RegisteredTask>;
};

function getRegistry(): Map<string, RegisteredTask> {
  if (!_g.__mangashelf_task_registry) {
    _g.__mangashelf_task_registry = new Map();
  }
  return _g.__mangashelf_task_registry;
}

export function registerTask(
  name: string,
  opts: {
    description: string;
    intervalMs: number;
    enabled?: boolean;
    run: () => Promise<string> | string;
  },
): void {
  const registry = getRegistry();
  // Preserve existing state if re-registering (HMR)
  const existing = registry.get(name);
  registry.set(name, {
    name,
    description: opts.description,
    intervalMs: opts.intervalMs,
    enabled: opts.enabled ?? true,
    status: existing?.status ?? "idle",
    lastRun: existing?.lastRun,
    nextRun: existing?.nextRun,
    stats: existing?.stats,
    run: opts.run,
  });
}

export function taskStarted(name: string): void {
  const task = getRegistry().get(name);
  if (!task) return;
  task.status = "running";
  task.startedAt = Date.now();
}

export function taskCompleted(name: string, result: string): void {
  const task = getRegistry().get(name);
  if (!task) return;
  const now = Date.now();
  task.status = "idle";
  task.lastRun = {
    startedAt: new Date(task.startedAt ?? now).toISOString(),
    completedAt: new Date(now).toISOString(),
    durationMs: task.startedAt ? now - task.startedAt : 0,
    result,
    success: true,
  };
  if (task.intervalMs > 0) {
    task.nextRun = new Date(now + task.intervalMs).toISOString();
  }
  task.startedAt = undefined;
}

export function taskFailed(name: string, error: string): void {
  const task = getRegistry().get(name);
  if (!task) return;
  const now = Date.now();
  task.status = "idle";
  task.lastRun = {
    startedAt: new Date(task.startedAt ?? now).toISOString(),
    completedAt: new Date(now).toISOString(),
    durationMs: task.startedAt ? now - task.startedAt : 0,
    result: error,
    success: false,
    error,
  };
  if (task.intervalMs > 0) {
    task.nextRun = new Date(now + task.intervalMs).toISOString();
  }
  task.startedAt = undefined;
}

export function setTaskEnabled(name: string, enabled: boolean): void {
  const task = getRegistry().get(name);
  if (!task) return;
  task.enabled = enabled;
  task.status = enabled ? "idle" : "disabled";
}

export function updateTaskNextRun(name: string, nextRun: Date): void {
  const task = getRegistry().get(name);
  if (!task) return;
  task.nextRun = nextRun.toISOString();
}

export async function triggerTask(
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const task = getRegistry().get(name);
  if (!task) return { success: false, error: `Task "${name}" not found` };
  if (task.status === "running")
    return { success: false, error: `Task "${name}" is already running` };

  // Fire and forget — don't await, let it run in background
  (async () => {
    taskStarted(name);
    try {
      const result = await task.run();
      taskCompleted(name, result);
    } catch (e) {
      taskFailed(name, e instanceof Error ? e.message : String(e));
    }
  })();

  return { success: true };
}

function toTaskState(task: RegisteredTask): TaskState {
  return {
    name: task.name,
    description: task.description,
    intervalMs: task.intervalMs,
    enabled: task.enabled,
    status: task.status,
    lastRun: task.lastRun,
    nextRun: task.nextRun,
    stats: task.stats,
  };
}

export function getTaskStates(): TaskState[] {
  return Array.from(getRegistry().values()).map(toTaskState);
}

export function getTask(name: string): TaskState | undefined {
  const task = getRegistry().get(name);
  if (!task) return undefined;
  return toTaskState(task);
}
