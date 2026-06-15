import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="container py-20 flex flex-col items-center text-center animate-fade-in">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FolderOpen className="h-6 w-6" />
      </div>
      <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">Project not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        This project doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Button asChild className="mt-6" variant="outline">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </Button>
    </div>
  );
}
