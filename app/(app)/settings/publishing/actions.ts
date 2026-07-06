"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { testPostBridgeConnection } from "@/services/postbridge/client";
import {
  getPublishingNotConfiguredMessage,
  getPublishingProviderLabel,
  isRemotePublishingEnabled,
  resolvePublishingCredentials,
  syncOwnerPublishingChannels,
  testPublishingConnection,
} from "@/services/social-publishing";

const PostBridgeSchema = z.object({
  api_key: z.string().optional(),
});

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function savePostBridgeConnectionAction(formData: FormData): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = PostBridgeSchema.safeParse({
    api_key: formData.get("api_key") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("postbridge_connections")
    .select("api_key")
    .eq("owner_id", user.id)
    .maybeSingle();

  const submittedKey =
    parsed.data.api_key && parsed.data.api_key !== "**********" ? parsed.data.api_key : undefined;
  let plainKey = submittedKey;
  if (!plainKey && existing?.api_key) {
    try {
      plainKey = decryptSecret(existing.api_key);
    } catch {
      return { ok: false, error: "The existing Post Bridge key could not be decrypted. Enter it again." };
    }
  }

  if (!plainKey) return { ok: false, error: "Post Bridge API key is required." };
  if (!plainKey.startsWith("pb_live_")) {
    return { ok: false, error: "Post Bridge API keys should start with pb_live_." };
  }

  const connectionTest = await testPostBridgeConnection({ apiKey: plainKey });
  if (!connectionTest.ok) {
    return { ok: false, error: connectionTest.error ?? "Post Bridge rejected the credentials." };
  }

  let storedKey: string;
  try {
    storedKey = encryptSecret(plainKey);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not encrypt the Post Bridge key.",
    };
  }

  const { error } = await supabase
    .from("postbridge_connections")
    .upsert(
      {
        owner_id: user.id,
        api_key: storedKey,
        status: "connected",
      },
      { onConflict: "owner_id" }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/publishing");
  return { ok: true, message: "Post Bridge connection verified and saved." };
}

export async function testPublishingConnectionAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const mode = await getProviderModeForUser(user.id);
  const credentials = await resolvePublishingCredentials(user.id, mode);
  if (!credentials || !isRemotePublishingEnabled(credentials)) {
    return { ok: false, error: getPublishingNotConfiguredMessage(mode) };
  }

  const label = getPublishingProviderLabel(credentials.provider);
  const result = await testPublishingConnection(credentials);
  return result.ok
    ? { ok: true, message: `${label} connection is healthy.` }
    : { ok: false, error: result.error ?? "Connection failed." };
}

export async function syncPublishingChannelsAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const mode = await getProviderModeForUser(user.id);

  try {
    const { synced, provider } = await syncOwnerPublishingChannels({
      ownerId: user.id,
      providerMode: mode,
    });
    revalidatePath("/settings/publishing");
    revalidatePath("/projects");
    const label = getPublishingProviderLabel(provider);
    return { ok: true, message: `Synced ${synced} ${label} channel(s).` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Channel sync failed." };
  }
}

export async function disconnectPostBridgeAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("postbridge_connections").delete().eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("postiz_channels").delete().eq("owner_id", user.id).eq("provider", "byok");
  revalidatePath("/settings/publishing");
  return { ok: true };
}
