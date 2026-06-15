import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface ProjectHeaderProps {
  projectId: string;
  projectName: string;
  niche?: string | null;
}

export function ProjectHeader({ projectId, projectName, niche }: ProjectHeaderProps) {
  return (
    <div className="border-b border-border/60 bg-muted/30">
      <div className="container py-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
          <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-none">
            {projectName}
          </span>
          {niche && (
            <>
              <span className="hidden sm:inline text-border">·</span>
              <span className="hidden sm:inline truncate max-w-xs">{niche}</span>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
