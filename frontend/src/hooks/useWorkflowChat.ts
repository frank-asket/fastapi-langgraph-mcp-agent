"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getApiUrl,
  workflowEmailExportUrl,
  workflowHistoryUrl,
  workflowThreadsUrl,
  workflowUploadUrl,
  workflowUrl,
} from "@/lib/api";

function formatWorkflowNetworkError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "Failed to fetch" || (err instanceof TypeError && msg.toLowerCase().includes("fetch"))) {
    return (
      `Could not reach the API at ${getApiUrl()}. ` +
      `Check that the FastAPI server is running, NEXT_PUBLIC_API_URL in frontend/.env matches that URL, ` +
      `and CORS_ORIGINS on the API includes this page (e.g. http://localhost:3000 and http://127.0.0.1:3000).`
    );
  }
  return `Network error: ${msg}`;
}

export type GetTokenFn = () => Promise<string | null>;

const STORAGE_KEY = "ghana_study_thread_id";
const PROFILE_KEY = "ghana_learner_profile";
const AGENT_LANE_KEY = "ghana_agent_lane";
const WELCOME_KEY = "ghana_show_assessment_welcome";

/** First /workflow turns (LangGraph + MCP + LLM) can be slow; cap wait so UI does not spin forever. */
const WORKFLOW_FETCH_TIMEOUT_MS = 300_000;

export type LearnerProfile = {
  education_level?: string;
  shs_track?: string | null;
  tertiary_institution?: string | null;
  tertiary_programme?: string | null;
  subject_focus?: string | null;
  region?: string | null;
  goals?: string | null;
};

export type ChatMsg = { role: "user" | "assistant"; content: string; isError?: boolean };

