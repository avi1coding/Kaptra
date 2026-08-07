"use client";

import { useState } from "react";
import { CaptionOverlay } from "@/components/CaptionOverlay";
import { ShortChrome, ShortFrame, SyntheticFootage } from "@/components/ShortFrame";
import { usePlayhead } from "@/components/usePlayhead";
import { MOCK_DURATION, MOCK_WORDS } from "@/lib/mock";
import { PRESETS } from "@/lib/presets";

export function HeroDemo() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const { time } = usePlayhead(MOCK_DURATION);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="w-full max-w-[290px]">
        <ShortFrame
          overlay={
            <>
              <CaptionOverlay
                words={MOCK_WORDS}
                style={preset.style}
                time={time}
              />
              <ShortChrome progress={time / MOCK_DURATION} />
            </>
          }
        >
          <SyntheticFootage />
        </ShortFrame>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPresetId(p.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              p.id === presetId
                ? "border-volt bg-volt text-ink"
                : "border-line bg-ink-2 text-muted hover:border-muted/50 hover:text-chalk"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

    </div>
  );
}
