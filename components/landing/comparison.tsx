import { Check, Minus } from "lucide-react";

const ROWS = [
  {
    label: "Starts from",
    generic: "Blank prompt",
    calendar: "Empty content slots",
    autoscale: "Your product URL + niche evidence",
  },
  {
    label: "Output",
    generic: "One-off videos",
    calendar: "Scheduled posts",
    autoscale: "Measured video experiments",
  },
  {
    label: "Learns from results",
    generic: false,
    calendar: false,
    autoscale: true,
  },
  {
    label: "Compounds winners",
    generic: false,
    calendar: false,
    autoscale: true,
  },
  {
    label: "Evidence chain",
    generic: false,
    calendar: false,
    autoscale: true,
  },
] as const;

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-primary" />
    ) : (
      <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />
    );
  }
  return <span className="text-sm text-foreground/80">{value}</span>;
}

export function Comparison() {
  return (
    <section id="compare" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Why not the usual tools</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            A growth engine, not a generator.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            Generic AI video tools stop at output. Content calendars stop at scheduling. AutoScale Shorts runs the full loop.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-4xl overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-4 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[28%]" />
                <th className="pb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Generic AI video
                </th>
                <th className="pb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Content calendar
                </th>
                <th className="pb-4 pl-3 text-xs font-semibold uppercase tracking-wider text-primary">
                  AutoScale Shorts
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border/60">
                  <td className="py-4 pr-4 text-sm font-medium">{row.label}</td>
                  <td className="py-4 px-3 text-center">
                    <Cell value={row.generic} />
                  </td>
                  <td className="py-4 px-3 text-center">
                    <Cell value={row.calendar} />
                  </td>
                  <td className="py-4 pl-3 text-center rounded-lg bg-primary/[0.04]">
                    <Cell value={row.autoscale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
