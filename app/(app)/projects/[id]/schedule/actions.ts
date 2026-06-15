"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { sendToPostiz } from "@/services/postiz/client";
import { checkChainIntegrity } from "@/lib/chain-integrity";

const Schema = z.object({
  project_id: z.string().uuid(),
  post_id: z.string().uuid(),
  channel: z.string().min(1, "Channel is required."),
  scheduled_for: z.string().min(1, "Schedule date is required."),
});

export type ScheduleResult = { ok: true; scheduledId: string } | { ok: false; error: string };

export async function schedulePostAction(formData: FormData): Promise<ScheduleResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = Schema.safeParse({
    project_id: formData.get("project_id"),
    post_id: formData.get("post_id"),
    channel: formData.get("channel"),
    scheduled_for: formData.get("scheduled_for"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [{ data: post }, { data: connection }] = await Promise.all([
    supabase
      .from("generated_posts")
      .select("id, project_id, platform, caption, cta, hook, status")
      .eq("id", parsed.data.post_id)
      .maybeSingle(),
    supabase
      .from("postiz_connections")
      .select("api_url, api_key")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);
  if (!post) return { ok: false, error: "Post not found." };
  if (post.project_id !== parsed.data.project_id) {
    return { ok: false, error: "Cross-project boundary violation: Post belongs to a different project." };
  }
  if (post.status !== "approved") return { ok: false, error: "Only approved posts can be scheduled." };

  const integrity = await checkChainIntegrity(supabase, {
    projectId: parsed.data.project_id,
    postId: parsed.data.post_id,
  });
  if (!integrity.ok) return { ok: false, error: integrity.error ?? "Chain integrity check failed." };

  const { data: slides } = await supabase
    .from("post_slides")
    .select("slide_number, headline, body")
    .eq("post_id", parsed.data.post_id)
    .order("slide_number", { ascending: true });

  const payload = {
    channel: parsed.data.channel,
    scheduledFor: new Date(parsed.data.scheduled_for).toISOString(),
    caption: post.caption ?? post.hook ?? "",
    cta: post.cta ?? undefined,
    platform: post.platform,
    slides: (slides ?? []).map((s) => ({ headline: s.headline ?? "", body: s.body ?? "" })),
    externalRef: post.id,
  };

  // Insert scheduled_post row first (pending)
  const { data: row, error } = await supabase
    .from("scheduled_posts")
    .insert({
      project_id: parsed.data.project_id,
      post_id: post.id,
      platform: post.platform,
      channel: parsed.data.channel,
      scheduled_for: payload.scheduledFor,
      postiz_payload: payload as never,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "Failed to create schedule." };

  // Send to Postiz if configured
  let finalStatus = "pending";
  let errorMessage: string | null = null;
  let postizResponse: unknown = {};

  if (connection?.api_url && connection?.api_key) {
    const response = await sendToPostiz(
      { apiUrl: connection.api_url, apiKey: connection.api_key },
      payload
    );
    finalStatus = response.ok ? "scheduled" : "failed";
    errorMessage = response.error ?? null;
    postizResponse = response.raw ?? {};
  } else {
    finalStatus = "queued_local";
    errorMessage = "Postiz not connected — saved locally. Configure in /settings/postiz to send.";
  }

  await supabase
    .from("scheduled_posts")
    .update({
      status: finalStatus,
      error_message: errorMessage,
      postiz_response: postizResponse as never,
    })
    .eq("id", row.id);

  // Mark post scheduled if Postiz accepted
  if (finalStatus === "scheduled") {
    await supabase.from("generated_posts").update({ status: "scheduled" }).eq("id", post.id);
  }

  // Auto-create experiment row
  await supabase.from("experiments").insert({
    project_id: parsed.data.project_id,
    post_id: post.id,
    scheduled_post_id: row.id,
    status: "approved",
    posted_at: null,
  });

  revalidatePath(`/projects/${parsed.data.project_id}/schedule`);
  revalidatePath(`/projects/${parsed.data.project_id}/experiments`);
  revalidatePath(`/projects/${parsed.data.project_id}`);
  return { ok: true, scheduledId: row.id };
}
