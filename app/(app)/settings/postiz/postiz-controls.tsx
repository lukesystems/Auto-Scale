"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncPostizChannelsAction, testPostizConnectionAction } from "./actions";

export function PostizControls() {
  const router = useRouter();
  const [testing, startTesting] = useTransition();
  const [syncing, startSyncing] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={testing}
        onClick={() => startTesting(async () => {
          const result = await testPostizConnectionAction();
          result.ok ? toast.success(result.message) : toast.error(result.error);
        })}
      >
        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
        Test connection
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={syncing}
        onClick={() => startSyncing(async () => {
          const result = await syncPostizChannelsAction();
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })}
      >
        {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Sync channels
      </Button>
    </div>
  );
}
