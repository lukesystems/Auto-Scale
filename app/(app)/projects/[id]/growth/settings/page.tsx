import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loadProjectGrowthSettings } from "@/services/project-growth-settings/load";
import { resolveProjectCta } from "@/services/project-growth-settings/schema";
import { saveGrowthSettingsAction } from "../actions";

interface PageProps {
  params: { id: string };
}

export default async function GrowthSettingsPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) return notFound();
  const projectId = params.id;
  const supabase = createSupabaseServerClient();
  const [settings, accounts, project] = await Promise.all([
    loadProjectGrowthSettings(projectId),
    supabase
      .from("connected_accounts")
      .select("id, platform, handle, status")
      .eq("project_id", projectId),
    supabase.from("projects").select("product_url").eq("id", projectId).single(),
  ]);
  const cta = resolveProjectCta(settings, project.data?.product_url ?? null);

  return (
    <div className="space-y-8 p-6 max-w-2xl">
      <header>
        <Link href={`/projects/${projectId}/growth`} className="text-xs underline text-muted-foreground">
          ← Growth Runs
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Growth settings</h1>
        <p className="text-sm text-muted-foreground">
          Operation mode, CTAs, booking links, and distribution targets.
        </p>
      </header>

      {cta.setupWarning ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          {cta.setupWarning}
        </p>
      ) : null}

      <form action={saveGrowthSettingsAction} className="rounded-xl border bg-card p-5 space-y-4">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="onboardingCompleted" value="on" />

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Operation mode</span>
          <select name="operationMode" defaultValue={settings.operation_mode} className="w-full rounded-md border px-3 py-2">
            <option value="manual">Manual — you approve and schedule</option>
            <option value="assisted">Assisted — auto-approve safe videos</option>
            <option value="managed">Managed / Non-Technical — auto-start, approve, schedule</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Main CTA</span>
          <select name="primaryCtaType" defaultValue={settings.primary_cta_type} className="w-full rounded-md border px-3 py-2">
            <option value="start_free">Start free</option>
            <option value="join_waitlist">Join waitlist</option>
            <option value="book_demo">Book a demo</option>
            <option value="download_app">Download app</option>
            <option value="buy_now">Buy now</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Demo booking link</span>
          <span className="block text-xs text-muted-foreground">
            Google Calendar appointment schedule link or any booking URL.
          </span>
          <input
            name="bookingUrl"
            type="url"
            defaultValue={settings.booking_url ?? ""}
            placeholder="https://calendar.google.com/calendar/appointments/..."
            className="w-full rounded-md border px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Booking provider</span>
          <select name="bookingProvider" defaultValue={settings.booking_provider} className="w-full rounded-md border px-3 py-2">
            <option value="none">None</option>
            <option value="google_calendar">Google Calendar</option>
            <option value="calendly">Calendly</option>
            <option value="manual">Manual link</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Distribution</span>
          <select
            name="distributionPreference"
            defaultValue={settings.distribution_preference}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="all_accounts">All connected accounts</option>
            <option value="selected">Selected accounts only</option>
            <option value="export_only">Export only (no Postiz)</option>
          </select>
        </label>

        {(accounts.data ?? []).length ? (
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium">Connected accounts</legend>
            {(accounts.data ?? []).map((a) => (
              <label key={a.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="selectedAccountIds"
                  value={a.id}
                  defaultChecked={
                    settings.distribution_preference !== "selected" ||
                    settings.selected_account_ids.includes(a.id)
                  }
                />
                {a.platform} · @{a.handle} ({a.status})
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-xs text-muted-foreground">No connected accounts — runs will use export-only mode.</p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="autopilotEnabled"
            defaultChecked={settings.autopilot_enabled}
          />
          Enable autopilot (required for Managed mode auto-start)
        </label>

        <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
          Save settings
        </button>
      </form>
    </div>
  );
}
