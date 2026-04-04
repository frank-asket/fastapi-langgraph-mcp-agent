/** FastAPI Study Coach base URL (no trailing slash). */
export function getApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
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
