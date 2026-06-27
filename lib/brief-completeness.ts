export interface BriefCompletenessInput {
  product_summary?: string | null;
  one_line_description?: string | null;
  target_customer?: string | null;
  primary_pain?: string | null;
}

export function isBriefComplete(brief: BriefCompletenessInput | null | undefined): boolean {
  if (!brief) return false;
  const summary = (brief.product_summary ?? brief.one_line_description ?? "").trim();
  const customer = (brief.target_customer ?? "").trim();
  const pain = (brief.primary_pain ?? "").trim();
  return Boolean(summary && customer && pain);
}

export function briefCompletenessError(): string {
  return "Complete your Product Brief (summary, target customer, and primary pain) before running discovery.";
}
