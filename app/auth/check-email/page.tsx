import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Check your email" };

export default function CheckEmailPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = searchParams.next?.startsWith("/projects?new=1") ? searchParams.next : "/projects?new=1";

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-xl text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mail className="h-5 w-5" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We just sent you a confirmation link. Click it to finish creating your account, then AutoScale Shorts will reopen
        project creation with your product URL saved.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href={`/auth/sign-in?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
      </Button>
    </div>
  );
}
