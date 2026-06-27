import Link from "next/link";
import { GitBranch, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/app/page-header";

interface PageProps {
  params: { id: string };
}

export const metadata = { title: "Variants" };

/**
 * Variants library — for now this is an entry point. Variant generation is
 * wired through the Growth Run orchestrator on exploitation batches; the v1
 * library lives here so the sidebar links resolve cleanly.
 */
export default function VariantsPage({ params }: PageProps) {
  return (
    <div className="container space-y-6 py-8">
      <PageHeader
        title="Variants"
        description="Compounded variants of winning videos. Generated automatically on exploitation Growth Runs."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${params.id}/growth`}>
              <Rocket className="h-4 w-4" /> Growth Run hub
            </Link>
          </Button>
        }
      />
      <EmptyState
        icon={<GitBranch className="h-5 w-5" />}
        title="No variants yet"
        description="Mark winners on the Winners surface to queue variant generation for the next Growth Run."
        action={
          <Button asChild variant="glow">
            <Link href={`/projects/${params.id}/growth/winners`}>Open Winners</Link>
          </Button>
        }
      />
    </div>
  );
}
