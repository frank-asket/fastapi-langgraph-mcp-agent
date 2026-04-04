"use client";

import { Fragment, useMemo, type ReactNode } from "react";

const LINE_ANIM_MS = 26;
const MAX_ANIM_LINES = 100;

/** Turn `**bold**` segments into <strong>; leaves code/math alone. */
function formatInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[#eef4ef]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function AssistantMessageContent({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);

  let animLine = 0;

  return (
    <div className="text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trimEnd();
        if (trimmed === "") {
          return <div key={i} className="h-2" aria-hidden />;
        }

        const delay = Math.min(animLine++, MAX_ANIM_LINES) * LINE_ANIM_MS;

        const h3 = /^###\s+(.+)$/.exec(trimmed);
        if (h3) {
          return (
            <div
              key={i}
              className="sc-assistant-line mb-1.5 mt-4 block first:mt-0"
              style={{ animationDelay: `${delay}ms` }}
            >
              <span className="font-[family-name:var(--font-syne)] text-[0.95rem] font-bold text-white">
                {formatInline(h3[1])}
              </span>
            </div>
          );
        }

        const h2 = /^##\s+(.+)$/.exec(trimmed);
        if (h2) {
          return (
            <div
              key={i}
              className="sc-assistant-line mb-1 mt-4 block"
              style={{ animationDelay: `${delay}ms` }}
            >
              <span className="text-base font-bold tracking-tight text-sc-mist">{formatInline(h2[1])}</span>
            </div>
          );
        }

        const bullet = /^(\s*)[-*]\s+(.+)$/.exec(trimmed);
        if (bullet) {
          const indentStep = Math.min(Math.floor(bullet[1].length / 2), 6);
          return (
            <div
              key={i}
              className="sc-assistant-line flex gap-2 py-0.5"
              style={{ animationDelay: `${delay}ms`, paddingLeft: `${indentStep * 0.65}rem` }}
            >
              <span className="mt-[0.35em] h-1.5 w-1.5 shrink-0 rounded-full bg-sc-gold/85" aria-hidden />
              <span className="min-w-0 flex-1">{formatInline(bullet[2])}</span>
            </div>
          );
        }

        const numbered = /^(\s*)(\d+)\.\s+(.+)$/.exec(trimmed);
        if (numbered) {
          const indentStep = Math.min(Math.floor(numbered[1].length / 2), 6);
          return (
            <div
              key={i}
              className="sc-assistant-line flex gap-2 py-0.5"
              style={{ animationDelay: `${delay}ms`, paddingLeft: `${indentStep * 0.65}rem` }}
            >
              <span className="w-6 shrink-0 text-right text-xs font-semibold text-sc-gold/90">{numbered[2]}.</span>
              <span className="min-w-0 flex-1">{formatInline(numbered[3])}</span>
            </div>
          );
        }

        return (
          <div key={i} className="sc-assistant-line py-0.5" style={{ animationDelay: `${delay}ms` }}>
            <span className="whitespace-pre-wrap">{formatInline(trimmed)}</span>
          </div>
        );
      })}
    </div>
  );
}
