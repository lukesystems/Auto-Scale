import { createClient } from "@supabase/supabase-js";
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: run } = await s.from("growth_runs").select("id, project_id").order("created_at",{ascending:false}).limit(1).single();
  console.log("target project:", run!.project_id);
  const { error } = await s.from("projects").delete().eq("id", run!.project_id);
  console.log(error ? "FAILED: "+error.message : "deleted");
}
main();
