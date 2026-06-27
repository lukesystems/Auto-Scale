import type { ProductSiteFact } from "../types";
import type { PageFacts } from "./llm-extract";

export function pageFactsToProductFacts(
  pageFacts: PageFacts,
  sourceUrl: string
): ProductSiteFact[] {
  const facts: ProductSiteFact[] = [];
  const confidence =
    pageFacts.relevance_score >= 0.7 ? "high" : pageFacts.relevance_score >= 0.4 ? "medium" : "low";

  if (pageFacts.page_intent) {
    facts.push({
      factType: "other",
      factKey: "page_intent",
      factValue: pageFacts.page_intent,
      confidence,
      evidenceSnippet: pageFacts.page_intent,
      sourceUrl,
    });
  }

  for (const signal of pageFacts.audience_signals) {
    facts.push({
      factType: "audience",
      factKey: "audience_signal",
      factValue: signal,
      confidence,
      evidenceSnippet: signal,
      sourceUrl,
    });
  }

  for (const prop of pageFacts.value_props) {
    facts.push({
      factType: "benefit",
      factKey: "value_prop",
      factValue: prop,
      confidence,
      evidenceSnippet: prop,
      sourceUrl,
    });
  }

  for (const feature of pageFacts.features) {
    facts.push({
      factType: "feature",
      factKey: "feature",
      factValue: feature,
      confidence,
      evidenceSnippet: feature,
      sourceUrl,
    });
  }

  for (const price of pageFacts.pricing_mentions) {
    facts.push({
      factType: "pricing",
      factKey: "pricing_mention",
      factValue: price,
      confidence: "high",
      evidenceSnippet: price,
      sourceUrl,
    });
  }

  for (const proof of pageFacts.social_proof) {
    facts.push({
      factType: "other",
      factKey: "social_proof",
      factValue: proof,
      confidence,
      evidenceSnippet: proof,
      sourceUrl,
    });
  }

  for (const cta of pageFacts.ctas) {
    facts.push({
      factType: "cta",
      factKey: "cta",
      factValue: cta,
      confidence: "high",
      evidenceSnippet: cta,
      sourceUrl,
    });
  }

  for (const objection of pageFacts.objections) {
    facts.push({
      factType: "pain_point",
      factKey: "objection",
      factValue: objection,
      confidence,
      evidenceSnippet: objection,
      sourceUrl,
    });
  }

  return facts;
}

export function summarizeLlmFacts(
  classified: Array<{ pageType: string; facts: ProductSiteFact[]; relevance?: number }>
): string {
  const byType = new Map<string, string[]>();
  for (const item of classified) {
    for (const fact of item.facts) {
      const key = fact.factType;
      const list = byType.get(key) ?? [];
      if (!list.includes(fact.factValue)) list.push(fact.factValue);
      byType.set(key, list);
    }
  }

  const lines: string[] = [];
  for (const [type, values] of byType) {
    lines.push(`${type}: ${values.slice(0, 12).join(" | ")}`);
  }
  return lines.join("\n");
}
