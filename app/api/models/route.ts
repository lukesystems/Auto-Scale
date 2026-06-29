import { NextResponse } from "next/server";
import { CURATED_MODELS } from "@/services/ai/curated-models";
import { getManagedOpenRouterCredentials } from "@/services/providers/config";

export const dynamic = "force-dynamic";

interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: { modality?: string };
}

let catalogCache: { models: OpenRouterModel[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchOpenRouterCatalog(): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.models;
  }

  const creds = getManagedOpenRouterCredentials();
  if (!creds?.apiKey) {
    return [];
  }

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${creds.apiKey}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return catalogCache?.models ?? [];
  }

  const body = (await res.json()) as { data?: OpenRouterModel[] };
  const models = (body.data ?? [])
    .filter((m) => m.id && !m.id.includes(":free"))
    .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));

  catalogCache = { models, fetchedAt: now };
  return models;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  if (mode === "curated") {
    return NextResponse.json({ models: CURATED_MODELS });
  }

  if (mode === "advanced") {
    const catalog = await fetchOpenRouterCatalog();
    return NextResponse.json({
      models: catalog.map((m) => ({
        slug: m.id,
        label: m.name ?? m.id,
        description: m.description?.slice(0, 200) ?? null,
        contextLength: m.context_length ?? null,
      })),
    });
  }

  return NextResponse.json({
    curated: CURATED_MODELS,
    advancedAvailable: Boolean(getManagedOpenRouterCredentials()?.apiKey),
  });
}
