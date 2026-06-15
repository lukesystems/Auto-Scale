"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2Off, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { disconnectPostizAction, savePostizConnectionAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PostizForm({ initial }: { initial: { api_url: string; has_key: boolean } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, startRemoving] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await savePostizConnectionAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Postiz connection saved.");
      router.refresh();
    });
  }

  function onDisconnect() {
    if (!confirm("Disconnect Postiz?")) return;
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
      <div className="space-y-1.5">
        <Label htmlFor="api_url">Postiz API URL</Label>
        <Input id="api_url" name="api_url" type="url" defaultValue={initial.api_url} placeholder="https://api.postiz.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="api_key">API key</Label>
        <Input
          id="api_key"
          name="api_key"
          type="password"
          defaultValue={initial.has_key ? "**********" : ""}
          placeholder="pst_..."
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
    </form>
  );
}
