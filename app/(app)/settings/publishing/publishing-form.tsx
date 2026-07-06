"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2Off, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { disconnectPostBridgeAction, savePostBridgeConnectionAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublishingControls } from "./publishing-controls";

export function PublishingForm({ initial }: { initial: { has_key: boolean } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, startRemoving] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await savePostBridgeConnectionAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Post Bridge connection saved.");
      router.refresh();
    });
  }

  function onDisconnect() {
    if (!confirm("Disconnect Post Bridge?")) return;
    startRemoving(async () => {
      const result = await disconnectPostBridgeAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Disconnected.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="api_key">Post Bridge API key</Label>
        <Input
          id="api_key"
          name="api_key"
          type="password"
          defaultValue={initial.has_key ? "**********" : ""}
          placeholder="pb_live_..."
        />
        <p className="text-xs text-muted-foreground">Leave masked value as-is to keep current key.</p>
      </div>

      <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save connection
        </Button>
        {initial.has_key && (
          <Button type="button" variant="ghost" onClick={onDisconnect} disabled={removing}>
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            Disconnect
          </Button>
        )}
      </div>
      {initial.has_key && <PublishingControls />}
    </form>
  );
}
