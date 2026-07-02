import { redirect } from "next/navigation";

interface PageProps {
  params: { id: string };
}

/**
 * Pivot note: legacy text-loop winners deprecated. Video winners now live at
 * `/projects/[id]/growth/winners`.
 */
export default function LegacyWinnersRedirect({ params }: PageProps) {
  redirect(`/projects/${params.id}/growth/winners`);
}
