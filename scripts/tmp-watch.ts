import { createClient } from "@supabase/supabase-js";
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await s.from("growth_runs")
    .select("id, status, phase, paused_at_phase, error, phase_status, created_at")
    .order("created_at", { ascending: false }).limit(1).single();
  if (!data) { console.log("{}"); return; }
  const phases = Object.entries((data.phase_status ?? {}) as Record<string, {status?: string}>)
    .map(([k, v]) => `${k}:${v?.status}`).join(" ");
  console.log(JSON.stringify({ id: data.id.slice(0,8), status: data.status, phase: data.phase, paused: data.paused_at_phase, error: data.error, phases }));
}
main();
