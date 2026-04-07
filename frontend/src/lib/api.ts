function directApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

/**
 * FastAPI Study Coach base URL (no trailing slash).
 *
 * In the **browser**, when `NEXT_PUBLIC_API_URL` points at another origin than this page (split UI/API hosts),
 * returns the same-origin prefix `/api/coach` so `next.config` rewrites forward to the real API without CORS.
 * On the **server** (SSR, metadata), always uses the real `NEXT_PUBLIC_API_URL`.
 */
export function getApiUrl(): string {
  const direct = directApiBase();
  if (typeof window === "undefined") {
    return direct;
  }
  try {
    const apiOrigin = new URL(direct).origin;
    if (apiOrigin === window.location.origin) {
      return direct;
    }
  } catch {
    return direct;
  }
  return "/api/coach";
}

export function apiDocsUrl(): string {
  return `${getApiUrl()}/docs`;
}

export function serviceMapUrl(): string {
  return `${getApiUrl()}/service`;
}

export function workflowUrl(): string {
  return `${getApiUrl()}/workflow`;
}

export function workflowLearningFeedbackUrl(): string {
  return `${getApiUrl()}/workflow/learning-feedback`;
}

export function workflowUploadUrl(): string {
  return `${getApiUrl()}/workflow/upload`;
}

export function workflowHistoryUrl(threadId: string): string {
  const q = new URLSearchParams({ thread_id: threadId });
  return `${getApiUrl()}/workflow/history?${q.toString()}`;
}

export function workflowEmailExportUrl(): string {
  return `${getApiUrl()}/workflow/email-export`;
}

export function workflowThreadsUrl(limit = 40): string {
  const q = new URLSearchParams({ limit: String(limit) });
  return `${getApiUrl()}/workflow/threads?${q.toString()}`;
}
