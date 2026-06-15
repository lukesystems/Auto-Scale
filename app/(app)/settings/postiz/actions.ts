"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { encryptSecret } from "@/lib/secret-crypto";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { fetchPostizIntegrations, testPostizConnection } from "@/services/postiz/client";

const Schema = z.object({
  api_url: z.string().url().optional().or(z.literal("")),
  api_key: z.string().optional(),
});

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function savePostizConnectionAction(formData: FormData): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = Schema.safeParse({
    api_url: formData.get("api_url") ?? undefined,
    api_key: formData.get("api_key") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("postiz_connections")
    .select("api_key")
    .eq("owner_id", user.id)
    .maybeSingle();
  const submittedKey = parsed.data.api_key && parsed.data.api_key !== "**********" ? parsed.data.api_key : undefined;
  const storedKey = submittedKey ? encryptSecret(submittedKey) : existing?.api_key ?? null;

  if (!parsed.data.api_url || !storedKey) {
    return { ok: false, error: "Postiz API URL and API key are required." };
  }
  const connectionTest = await testPostizConnection({
    apiUrl: parsed.data.api_url,
    apiKey: submittedKey ?? (await resolvePostizCredentials(user.id, "byok"))?.apiKey,
  });
  if (!connectionTest.ok) {
    return { ok: false, error: connectionTest.error ?? "Postiz rejected the credentials." };
  }

  const { error } = await supabase
    .from("postiz_connections")
    .upsert(
      {
        owner_id: user.id,
        api_url: parsed.data.api_url,
        api_key: storedKey,
        status: "connected",
      },
      { onConflict: "owner_id" }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/postiz");
  return { ok: true, message: "Postiz connection verified and saved." };
}

export async function testPostizConnectionAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const mode = await getProviderModeForUser(user.id);
  const credentials = await resolvePostizCredentials(user.id, mode);
  if (!credentials) return { ok: false, error: "Postiz credentials are not configured." };
  const result = await testPostizConnection(credentials);
  return result.ok ? { ok: true, message: "Postiz connection is healthy." } : { ok: false, error: result.error ?? "Connection failed." };
}

export async function syncPostizChannelsAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const mode = await getProviderModeForUser(user.id);
  const credentials = await resolvePostizCredentials(user.id, mode);
  if (!credentials) return { ok: false, error: "Postiz credentials are not configured." };

  try {
    const integrations = await fetchPostizIntegrations(credentials);
    if (integrations.length) {
      const { error } = await supabase.from("postiz_channels").upsert(
        integrations.map((channel) => ({
          owner_id: user.id,
          integration_id: channel.id,
          provider: credentials.source,
          platform: channel.identifier,
          name: channel.name,
          profile: channel.profile,
          disabled: channel.disabled,
          raw_metadata: channel.raw as never,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "owner_id,integration_id" }
      );
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/settings/postiz");
    revalidatePath("/projects");
    return { ok: true, message: `Synced ${integrations.length} Postiz channel(s).` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Channel sync failed." };
  }
}

export async function disconnectPostizAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("postiz_connections").delete().eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };
  await supabase.from("postiz_channels").delete().eq("owner_id", user.id).eq("provider", "byok");
  revalidatePath("/settings/postiz");
  return { ok: true };
}
