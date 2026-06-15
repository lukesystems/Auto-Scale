import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PostizForm } from "./postiz-form";

export const metadata = { title: "Postiz" };

export default async function PostizSettingsPage() {
  const connection = await loadConnection();
  const connected = Boolean(connection?.api_url && connection?.api_key);

  return (
    <div className="container py-10 max-w-2xl space-y-8">
      <PageHeader
        title="Postiz connection"
        description="Connect Postiz to push approved posts directly to your scheduler. AutoScale falls back to manual exports if Postiz is offline."
        badge={
          <Badge variant={connected ? "success" : "secondary"}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse-soft" : "bg-muted-foreground"}`} />
            {connected ? "Connected" : "Not connected"}
          </Badge>
        }
      />

      <div className="rounded-xl border border-border bg-card p-6">
        <PostizForm
          initial={{
            api_url: connection?.api_url ?? "",
            has_key: Boolean(connection?.api_key),
          }}
        />
      </div>

      <div className="rounded-xl border border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
        <h4 className="font-semibold text-foreground">Heads up</h4>
        <p className="mt-2">
          Your Postiz API key is stored in Supabase under your user row, protected by RLS. Don&apos;t share screenshots that include it.
        </p>
        <p className="mt-2">
          For best results, configure channels in your Postiz workspace first (one per platform you want to schedule to), then enter the channel ID/name when scheduling from /schedule.
        </p>
      </div>
    </div>
  );
}

async function loadConnection() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("postiz_connections")
    .select("api_url, api_key")
    .eq("owner_id", user.id)
    .maybeSingle();
  return data;
}
