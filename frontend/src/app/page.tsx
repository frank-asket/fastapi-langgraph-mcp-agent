import Image from "next/image";
import Link from "next/link";
import { AppLogo } from "@/components/brand/AppLogo";
import { PoweredByInfrastructure } from "@/components/marketing/PoweredByInfrastructure";
import { SiteNav } from "@/components/marketing/SiteNav";
import { getApiUrl } from "@/lib/api";

const api = getApiUrl();

export default function HomePage() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        aria-hidden
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative mx-auto max-w-[980px] px-5 py-10 pb-16">
      <header className="mb-12 flex flex-col gap-5 sm:mb-14 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-4">
        <Link
          href="/"
          className="flex items-center gap-3 transition opacity-90 hover:opacity-100"
        >
          <AppLogo size={44} priority />
          <div className="font-[family-name:var(--font-syne)] text-lg font-extrabold tracking-tight text-white">
            Study <span className="text-sc-gold">Coach</span>
          </div>
        </Link>
        <div className="flex w-full min-w-0 md:w-auto md:max-w-[min(100%,42rem)] md:justify-end">
          <SiteNav />
        </div>
      </header>

      <section className="mb-12 grid gap-8 lg:grid-cols-[1fr_minmax(280px,44%)] lg:items-center lg:gap-12">
        <div>
          <h1 className="font-[family-name:var(--font-syne)] text-[clamp(2rem,5.5vw,3.15rem)] font-extrabold leading-tight tracking-tight text-white">
            Expert-level tutoring built for African education.
          </h1>
          <p className="mt-4 max-w-[42ch] text-lg text-[#9caaa0]">
            Study Coach is a vertical AI platform for learners in Ghana and across the continent—personalized coaching
            that understands local programmes, document intelligence on your materials, and an architecture designed for
            offline-capable use where connectivity is uneven.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/assessment"
              className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-br from-sc-leaf to-[#2d5f49] px-5 py-3.5 font-[family-name:var(--font-syne)] text-[0.95rem] font-bold text-[#f4faf7] shadow-[0_12px_40px_rgba(61,122,95,0.35)] hover:brightness-110"
            >
              Start assessment → coach
            </Link>
            <Link
              href="/studio/chat"
              className="inline-flex items-center gap-2 rounded-[14px] border border-sc-line bg-sc-elev px-5 py-3.5 font-[family-name:var(--font-syne)] text-[0.95rem] font-bold text-sc-mist hover:border-sc-gold hover:text-sc-gold"
            >
              Open coach
            </Link>
          </div>
        </div>
        <figure className="relative">
          <Image
            src="/images/landing/hero.png"
            alt="Stylized illustration of students learning together"
            width={1200}
            height={629}
            className="aspect-[21/11] w-full rounded-[18px] border border-sc-line bg-sc-elev object-cover"
            priority
          />
        </figure>
      </section>

      <PoweredByInfrastructure />

      <p className="mb-3 font-[family-name:var(--font-syne)] text-xs font-bold uppercase tracking-widest text-sc-gold">
        How it works
      </p>
      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          img="/images/landing/card-assessment.png"
          title="1 · Quick assessment"
          body="Level, programme, subject focus, and goals — tuned for GES, SHS, WASSCE paths, tertiary, and digital literacy."
          alt="Ghanaian student working through an assessment"
        />
        <FeatureCard
          img="/images/landing/card-thread.png"
          title="2 · Personal thread"
          body="A private learning ID and server-side memory so your coach remembers context across sessions."
          alt="Students collaborating with notes"
        />
        <FeatureCard
          img="/images/landing/card-limits.png"
          title="3 · Honest answers"
          body="No fabricated exam aggregates—we cite WAEC, GES, and your teachers for official rules."
          alt="Student reading with academic integrity"
        />
      </div>

      <p className="mb-3 font-[family-name:var(--font-syne)] text-xs font-bold uppercase tracking-widest text-sc-gold">
        Intelligence layer
      </p>
      <h2 className="mb-4 font-[family-name:var(--font-syne)] text-xl font-bold tracking-tight text-white">
        Adaptive paths, analytics, and targeted remediation
      </h2>
      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextCard
          title="Adaptive learning path optimizer"
          body="Personalized study roadmaps that respect how you learn—sequencing topics and adjusting difficulty."
        />
        <TextCard
          title="Predictive performance analytics"
          body="Uses your history and study patterns to surface gaps early and clear next steps."
        />
        <TextCard
          title="Weakness detection & remediation"
          body="Pinpoints concepts that need work and proposes focused practice—not generic drills."
        />
      </div>

      <section className="rounded-2xl border border-sc-line bg-sc-elev p-6">
        <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-white">Privacy, access & authentication</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#8c9a90]">
          This Next.js app uses <strong className="text-sc-mist">Clerk</strong> for sign-in when configured. The FastAPI
          backend validates Clerk session tokens. Add your frontend origin to{" "}
          <code className="text-sc-gold">CORS_ORIGINS</code> and <code className="text-sc-gold">CLERK_AUTHORIZED_PARTIES</code>{" "}
          on the API. Learning IDs are private—treat them like passwords.
        </p>
      </section>

      <p className="mt-14 border-t border-sc-line pt-6 text-xs text-[#6a756d]">
        Educational support only. Verify exams with official sources.{" "}
        <a href={`${api}/service`} className="text-sc-gold">
          Service map
        </a>
      </p>
    </div>
    </>
  );
}

function FeatureCard({
  img,
  title,
  body,
  alt,
}: {
  img: string;
  title: string;
  body: string;
  alt: string;
}) {
  return (
    <div className="rounded-2xl border border-sc-line bg-sc-elev p-5 transition hover:-translate-y-0.5 hover:border-sc-gold/35">
      <Image
        src={img}
        alt={alt}
        width={512}
        height={512}
        className="mb-4 aspect-square w-full rounded-xl border border-sc-line object-cover"
        unoptimized
      />
      <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm text-[#8c9a90]">{body}</p>
    </div>
  );
}

function TextCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-sc-line bg-sc-elev p-5 transition hover:-translate-y-0.5 hover:border-sc-gold/35">
      <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm text-[#8c9a90]">{body}</p>
    </div>
  );
}
