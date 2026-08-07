"use client";

import { FONTS, FONT_KEYS } from "@/lib/fonts";
import { PRESETS } from "@/lib/presets";
import type { CaptionStyle } from "@/lib/types";
import {
  ColorInput,
  Field,
  Panel,
  SegmentedControl,
  Slider,
  Toggle,
} from "./controls";

type Props = {
  style: CaptionStyle;
  presetId: string | null;
  onPreset: (id: string) => void;
  onChange: (patch: Partial<CaptionStyle>) => void;
  onSuggest: (() => void) | null;
  suggesting: boolean;
  suggestion: string | null;
  suggestError: string | null;
};

export function StylePanel({
  style,
  presetId,
  onPreset,
  onChange,
  onSuggest,
  suggesting,
  suggestion,
  suggestError,
}: Props) {
  return (
    <div className="space-y-4">
      <Panel title="Or let us style it for you" tourId="suggest">
        <button
          onClick={() => onSuggest?.()}
          disabled={!onSuggest || suggesting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet px-3 py-2.5 text-[13px] font-semibold text-ink transition-transform enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          {suggesting ? (
            "Looking at your footage…"
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2z" />
                <path d="M18.5 14l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8.8-2.4z" opacity=".75" />
              </svg>
              Suggest a style
            </>
          )}
        </button>

        {suggestion || suggestError ? (
          <p className="mt-2 text-[11.5px] leading-relaxed">
            {suggestion ? (
              <span className="text-chalk">{suggestion}</span>
            ) : (
              <span className="text-[#ff8a7a]">{suggestError}</span>
            )}
          </p>
        ) : null}
      </Panel>

      <Panel title="Preset">
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onPreset(preset.id)}
              title={preset.blurb}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                preset.id === presetId
                  ? "border-volt bg-volt/[0.08]"
                  : "border-line bg-ink hover:border-muted/40"
              }`}
            >
              <span
                className="block text-[13px] font-semibold"
                style={{
                  fontFamily: FONTS[preset.style.font].css,
                  color:
                    preset.id === presetId
                      ? preset.style.emphasisColor
                      : undefined,
                }}
              >
                {preset.name}
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-tight text-muted">
                {preset.style.mode === "word" ? "word by word" : "phrase"} ·{" "}
                {preset.style.position}
              </span>
            </button>
          ))}
        </div>
        {presetId === null ? (
          <p className="mt-3 text-[11.5px] text-muted">
            Custom — you've tuned this away from a preset.
          </p>
        ) : null}
      </Panel>

      <Panel title="Type">
        <Field label="Font">
          <div className="grid grid-cols-3 gap-1.5">
            {FONT_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => onChange({ font: key })}
                className={`rounded-lg border px-2 py-2.5 text-[13px] transition-colors ${
                  style.font === key
                    ? "border-chalk bg-chalk text-ink"
                    : "border-line bg-ink text-chalk hover:border-muted/40"
                }`}
                style={{ fontFamily: FONTS[key].css }}
              >
                {FONTS[key].label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Size" hint={`${style.size.toFixed(1)}% of height`}>
          <Slider
            value={style.size}
            min={2.5}
            max={12}
            step={0.1}
            onChange={(size) => onChange({ size })}
          />
        </Field>

        <Field label="Words per line" hint={String(style.maxWords)}>
          <Slider
            value={style.maxWords}
            min={1}
            max={10}
            onChange={(maxWords) => onChange({ maxWords })}
          />
        </Field>

        <Field label="Case">
          <SegmentedControl
            value={style.uppercase ? "upper" : "sentence"}
            options={[
              { value: "upper", label: "UPPERCASE" },
              { value: "sentence", label: "Sentence" },
            ]}
            onChange={(v) => onChange({ uppercase: v === "upper" })}
          />
        </Field>
      </Panel>

      <Panel title="Colour">
        <div className="space-y-2">
          <ColorInput
            label="Base words"
            value={style.color}
            onChange={(color) => onChange({ color })}
          />
          <ColorInput
            label="Active word"
            value={style.activeColor}
            onChange={(activeColor) => onChange({ activeColor })}
          />
          <ColorInput
            label="AI-emphasised word"
            value={style.emphasisColor}
            onChange={(emphasisColor) => onChange({ emphasisColor })}
          />
          <ColorInput
            label="Outline"
            value={style.outlineColor}
            onChange={(outlineColor) => onChange({ outlineColor })}
          />
          {style.highlightBox ? (
            <ColorInput
              label="Highlight box"
              value={style.boxColor}
              onChange={(boxColor) => onChange({ boxColor })}
            />
          ) : null}
        </div>

        <Field label="Outline weight" hint={`${style.outline.toFixed(2)}%`}>
          <Slider
            value={style.outline}
            min={0}
            max={1.4}
            step={0.05}
            onChange={(outline) => onChange({ outline })}
          />
        </Field>

        <Field label="Drop shadow" hint={`${style.shadow.toFixed(2)}%`}>
          <Slider
            value={style.shadow}
            min={0}
            max={1.2}
            step={0.05}
            onChange={(shadow) => onChange({ shadow })}
          />
        </Field>
      </Panel>

      <Panel title="Layout & motion">
        <Field
          label="Position"
          hint={style.anchor ? "dragged" : undefined}
        >
          <SegmentedControl
            value={style.position}
            options={[
              { value: "top", label: "Top" },
              { value: "middle", label: "Middle" },
              { value: "bottom", label: "Bottom" },
            ]}
            onChange={(position) => onChange({ position, anchor: null })}
          />
        </Field>

        {style.anchor ? (
          <div className="rounded-lg border border-line bg-ink p-3">
            <p className="text-[11.5px] leading-relaxed text-muted">
              Dragged to{" "}
              <span className="font-mono text-chalk">
                {style.anchor.x.toFixed(0)}%, {style.anchor.y.toFixed(0)}%
              </span>
              . Drag the captions on the preview to move them again.
            </p>
            <button
              onClick={() => onChange({ anchor: null })}
              className="mt-2 w-full rounded-md border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-muted/50 hover:text-chalk"
            >
              Snap back to {style.position}
            </button>
          </div>
        ) : (
          <>
            {style.position !== "middle" ? (
              <Field label="Distance from edge" hint={`${style.margin}%`}>
                <Slider
                  value={style.margin}
                  min={2}
                  max={40}
                  onChange={(margin) => onChange({ margin })}
                />
              </Field>
            ) : null}
            <p className="pb-1 text-[11.5px] leading-relaxed text-muted">
              Or drag the captions directly on the preview to place them
              anywhere in frame.
            </p>
          </>
        )}

        <Field label="Reveal">
          <SegmentedControl
            value={style.mode}
            options={[
              { value: "phrase", label: "Phrase" },
              { value: "word", label: "One word" },
            ]}
            onChange={(mode) => onChange({ mode })}
          />
        </Field>

        <Field label="Animation">
          <SegmentedControl
            value={style.animation}
            options={[
              { value: "pop", label: "Pop" },
              { value: "karaoke", label: "Karaoke" },
              { value: "none", label: "None" },
            ]}
            onChange={(animation) => onChange({ animation })}
          />
        </Field>

        <div className="pt-2.5">
          <Toggle
            label="Highlight box on active word"
            checked={style.highlightBox}
            onChange={(highlightBox) => onChange({ highlightBox })}
          />
        </div>
      </Panel>
    </div>
  );
}
