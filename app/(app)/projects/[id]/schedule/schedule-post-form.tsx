"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { schedulePostAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChannelOption {
  integrationId: string;
  name: string;
  platform: string;
}

interface Props {
  projectId: string;
  postId: string;
  defaultPlatform: string;
  channels: ChannelOption[];
}

export function SchedulePostForm({ projectId, postId, defaultPlatform, channels }: Props) {
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
          {channels.length > 0 ? (
            <select
              id={`channel-${postId}`}
              name="channel"
              defaultValue={channels.find((channel) => channel.platform === defaultPlatform)?.integrationId ?? channels[0]?.integrationId}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              required
            >
              {channels.map((channel) => (
                <option key={channel.integrationId} value={channel.integrationId}>
                  {channel.name} ({channel.platform})
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={`channel-${postId}`}
              name="channel"
              defaultValue={defaultPlatform}
              className="h-9 text-sm"
              required
            />
          )}
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
