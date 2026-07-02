import { redirectToActiveRun } from "@/lib/redirect-to-active-run";

interface PageProps {
  params: { id: string };
}

export default async function TrendWatchScheduleRedirectPage({ params }: PageProps) {
  await redirectToActiveRun(params.id, "trendhop");
}
