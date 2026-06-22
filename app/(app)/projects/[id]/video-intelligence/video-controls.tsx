"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Radar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { discoverVideoEvidenceAction, importVideoUrlsAction } from "./actions";

export function VideoControls({ projectId, hasBrief }: { projectId: string; hasBrief: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [importPending, startImport] = useTransition();
  const [discoveryPending, startDiscovery] = useTransition();

  function importUrls(formData: FormData) {
    formData.set("project_id", projectId);
    startImport(async () => {
      const result = await importVideoUrlsAction(formData);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Saved ${result.saved} public video evidence item${result.saved === 1 ? "" : "s"}${result.failed ? `; ${result.failed} failed` : ""}.`);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function discover() {
    startDiscovery(async () => {
      const toastId = toast.loading("Searching public short-form video evidence…");
      const result = await discoverVideoEvidenceAction(projectId);
      if (!result.ok) return void toast.error(result.error, { id: toastId });
      toast.success(`Saved ${result.saved} public video evidence item${result.saved === 1 ? "" : "s"}.`, { id: toastId });
      router.refresh();
    });
  }

  const pending = importPending || discoveryPending;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <form ref={formRef} action={importUrls} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="video_urls">Add video/account URLs</Label>
          <Textarea
            id="video_urls"
            name="urls"
            rows={4}
            required
            placeholder={"https://tiktok.com/@creator/video/123\nhttps://instagram.com/reel/ABC\nhttps://youtube.com/shorts/XYZ"}
          />
          <p className="text-xs text-muted-foreground">One or more public TikTok, Reels, Shorts, or creator profile URLs.</p>
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {importPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add public evidence
        </Button>
      </form>
      <Button type="button" onClick={discover} disabled={pending || !hasBrief} title={!hasBrief ? "Save a Product Brief first" : undefined}>
        {discoveryPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
        Discover public video evidence
      </Button>
    </div>
  );
}
