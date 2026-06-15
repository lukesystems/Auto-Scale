import Link from "next/link";
import { AlertTriangle, Calendar, Send, Settings2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeTime } from "@/lib/utils";
import { SchedulePostForm } from "./schedule-post-form";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";

interface PageProps { params: { id: string } }
export const metadata = { title: "Schedule" };

export default async function SchedulePage({ params }: PageProps) {
  const [approved, scheduled, postiz] = await Promise.all([
    loadApproved(params.id),
    loadScheduled(params.id),
    loadPostizContext(),
  ]);

  const postizReady = postiz.ready;

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Schedule"
        description="Push approved posts through Postiz, or save locally and export. Every scheduled post auto-creates an experiment."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/postiz">
              <Settings2 className="h-4 w-4" /> Postiz settings
            </Link>
          </Button>
        }
      />

      {!postizReady && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-5 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">Postiz isn&apos;t connected</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              You can still schedule locally — AutoScale will store the payload and create the experiment. Connect Postiz to actually publish.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/settings/postiz">Connect Postiz</Link>
            </Button>
          </div>
        </div>
      )}

      {approved.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="No approved posts to schedule"
          description="Head to the approval queue and approve some drafts."
          action={
            <Button asChild>
              <Link href={`/projects/${params.id}/approval`}>
                <Send className="h-4 w-4" /> Go to approval
              </Link>
            </Button>
          }
        />
      ) : (
        <section>
          <h3 className="font-semibold tracking-tight mb-3">Approved posts ({approved.length})</h3>
          <div className="grid lg:grid-cols-2 gap-4">
            {approved.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.format && <Badge>{p.format}</Badge>}
                  {p.platform && <Badge variant="outline">{p.platform}</Badge>}
                </div>
                <h4 className="mt-3 font-semibold tracking-tight text-balance">{p.hook}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{p.target_audience}</p>

                <div className="mt-4 pt-4 border-t border-border">
                  <SchedulePostForm
                    projectId={params.id}
                    postId={p.id}
                    defaultPlatform={p.platform ?? "linkedin"}
                    channels={postiz.channels}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {scheduled.length > 0 && (
        <section>
          <h3 className="font-semibold tracking-tight mb-3">Scheduled ({scheduled.length})</h3>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {scheduled.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.platform && <Badge variant="outline">{s.platform}</Badge>}
                    <span className="text-sm font-medium truncate">{s.hook}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {s.channel ? `${s.channel} · ` : ""}{s.scheduled_for ? new Date(s.scheduled_for).toLocaleString() : "no date"}
                    {" · "}created {formatRelativeTime(s.created_at)}
                  </div>
                  {s.error_message && (
                    <div className="mt-1 text-xs text-warning">⚠ {s.error_message}</div>
                  )}
                </div>
                <ScheduledStatus status={s.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScheduledStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
    scheduled: { label: "scheduled", variant: "success" },
    queued_local: { label: "queued locally", variant: "warning" },
    pending: { label: "pending", variant: "warning" },
    failed: { label: "failed", variant: "destructive" },
  };
  const e = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={e.variant}>{e.label}</Badge>;
}

async function loadApproved(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("generated_posts")
    .select("id, format, platform, hook, target_audience")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function loadScheduled(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("scheduled_posts")
    .select(`
      id, platform, channel, status, scheduled_for, error_message, created_at,
      post:generated_posts(hook)
    `)
    .eq("project_id", projectId)
    .order("scheduled_for", { ascending: true });

  return ((data ?? []) as Array<{
    id: string;
    platform: string | null;
    channel: string | null;
    status: string;
    scheduled_for: string | null;
    error_message: string | null;
    created_at: string;
    post: { hook: string | null } | null;
  }>).map((s) => ({
    ...s,
    hook: (s.post as { hook: string | null } | null)?.hook ?? "(no hook)",
  }));
}

async function loadPostizContext() {
  if (!isSupabaseConfigured()) return { ready: false, channels: [] };
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ready: false, channels: [] };
  const mode = await getProviderModeForUser(user.id);
  const [credentials, channelsResult] = await Promise.all([
    resolvePostizCredentials(user.id, mode),
    supabase
      .from("postiz_channels")
      .select("integration_id, name, platform")
      .eq("owner_id", user.id)
      .eq("disabled", false)
      .order("name"),
  ]);
  return {
    ready: Boolean(credentials),
    channels: (channelsResult.data ?? []).map((channel) => ({
      integrationId: channel.integration_id,
      name: channel.name,
      platform: channel.platform,
    })),
  };
}
