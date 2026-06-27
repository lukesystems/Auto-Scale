import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ProviderMode } from "@/lib/provider-mode";
import { isManagedMode } from "@/lib/provider-mode";
import { getManagedPostBridgeCredentials } from "@/services/providers/config";
import { decryptSecret } from "@/lib/secret-crypto";

export interface PostBridgeCredentials {
  apiKey: string;
  apiUrl?: string;
  source: "managed" | "byok";
}

export async function resolvePostBridgeCredentials(
  userId: string,
  providerMode: ProviderMode
): Promise<PostBridgeCredentials | null> {
  if (isManagedMode(providerMode)) {
    const managed = getManagedPostBridgeCredentials();
    if (managed) {
      return { ...managed, source: "managed" };
    }
    return null;
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("postbridge_connections")
    .select("api_key")
    .eq("owner_id", userId)
    .maybeSingle();

  if (data?.api_key) {
    try {
      return { apiKey: decryptSecret(data.api_key), source: "byok" };
    } catch {
      return null;
    }
  }

  return null;
}
