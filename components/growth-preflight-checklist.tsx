import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export interface PreflightItem {
  ok: boolean;
  label: string;
  detail?: string | null;
  remediation?: { label: string; href: string } | null;
}

interface PreflightProps {
  projectId: string;
  items: PreflightItem[];
}

/**
 * Pre-flight checklist rendered above the Start Growth Run button. All items
 * must be green before the run can be started; the start submit is disabled
 * by the parent based on `allGreen(items)`.
 */
export function GrowthPreflightChecklist({ items }: PreflightProps) {
  const allGreen = items.every((i) => i.ok);
  return (
    <section
      className={`rounded-lg border p-4 space-y-3 ${
        allGreen ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-amber-500/30 bg-amber-500/[0.04]"
      }`}
    >
      <div className="flex items-center gap-2">
        {allGreen ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        )}
        <h3 className="text-sm font-semibold">
          {allGreen ? "Ready to launch Growth Run" : "Pre-flight checks"}
        </h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {item.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <p className={item.ok ? "" : "font-medium"}>{item.label}</p>
              {item.detail && (
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              )}
            </div>
            {!item.ok && item.remediation && (
              <Link
                href={item.remediation.href}
                className="text-xs font-medium text-primary hover:underline"
              >
                {item.remediation.label} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function preflightAllGreen(items: PreflightItem[]): boolean {
  return items.every((i) => i.ok);
}
