"use client";

import { useState } from "react";
import {
  PRODUCTION_FORMAT_SPECS,
  PRODUCTION_FORMATS,
  FAL_MODEL_TIERS,
  VISUAL_PIPELINE_SPECS,
  VISUAL_PIPELINES,
  type FalModelTier,
  type ProductionFormat,
  type VisualPipeline,
} from "@/services/video-factory/production-options";
import { PRODUCTION_MODE_SPECS } from "@/services/video-factory/production-modes";
import { describeFalTierForRun } from "@/services/video-factory/fal/model-router";

export function ProductionFormatPicker({
  name = "productionFormat",
  defaultValue = "slide",
}: {
  name?: string;
  defaultValue?: ProductionFormat;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Production format
      </legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTION_FORMATS.map((format) => {
          const spec = PRODUCTION_FORMAT_SPECS[format];
          return (
            <label
              key={format}
              className={`cursor-pointer rounded-lg border bg-background p-3 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/40 ${
                !spec.implemented ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name={name}
                  value={format}
                  defaultChecked={defaultValue === format}
                  disabled={!spec.implemented}
                  className="mt-0.5"
                />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-sm">{spec.label}</p>
                  <p className="text-muted-foreground leading-snug">{spec.description}</p>
                  {spec.requiresFal ? (
                    <p className="text-amber-700 dark:text-amber-300">FAL_KEY recommended</p>
                  ) : null}
                  {spec.requiresUpload ? (
                    <p className="text-sky-700 dark:text-sky-300">Screen demo upload optional</p>
                  ) : null}
                </div>
              </div>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Phase 3 (coming soon):{" "}
        {Object.values(PRODUCTION_MODE_SPECS)
          .filter((s) => !s.implemented)
          .map((s) => s.label)
          .join(" · ")}
      </p>
    </fieldset>
  );
}

export function FalRenderModePicker({
  name = "falRenderMode",
  defaultValue = "cinematic",
  falModelTierName = "falModelTier",
  defaultModelTier = "auto",
}: {
  name?: string;
  defaultValue?: "cinematic" | "fast";
  falModelTierName?: string;
  defaultModelTier?: FalModelTier;
}) {
  const [falRenderMode, setFalRenderMode] = useState<"cinematic" | "fast">(defaultValue);
  const [falModelTier, setFalModelTier] = useState<FalModelTier>(defaultModelTier);

  const tierHint = describeFalTierForRun({ falRenderMode, falModelTier });

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Fal render mode
      </legend>
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-lg border bg-background px-3 py-2 text-xs has-[:checked]:border-primary">
          <input
            type="radio"
            name={name}
            value="cinematic"
            defaultChecked={defaultValue === "cinematic"}
            className="mr-2"
            onChange={() => setFalRenderMode("cinematic")}
          />
          Cinematic — Seedance b-roll middle scenes
        </label>
        <label className="cursor-pointer rounded-lg border bg-background px-3 py-2 text-xs has-[:checked]:border-primary">
          <input
            type="radio"
            name={name}
            value="fast"
            defaultChecked={defaultValue === "fast"}
            className="mr-2"
            onChange={() => setFalRenderMode("fast")}
          />
          Fast — slides only, no fal
        </label>
      </div>
      {falRenderMode === "cinematic" ? (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Video AI tier
          </p>
          <div className="flex flex-wrap gap-2">
            {FAL_MODEL_TIERS.map((tier) => (
              <label
                key={tier}
                className="cursor-pointer rounded-lg border bg-background px-3 py-2 text-xs has-[:checked]:border-primary"
              >
                <input
                  type="radio"
                  name={falModelTierName}
                  value={tier}
                  defaultChecked={defaultModelTier === tier}
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
        </div>
      ) : (
        <input type="hidden" name={falModelTierName} value="auto" />
      )}
      <p className="text-[11px] text-muted-foreground">{tierHint}</p>
    </fieldset>
  );
}

export function VisualPipelinePicker({
  name = "visualPipeline",
  defaultValue = "auto",
  falConfigured = false,
}: {
  name?: string;
  /** Explicit pipeline override, or `auto` to let the resolver decide. */
  defaultValue?: VisualPipeline | "auto";
  falConfigured?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Visual pipeline
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
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
                Resolver picks the best path — image→video for ai_broll_short + cinematic when Fal is
                configured, otherwise text-to-video.
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
      {!falConfigured ? (
        <p className="text-[11px] text-muted-foreground">
          Fal is not configured — only static slides are available for explicit overrides. Auto still
          works and falls back safely.
        </p>
      ) : null}
    </fieldset>
  );
}
