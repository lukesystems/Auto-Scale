import Link from "next/link";
import { ArrowLeft, ImageIcon, KeyRound, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";
import { getClientSafeProviderStatus } from "@/services/providers/status";
import { getModelRoutingSummary } from "@/services/ai/runtime";
import { isManagedMode } from "@/lib/provider-mode";

export const metadata = { title: "Providers" };

export default async function ProvidersSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container py-10 max-w-3xl">
        <PageHeader title="Providers" description="Configure Supabase to manage provider settings." />
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const mode = await getProviderModeForUser(user.id);
  const status = getClientSafeProviderStatus(mode);
  const routing = getModelRoutingSummary();

  return (
    <div className="container py-10 max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Provider settings"
        description={
          isManagedMode(mode)
            ? "Managed Mode: AutoScale handles the technical setup. You do not need API keys."
            : "Advanced Mode: Bring your own OpenRouter, Postiz, or media provider keys. Recommended only for technical users."
        }
        badge={
          <Badge variant={isManagedMode(mode) ? "success" : "outline"}>
            {isManagedMode(mode) ? "Managed Mode" : "Advanced Mode"}
          </Badge>
        }
      />

      {status.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-2">
          {status.warnings.map((warning) => (
            <p key={warning} className="text-sm text-muted-foreground">
              {warning}
            </p>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1 space-y-3">
            <h3 className="font-semibold">OpenRouter (AI)</h3>
            <StatusRow label="Configured" ok={status.openrouter.configured} />
            <div className="text-xs text-muted-foreground space-y-1 font-mono">
              {Object.entries(status.openrouter.modelDefaults).map(([task, model]) => (
                <div key={task}>
                  {task}: {model ?? "(uses default)"}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1 space-y-3">
            <h3 className="font-semibold">Postiz (scheduling)</h3>
            <StatusRow label="Configured" ok={status.postiz.configured} />
            <StatusRow label="API URL set" ok={status.postiz.apiUrlConfigured} />
            {isManagedMode(mode) ? (
              <p className="text-sm text-muted-foreground">Managed by AutoScale — no API key required in the UI.</p>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/postiz">Manage Postiz connection</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <ImageIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1 space-y-3">
            <h3 className="font-semibold">Fal (media)</h3>
            <StatusRow label="Configured" ok={status.fal.configured} />
            <Badge variant="secondary">Coming soon</Badge>
            <p className="text-sm text-muted-foreground">
              Fal credentials can be configured server-side. Full image/video generation is planned — not active in V1.1.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-secondary/30 p-5 text-sm">
        <h4 className="font-semibold">Model routing summary</h4>
        <ul className="mt-3 space-y-1 font-mono text-xs text-muted-foreground">
          {(Object.entries(routing) as [string, string | null][]).map(([task, model]) => (
            <li key={task}>
              {task} → {model ?? "AUTOSCALE_MODEL_DEFAULT / provider default"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-muted-foreground"}`} />
      <span>{label}:</span>
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{ok ? "Yes" : "No"}</span>
    </div>
  );
}
