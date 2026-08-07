import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  tone = "plain",
  align = "left",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  tone?: "plain" | "raised";
  align?: "left" | "center";
}) {
  return (
    <section
      id={id}
      className={
        tone === "raised"
          ? "scroll-mt-20 border-y border-line bg-ink-2/50"
          : "scroll-mt-20"
      }
    >
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <Reveal as="header" className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-volt">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 text-[clamp(28px,4vw,42px)] font-bold leading-[1.08] tracking-[-0.03em]">
            {title}
          </h2>
          {lead ? (
            <p className="mt-5 text-[16px] leading-relaxed text-muted">{lead}</p>
          ) : null}
        </Reveal>

        {children}
      </div>
    </section>
  );
}
