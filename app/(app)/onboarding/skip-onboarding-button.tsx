"use client";

import { useTransition } from "react";
import { skipOnboardingAction } from "./skip-action";
import { Button } from "@/components/ui/button";

export function SkipOnboardingButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => skipOnboardingAction())}
      className="text-muted-foreground"
    >
      {pending ? "Skipping…" : "Skip for now"}
    </Button>
  );
}
