import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { readAutobriefProgress } from "@/services/autobrief/crawl-progress";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const crawlId = req.nextUrl.searchParams.get("crawlId");
  if (!crawlId) {
    return NextResponse.json({ error: "crawlId is required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: crawl } = await supabase
    .from("product_site_crawls")
    .select("id, status")
    .eq("id", crawlId)
    .eq("project_id", params.id)
    .maybeSingle();

  if (!crawl) {
    return NextResponse.json({ error: "Crawl not found." }, { status: 404 });
  }

  const progress = await readAutobriefProgress(crawlId);

  return NextResponse.json({
    crawlId,
    status: crawl.status,
    progress: progress ?? {
      phase: "starting",
      currentMessage: "Starting…",
      events: [],
      pagesDiscovered: 0,
      pagesCrawled: 0,
      factsFound: 0,
    },
  });
}
