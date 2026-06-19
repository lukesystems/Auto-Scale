import { PageHeader } from "@/components/app/page-header";
import { getUserSettings } from "@/lib/provider-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container py-10 max-w-2xl">
        <PageHeader
          title="Welcome to AutoScale"
          description="Configure Supabase to enable onboarding. You can still browse projects in preview mode."
        />
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const settings = await getUserSettings(user.id);
  if (settings?.onboarding_completed) {
    redirect(settings.default_project_id ? `/projects/${settings.default_project_id}` : "/projects");
  }

  return (
    <div className="container py-10 max-w-2xl animate-fade-in">
      <PageHeader
        title="Paste your product URL. Generate your growth brief."
        description="AutoScale will read your website, identify your audience, positioning, content angles, and distribution opportunities."
      />
      <div className="mt-8 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 md:p-8 shadow-lg shadow-primary/5">
        <OnboardingWizard initialProviderMode={settings?.provider_mode ?? "managed"} />
      </div>
    </div>
  );
}
