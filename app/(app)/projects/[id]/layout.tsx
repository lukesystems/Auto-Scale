import { ProjectNav } from "@/components/app/project-nav";
import { buildPipelineSteps } from "@/lib/project-pipeline";
import { ProjectHeader } from "@/components/app/project-header";
import { PageContent } from "@/components/app/page-content";
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

  const briefComplete = Boolean(brief?.product_summary && brief?.target_customer);
  const pipeline = buildPipelineSteps(stats, briefComplete);

  return (
    <>
      <ProjectHeader
        projectId={params.id}
        projectName={project.name}
        niche={project.niche}
      />
      <ProjectNav projectId={params.id} pipeline={pipeline} />
      <PageContent>{children}</PageContent>
    </>
  );
}
