import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildExportZip,
  buildPostsCsv,
  type ExportPostInput,
} from "@/services/export/pack";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return new NextResponse("Supabase not configured.", { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Not signed in.", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) return new NextResponse("Project not found.", { status: 404 });

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "zip";
  const scope = searchParams.get("scope") ?? "approved";

  let query = supabase
    .from("generated_posts")
    .select("id, format, platform, hook, caption, cta, target_audience, hypothesis, metric_to_watch, status")
    .eq("project_id", params.id);
  if (scope === "approved") query = query.eq("status", "approved");

  const { data: posts } = await query.order("created_at", { ascending: false });
  if (!posts || posts.length === 0) {
    return new NextResponse("No posts to export.", { status: 400 });
  }

  const ids = posts.map((p) => p.id);
  const { data: slides } = await supabase
    .from("post_slides")
    .select("post_id, slide_number, headline, body")
    .in("post_id", ids)
    .order("slide_number", { ascending: true });

  const slideMap = new Map<string, Array<{ slide_number: number; headline: string | null; body: string | null }>>();
  for (const s of slides ?? []) {
    const arr = slideMap.get(s.post_id) ?? [];
    arr.push({ slide_number: s.slide_number, headline: s.headline, body: s.body });
    slideMap.set(s.post_id, arr);
  }

  const exportPosts: ExportPostInput[] = posts.map((p) => ({
    id: p.id,
    format: p.format,
    platform: p.platform,
    hook: p.hook,
    caption: p.caption,
    cta: p.cta,
    target_audience: p.target_audience,
    hypothesis: p.hypothesis,
    metric_to_watch: p.metric_to_watch,
    status: p.status,
    slides: slideMap.get(p.id) ?? [],
  }));

  // Log export
  await supabase.from("exports").insert({
    project_id: params.id,
    owner_id: user.id,
    kind,
    status: "ready",
    metadata: { scope, count: posts.length } as never,
  });

  if (kind === "csv") {
    return new NextResponse(buildPostsCsv(exportPosts), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${project.name}-posts.csv"`,
      },
    });
  }

  if (kind === "json") {
    return new NextResponse(JSON.stringify({ project: project.name, posts: exportPosts }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${project.name}-export.json"`,
      },
    });
  }

  const zipData = await buildExportZip({ projectName: project.name, posts: exportPosts });
  return new NextResponse(new Uint8Array(zipData), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${project.name}-export.zip"`,
    },
  });
}
