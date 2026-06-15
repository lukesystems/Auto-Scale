import Link from "next/link";
import { Bug, KeyRound, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listProviders, getDefaultProvider } from "@/services/ai/runtime";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isManagedMode } from "@/lib/provider-mode";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const providers = listProviders();
  const active = getDefaultProvider();
  let mode = "managed" as "managed" | "byok";

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      mode = await getProviderModeForUser(user.id);
    }
  }

  return (
    <div className="container py-10 max-w-4xl space-y-8">
      <PageHeader title="Settings" description="Provider mode, integrations, and debugging tools." />

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold tracking-tight">Provider mode</h3>
              <Badge variant={isManagedMode(mode) ? "success" : "outline"}>
                {isManagedMode(mode) ? "Managed Mode" : "Advanced Mode"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManagedMode(mode)
                ? "AutoScale handles the technical setup. You do not need API keys."
                : "Bring your own OpenRouter, Postiz, or media provider keys. Recommended only for technical users."}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/settings/providers">View provider status</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold tracking-tight">AI runtime</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Task-based model routing via OpenRouter in Managed Mode. Mock provider keeps local dev working without keys.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {providers.map((p) => (
                <Badge key={p} variant={p === active ? "success" : "outline"}>
                  {p === active && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />}
                  {p}
                </Badge>
              ))}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Active default: <code className="font-mono text-foreground">{active}</code>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold tracking-tight">Postiz connection</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManagedMode(mode)
                ? "Scheduling uses AutoScale-managed Postiz credentials in Managed Mode."
                : "Connect your Postiz account to push approved posts to your scheduler."}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/settings/postiz">Manage Postiz</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bug className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold tracking-tight">AI run debugger</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Inspect every AI call: provider, model, prompt version, raw output, parsed output, retries, latency, and errors.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/debug/ai-runs">Open AI runs</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
