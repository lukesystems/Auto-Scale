import { PageHeader } from "@/components/app/page-header";
import { RunsPoll } from "@/components/app/runs-poll";

interface PageProps {
  params: { id: string };
}

export const metadata = { title: "Run Center" };

export default function RunsPage({ params }: PageProps) {
  return (
    <div className="container space-y-6 py-8">
      <PageHeader
        title="Run Center"
        description="Live status for Growth Runs, TrendHop scans, source discovery, and recent AI calls. Refreshes every 3 seconds."
      />
      <RunsPoll projectId={params.id} />
    </div>
  );
}
