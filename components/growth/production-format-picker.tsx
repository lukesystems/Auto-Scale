"use client";



import { useState } from "react";

import {

  FAL_MODEL_TIERS,

  VIDEO_OUTPUT_MODES,

  VIDEO_OUTPUT_MODE_SPECS,

  VISUAL_PIPELINE_SPECS,

  VISUAL_PIPELINES,

  type FalModelTier,

  type VideoOutputMode,

  type VisualPipeline,

} from "@/services/video-factory/production-options";

import { describeFalTierForRun } from "@/services/video-factory/fal/model-router";



export function VideoOutputModePicker({

  name = "videoOutputMode",

  defaultValue = "kinetic_text_ad",

}: {

  name?: string;

  defaultValue?: VideoOutputMode;

}) {

  return (

    <fieldset className="space-y-2">

      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">

        Video output mode

      </legend>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">

        {VIDEO_OUTPUT_MODES.map((mode) => {

          const spec = VIDEO_OUTPUT_MODE_SPECS[mode];

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

                  <p className="font-semibold text-sm">

                    {spec.label}

                    {mode === "kinetic_text_ad" ? (

                      <span className="ml-1.5 text-[10px] font-normal uppercase text-primary">

                        Default

                      </span>

                    ) : null}

                  </p>

                  <p className="text-muted-foreground leading-snug">{spec.description}</p>

                  {spec.maxAiVideoScenes > 0 ? (

                    <p className="text-amber-700 dark:text-amber-300">

                      Up to {spec.maxAiVideoScenes} AI scene{spec.maxAiVideoScenes === 1 ? "" : "s"} · FAL_KEY

                      recommended

                    </p>

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



/** @deprecated Use VideoOutputModePicker */

export const ProductionFormatPicker = VideoOutputModePicker;



export function AdvancedProductionSettings({

  defaultQualityTier = "standard",

  defaultVisualPipeline = "slide",

  defaultFalModelTier = "auto",

  falConfigured = false,

  showFalTier = true,

}: {

  defaultQualityTier?: "draft" | "standard" | "cinematic";

  defaultVisualPipeline?: VisualPipeline | "auto";

  defaultFalModelTier?: FalModelTier;

  falConfigured?: boolean;

  showFalTier?: boolean;

}) {

  const [qualityTier, setQualityTier] = useState(defaultQualityTier);

  const [falModelTier, setFalModelTier] = useState<FalModelTier>(defaultFalModelTier);



  const tierHint = describeFalTierForRun({

    falRenderMode: qualityTier === "draft" ? "fast" : "cinematic",

    falModelTier,

    qualityTier,

  });



  return (

    <details className="rounded-lg border bg-muted/20 p-3 text-xs">

      <summary className="cursor-pointer font-medium text-sm">Advanced settings</summary>

      <div className="mt-3 space-y-4">

        <fieldset className="space-y-2">

          <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">

            Quality tier

          </legend>

          <div className="flex flex-wrap gap-2">

            {(["draft", "standard", "cinematic"] as const).map((tier) => (

              <label

                key={tier}

                className="cursor-pointer rounded-lg border bg-background px-3 py-2 has-[:checked]:border-primary"

              >

                <input

                  type="radio"

                  name="qualityTier"

                  value={tier}

                  defaultChecked={defaultQualityTier === tier}

                  className="mr-2"

                  onChange={() => setQualityTier(tier)}

                />

                {tier === "draft" ? "Draft" : tier === "standard" ? "Standard" : "Cinematic"}

              </label>

            ))}

          </div>

        </fieldset>



        {showFalTier && qualityTier !== "draft" ? (

          <fieldset className="space-y-2">

            <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">

              Video AI tier

            </legend>

            <div className="flex flex-wrap gap-2">

              {FAL_MODEL_TIERS.map((tier) => (

                <label

                  key={tier}

                  className="cursor-pointer rounded-lg border bg-background px-3 py-2 has-[:checked]:border-primary"

                >

                  <input

                    type="radio"

                    name="falModelTier"

                    value={tier}

                    defaultChecked={defaultFalModelTier === tier}

                    className="mr-2"

                    onChange={() => setFalModelTier(tier)}

                  />

                  {tier === "auto"

                    ? "Auto (scene-aware)"

                    : tier === "fast"

                      ? "Fast"

                      : tier === "standard"

                        ? "Standard"

                        : "Cinematic"}

                </label>

              ))}

            </div>

            <p className="text-[11px] text-muted-foreground">{tierHint}</p>

          </fieldset>

        ) : (

          <input type="hidden" name="falModelTier" value="auto" />

        )}



        <VisualPipelinePicker

          defaultValue={defaultVisualPipeline}

          falConfigured={falConfigured}

          compact

        />

      </div>

    </details>

  );

}



/** @deprecated Use AdvancedProductionSettings */

export function FalRenderModePicker({

  defaultValue = "fast",

  defaultModelTier = "auto",

}: {

  name?: string;

  defaultValue?: "cinematic" | "fast";

  falModelTierName?: string;

  defaultModelTier?: FalModelTier;

}) {

  return (

    <AdvancedProductionSettings

      defaultQualityTier={defaultValue === "fast" ? "draft" : "standard"}

      defaultFalModelTier={defaultModelTier}

      showFalTier={defaultValue !== "fast"}

    />

  );

}



export function VisualPipelinePicker({

  name = "visualPipeline",

  defaultValue = "auto",

  falConfigured = false,

  compact = false,

}: {

  name?: string;

  defaultValue?: VisualPipeline | "auto";

  falConfigured?: boolean;

  compact?: boolean;

}) {

  return (

    <fieldset className="space-y-2">

      <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">

        Visual pipeline {compact ? "(I2V vs T2V for AI scenes)" : ""}

      </legend>

      <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>

        <label className="cursor-pointer rounded-lg border bg-background p-3 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/40">

          <div className="flex items-start gap-2">

            <input

              type="radio"

              name={name}

              value="auto"

              defaultChecked={defaultValue === "auto"}

              className="mt-0.5"

            />

            <div className="space-y-1 text-xs">

              <p className="font-semibold text-sm">Auto</p>

              <p className="text-muted-foreground leading-snug">

                Image→video (I2V) for hybrid/full AI modes when Fal is configured.

              </p>

            </div>

          </div>

        </label>

        {VISUAL_PIPELINES.map((pipeline) => {

          const spec = VISUAL_PIPELINE_SPECS[pipeline];

          const disabled = spec.requiresFal && !falConfigured;

          return (

            <label

              key={pipeline}

              className={`rounded-lg border bg-background p-3 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/40 ${

                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"

              }`}

            >

              <div className="flex items-start gap-2">

                <input

                  type="radio"

                  name={name}

                  value={pipeline}

                  defaultChecked={defaultValue === pipeline}

                  disabled={disabled}

                  className="mt-0.5"

                />

                <div className="space-y-1 text-xs">

                  <p className="font-semibold text-sm">{spec.label}</p>

                  <p className="text-muted-foreground leading-snug">{spec.description}</p>

                  {disabled ? (

                    <p className="text-amber-700 dark:text-amber-300">Requires FAL_KEY</p>

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


