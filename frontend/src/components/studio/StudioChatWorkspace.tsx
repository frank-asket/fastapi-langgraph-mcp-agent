"use client";

import { SignedIn, SignOutButton } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLogo } from "@/components/brand/AppLogo";
import { useWorkflowChat, type GetTokenFn } from "@/hooks/useWorkflowChat";
import { AssistantMessageContent } from "./AssistantMessageContent";
import { StudioCoachCalendar } from "./StudioCoachCalendar";

type Props = {
  getToken?: GetTokenFn;
  /** false until Clerk `isLoaded && isSignedIn` when using session JWT auth */
  clerkSessionReady?: boolean;
  initialPrompt?: string | null;
};

const hasClerkPk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const NEAR_BOTTOM_PX = 96;

function formatThreadDate(createdAt: string): string {
  const raw = createdAt.trim();
  if (!raw) return "";
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function IconUserBadge() {
  return (
    <svg className="h-3.5 w-3.5 opacity-90" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function IconCoachBadge() {
  return (
    <svg className="h-3.5 w-3.5 opacity-90" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg className="h-3.5 w-3.5 opacity-90" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

function IconAttach() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

function IconSend() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function IconChatNew() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </svg>
  );
}

export function StudioChatWorkspace({ getToken, clerkSessionReady, initialPrompt }: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [showJumpTop, setShowJumpTop] = useState(false);
  const [emailingIndex, setEmailingIndex] = useState<number | null>(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const starterSent = useRef(false);

  const chat = useWorkflowChat(getToken, clerkSessionReady);

  const { sendText } = chat;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    pinnedToBottomRef.current = true;
    setShowJumpLatest(false);
  }, []);

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior });
    pinnedToBottomRef.current = false;
    setShowJumpTop(false);
  }, []);

  const onLogScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedToBottomRef.current = fromBottom < NEAR_BOTTOM_PX;
    setShowJumpLatest(fromBottom > 140);
    setShowJumpTop(el.scrollTop > 200);
  }, []);

  useEffect(() => {
    const p = initialPrompt?.trim();
    if (!p) return;
    const dedupe = `studio_starter_${btoa(unescape(encodeURIComponent(p))).slice(0, 48)}`;
    try {
      if (sessionStorage.getItem(dedupe)) return;
      sessionStorage.setItem(dedupe, "1");
    } catch {
      if (starterSent.current) return;
      starterSent.current = true;
    }
    void sendText(p);
  }, [initialPrompt, sendText]);

  useEffect(() => {
    if (!pinnedToBottomRef.current) return;
    const id = requestAnimationFrame(() => {
      scrollToBottom(chat.messages.length <= 1 ? "auto" : "smooth");
    });
    return () => cancelAnimationFrame(id);
  }, [chat.messages, chat.sending, scrollToBottom]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    onLogScroll();
  }, [chat.messages.length, onLogScroll]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch xl:flex-row">
      <div className="flex min-h-[min(52dvh,520px)] min-w-0 flex-1 flex-col bg-sc-bg xl:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sc-line bg-sc-elev px-3 py-2.5 transition-shadow duration-300 sm:gap-3 sm:px-4 sm:py-3 hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <span className="sc-fade-up mt-0.5">
              <AppLogo size={36} />
            </span>
            <div className="min-w-0">
              <h1 className="font-[family-name:var(--font-syne)] text-base font-bold text-white sm:text-lg">Coach</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.65rem] text-[#8c9a90] sm:text-xs">
                <svg className="h-3 w-3 text-sc-gold/60" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                </svg>
                Thread: {chat.threadId ? `${chat.threadId.slice(0, 8)}…` : "new after first message"}
              </p>
              <p className="mt-1 max-w-md text-[0.62rem] leading-snug text-[#6a756d] sm:text-[0.65rem]">
                When <strong className="font-semibold text-[#8c9a90]">Include timetable in Coach</strong> is on ({" "}
                <a
                  href="/studio/settings#notifications"
                  className="text-sc-gold/90 underline hover:text-sc-gold"
                >
                  Account → Notification settings
                </a>
                ), your saved{" "}
                <a href="/studio/timetable" className="text-sc-gold/90 underline hover:text-sc-gold">
                  weekly timetable
                </a>{" "}
                is sent with each message for study plans, revision, and exam-prep timing (heuristics—not grade
                predictions).
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:gap-2">
            <button
              type="button"
              onClick={chat.newChat}
              className="flex min-h-10 items-center gap-1.5 rounded-full border border-sc-line bg-sc-bg px-3 py-2 text-[0.7rem] font-semibold text-sc-mist transition hover:border-sc-gold hover:text-sc-gold active:scale-[0.98] sm:text-xs"
            >
              <IconChatNew />
              New chat
            </button>
            <button
              type="button"
              onClick={() => setShowHistoryPanel((v) => !v)}
              className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-[0.7rem] font-semibold transition active:scale-[0.98] sm:text-xs ${
                showHistoryPanel
                  ? "border-sc-gold/60 bg-sc-leaf/25 text-sc-gold"
                  : "border-sc-line bg-sc-bg text-sc-mist hover:border-sc-gold hover:text-sc-gold"
              }`}
              aria-expanded={showHistoryPanel}
              aria-controls="coach-history-panel"
            >
              <IconHistory />
              History
            </button>
            <button
              type="button"
              onClick={() => void chat.copyThreadId()}
              className="flex min-h-10 items-center gap-1.5 rounded-full border border-sc-line bg-sc-bg px-3 py-2 text-[0.7rem] font-semibold text-sc-mist transition hover:border-sc-gold hover:text-sc-gold active:scale-[0.98] sm:text-xs"
            >
              <IconCopy />
              Copy ID
            </button>
            {hasClerkPk && (
              <SignedIn>
                <SignOutButton signOutOptions={{ redirectUrl: "/" }}>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full border border-sc-line bg-sc-bg px-3 py-1.5 text-xs font-semibold text-sc-mist transition hover:border-red-400/60 hover:text-red-200 active:scale-[0.98]"
                  >
                    <IconLogout />
                    Log out
                  </button>
                </SignOutButton>
              </SignedIn>
            )}
          </div>
        </div>

        {showHistoryPanel ? (
          <div
            id="coach-history-panel"
            className="border-b border-sc-line bg-[#141c17] px-3 py-3 sm:px-4"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8c9a90]">
                Past conversations
              </p>
              <button
                type="button"
                onClick={() => void chat.refreshPastThreads()}
                disabled={chat.pastThreadsLoading}
                className="text-[0.65rem] font-semibold text-sc-gold hover:text-sc-mist disabled:opacity-50 sm:text-xs"
              >
                {chat.pastThreadsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            {chat.pastThreadsLoading && chat.pastThreads.length === 0 ? (
              <p className="text-xs text-[#6a756d]">Loading your threads…</p>
            ) : chat.pastThreads.length === 0 ? (
              <p className="text-xs leading-relaxed text-[#6a756d]">
                No threads listed yet. After you send messages while signed in, chats appear here (when the API has
                session binding enabled). You can also paste a learning ID below to open any saved thread.
              </p>
            ) : (
              <ul className="max-h-44 space-y-1 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
                {chat.pastThreads.map((t) => {
                  const isActive = chat.threadId === t.thread_id;
                  return (
                    <li key={t.thread_id}>
                      <button
                        type="button"
                        onClick={() => {
                          void chat.resumeThread(t.thread_id);
                          setShowHistoryPanel(false);
                        }}
                        className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                          isActive
                            ? "border-sc-gold/50 bg-sc-leaf/20 text-[#f4faf7]"
                            : "border-sc-line bg-sc-bg/80 text-sc-mist hover:border-sc-gold/35"
                        }`}
                      >
                        <span className="font-mono text-[0.65rem] sm:text-xs">
                          {t.thread_id.slice(0, 10)}…{t.thread_id.slice(-6)}
                        </span>
                        <span className="text-[0.65rem] text-[#8c9a90] sm:text-xs">
                          {formatThreadDate(t.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="coach-resume-thread-id">
                Open conversation by learning ID
              </label>
              <input
                id="coach-resume-thread-id"
                value={chat.resumeInput}
                onChange={(e) => chat.setResumeInput(e.target.value)}
                placeholder="Paste full learning / thread ID"
                className="min-h-10 flex-1 rounded-lg border border-sc-line bg-sc-bg px-3 py-2 font-mono text-[0.7rem] text-sc-mist placeholder:text-[#6a756d] focus:border-sc-gold/40 focus:outline-none sm:text-xs"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => {
                  void chat.applyResume();
                  setShowHistoryPanel(false);
                }}
                className="min-h-10 shrink-0 rounded-lg border border-sc-gold/40 bg-sc-leaf/80 px-4 py-2 text-xs font-semibold text-[#f4faf7] transition hover:bg-sc-leaf active:scale-[0.98]"
              >
                Open
              </button>
            </div>
          </div>
        ) : null}

        {chat.profileBanner.show && (
          <div
            className="sc-animate-message mx-4 mt-3 rounded-xl border border-sc-line bg-sc-elev p-3 text-sm shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
            dangerouslySetInnerHTML={{ __html: chat.profileBanner.html }}
          />
        )}

        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={logRef}
            onScroll={onLogScroll}
            className="h-full min-h-0 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth px-4 py-4 [-webkit-overflow-scrolling:touch]"
          >
            {chat.messages.length === 0 && !chat.sending && (
              <div className="sc-fade-up flex flex-col items-center justify-center gap-3 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sc-line bg-sc-elev text-3xl text-sc-gold/90">
                  💬
                </span>
                <p className="max-w-sm text-sm text-[#8c9a90]">
                  Ask anything below, or use starter cards on the dashboard.
                </p>
              </div>
            )}
            {chat.messages.map((m, i) => (
              <div
                key={i}
                style={
                  m.role === "user" || m.isError ? { animationDelay: `${Math.min(i, 6) * 45}ms` } : undefined
                }
                className={
                  (m.role === "user" || m.isError ? "sc-animate-message " : "") +
                  (m.role === "user"
                    ? "ml-4 rounded-2xl rounded-br-md bg-gradient-to-br from-sc-leaf to-[#2d5f49] px-4 py-3 text-[#f4faf7] shadow-[0_12px_40px_rgba(61,122,95,0.25)] transition-transform duration-200 hover:scale-[1.01] sm:ml-12"
                    : `mr-4 rounded-2xl rounded-bl-md border border-sc-line bg-sc-elev px-4 py-3 text-sc-mist shadow-sm transition-transform duration-200 hover:scale-[1.005] sm:mr-12 ${m.isError ? "border-red-400/50 bg-red-950/40 text-red-100" : "sc-fade-up"}`)
                }
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-current opacity-80">
                  {m.role === "user" ? (
                    <IconUserBadge />
                  ) : m.isError ? (
                    <IconAlert />
                  ) : (
                    <IconCoachBadge />
                  )}
                  {m.role === "user" ? "You" : m.isError ? "System" : "Coach"}
                </div>
                {m.role === "assistant" && !m.isError ? (
                  <AssistantMessageContent content={m.content} />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                )}
                {m.role === "assistant" && !m.isError && m.content.trim() ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sc-line/60 pt-2">
                    <button
                      type="button"
                      disabled={
                        emailingIndex === i ||
                        chat.sending ||
                        (hasClerkPk && clerkSessionReady === false)
                      }
                      onClick={() => {
                        void (async () => {
                          setEmailingIndex(i);
                          try {
                            const { sentTo } = await chat.emailAssistantMessage(m.content);
                            window.alert(`Sent to ${sentTo}. Check your inbox (and spam).`);
                          } catch (e) {
                            window.alert(e instanceof Error ? e.message : String(e));
                          } finally {
                            setEmailingIndex(null);
                          }
                        })();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sc-line bg-sc-bg/80 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[#9caaa0] transition hover:border-sc-gold/50 hover:text-sc-gold disabled:opacity-50 sm:text-xs"
                    >
                      <IconMail />
                      {emailingIndex === i ? "Sending…" : "Email to me"}
                    </button>
                    <span className="text-[0.6rem] text-[#6a756d] sm:text-[0.65rem]">
                      Uses your address in Account → Notification settings
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
            {chat.sending && (
              <div className="sc-animate-message mr-4 flex items-center gap-3 rounded-2xl rounded-bl-md border border-sc-line bg-sc-elev px-4 py-3 sm:mr-12">
                <IconCoachBadge />
                <div className="flex items-center gap-1.5 text-sm font-medium text-[#8c9a90]">
                  <span className="text-sc-gold">Thinking</span>
                  <span className="flex gap-1 pt-0.5">
                    <span
                      className="sc-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-sc-gold"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="sc-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-sc-gold"
                      style={{ animationDelay: "160ms" }}
                    />
                    <span
                      className="sc-thinking-dot inline-block h-1.5 w-1.5 rounded-full bg-sc-gold"
                      style={{ animationDelay: "320ms" }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomSentinelRef} className="h-1 shrink-0" aria-hidden />
          </div>

          {(showJumpTop || showJumpLatest) && (
            <div className="pointer-events-none absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
              {showJumpTop && (
                <button
                  type="button"
                  onClick={() => scrollToTop("smooth")}
                  className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-sc-line bg-sc-elev/95 text-sc-mist shadow-lg backdrop-blur-sm transition hover:border-sc-gold hover:text-sc-gold hover:shadow-[0_8px_24px_rgba(212,168,75,0.15)] active:scale-95"
                  title="Jump to top"
                  aria-label="Scroll conversation to top"
                >
                  <IconChevronUp />
                </button>
              )}
              {showJumpLatest && (
                <button
                  type="button"
                  onClick={() => scrollToBottom("smooth")}
                  className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-sc-gold/40 bg-sc-leaf/90 text-[#f4faf7] shadow-lg backdrop-blur-sm transition hover:bg-sc-leaf active:scale-95"
                  title="Jump to latest"
                  aria-label="Scroll to latest message"
                >
                  <IconChevronDown />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-sc-line bg-sc-elev p-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] transition-colors duration-300 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <select
              value={chat.agentLane}
              onChange={(e) => chat.onLaneChange(e.target.value)}
              className="rounded-lg border border-sc-line bg-sc-bg px-2 py-1.5 font-medium text-sc-mist transition hover:border-sc-gold/35"
            >
              <option value="auto">Coach: Auto</option>
              <option value="general">General</option>
              <option value="jhs">JHS</option>
              <option value="shs">SHS</option>
              <option value="tertiary">Tertiary</option>
              <option value="educator">Educator</option>
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-[#9caaa0] transition hover:text-sc-mist">
              <input
                type="checkbox"
                checked={chat.hintsMode}
                onChange={(e) => chat.setHintsMode(e.target.checked)}
                className="rounded border-sc-line"
              />
              Hints mode
            </label>
            <input
              ref={chat.fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.pdf,.doc,.docx,.rtf,.odt,.html,.htm,.csv,.md"
              onChange={(e) => chat.setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <form
            onSubmit={(e) => void chat.onSubmit(e)}
            className="flex gap-2 rounded-2xl border border-sc-line bg-sc-bg p-2 pl-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] duration-300 focus-within:border-sc-gold/45 focus-within:shadow-[0_0_0_1px_rgba(212,168,75,0.12)]"
          >
            <button
              type="button"
              onClick={() => chat.fileInputRef.current?.click()}
              className="shrink-0 self-end rounded-lg p-2 text-[#8c9a90] transition hover:bg-sc-elev hover:text-sc-gold active:scale-95"
              title="Attach file"
              aria-label="Attach file"
            >
              <IconAttach />
            </button>
            <textarea
              value={chat.input}
              onChange={(e) => chat.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              placeholder="What do you want to learn or clarify?"
              className="min-h-[44px] flex-1 resize-none border-0 bg-transparent py-2 text-sm text-sc-mist placeholder:text-[#6a756d] focus:outline-none focus:ring-0"
            />
            <button
              type="submit"
              disabled={chat.sending}
              className="flex shrink-0 items-center justify-center self-end rounded-xl bg-gradient-to-br from-sc-leaf to-[#2d5f49] px-4 py-2.5 text-[#f4faf7] shadow-[0_8px_24px_rgba(61,122,95,0.35)] transition hover:shadow-[0_10px_28px_rgba(61,122,95,0.45)] disabled:opacity-50 active:scale-[0.96]"
              aria-label="Send message"
            >
              <IconSend />
            </button>
          </form>
          {chat.file && <p className="mt-1 truncate text-xs text-[#6a756d]">Attached: {chat.file.name}</p>}
        </div>
      </div>
      <StudioCoachCalendar getToken={getToken} />
    </div>
  );
}
