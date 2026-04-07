import Link from "next/link";
import { HeroDashboardMockup } from "@/components/marketing/HeroDashboardMockup";
import { LandingFaq } from "@/components/marketing/LandingFaq";
import { LandingPricing } from "@/components/marketing/LandingPricing";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { PoweredByInfrastructure } from "@/components/marketing/PoweredByInfrastructure";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import { apiDocsUrl, getApiUrl, serviceMapUrl } from "@/lib/api";

const api = getApiUrl();
const serviceUrl = serviceMapUrl();
const docsUrl = apiDocsUrl();

const testimonials = [
  {
    quote:
      "The coach stays in its lane — it explains electives and never invents cut-off aggregates. My SHS class uses it as a structured revision layer.",
    name: "Kwame Mensah",
    role: "Physics teacher · Accra",
  },
  {
    quote:
      "Uploading our reading pack and getting back section-aware help saved hours. The thread remembers what we were stuck on last session.",
    name: "Adwoa Serwaa",
    role: "Level 300 · Public health",
  },
  {
    quote:
      "We pilot APIs for many tools; this one is transparent about stack, auth, and limits — rare for an AI tutor product.",
    name: "Lydia Owusu",
    role: "Program lead · Edtech nonprofit",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-sc-void text-sc-mist">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        aria-hidden
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <MarketingHeader apiServiceUrl={serviceUrl} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-14">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[50vh] w-[120%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.06)_0%,_transparent_55%)]" />
          <div className="relative mx-auto max-w-6xl text-center">
            <ScrollReveal>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-sc-surface/90 px-4 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_40px_-10px_rgba(255,255,255,0.15)]">
                <span aria-hidden>✨</span> Built for African learners &amp; honest pedagogy
              </p>
            </ScrollReveal>
            <ScrollReveal delayClass="delay-75">
              <h1 className="mx-auto max-w-4xl font-[family-name:var(--font-syne)] text-[clamp(2.1rem,6vw,3.75rem)] font-extrabold leading-[1.08] tracking-tight text-white">
                Run your study rhythm with{" "}
                <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                  Study Coach
                </span>
              </h1>
            </ScrollReveal>
            <ScrollReveal delayClass="delay-100">
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#9caaa0]">
                A vertical AI workspace for Ghana and the continent — assessment-aware coaching, document intelligence,
                and server-side memory tuned for programmes you actually sit for.
              </p>
            </ScrollReveal>
            <ScrollReveal delayClass="delay-150">
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/assessment"
                  className="sc-lime-glow-soft inline-flex items-center gap-2 rounded-2xl bg-sc-lime px-7 py-4 font-[family-name:var(--font-syne)] text-base font-extrabold text-sc-void transition hover:bg-sc-lime-hover"
                >
                  Start now
                </Link>
                <Link
                  href="/studio/chat"
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/25 bg-transparent px-7 py-4 font-[family-name:var(--font-syne)] text-base font-bold text-white transition hover:border-white/50 hover:bg-white/[0.04]"
                >
                  Live demo
                </Link>
              </div>
            </ScrollReveal>
          </div>
          <div className="relative mx-auto mt-16 max-w-6xl px-2">
            <ScrollReveal>
              <HeroDashboardMockup />
            </ScrollReveal>
          </div>
          <ScrollReveal>
            <p className="mx-auto mt-16 max-w-3xl text-center text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#5c665f]">
              Aligned with common paths
            </p>
            <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3 sm:gap-5">
              {["GES · BECE", "SHS tracks", "WASSCE prep", "Tertiary programmes"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-sc-line bg-sc-surface/60 px-4 py-2 text-xs font-semibold text-[#8c9a90] transition hover:border-white/25 hover:text-white"
                >
                  {label}
                </span>
              ))}
            </div>
          </ScrollReveal>
        </section>

        {/* Feature grid */}
        <section id="features" className="scroll-mt-28 border-t border-sc-line/80 bg-sc-bg/40 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-center font-[family-name:var(--font-syne)] text-[clamp(1.65rem,4vw,2.35rem)] font-extrabold text-white">
                Get it done with{" "}
                <span className="text-sc-lime">Study Coach</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-center text-[#8c9a90]">
                Four pillars: intake, coach memory, documents, and calendar-aware nudges — each with a focused surface in
                the app.
              </p>
            </ScrollReveal>
            <div className="mt-14 grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Assessment that respects levels",
                  body: "Captures SHS track, tertiary field, goals, and region without generic global defaults.",
                  visual: <MiniBars />,
                },
                {
                  title: "Thread memory you control",
                  body: "Learning IDs and LangGraph checkpoints persist context across sessions — not a one-off chatbot.",
                  visual: <MiniThread />,
                },
                {
                  title: "Bring your own materials",
                  body: "Uploads flow through extraction pipelines so answers cite your pack, not invented syllabi.",
                  visual: <MiniDoc />,
                },
                {
                  title: "Timetable → nudges",
                  body: "Recurring slots fuel prep and rest reminders; optional email when SendGrid is configured.",
                  visual: <MiniCal />,
                },
              ].map((f, i) => (
                <ScrollReveal key={f.title} delayClass={i % 2 === 1 ? "delay-100" : ""}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sc-line bg-sc-elev transition duration-300 hover:border-sc-lime/25 hover:shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                    <div className="flex min-h-[140px] items-center justify-center border-b border-sc-line bg-sc-surface/50 p-6 transition group-hover:bg-white/[0.04]">
                      {f.visual}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">{f.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#8c9a90]">{f.body}</p>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Why us */}
        <section className="border-t border-sc-line/80 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-center font-[family-name:var(--font-syne)] text-[clamp(1.5rem,3.8vw,2.1rem)] font-extrabold text-white">
                Why teams choose{" "}
                <span className="text-sc-lime">this stack</span>
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {[
                {
                  icon: "◎",
                  t: "Transparent architecture",
                  d: "FastAPI routes, OpenAPI docs, and MCP-mounted tools — inspect what the coach can call.",
                },
                {
                  icon: "◇",
                  t: "Auth that fits split domains",
                  d: "Clerk session JWTs, CORS merges from authorized parties, optional API keys for pilots.",
                },
                {
                  icon: "◆",
                  t: "Truthfulness guardrails",
                  d: "Anti-hallucination addendum and verification footers; we steer away from fake institutional data.",
                },
                {
                  icon: "▣",
                  t: "Portable deployment",
                  d: "Docker-friendly, SQLite-first stores, and clear environment knobs for Railway or your cloud.",
                },
              ].map((x, i) => (
                <ScrollReveal key={x.t} delayClass={i % 2 === 1 ? "delay-75" : ""}>
                  <div className="flex gap-4 rounded-2xl border border-sc-line bg-sc-surface/40 p-6 transition hover:border-sc-lime/20">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg text-white ring-1 ring-white/20"
                      aria-hidden
                    >
                      {x.icon}
                    </span>
                    <div>
                      <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-white">{x.t}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#8c9a90]">{x.d}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Stack */}
        <section id="stack" className="scroll-mt-28 border-t border-sc-line/80 bg-sc-bg/30 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-6xl py-10">
            <PoweredByInfrastructure />
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-28 border-t border-sc-line/80 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-center font-[family-name:var(--font-syne)] text-[clamp(1.55rem,3.8vw,2.2rem)] font-extrabold text-white">
                Stay ahead with{" "}
                <span className="text-sc-lime">powerful primitives</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-center text-sm text-[#8c9a90]">
                Choose a lane that matches how you ship. Campus pricing is customised; learner tier is a practical default
                for individuals.
              </p>
            </ScrollReveal>
            <div className="mt-14">
              <LandingPricing />
            </div>
          </div>
        </section>

        {/* FAQ light */}
        <section id="faq" className="scroll-mt-28 border-t border-sc-line bg-[#f4f6f3] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-center font-[family-name:var(--font-syne)] text-2xl font-extrabold text-sc-void sm:text-3xl">
                Frequently asked questions
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-center text-sm text-[#4a524c]">
                Straight answers about scope, connectivity, data, and pilots.
              </p>
            </ScrollReveal>
            <div className="mt-12">
              <LandingFaq />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-sc-line/80 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <h2 className="text-center font-[family-name:var(--font-syne)] text-[clamp(1.5rem,3.6vw,2rem)] font-extrabold text-white">
                Trusted by <span className="text-sc-lime">educators &amp; learners</span>
              </h2>
            </ScrollReveal>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <ScrollReveal key={t.name} delayClass={i === 1 ? "delay-75" : i === 2 ? "delay-150" : ""}>
                  <article className="flex h-full flex-col rounded-2xl border border-sc-line bg-sc-elev p-6 transition hover:border-sc-lime/25">
                    <span className="font-serif text-4xl leading-none text-sc-lime/90" aria-hidden>
                      “
                    </span>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-sc-mist">{t.quote}</p>
                    <div className="mt-6 flex items-center gap-3 border-t border-sc-line/80 pt-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-sc-lime/30 bg-sc-lime/10 text-sm font-bold text-sc-lime">
                        {t.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{t.name}</p>
                        <p className="text-xs text-[#6a756d]">{t.role}</p>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-sc-line/80 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-3xl border border-sc-lime/20 bg-gradient-to-br from-sc-elev to-sc-surface px-8 py-12 text-center sc-lime-glow-soft sm:px-12">
            <h2 className="font-[family-name:var(--font-syne)] text-2xl font-extrabold text-white sm:text-3xl">
              Coach smarter sessions — starting today.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-[#8c9a90]">
              Run the assessment, open the studio, and keep one honest thread for everything you study.
            </p>
            <Link
              href="/assessment"
              className="mt-8 inline-flex rounded-2xl bg-sc-lime px-8 py-4 font-[family-name:var(--font-syne)] text-base font-extrabold text-sc-void transition hover:bg-sc-lime-hover"
            >
              Start now
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-sc-line bg-sc-void px-4 pb-12 pt-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-center font-[family-name:var(--font-syne)] text-[clamp(2.5rem,12vw,6rem)] font-extrabold leading-none tracking-tighter text-sc-lime/90">
            STUDY COACH
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sc-lime">Product</p>
              <ul className="mt-4 space-y-2 text-sm text-[#8c9a90]">
                <li>
                  <Link href="/assessment" className="hover:text-sc-lime">
                    Assessment
                  </Link>
                </li>
                <li>
                  <Link href="/studio" className="hover:text-sc-lime">
                    Workspace
                  </Link>
                </li>
                <li>
                  <Link href="/studio/chat" className="hover:text-sc-lime">
                    Coach
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sc-lime">Developers</p>
              <ul className="mt-4 space-y-2 text-sm text-[#8c9a90]">
                <li>
                  <a href={docsUrl} className="hover:text-sc-lime">
                    API docs
                  </a>
                </li>
                <li>
                  <a href={serviceUrl} className="hover:text-sc-lime">
                    Service map
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sc-lime">Trust</p>
              <ul className="mt-4 space-y-2 text-sm text-[#8c9a90]">
                <li className="leading-snug">Educational support only · verify with official sources.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sc-lime">Connect</p>
              <ul className="mt-4 flex gap-3 text-[#8c9a90]">
                <li>
                  <a
                    href="https://github.com/klingbo"
                    className="hover:text-sc-lime"
                    aria-label="GitHub organisation"
                    title="GitHub"
                  >
                    <IconGH />
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@klingbo.com" className="hover:text-sc-lime" aria-label="Email" title="Email">
                    <IconMail />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-12 border-t border-sc-line/60 pt-8 text-center text-xs text-[#5c665f]">
            © {new Date().getFullYear()} Study Coach · Klingbo vertical AI pilot.
          </p>
        </div>
      </footer>

      <p className="sr-only">
        API base for operators: {api}
      </p>
    </div>
  );
}

function MiniBars() {
  return (
    <div className="flex h-20 w-full max-w-[200px] items-end gap-1.5">
      {[40, 65, 45, 80, 55, 72, 50].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-gradient-to-t from-white/25 to-white/50 transition-all duration-500 group-hover:from-white/35 group-hover:to-white/70"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function MiniThread() {
  return (
    <div className="w-full max-w-[220px] space-y-2 text-left text-[0.65rem]">
      <div className="ml-4 rounded-lg border border-sc-line bg-sc-bg px-2 py-1.5 text-sc-mist">Learner</div>
      <div className="mr-4 rounded-lg border border-white/25 bg-white/10 px-2 py-1.5 text-sc-mist">Coach + tools</div>
      <div className="ml-4 rounded-lg border border-sc-line bg-sc-bg px-2 py-1.5 text-sc-mist">Follow-up</div>
    </div>
  );
}

function MiniDoc() {
  return (
    <div className="flex w-full max-w-[200px] gap-2">
      <div className="h-16 w-12 shrink-0 rounded border border-sc-line bg-sc-bg" />
      <div className="flex flex-1 flex-col justify-center gap-1">
        <div className="h-2 rounded bg-white/40" />
        <div className="h-2 w-[80%] rounded bg-sc-line" />
        <div className="h-2 w-[60%] rounded bg-sc-line" />
      </div>
    </div>
  );
}

function MiniCal() {
  return (
    <div className="grid w-full max-w-[200px] grid-cols-7 gap-1 text-[0.5rem] text-[#6a756d]">
      {Array.from({ length: 21 }).map((_, i) => (
        <div
          key={i}
          className={`aspect-square rounded-sm ${i % 5 === 0 ? "bg-white/35 ring-1 ring-white/40" : "bg-sc-line/60"}`}
        />
      ))}
    </div>
  );
}

function IconGH() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 6h16v12H4z" strokeLinejoin="round" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}
