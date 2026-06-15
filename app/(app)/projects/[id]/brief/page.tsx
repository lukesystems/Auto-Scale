import { PageHeader } from "@/components/app/page-header";
import { getProductBrief, getProjectOr404 } from "../queries";
import { BriefForm } from "./brief-form";

interface PageProps { params: { id: string } }

export const metadata = { title: "Product brief" };

export default async function BriefPage({ params }: PageProps) {
  const [project, brief] = await Promise.all([
    getProjectOr404(params.id),
    getProductBrief(params.id),
  ]);

  return (
    <div className="container py-10 max-w-4xl space-y-8">
      <PageHeader
        title="Product brief"
        description={`Sharpens TrendWatch and Content Conveyor for ${project.name}. Use AI to seed it, then refine.`}
      />

      <BriefForm
        projectId={params.id}
        initial={{
          product_summary: brief?.product_summary ?? "",
          target_customer: brief?.target_customer ?? "",
          primary_pain: brief?.primary_pain ?? "",
          core_promise: brief?.core_promise ?? "",
          offer: brief?.offer ?? "",
          cta: brief?.cta ?? "",
          brand_voice: brief?.brand_voice ?? "",
          content_pillars: Array.isArray(brief?.content_pillars) ? (brief?.content_pillars as string[]).join("\n") : "",
          positioning_angles: Array.isArray(brief?.positioning_angles) ? (brief?.positioning_angles as string[]).join("\n") : "",
        }}
      />
    </div>
  );
}
