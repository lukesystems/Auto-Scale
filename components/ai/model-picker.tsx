"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CURATED_MODELS,
  getDefaultCuratedModel,
  type CuratedModel,
} from "@/services/ai/curated-models";

export interface ModelPickerValue {
  slug: string;
  source: "curated" | "advanced";
}

interface AdvancedModel {
  slug: string;
  label: string;
  description: string | null;
}

interface ModelPickerProps {
  value: ModelPickerValue;
  onChange: (value: ModelPickerValue) => void;
  disabled?: boolean;
}

export function ModelPicker({ value, onChange, disabled }: ModelPickerProps) {
  const [advancedOpen, setAdvancedOpen] = useState(value.source === "advanced");
  const [advancedModels, setAdvancedModels] = useState<AdvancedModel[]>([]);
  const [advancedSearch, setAdvancedSearch] = useState("");
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);

  useEffect(() => {
    if (!advancedOpen || advancedModels.length > 0) return;
    setLoadingAdvanced(true);
    fetch("/api/models?mode=advanced")
      .then((r) => r.json())
      .then((data: { models?: AdvancedModel[] }) => {
        setAdvancedModels(data.models ?? []);
      })
      .catch(() => setAdvancedModels([]))
      .finally(() => setLoadingAdvanced(false));
  }, [advancedOpen, advancedModels.length]);

  function selectCurated(model: CuratedModel) {
    onChange({ slug: model.slug, source: "curated" });
    setAdvancedOpen(false);
  }

  const filteredAdvanced = advancedModels.filter(
    (m) =>
      !advancedSearch.trim() ||
      m.label.toLowerCase().includes(advancedSearch.toLowerCase()) ||
      m.slug.toLowerCase().includes(advancedSearch.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">AI model for this project</p>
      </div>
      <p className="text-xs text-muted-foreground">
        One model drives AutoBrief, discovery, strategy, and video generation end to end.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {CURATED_MODELS.map((model) => {
          const selected = value.source === "curated" && value.slug === model.slug;
          return (
            <button
              key={model.id}
              type="button"
              disabled={disabled}
              onClick={() => selectCurated(model)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-secondary/50",
                disabled && "pointer-events-none opacity-50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{model.label}</span>
                {model.recommended && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{model.provider}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{model.description}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
        >
          Advanced — full OpenRouter catalog
          <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
        </button>
        {advancedOpen && (
          <div className="border-t border-border p-3 space-y-2">
            <input
              type="search"
              placeholder="Search models…"
              value={advancedSearch}
              onChange={(e) => setAdvancedSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={disabled}
            />
            {loadingAdvanced ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading catalog…</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredAdvanced.slice(0, 50).map((m) => {
                  const selected = value.source === "advanced" && value.slug === m.slug;
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ slug: m.slug, source: "advanced" })}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-xs",
                        selected ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                      )}
                    >
                      <span className="font-medium">{m.label}</span>
                      <span className="ml-1 text-muted-foreground">({m.slug})</span>
                    </button>
                  );
                })}
                {filteredAdvanced.length === 0 && !loadingAdvanced && (
                  <p className="text-xs text-muted-foreground py-2">
                    No models found. Configure OPENROUTER_API_KEY for the full catalog.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function getDefaultModelPickerValue(): ModelPickerValue {
  const def = getDefaultCuratedModel();
  return { slug: def.slug, source: "curated" };
}
