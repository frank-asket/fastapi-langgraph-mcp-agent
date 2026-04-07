/** Decorative coach workspace preview — original UI, not copied from third-party templates. */
export function HeroDashboardMockup() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div
        className="sc-landing-glow pointer-events-none absolute -inset-x-8 -bottom-6 top-1/4 rounded-[2rem] bg-white/10 blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-sc-line bg-sc-elev/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-sc-line bg-sc-surface/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/90" />
          <span className="ml-2 text-[0.65rem] font-mono text-[#6a756d]">studio / coach</span>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <p className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">
            Hello <span className="text-white">Ama</span> <span aria-hidden>👋</span>
          </p>
          <p className="text-sm text-[#9caaa0]">Here are quick ways to continue your week.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { t: "Paste a past question", s: "Get step-by-step reasoning" },
              { t: "Upload a timetable photo", s: "Turn it into weekly slots" },
              { t: "SHS electives sanity check", s: "Align to your track" },
              { t: "Daily nudge", s: "One focus block before class" },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-xl border border-sc-line bg-sc-bg/80 px-3 py-3 transition duration-300 hover:border-white/20 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              >
                <p className="text-xs font-bold text-white">{c.t}</p>
                <p className="mt-1 text-[0.7rem] text-[#6a756d]">{c.s}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.04] px-4 py-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-white/90">Next step</p>
            <p className="mt-1 text-sm text-sc-mist">Ask the coach to stress-test one weak topic for 10 minutes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
