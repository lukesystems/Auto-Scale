import Link from "next/link";
import { Bug, KeyRound, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listProviders, getDefaultProvider } from "@/services/ai/runtime";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  const providers = listProviders();
  const active = getDefaultProvider();

  return (
    <div className="container py-10 max-w-4xl space-y-8">
      <PageHeader title="Settings" description="Project-wide defaults, AI providers, and integrations." />

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold tracking-tight">AI providers</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              AutoScale uses a model abstraction layer. Whichever provider you configure via env becomes the default. Fall-back is the mock provider.
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
            <p className="mt-2 text-xs text-muted-foreground">
              Set <code className="font-mono">OPENAI_API_KEY</code>, <code className="font-mono">ANTHROPIC_API_KEY</code>, or <code className="font-mono">OPENROUTER_API_KEY</code> in <code className="font-mono">.env.local</code> to enable real providers.
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
              Connect Postiz to push approved posts directly to your scheduler. Without it, AutoScale still works — you just export packs manually.
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
