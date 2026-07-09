import Link from "next/link";
import { SignInForm } from "./sign-in-form";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-xl shadow-primary/5">
      <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary text-[10px]">
        Welcome back
      </Badge>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in to AutoScale Shorts</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your winners are waiting to compound. Pick up where you left off.
      </p>

      <div className="mt-7">
        <SignInForm next={searchParams.next} />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
