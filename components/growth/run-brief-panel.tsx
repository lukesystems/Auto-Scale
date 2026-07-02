import { formatBriefField } from "@/lib/format-brief-field";

export interface RunBriefData {
  product_name?: string | null;
  one_line_description?: string | null;
  product_summary?: string | null;
  what_it_does?: string | null;
  target_customer?: string | null;
  primary_pain?: string | null;
  core_promise?: string | null;
  offer?: string | null;
  cta?: string | null;
  niche?: string | null;
  category?: string | null;
  key_features?: unknown;
  positioning_angles?: unknown;
}

export function RunBriefPanel({ brief, modelSlug }: { brief: RunBriefData; modelSlug?: string | null }) {
  const features = Array.isArray(brief.key_features)
    ? brief.key_features.filter((f): f is string => typeof f === "string")
    : [];
  const angles = Array.isArray(brief.positioning_angles)
    ? brief.positioning_angles.filter((a): a is string => typeof a === "string")
    : [];

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-lg font-semibold">{brief.product_name ?? "Product"}</h3>
        {brief.one_line_description ? (
          <p className="text-muted-foreground mt-1">{brief.one_line_description}</p>
        ) : null}
      </div>

      {brief.product_summary ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h4>
          <p className="leading-relaxed">{brief.product_summary}</p>
        </section>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        <BriefRow label="Target customer" value={formatBriefField(brief.target_customer)} />
        <BriefRow label="Primary pain" value={formatBriefField(brief.primary_pain)} />
        <BriefRow label="Core promise" value={formatBriefField(brief.core_promise)} />
        <BriefRow label="Niche" value={formatBriefField(brief.niche ?? brief.category)} />
        <BriefRow label="Offer" value={formatBriefField(brief.offer)} />
        <BriefRow label="CTA" value={formatBriefField(brief.cta)} />
      </dl>

      {brief.what_it_does ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it does</h4>
          <p className="leading-relaxed">{brief.what_it_does}</p>
        </section>
      ) : null}

      {features.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key features</h4>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {features.slice(0, 8).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {angles.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Positioning angles</h4>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {angles.slice(0, 6).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {modelSlug ? (
        <p className="text-xs text-muted-foreground pt-1 border-t border-border">Model: {modelSlug}</p>
      ) : null}
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 leading-snug">{value}</dd>
    </div>
  );
}
