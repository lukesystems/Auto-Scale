import { redirect } from "next/navigation";

interface PageProps {
  params: { id: string };
}

export default function LegacyExperimentsRedirect({ params }: PageProps) {
  redirect(`/projects/${params.id}/growth`);
}
