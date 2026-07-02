"use client";

import {
  AUDIO_MODE_SPECS,
  AUDIO_MODES,
  type AudioMode,
} from "@/services/video-factory/production-options";

export function AudioModePicker({
  name = "audioMode",
  defaultValue = "voiceover",
}: {
  name?: string;
  defaultValue?: AudioMode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Audio mode
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {AUDIO_MODES.map((mode) => {
          const spec = AUDIO_MODE_SPECS[mode];
          return (
            <label
              key={mode}
              className="cursor-pointer rounded-lg border bg-background p-3 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/40"
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name={name}
                  value={mode}
                  defaultChecked={defaultValue === mode}
                  className="mt-0.5"
                />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-sm">{spec.label}</p>
                  <p className="text-muted-foreground leading-snug">{spec.description}</p>
                  {spec.requiresElevenLabs ? (
                    <p className="text-muted-foreground">Requires ELEVENLABS_API_KEY</p>
                  ) : null}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
