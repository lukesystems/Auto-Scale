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
          source_url: brief?.source_url ?? project.product_url ?? "",
          product_name: brief?.product_name ?? project.name ?? "",
          one_line_description: brief?.one_line_description ?? brief?.product_summary ?? project.description ?? "",
          category: brief?.category ?? project.niche ?? "",
          product_type: brief?.product_type ?? "",
          product_summary: brief?.product_summary ?? "",
          what_it_does: brief?.what_it_does ?? brief?.product_summary ?? "",
          target_customer: brief?.target_customer ?? "",
          target_audience: jsonLines(brief?.target_audience),
          primary_pain: brief?.primary_pain ?? "",
          user_pain_points: jsonLines(brief?.user_pain_points),
          core_promise: brief?.core_promise ?? "",
          key_features: jsonLines(brief?.key_features),
          key_benefits: jsonLines(brief?.key_benefits),
          offer: brief?.offer ?? "",
          cta: brief?.cta ?? "",
          competitors: jsonLines(brief?.competitors),
          alternative_solutions: jsonLines(brief?.alternative_solutions),
          market_category: brief?.market_category ?? "",
          content_angles: jsonLines(brief?.content_angles),
          platform_recommendations: platformLines(brief?.platform_recommendations),
          cta_suggestions: jsonLines(brief?.cta_suggestions),
          founder_led_opportunities: jsonLines(brief?.founder_led_opportunities),
          positioning_gaps: jsonLines(brief?.positioning_gaps),
          extraction_notes: jsonLines(brief?.extraction_notes),
          brand_voice: brief?.brand_voice ?? "",
          content_pillars: Array.isArray(brief?.content_pillars) ? (brief?.content_pillars as string[]).join("\n") : "",
          positioning_angles: Array.isArray(brief?.positioning_angles) ? (brief?.positioning_angles as string[]).join("\n") : "",
        }}
      />
    </div>
  );
}

function jsonLines(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) return String(item.name);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function platformLines(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "platform" in item && "reason" in item) {
        return `${String(item.platform)}: ${String(item.reason)}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
