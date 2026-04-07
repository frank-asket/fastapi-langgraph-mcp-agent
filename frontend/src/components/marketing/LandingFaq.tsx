"use client";

import { useId, useState } from "react";

const faqs = [
  {
    q: "Does Study Coach replace my teacher or official exam rules?",
    a: "No. It is study support: explanations, practice structure, and document help. Always confirm grades, timetables, and admissions with your school, WAEC, and GTEC sources.",
  },
  {
    q: "How do you handle weak or uneven internet?",
    a: "The workspace is built around short REST turns and a resilient API. Your learning thread lives on the server; retry a send when the network drops instead of losing context.",
  },
  {
    q: "What data leaves my browser?",
    a: "Coach messages and uploads go to your configured Study Coach API. When Clerk is enabled, session tokens validate against your Clerk instance. Treat your learning ID like a private link.",
  },
  {
    q: "Can institutions pilot Study Coach?",
    a: "Yes — the stack is FastAPI, LangGraph, and MCP-friendly tools so you can align guardrails, rate limits, and subscription checks to your policy.",
  },
] as const;

export function LandingFaq() {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl">
      <ul className="divide-y divide-[#dde3db] border-y border-[#dde3db]">
        {faqs.map((item, i) => {
          const expanded = open === i;
          const panelId = `${baseId}-panel-${i}`;
          const btnId = `${baseId}-btn-${i}`;
          return (
            <li key={item.q}>
              <h3 className="m-0">
                <button
                  id={btnId}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen(expanded ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-bold text-sc-void transition hover:text-[#2a3528]"
                >
                  {item.q}
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c5ccc4] text-lg font-light text-sc-void transition ${
                      expanded ? "rotate-45 border-sc-lime bg-sc-lime/15" : ""
                    }`}
                    aria-hidden
                  >
                    +
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="pb-5 text-sm leading-relaxed text-[#3d4540]">{item.a}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
