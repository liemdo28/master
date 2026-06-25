export interface BrowserTaskInput {
  url: string;
  actions?: unknown[];
  screenshot?: boolean;
  task_id?: string;
}

export async function smokeTest(url: string, taskId?: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return {
      ok: res.ok,
      task_id: taskId,
      url,
      status: res.status,
      latency_ms: Date.now() - start,
    };
  } catch (e: any) {
    return {
      ok: false,
      task_id: taskId,
      url,
      error: e.message,
      latency_ms: Date.now() - start,
    };
  }
}

export async function runBrowserTask(input: BrowserTaskInput) {
  const smoke = await smokeTest(input.url, input.task_id);
  return {
    ...smoke,
    actions_requested: input.actions?.length || 0,
    screenshot_requested: !!input.screenshot,
    note: 'Browser automation engine is using HTTP smoke fallback.',
  };
}
