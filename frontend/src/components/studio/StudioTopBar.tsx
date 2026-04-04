"use client";

import Link from "next/link";
import { apiDocsUrl, serviceMapUrl } from "@/lib/api";

export function StudioTopBar() {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-sc-line bg-sc-elev/95 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[#9caaa0]">
        <span aria-hidden className="text-sc-gold">
          ⭐
        </span>
        <span className="hidden sm:inline">
          <strong className="font-[family-name:var(--font-syne)] font-semibold text-white">Study Coach</strong>
          {" — "}
          LangGraph + MCP workflow via{" "}
          <code className="rounded bg-sc-bg px-1 text-sc-gold">POST /workflow</code>
          .
        </span>
      </div>
      <Link
        href={apiDocsUrl()}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-gradient-to-br from-sc-leaf to-[#2d5f49] px-3 py-1.5 text-xs font-bold text-[#f4faf7] shadow-[0_8px_24px_rgba(61,122,95,0.35)] hover:brightness-110"
      >
        API docs
      </Link>
      <div className="flex items-center gap-1 border-l border-sc-line pl-2">
        <Link
          href={serviceMapUrl()}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg p-2 text-[#8c9a90] hover:bg-sc-line hover:text-sc-gold"
          title="Service map"
        >
          🗺
        </Link>
      </div>
    </header>
  );
}
