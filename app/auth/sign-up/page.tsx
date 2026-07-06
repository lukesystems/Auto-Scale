import Link from "next/link";
import { SignUpForm } from "./sign-up-form";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Create your account" };

export default function SignUpPage({ searchParams }: { searchParams: { url?: string } }) {
  const productUrl = searchParams.url?.trim() ?? "";

  return (
    <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-xl shadow-primary/5">
      <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary text-[10px]">
        {productUrl ? "Step 1 of 2 · Your URL is saved" : "Paste your URL in 2 minutes"}
      </Badge>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Start your first Growth Run</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {productUrl
          ? "Create an account — we'll open your project with your product URL pre-filled."
          : "No onboarding form. AutoScale reads your site and builds your Product Brief automatically."}
      </p>

      {productUrl ? (
        <p className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs font-mono text-foreground/80 truncate">
          {productUrl}
        </p>
      ) : null}

      <div className="mt-7">
        <SignUpForm productUrl={productUrl} />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have one?{" "}
        <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <p className="mt-5 text-center text-[11px] text-muted-foreground">
        You approve videos before anything posts. No spam, ever.
      </p>
    </div>
  );
}
