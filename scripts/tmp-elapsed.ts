import { createClient } from "@supabase/supabase-js";
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: run } = await s.from("growth_runs").select("id, phase_status, updated_at, created_at").order("created_at",{ascending:false}).limit(1).single();
  const ps = run!.phase_status as Record<string, {at?: string, status?: string}>;
  console.log("run created:", run!.created_at);
  console.log("run updated_at:", run!.updated_at);
  console.log("deep_discovery entry:", JSON.stringify(ps.deep_discovery));
  console.log("now:", new Date().toISOString());
  if (ps.deep_discovery?.at) {
    const elapsed = (Date.now() - new Date(ps.deep_discovery.at).getTime())/1000;
    console.log("elapsed since deep_discovery started running:", elapsed.toFixed(0), "s");
  }
}
main();
