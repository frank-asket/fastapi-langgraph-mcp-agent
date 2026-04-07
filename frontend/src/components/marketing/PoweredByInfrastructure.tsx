import Link from "next/link";

const cards = [
  {
    name: "FastAPI",
    href: "https://fastapi.tiangolo.com/",
    description:
      "High-performance Python API gateway—OpenAPI docs, async I/O, and typed request/response models for our workflow, uploads, and health endpoints.",
    icon: IconFastAPI,
  },
  {
    name: "LangGraph",
    href: "https://langchain-ai.github.io/langgraph/",
    description:
      "Checkpointed agent graphs with thread-scoped memory. Routes between reasoning and tools until the coach finishes—backed by SQLite for durable sessions.",
    icon: IconLangGraph,
  },
  {
    name: "Next.js",
    href: "https://nextjs.org/",
    description:
      "App Router, React 19, and a typed client UI for assessment, /studio coach, and Clerk-ready auth—calling the same REST API as our legacy static pages.",
    icon: IconNext,
  },
] as const;

export function PoweredByInfrastructure() {
  return (
    <section className="mb-16" aria-labelledby="infra-heading">
      <h2
        id="infra-heading"
        className="mx-auto max-w-[34ch] text-center font-[family-name:var(--font-syne)] text-[clamp(1.35rem,3.5vw,1.85rem)] font-extrabold leading-snug tracking-tight text-white"
      >
        Built on a foundation of fast, production-grade tooling
      </h2>

      <div className="relative mx-auto mt-10 max-w-[920px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 overflow-visible sm:h-40" aria-hidden>
          <svg
            className="h-full w-full text-sc-line"
            viewBox="0 0 920 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              opacity="0.85"
              d="M 460 52 L 460 72 M 460 72 C 460 92 150 88 150 108 M 460 72 C 460 92 460 108 460 108 M 460 72 C 460 92 770 88 770 108"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            <path
              opacity="0.45"
              d="M 420 28 L 420 40 L 360 40 L 360 52 M 500 28 L 500 40 L 560 40 L 560 52 M 460 12 L 460 36"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="460" cy="18" r="2.5" fill="currentColor" className="text-sc-lime/70" />
            <circle cx="360" cy="52" r="2" fill="currentColor" className="text-sc-lime/50" />
            <circle cx="560" cy="52" r="2" fill="currentColor" className="text-sc-lime/50" />
          </svg>
        </div>

        <div className="relative z-10 flex justify-center pt-2 pb-10 sm:pt-3 sm:pb-12">
          <div className="rounded-xl border border-sc-line bg-[#121916] px-6 py-2.5 font-[family-name:var(--font-syne)] text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-sc-mist shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]">
            Powered by
          </div>
        </div>

        <div className="relative z-[1] grid gap-4 md:grid-cols-3 md:gap-5">
          {cards.map((card) => (
            <article
              key={card.name}
              className="group rounded-2xl border border-sc-line bg-sc-elev p-5 transition duration-200 hover:-translate-y-0.5 hover:border-sc-lime/30 hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-sc-line bg-sc-bg text-sc-mist transition group-hover:border-sc-lime/25">
                <card.icon />
              </div>
              <h3 className="font-[family-name:var(--font-syne)] text-base font-bold">
                <Link
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-white transition hover:text-sc-lime"
                >
                  {card.name}
                  <ExternalArrow className="h-3.5 w-3.5 shrink-0 text-sc-lime/80 opacity-80 group-hover:opacity-100" />
                </Link>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8c9a90]">{card.description}</p>
            </article>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-[52ch] text-center text-xs leading-relaxed text-[#6a756d]">
        Agents call tools over{" "}
        <Link
          href="https://modelcontextprotocol.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sc-lime hover:underline"
        >
          MCP
        </Link>{" "}
        (FastMCP)—kept alongside this stack for discoverable prompts and integrations.
      </p>
    </section>
  );
}

function ExternalArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="m2.5 9.5 7-7M4.5 2.5h5v5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFastAPI() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden>
      <path
        d="M8 26 16 6l8 20H8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        className="text-sc-leaf"
        fill="none"
      />
      <path d="M13 20h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-sc-lime" />
    </svg>
  );
}

function IconLangGraph() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 text-sc-mist" fill="none" aria-hidden>
      <path
        d="M6 22v-8l6-4 6 4v8M6 14l6 4 6-4M12 18v8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="22" r="2.2" fill="currentColor" className="text-sc-lime" />
      <circle cx="12" cy="26" r="2.2" fill="currentColor" className="text-sc-leaf" />
      <circle cx="18" cy="22" r="2.2" fill="currentColor" className="text-sc-lime" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.2" className="text-sc-line" />
      <path
        d="M10 23V9l13.5 14V9"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white"
      />
    </svg>
  );
}
