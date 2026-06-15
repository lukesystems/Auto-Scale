import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ProviderMode } from "@/lib/provider-mode";
import { isManagedMode } from "@/lib/provider-mode";
import { getManagedPostizCredentials } from "@/services/providers/config";

export interface PostizCredentials {
  apiUrl: string;
  apiKey: string;
  source: "managed" | "byok";
}

export async function resolvePostizCredentials(
  userId: string,
  providerMode: ProviderMode
): Promise<PostizCredentials | null> {
  if (isManagedMode(providerMode)) {
    const managed = getManagedPostizCredentials();
    if (managed) {
      return { ...managed, source: "managed" };
    }
    return null;
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("postiz_connections")
    .select("api_url, api_key")
    .eq("owner_id", userId)
    .maybeSingle();

  if (data?.api_url && data?.api_key) {
    return { apiUrl: data.api_url, apiKey: data.api_key, source: "byok" };
  }

  return null;
}
