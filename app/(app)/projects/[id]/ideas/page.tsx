import { redirect } from "next/navigation";

interface PageProps {
  params: { id: string };
}

/**
 * Pivot note: legacy text-loop "Ideas" surface deprecated. Growth Run is the
 * sole loop. Redirecting to Growth Run hub.
 */
export default function LegacyIdeasRedirect({ params }: PageProps) {
  redirect(`/projects/${params.id}/growth`);
}
