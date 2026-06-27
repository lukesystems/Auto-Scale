import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { getPublishingProviderId } from "@/services/social-publishing";
import { getManagedPostBridgeCredentials } from "@/services/providers/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function ProviderReadinessChip({ projectId }: { projectId: string }) {
  const provider = getPublishingProviderId();
  const label = provider === "postbridge" ? "Post Bridge" : provider === "postiz" ? "Postiz" : "Export";
  const configured =
    provider === "postbridge"
      ? Boolean(getManagedPostBridgeCredentials())
      : provider === "postiz"
        ? Boolean(process.env.POSTIZ_API_KEY || process.env.AUTOSCALE_POSTIZ_API_KEY)
        : true;

  if (!isSupabaseConfigured()) return null;

  return (
    <Link
      href="/settings/providers"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        configured
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      }`}
    >
      {configured ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label} {configured ? "configured" : "not configured"}
    </Link>
  );
}
