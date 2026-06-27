import Link from "next/link";
import { Lightbulb, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/app/page-header";

interface PageProps {
  params: { id: string };
}

export const metadata = { title: "Learnings" };

export default function LearningsPage({ params }: PageProps) {
  return (
    <div className="container space-y-6 py-8">
      <PageHeader
        title="Learnings"
        description="What we learned from each kill / winner. Compounds across Growth Runs."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${params.id}/growth`}>
              <Rocket className="h-4 w-4" /> Growth Run hub
            </Link>
          </Button>
        }
      />
      <EmptyState
        icon={<Lightbulb className="h-5 w-5" />}
        title="No learnings yet"
        description="Once metrics come back and videos are classified, learnings will appear here as durable insights."
      />
    </div>
  );
}
