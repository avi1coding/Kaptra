import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { ScrollProgress } from "@/components/ScrollProgress";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { Capabilities } from "@/components/landing/Capabilities";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Section } from "@/components/landing/Section";
import { Stats } from "@/components/landing/Stats";
import { VIDEO_EXTENSIONS, WHISPER_LANGUAGES } from "@/lib/video-formats";

export default function Home() {
  return (
    <div className="grid-bg min-h-screen">
      <Nav />
      <ScrollProgress />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,230,0,.10),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-5 py-16 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div className="animate-rise">
            <h1 className="text-[clamp(40px,6vw,68px)] font-black leading-[0.96] tracking-[-0.04em]">
              From raw clip to
              <br />
              posted{" "}
              <span className="relative whitespace-nowrap text-volt">
                Short
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  height="10"
                  viewBox="0 0 200 10"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M2 7C40 3 90 2 198 5"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                    opacity=".55"
                  />
                </svg>
              </span>
              .
            </h1>

            <p className="mt-7 max-w-md text-[18px] leading-snug text-muted">
              Styled captions, burned in. Then straight to YouTube.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/studio"
                className="glow-volt rounded-xl bg-volt px-6 py-3.5 font-semibold text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Open the Studio →
              </Link>
              <a
                href="#how"
                className="rounded-xl border border-line bg-ink-2 px-6 py-3.5 font-semibold text-chalk transition-colors hover:border-muted/50"
              >
                See how
              </a>
            </div>
          </div>

          <div className="animate-rise justify-self-center [animation-delay:.12s]">
            <HeroDemo />
          </div>
        </div>
      </section>

      <Stats formats={VIDEO_EXTENSIONS.length} languages={WHISPER_LANGUAGES} />

      {/* ── The argument, made visually ──────────────────────────────── */}
      <Section
        tone="raised"
        align="center"
        eyebrow="Sound off"
        title="This is the difference."
      >
        <Reveal>
          <div className="mt-10">
            <BeforeAfter />
          </div>
        </Reveal>
      </Section>

      {/* ── Pipeline ─────────────────────────────────────────────────── */}
      <Section
        id="how"
        align="center"
        eyebrow="How it works"
        title="All it takes is three steps"
      >
        <Reveal>
          <HowItWorks />
        </Reveal>
      </Section>

      {/* ── What you get ─────────────────────────────────────────────── */}
      <Section
        id="features"
        tone="raised"
        title="What you get"
      >
        <Reveal>
          <Capabilities />
        </Reveal>
      </Section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[clamp(30px,4.6vw,48px)] font-black leading-[1.03] tracking-[-0.04em]">
              Raw clip in.
              <br className="sm:hidden" /> Ready to post out.
            </h2>
            <Link
              href="/studio"
              className="glow-volt mt-9 inline-block rounded-xl bg-volt px-7 py-4 font-semibold text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Open the Studio →
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-muted sm:flex-row">
          <p>Made by Avi Mehta</p>
        </div>
      </footer>
    </div>
  );
}
