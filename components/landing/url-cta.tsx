"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UrlCtaProps = {
  buttonLabel?: string;
  placeholder?: string;
  className?: string;
  size?: "default" | "large";
  showTrustLine?: boolean;
};

function buildSignUpHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "/auth/sign-up";
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return `/auth/sign-up?url=${encodeURIComponent(normalized)}`;
}

export function UrlCta({
  buttonLabel = "Find my winning format",
  placeholder = "https://yourproduct.com",
  className,
  size = "default",
  showTrustLine = false,
}: UrlCtaProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function go() {
    router.push(buildSignUpHref(url));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  }

  const isLarge = size === "large";

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:items-stretch",
          isLarge && "sm:gap-3"
        )}
      >
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Product URL"
            className={cn("pl-9", isLarge && "h-14 text-base")}
          />
        </div>
        <Button
          type="button"
          onClick={go}
          size={isLarge ? "xl" : "lg"}
          variant="glow"
          className={cn("shrink-0", isLarge ? "w-full sm:w-auto" : "w-full sm:w-auto")}
        >
          {buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {showTrustLine && (
        <p className="mt-3 text-xs text-muted-foreground text-center sm:text-left">
          No 30-question onboarding. No blank prompts. Just your product URL.
        </p>
      )}
    </div>
  );
}
