import Link from "next/link";
import { SignUpForm } from "./sign-up-form";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-xl shadow-primary/5">
      <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary text-[10px]">
        Free to start
      </Badge>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Build your growth engine</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Create an account and launch your first content experiment loop in minutes.
      </p>

      <div className="mt-7">
        <SignUpForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have one?{" "}
        <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <p className="mt-5 text-center text-[11px] text-muted-foreground">
        By signing up you agree to use AutoScale responsibly. No spam, ever.
      </p>
    </div>
  );
}
