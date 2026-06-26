"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2Off, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  disconnectPostizAction,
  savePostBridgeConnectionAction,
  savePostizConnectionAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PostizControls } from "./postiz-controls";

type ProviderId = "postiz" | "postbridge" | "export_only";

export function PostizForm({
  providerId,
  initial,
}: {
  providerId: ProviderId;
  initial: { api_url: string; has_key: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, startRemoving] = useTransition();
  const label =
    providerId === "postbridge" ? "Post Bridge" : providerId === "export_only" ? "Export" : "Postiz";

  if (providerId === "export_only") {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Export-only mode is active. No remote publishing credentials are required.</p>
        <p>Set <code className="text-xs">PUBLISHING_PROVIDER=postiz</code> on the server to re-enable Postiz scheduling.</p>
      </div>
    );
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result =
        providerId === "postbridge"
          ? await savePostBridgeConnectionAction(formData)
          : await savePostizConnectionAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? `${label} connection saved.`);
      router.refresh();
    });
  }

  function onDisconnect() {
    if (!confirm(`Disconnect ${label}?`)) return;
    startRemoving(async () => {
      const result = await disconnectPostizAction();
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
      {providerId === "postiz" && (
        <div className="space-y-1.5">
          <Label htmlFor="api_url">Postiz API URL</Label>
          <Input
            id="api_url"
            name="api_url"
            type="url"
            defaultValue={initial.api_url}
            placeholder="https://api.postiz.com"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="api_key">API key</Label>
        <Input
          id="api_key"
          name="api_key"
          type="password"
          defaultValue={initial.has_key ? "**********" : ""}
          placeholder={providerId === "postbridge" ? "pb_live_..." : "pst_..."}
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
      {initial.has_key && <PostizControls />}
    </form>
  );
}
