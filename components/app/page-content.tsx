import { cn } from "@/lib/utils";

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

/** Wraps page content with a subtle entrance animation. */
export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn("animate-fade-in", className)}>
      {children}
    </div>
  );
}
