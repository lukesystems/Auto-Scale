"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";

export function ProjectsNewModalHost() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const open = searchParams.get("new") === "1";

  const onClose = useCallback(() => {
    router.replace("/projects");
  }, [router]);

  return <NewProjectDialog open={open} onClose={onClose} />;
}
