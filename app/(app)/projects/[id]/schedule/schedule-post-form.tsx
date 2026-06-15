"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { schedulePostAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props { projectId: string; postId: string; defaultPlatform: string }

export function SchedulePostForm({ projectId, postId, defaultPlatform }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const defaultIso = defaultDate.toISOString().slice(0, 16);

  function onSubmit(formData: FormData) {
    formData.set("project_id", projectId);
    formData.set("post_id", postId);
    startTransition(async () => {
      const result = await schedulePostAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Scheduled. Experiment record created.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`channel-${postId}`} className="text-xs">Channel / platform</Label>
          <Input
            id={`channel-${postId}`}
            name="channel"
            defaultValue={defaultPlatform}
            className="h-9 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`when-${postId}`} className="text-xs">When</Label>
          <Input
            id={`when-${postId}`}
            type="datetime-local"
            name="scheduled_for"
            defaultValue={defaultIso}
            className="h-9 text-sm"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending} size="sm" className="w-full">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Schedule
      </Button>
    </form>
  );
}