export type PastThreadMeta = { thread_id: string; created_at: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** When using Clerk, pass `false` until `useAuth()` reports `isLoaded && isSignedIn` to avoid requests without a session JWT. */
export function useWorkflowChat(getToken?: GetTokenFn, clerkSessionReady?: boolean) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [resumeInput, setResumeInput] = useState("");
  const [agentLane, setAgentLane] = useState("auto");
  const [hintsMode, setHintsMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastThreads, setPastThreads] = useState<PastThreadMeta[]>([]);
  const [pastThreadsLoading, setPastThreadsLoading] = useState(false);

  const authHeaders = useCallback(async () => {
    if (!getToken) return {} as Record<string, string>;
    if (clerkSessionReady === false) return {} as Record<string, string>;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const t = await getToken();
        if (t) return { Authorization: `Bearer ${t}` };
      } catch {
        /* Clerk can fail transiently right after sign-in */
      }
      await new Promise((r) => setTimeout(r, 55 * (attempt + 1)));
    }
    return {} as Record<string, string>;
  }, [getToken, clerkSessionReady]);

  const readProfile = useCallback((): LearnerProfile | null => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw) as unknown;
      if (!o || typeof o !== "object") return null;
      return o as LearnerProfile;
    } catch {
      return null;
    }
  }, []);

  const [profileBanner, setProfileBanner] = useState<{ html: string; show: boolean }>({
    html: "",
    show: false,
  });

  const renderProfileBanner = useCallback(() => {
    const p = readProfile();
    if (!p) {
      setProfileBanner({ html: "", show: false });
      return;
    }
    const parts: string[] = [];
    if (p.education_level) parts.push(String(p.education_level).replace(/_/g, " "));
    if (p.subject_focus) parts.push(String(p.subject_focus));
    if (p.region) parts.push(String(p.region));
    if (p.shs_track && p.shs_track !== "na") parts.push(`track: ${String(p.shs_track).replace(/_/g, " ")}`);
    if (p.tertiary_institution && String(p.tertiary_institution).trim())
      parts.push(String(p.tertiary_institution).trim());
    if (p.tertiary_programme && String(p.tertiary_programme).trim())
      parts.push(String(p.tertiary_programme).trim());
    const line = parts.length ? parts.join(" · ") : "Assessment on file";
    let goalsHtml = "";
    if (p.goals && String(p.goals).trim()) {
      const g = String(p.goals).trim();
      const short = g.length > 180 ? `${g.slice(0, 180)}…` : g;
      goalsHtml = `<div class="mt-2 rounded-lg border border-[#2a352e] bg-[#0f1411]/90 p-2 text-sm text-[#c4cfc7]"><em>Goals:</em> ${escapeHtml(short)}</div>`;
    }
    let welcome = "";
    try {
      if (sessionStorage.getItem(WELCOME_KEY) === "1") {
        sessionStorage.removeItem(WELCOME_KEY);
        welcome =
          "<div class='mt-2 rounded-lg border border-[#d4a84b]/35 bg-[#171e19] p-2 text-sm text-[#c4cfc7]'>New thread from your assessment — say hello or ask your first question. The coach uses your profile on the first reply.</div>";
      }
    } catch {
      /* ignore */
    }
    setProfileBanner({
      show: true,
      html: `<strong class="text-white">Personalised from your assessment</strong><div class="mt-1 text-sm text-[#8c9a90]">${escapeHtml(line)}</div>${goalsHtml}${welcome}`,
    });
  }, [readProfile]);

  useEffect(() => {
    try {
      const sid = localStorage.getItem(STORAGE_KEY);
      setThreadId(sid || null);
    } catch {
      /* ignore */
    }
    try {
      const savedLane = localStorage.getItem(AGENT_LANE_KEY);
      if (savedLane && ["auto", "general", "jhs", "shs", "tertiary", "educator"].includes(savedLane)) {
        setAgentLane(savedLane);
      }
    } catch {
      /* ignore */
    }
    renderProfileBanner();
  }, [renderProfileBanner]);

  const fetchHistoryForThread = useCallback(
    async (tid: string) => {
      try {
        const h = await authHeaders();
        const res = await fetch(workflowHistoryUrl(tid), { credentials: "include", headers: h });
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: { role: string; content: string }[] };
        if (!data.messages?.length) return;
        setMessages(
          data.messages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        );
      } catch {
        /* offline */
      }
    },
    [authHeaders],
  );

  const loadHistory = useCallback(async () => {
    if (getToken != null && clerkSessionReady === false) return;
    let tid: string | null = threadId;
    if (!tid) {
      try {
        tid = localStorage.getItem(STORAGE_KEY);
      } catch {
        return;
      }
    }
    if (!tid) return;
    await fetchHistoryForThread(tid);
  }, [threadId, fetchHistoryForThread, getToken, clerkSessionReady]);

  const refreshPastThreads = useCallback(async () => {
    if (getToken != null && clerkSessionReady === false) return;
    setPastThreadsLoading(true);
    try {
      const h = await authHeaders();
      const res = await fetch(workflowThreadsUrl(40), {
        credentials: "include",
        headers: h,
      });
      let rows: PastThreadMeta[] = [];
      if (res.ok) {
        const data = (await res.json()) as { threads?: PastThreadMeta[] };
        rows = Array.isArray(data.threads) ? data.threads : [];
      }
      let active = threadId;
      if (!active) {
        try {
          active = localStorage.getItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
      const aid = active?.trim();
      if (aid && !rows.some((r) => r.thread_id === aid)) {
        rows = [{ thread_id: aid, created_at: new Date().toISOString() }, ...rows];
      }
      setPastThreads(rows);
    } catch {
      setPastThreads([]);
    } finally {
      setPastThreadsLoading(false);
    }
  }, [authHeaders, getToken, clerkSessionReady, threadId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, getToken, clerkSessionReady]);

  useEffect(() => {
    void refreshPastThreads();
  }, [refreshPastThreads]);

  const appendMessage = useCallback((role: "user" | "assistant", content: string, isError?: boolean) => {
    setMessages((prev) => [...prev, { role, content, isError }]);
  }, []);

  const clearProfile = useCallback(() => {
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
    renderProfileBanner();
  }, [renderProfileBanner]);

  const newChat = useCallback(() => {
    setThreadId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setResumeInput("");
    setMessages([]);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const applyResume = useCallback(async () => {
    const v = resumeInput.trim();
    if (!v) return;
    setThreadId(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    setMessages([]);
    await fetchHistoryForThread(v);
    void refreshPastThreads();
  }, [resumeInput, fetchHistoryForThread, refreshPastThreads]);

  const resumeThread = useCallback(
    async (tid: string) => {
      const v = tid.trim();
      if (!v) return;
      setThreadId(v);
      try {
        localStorage.setItem(STORAGE_KEY, v);
      } catch {
        /* ignore */
      }
      setResumeInput("");
      setMessages([]);
      await fetchHistoryForThread(v);
      void refreshPastThreads();
    },
    [fetchHistoryForThread, refreshPastThreads],
  );

  const onLaneChange = useCallback((v: string) => {
    setAgentLane(v);
    try {
      localStorage.setItem(AGENT_LANE_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const onSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text && !file) return;
      const userDisplay =
        text && file ? `${text}\n📎 ${file.name}` : file ? `📎 ${file.name}` : text;
      setInput("");
      appendMessage("user", userDisplay);
      setSending(true);

      const abortCtl = new AbortController();
      const abortTimer = setTimeout(() => abortCtl.abort(), WORKFLOW_FETCH_TIMEOUT_MS);
      try {
        const h = await authHeaders();
        let res: Response;
        const prof = readProfile();
        const fetchOpts: RequestInit = { signal: abortCtl.signal };
        if (file) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("message", text);
          if (threadId) fd.append("thread_id", threadId);
          fd.append("coaching_mode", hintsMode ? "hints" : "full");
          fd.append("agent_lane", agentLane || "auto");
          if (prof) fd.append("learner_profile_json", JSON.stringify(prof));
          const headers: Record<string, string> = {};
          if (h.Authorization) headers.Authorization = h.Authorization;
          res = await fetch(workflowUploadUrl(), {
            method: "POST",
            credentials: "include",
            headers,
            body: fd,
            ...fetchOpts,
          });
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          const payload: Record<string, unknown> = {
            message: text,
            coaching_mode: hintsMode ? "hints" : "full",
            agent_lane: agentLane || "auto",
          };
          if (threadId) payload.thread_id = threadId;
          if (prof) payload.learner_profile = prof;
          res = await fetch(workflowUrl(), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...h },
            body: JSON.stringify(payload),
            ...fetchOpts,
          });
        }

        const raw = await res.text();
        let data: { detail?: string | unknown; reply?: string; thread_id?: string };
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          data = { detail: raw || "Invalid response" };
        }

        if (!res.ok) {
          let detail =
            typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
          if (res.status === 401) {
            detail += getToken
              ? " Sign in with Clerk and try again."
              : " Configure Clerk on the frontend and API, or use an allowed access method.";
          }
          appendMessage("assistant", detail, true);
          return;
        }

        const newTid = data.thread_id;
        if (newTid) {
          setThreadId(newTid);
          try {
            localStorage.setItem(STORAGE_KEY, newTid);
          } catch {
            /* ignore */
          }
        }
        appendMessage("assistant", data.reply?.trim() ? data.reply : "(Empty reply)");
        void refreshPastThreads();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          appendMessage(
            "assistant",
            "Request timed out after 5 minutes. The Study Coach API may be overloaded, waiting on the LLM/MCP, or not running. Check the API terminal for errors (e.g. OpenAI key, MCP), restart uvicorn, and try again.",
            true,
          );
        } else {
          appendMessage("assistant", formatWorkflowNetworkError(err), true);
        }
      } finally {
        clearTimeout(abortTimer);
        setSending(false);
      }
    },
    [
      input,
      file,
      threadId,
      hintsMode,
      agentLane,
      authHeaders,
      readProfile,
      appendMessage,
      getToken,
      refreshPastThreads,
    ],
  );

  const copyThreadId = useCallback(async () => {
    if (!threadId) {
      alert("Send a message first to get a learning ID.");
      return;
    }
    try {
      await navigator.clipboard.writeText(threadId);
    } catch {
      prompt("Copy this learning ID:", threadId);
    }
  }, [threadId]);

  /** Email assistant markdown/plain text to the notification address saved under Account / Notification settings. */
  const emailAssistantMessage = useCallback(
    async (messageBody: string): Promise<{ sentTo: string }> => {
      const trimmed = messageBody.trim();
      if (!trimmed) {
        throw new Error("Nothing to email — this message is empty.");
      }
      if (getToken && clerkSessionReady === false) {
        throw new Error("Finish signing in before sending email.");
      }
      const h = await authHeaders();
      if (getToken && clerkSessionReady && !h.Authorization) {
        throw new Error(
          "Could not get a session token from Clerk. Wait a moment after sign-in, refresh the page, then try again.",
        );
      }
      const res = await fetch(workflowEmailExportUrl(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ body: trimmed }),
      });
      const raw = await res.text();
      let data: { detail?: unknown; sent_to?: string };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        data = { detail: raw || "Invalid response" };
      }
      if (!res.ok) {
        const detail =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? raw);
        throw new Error(detail);
      }
      const sentTo = (data.sent_to || "").trim();
      if (!sentTo) throw new Error("Server did not return sent_to.");
      return { sentTo };
    },
    [authHeaders, getToken, clerkSessionReady],
  );

  /** Send a single-turn message (e.g. from starter cards) without requiring input state first. */
  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      appendMessage("user", trimmed);
      setSending(true);
      const abortCtl = new AbortController();
      const abortTimer = setTimeout(() => abortCtl.abort(), WORKFLOW_FETCH_TIMEOUT_MS);
      try {
        const h = await authHeaders();
        const prof = readProfile();
        const payload: Record<string, unknown> = {
          message: trimmed,
          coaching_mode: hintsMode ? "hints" : "full",
          agent_lane: agentLane || "auto",
        };
        if (threadId) payload.thread_id = threadId;
        if (prof) payload.learner_profile = prof;
        const res = await fetch(workflowUrl(), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...h },
          body: JSON.stringify(payload),
          signal: abortCtl.signal,
        });
        const raw = await res.text();
        let data: { detail?: string | unknown; reply?: string; thread_id?: string };
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          data = { detail: raw || "Invalid response" };
        }
        if (!res.ok) {
          let detail =
            typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
          if (res.status === 401) {
            detail += getToken
              ? " Sign in with Clerk and try again."
              : " Configure Clerk on the frontend and API, or use an allowed access method.";
          }
          appendMessage("assistant", detail, true);
          return;
        }
        const newTid = data.thread_id;
        if (newTid) {
          setThreadId(newTid);
          try {
            localStorage.setItem(STORAGE_KEY, newTid);
          } catch {
            /* ignore */
          }
        }
        appendMessage("assistant", data.reply?.trim() ? data.reply : "(Empty reply)");
        void refreshPastThreads();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          appendMessage(
            "assistant",
            "Request timed out after 5 minutes. The Study Coach API may be overloaded, waiting on the LLM/MCP, or not running. Check the API terminal for errors (e.g. OpenAI key, MCP), restart uvicorn, and try again.",
            true,
          );
        } else {
          appendMessage("assistant", formatWorkflowNetworkError(err), true);
        }
      } finally {
        clearTimeout(abortTimer);
        setSending(false);
      }
    },
    [threadId, hintsMode, agentLane, authHeaders, readProfile, appendMessage, getToken, refreshPastThreads],
  );

  return {
    messages,
    threadId,
    input,
    setInput,
    resumeInput,
    setResumeInput,
    agentLane,
    hintsMode,
    setHintsMode,
    sending,
    file,
    setFile,
    fileInputRef,
    profileBanner,
    onLaneChange,
    onSubmit,
    sendText,
    newChat,
    applyResume,
    clearProfile,
    copyThreadId,
    emailAssistantMessage,
    loadHistory,
    readProfile,
    pastThreads,
    pastThreadsLoading,
    refreshPastThreads,
    resumeThread,
  };
}
