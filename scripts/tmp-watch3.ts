import { createClient } from "@supabase/supabase-js";
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: run } = await s.from("growth_runs")
    .select("id, project_id, phase_status")
    .order("created_at", { ascending: false }).limit(1).single();
  const ps = (run?.phase_status ?? {}) as Record<string, {status?: string}>;
  console.log(JSON.stringify({ id: run?.id?.slice(0,8), deep_discovery: ps.deep_discovery?.status ?? "pending" }));
}
main();
