import { AlertTriangle } from "lucide-react";

export function ConfigBanner() {
  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="container py-2.5 flex items-center gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <div className="flex-1">
          <span className="font-medium text-foreground">Supabase isn&apos;t configured yet.</span>{" "}
          <span className="text-muted-foreground">
            Copy <code className="font-mono text-xs">.env.example</code> to <code className="font-mono text-xs">.env.local</code>, fill in the keys, run the migration in <code className="font-mono text-xs">supabase/migrations</code>, and restart.
          </span>
        </div>
      </div>
    </div>
  );
}
