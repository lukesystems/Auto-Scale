import { ProjectNav } from "@/components/app/project-nav";
import { buildPipelineSteps } from "@/lib/project-pipeline";
import { isBriefComplete } from "@/lib/brief-completeness";
import { ProjectHeader } from "@/components/app/project-header";
import { getProductBrief, getProjectOr404, getProjectStats } from "./queries";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const [project, brief, stats] = await Promise.all([
    getProjectOr404(params.id),
    getProductBrief(params.id),
    getProjectStats(params.id),
  ]);

  const briefComplete = isBriefComplete(brief);
  const pipeline = buildPipelineSteps(stats, briefComplete);

  return (
    <>
      <ProjectHeader
        projectId={params.id}
        projectName={project.name}
        niche={project.niche}
      />
      <div className="flex flex-col lg:flex-row">
        <ProjectNav projectId={params.id} pipeline={pipeline} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
