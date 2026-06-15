import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

export function PageHeader({ title, description, actions, className, badge }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1.5">
        {badge && <div>{badge}</div>}
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-sm md:text-base text-muted-foreground max-w-2xl text-balance">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border border-dashed border-border rounded-xl bg-card/40 p-10 text-center">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] to-transparent" />
      {icon && (
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/5">
          {icon}
        </div>
      )}
      <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto text-balance">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
