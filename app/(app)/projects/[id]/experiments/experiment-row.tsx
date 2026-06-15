"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { updateExperimentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Experiment {
  id: string;
  status: string;
  posted_at: string | null;
  views: number | null;
  saves: number | null;
  shares: number | null;
  comments: number | null;
  clicks: number | null;
  signups: number | null;
  purchases: number | null;
  revenue: number | null;
  notes: string | null;
  hook: string;
  format: string | null;
  platform: string | null;
  metric_to_watch: string | null;
}

const STATUSES = ["draft", "approved", "posted", "measured", "winner", "neutral", "loser", "killed"];

export function ExperimentRow({ projectId, experiment }: { projectId: string; experiment: Experiment }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("project_id", projectId);
    formData.set("experiment_id", experiment.id);
    startTransition(async () => {
      const result = await updateExperimentAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved.");
      router.refresh();
    });
  }

  return (
    <div className="">
      <div className="px-5 py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-secondary/30" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <StatusBadge status={experiment.status} />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{experiment.hook}</div>
            <div className="text-xs text-muted-foreground">
              {experiment.platform ?? "—"} · {experiment.format ?? "—"}
              {experiment.metric_to_watch && <> · watch <span className="text-primary font-mono">{experiment.metric_to_watch}</span></>}
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
          <Metric label="Views" value={experiment.views} />
          <Metric label="Saves" value={experiment.saves} />
          <Metric label="Clicks" value={experiment.clicks} />
          <Metric label="Signups" value={experiment.signups} />
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <form action={onSubmit} className="px-5 pb-5 pt-2 bg-secondary/30 border-t border-border space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumberField name="views" label="Views" defaultValue={experiment.views} />
            <NumberField name="saves" label="Saves" defaultValue={experiment.saves} />
            <NumberField name="shares" label="Shares" defaultValue={experiment.shares} />
            <NumberField name="comments" label="Comments" defaultValue={experiment.comments} />
            <NumberField name="clicks" label="Clicks" defaultValue={experiment.clicks} />
            <NumberField name="signups" label="Signups" defaultValue={experiment.signups} />
            <NumberField name="purchases" label="Purchases" defaultValue={experiment.purchases} />
            <NumberField name="revenue" label="Revenue ($)" defaultValue={experiment.revenue} step="0.01" />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`status-${experiment.id}`} className="text-xs">Status</Label>
              <select id={`status-${experiment.id}`} name="status" defaultValue={experiment.status} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor={`notes-${experiment.id}`} className="text-xs">Founder notes</Label>
              <Textarea id={`notes-${experiment.id}`} name="notes" rows={2} defaultValue={experiment.notes ?? ""} placeholder="What worked? What surprised you?" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save metrics
            </Button>
            {experiment.status !== "winner" && (
              <MarkWinnerButton projectId={projectId} experimentId={experiment.id} />
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function MarkWinnerButton({ projectId, experimentId }: { projectId: string; experimentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function mark() {
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("experiment_id", experimentId);
    fd.set("status", "winner");
    startTransition(async () => {
      const result = await updateExperimentAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Marked as winner. Head to Winners to compound.");
      router.refresh();
    });
  }
  return (
    <Button type="button" size="sm" variant="default" onClick={mark} disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
      Mark as winner
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    winner: "success",
    measured: "default",
    neutral: "secondary",
    loser: "destructive",
    killed: "destructive",
    posted: "default",
    approved: "secondary",
    draft: "secondary",
  };
  return <Badge variant={map[status] ?? "secondary"}>{status}</Badge>;
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="font-mono">
      <span className="text-muted-foreground">{label}</span> {value ?? "—"}
    </span>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  step,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        step={step}
        min={0}
        defaultValue={defaultValue ?? ""}
        className="h-9 text-sm"
      />
    </div>
  );
}
