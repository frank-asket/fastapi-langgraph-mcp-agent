"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkflowChat, type GetTokenFn } from "@/hooks/useWorkflowChat";
import { StudioEditorPanel } from "./StudioEditorPanel";

type Props = { getToken?: GetTokenFn; initialPrompt?: string | null };

export function StudioChatWorkspace({ getToken, initialPrompt }: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const [editorContent, setEditorContent] = useState("");
  const starterSent = useRef(false);

  const chat = useWorkflowChat(getToken);

  const { sendText } = chat;
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
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [chat.messages, chat.sending]);

  const lastAssistant =
    [...chat.messages].reverse().find((m) => m.role === "assistant" && !m.isError)?.content ?? null;

  const appendFromAssistant = (text: string) => {
    setEditorContent((prev) => (prev ? `${prev.trim()}\n\n${text}` : text));
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-sc-bg">
        <div className="flex items-center justify-between border-b border-sc-line bg-sc-elev px-4 py-3">
          <div>
            <h1 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Coach</h1>
            <p className="text-xs text-[#8c9a90]">
              Thread: {chat.threadId ? `${chat.threadId.slice(0, 8)}…` : "new after first message"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={chat.newChat}
              className="rounded-full border border-sc-line bg-sc-bg px-3 py-1.5 text-xs font-semibold text-sc-mist hover:border-sc-gold hover:text-sc-gold"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={() => void chat.copyThreadId()}
              className="rounded-full border border-sc-line bg-sc-bg px-3 py-1.5 text-xs font-semibold text-sc-mist hover:border-sc-gold"
            >
              Copy ID
            </button>
          </div>
        </div>

        {chat.profileBanner.show && (
          <div
            className="mx-4 mt-3 rounded-xl border border-sc-line bg-sc-elev p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: chat.profileBanner.html }}
          />
        )}

        <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {chat.messages.length === 0 && !chat.sending && (
            <p className="text-center text-sm text-[#8c9a90]">
              Ask anything below, or use starter cards on the dashboard.
            </p>
          )}
          {chat.messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-4 rounded-2xl rounded-br-md bg-gradient-to-br from-sc-leaf to-[#2d5f49] px-4 py-3 text-[#f4faf7] shadow-[0_12px_40px_rgba(61,122,95,0.25)] sm:ml-12"
                  : `mr-4 rounded-2xl rounded-bl-md border border-sc-line bg-sc-elev px-4 py-3 text-sc-mist shadow-sm sm:mr-12 ${m.isError ? "border-red-400/50 bg-red-950/40 text-red-100" : ""}`
              }
            >
              <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-current opacity-75">
                {m.role === "user" ? "You" : m.isError ? "System" : "Coach"}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              {m.role === "assistant" && !m.isError && (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-sc-gold hover:underline"
                  onClick={() => appendFromAssistant(m.content)}
                >
                  Add to editor
                </button>
              )}
            </div>
          ))}
          {chat.sending && (
            <p className="text-sm text-[#8c9a90]">
              <span className="font-semibold text-sc-gold">Thinking</span>…
            </p>
          )}
        </div>

        <div className="border-t border-sc-line bg-sc-elev p-4">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <select
              value={chat.agentLane}
              onChange={(e) => chat.onLaneChange(e.target.value)}
              className="rounded-lg border border-sc-line bg-sc-bg px-2 py-1.5 font-medium text-sc-mist"
            >
              <option value="auto">Coach: Auto</option>
              <option value="general">General</option>
              <option value="jhs">JHS</option>
              <option value="shs">SHS</option>
              <option value="tertiary">Tertiary</option>
              <option value="educator">Educator</option>
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-[#9caaa0]">
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
            className="flex gap-2 rounded-2xl border border-sc-line bg-sc-bg p-2 pl-3 focus-within:border-sc-gold/45"
          >
            <button
              type="button"
              onClick={() => chat.fileInputRef.current?.click()}
              className="shrink-0 self-end rounded-lg px-2 py-2 text-[#8c9a90] hover:bg-sc-elev hover:text-sc-gold"
              title="Attach"
            >
              📎
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
              className="shrink-0 self-end rounded-xl bg-gradient-to-br from-sc-leaf to-[#2d5f49] px-4 py-2.5 text-sm font-bold text-[#f4faf7] shadow-[0_8px_24px_rgba(61,122,95,0.35)] disabled:opacity-50"
              aria-label="Send"
            >
              ➤
            </button>
          </form>
          {chat.file && <p className="mt-1 truncate text-xs text-[#6a756d]">Attached: {chat.file.name}</p>}
        </div>
      </div>

      <StudioEditorPanel
        value={editorContent}
        onChange={setEditorContent}
        lastAssistantText={lastAssistant}
        onAppendFromAssistant={appendFromAssistant}
      />
    </div>
  );
}
