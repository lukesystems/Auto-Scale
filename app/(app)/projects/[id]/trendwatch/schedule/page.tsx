import { redirect } from "next/navigation";

interface PageProps {
  params: { id: string };
}

/**
 * Schedule editor lives on the main TrendWatch page; this route resolves the
 * sidebar entry and lands the user where the schedule controls live.
 */
export default function TrendWatchScheduleRedirect({ params }: PageProps) {
  redirect(`/projects/${params.id}/trendwatch`);
}
