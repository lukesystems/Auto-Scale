"use client";

import { useFormStatus } from "react-dom";

export function StartRunSubmit() {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        aria-describedby="growth-run-submit-status"
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Running evidence → strategy → videos…" : "Start Growth Run"}
      </button>
      <span
        id="growth-run-submit-status"
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {pending ? "This run is saved. AutoScale will open its review when processing finishes." : ""}
      </span>
    </div>
  );
}
