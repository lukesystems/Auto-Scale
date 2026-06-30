import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export interface ProductionProviderStatus {
  ffmpeg: { ok: boolean; message: string };
  fal: { ok: boolean; message: string };
  elevenlabs: { ok: boolean; message: string };
}

function ProviderPill({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean;
  hint?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      }`}
      title={hint}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function ProductionProviderBar({ status }: { status: ProductionProviderStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Production readiness
      </span>
      <ProviderPill label="FFmpeg" ok={status.ffmpeg.ok} hint={status.ffmpeg.message} />
      <ProviderPill label="Fal / Seedance" ok={status.fal.ok} hint={status.fal.message} />
      <ProviderPill
        label="ElevenLabs"
        ok={status.elevenlabs.ok}
        hint={status.elevenlabs.message}
      />
      {!status.elevenlabs.ok ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          Music-only works without ElevenLabs
        </span>
      ) : null}
    </div>
  );
}
