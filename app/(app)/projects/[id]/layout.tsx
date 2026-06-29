import { ProjectNav } from "@/components/app/project-nav";
import { buildPipelineSteps } from "@/lib/project-pipeline";
import { ProjectHeader } from "@/components/app/project-header";
import { getProjectOr404, getProjectStats } from "./queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const [project, stats, activeRun] = await Promise.all([
    getProjectOr404(params.id),
    getProjectStats(params.id),
    supabase
      .from("growth_runs")
      .select("id")
      .eq("project_id", params.id)
      .in("status", ["pending", "running", "awaiting_user_input", "awaiting_approval", "live"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const hasActiveRun = Boolean(activeRun.data?.id);
  const pipeline = buildPipelineSteps(stats, hasActiveRun);

  return (
    <>
      <ProjectHeader
        projectId={params.id}
        projectName={project.name}
        niche={project.niche}
      />
      <div className="flex flex-col lg:flex-row">
        <ProjectNav
          projectId={params.id}
          pipeline={pipeline}
          activeRunId={activeRun.data?.id ?? null}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
