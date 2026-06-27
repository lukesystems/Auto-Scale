"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, requireUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { materializeWinnerVariants } from "@/services/compound/materialize-winner";

const CompoundWinnerSchema = z.object({
  projectId: z.string().uuid(),
  experimentResultId: z.string().uuid(),
  videoId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export async function compoundWinnerAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const user = await requireUser();
  const parsed = CompoundWinnerSchema.safeParse({
    projectId: formData.get("projectId"),
    experimentResultId: formData.get("experimentResultId"),
    videoId: formData.get("videoId"),
    growthRunId: formData.get("growthRunId"),
  });
  if (!parsed.success) return;

  const supabase = createSupabaseServerClient();
  await materializeWinnerVariants({
    client: supabase,
    projectId: parsed.data.projectId,
    ownerId: user.id,
    sourceGrowthRunId: parsed.data.growthRunId,
    sourceVideoId: parsed.data.videoId,
    experimentResultId: parsed.data.experimentResultId,
  });

  revalidatePath(`/projects/${parsed.data.projectId}/growth/winners`);
  revalidatePath(`/projects/${parsed.data.projectId}/growth`);
}
