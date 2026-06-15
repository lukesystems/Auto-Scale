import type { AIAdapter, GenerateTextParams, GenerateTextResult } from "../types";

/**
 * Deterministic mock adapter used in dev and tests.
 * Returns plausibly structured outputs based on the prompt's intent hint.
 *
 * The runtime detects intent from a leading "[[KIND]]" tag in the user prompt
 * (e.g. "[[product_brief]] ...", "[[trendwatch_analysis]] ...").
 * See services/ai/runtime.ts for usage.
 */
function detectKind(prompt: string): string | null {
  const m = prompt.match(/^\[\[([a-z_]+)\]\]/i);
  return m ? m[1]!.toLowerCase() : null;
}

const RESPONDERS: Record<string, () => unknown> = {
  product_brief: () => ({
    product_summary:
      "An AI-powered tool that helps technical founders turn proven content patterns into weekly growth experiments.",
    target_customer: "Solo and early-stage technical founders who can build but struggle with distribution.",
    primary_pain:
      "Building is easy. Getting users is hard. Founders don't know what to post, when, or why.",
    core_promise:
      "Reverse-engineer your niche, ship structured content experiments, and compound winners — without hiring marketing.",
    offer: "$149/month for the full growth loop.",
    cta: "Build my growth engine",
    competitors: [],
    content_pillars: [
      "Founder distribution lessons",
      "Niche reverse-engineering",
      "Content experiment teardowns",
      "Compounding wins",
    ],
    positioning_angles: [
      "You built the app. Nobody cares yet. Here's how to change that.",
      "Stop guessing what to post.",
      "Distribution is the new bottleneck.",
    ],
    production_constraints: {
      can_make_carousels: true,
      can_make_founder_videos: false,
      can_use_product_screenshots: true,
      can_use_ai_images: true,
      preferred_platforms: ["x", "linkedin", "tiktok"],
    },
    brand_voice: "Direct, technical, slightly contrarian. No hype. No fluff.",
  }),

  autobrief: () => ({
    product_name: "AutoScale",
    product_url: "https://autoscale.app",
    product_summary:
      "An AI-powered distribution OS that helps founders turn proven niche patterns into content experiments.",
    target_customer: "Non-technical and technical founders who can build but struggle with distribution.",
    primary_pain: "Founders don't know what to post, when, or why — so growth stalls after launch.",
    core_promise: "Find what works in your niche, ship structured experiments, and compound winners.",
    offer: "Starter plan from $49/mo",
    cta: "Start my growth loop",
    niche: "founder-led SaaS distribution",
    positioning_angles: [
      "You built the product. Distribution is the bottleneck.",
      "Stop guessing hooks — reverse-engineer what already works.",
      "Compound winners, don't chase vanity metrics.",
    ],
    content_pillars: [
      "Niche reverse-engineering",
      "Founder distribution lessons",
      "Content experiment teardowns",
      "Compounding wins",
    ],
    brand_voice: "Direct, plain English, no hype.",
    production_constraints: {
      can_make_carousels: true,
      can_make_founder_videos: false,
      can_use_product_screenshots: true,
      can_use_ai_images: true,
    },
    suggested_competitors: [
      { name: "Buffer", url: null, reason: "Scheduling competitor", confidence: 0.6 },
      { name: "Hypefury", url: null, reason: "Founder social tooling", confidence: 0.5 },
    ],
    suggested_sources: [
      { platform: "x", url: null, reason: "Founders share distribution playbooks on X", confidence: 0.7 },
      { platform: "linkedin", url: null, reason: "B2B SaaS founders post carousels on LinkedIn", confidence: 0.65 },
    ],
    confidence_score: 0.72,
    missing_information: ["Exact pricing tier", "Primary acquisition channel"],
  }),

  trendwatch_analysis: () => ({
    niche_summary:
      "A technical founder niche dominated by reverse-engineering teardowns, founder-led pain narratives, and tactical loop diagrams. Mid-sized accounts win with carousels over polished video.",
    competitor_map: [
      { name: "Competitor A", strength: "polished video", weakness: "no founder voice", account_type: "official" },
      { name: "Shadow account X", strength: "raw founder takes", weakness: "inconsistent cadence", account_type: "shadow" },
    ],
    shadow_account_targets: [
      "Solo SaaS founders posting raw build logs",
      "Indie hackers running content experiments in public",
      "Distribution-focused operators teaching their playbook",
    ],
    winning_formats: [
      { format: "problem-solution carousel", reason: "Encodes both pain and demo on slide 1." },
      { format: "tool teardown", reason: "Reads like research — high save rate." },
      { format: "before/after workflow", reason: "Shows transformation, drives self-projection." },
    ],
    hook_opportunities: [
      "You built the app. Nobody cares yet. Here's why.",
      "I analyzed 50 founder posts. 3 patterns drove every winner.",
      "Stop posting features. Start posting transformations.",
    ],
    recommended_experiments: [
      "Test a 6-slide problem-solution carousel on the most acute founder pain.",
      "Run a tool teardown of a competitor for a save-rate signal.",
      "Run a contrarian hook against generic 'AI content tool' positioning.",
    ],
    risk_flags: [
      "Avoid copying celebrity-creator hooks — distortion risk is high.",
      "Don't lean on production budget formats you can't replicate weekly.",
    ],
  }),

  source_classification: () => ({
    account_type: "shadow",
    follower_count: 4200,
    format: "problem-solution carousel",
    hook: "You built the app. Nobody cares yet.",
    angle: "Distribution is the bottleneck, not building.",
    visual_pattern: "Bold headline + body. Slide 1 isolates pain.",
    cta_pattern: "Soft CTA on final slide — comment a word to get the playbook.",
    audience_pain: "Technical founders who can't get attention post-launch.",
    why_it_worked: "Mid-size account, niche pain, save-worthy structure, transferable format.",
    how_to_adapt:
      "Replace the pain with your ICP's specific stuck moment. Keep slide 1 stark. Use 5–7 slides.",
    distortion_risk: "low",
    transferability_score: 0.85,
    signal_score: 0.78,
    recommended_experiments: [
      "Test 3 variants of the slide-1 headline.",
      "Test a founder-led version with face.",
    ],
  }),

  hooks: () => ({
    hooks: [
      { hook: "You built the app. Nobody cares yet. Here's why.", angle: "Pain → revelation" },
      { hook: "I shipped 12 products. 11 failed. Distribution killed them.", angle: "Vulnerability + lesson" },
      { hook: "Stop writing features. Start writing transformations.", angle: "Reframe" },
      { hook: "Your landing page is fine. Your distribution loop isn't.", angle: "Contrarian" },
      { hook: "3 things I'd do differently if I launched again tomorrow.", angle: "Hindsight playbook" },
      { hook: "I reverse-engineered 50 founder posts. Here's what worked.", angle: "Research teardown" },
      { hook: "The only growth loop that scales without you.", angle: "Promise" },
      { hook: "Why your 10x product gets 0.1x the attention.", angle: "Math hook" },
      { hook: "Marketing is just compounding learning. Most founders skip step 1.", angle: "Foundational" },
      { hook: "How to know which competitor to actually copy.", angle: "Tactical" },
      { hook: "The post format that turned my product into a growth machine.", angle: "Personal proof" },
      { hook: "Stop posting random things. Start running experiments.", angle: "Reframe" },
    ],
  }),

  content_ideas: () => ({
    ideas: [
      {
        format: "problem-solution carousel",
        hook: "You built the app. Nobody cares yet.",
        angle: "Distribution is the bottleneck",
        target_audience: "Solo SaaS founders post-launch",
        why_this_should_work:
          "Encodes acute pain on slide 1, then walks through a tractable system, ending with a soft CTA.",
        hypothesis: "Pain-first hooks drive saves from founders who feel stuck on distribution.",
        platforms: ["linkedin", "x"],
        metric_to_watch: "save_rate",
        risk_level: "low",
        variant_suggestions: ["founder-led video", "shorter 3-slide variant"],
      },
      {
        format: "tool teardown carousel",
        hook: "I tested 7 growth tools so you don't have to.",
        angle: "Research teardown",
        target_audience: "Founders evaluating their growth stack",
        why_this_should_work:
          "Reads like research, drives saves, and positions AutoScale as the missing intelligence layer.",
        hypothesis: "Tool teardowns drive high save rates and qualified profile clicks.",
        platforms: ["linkedin", "x", "tiktok"],
        metric_to_watch: "clicks",
        risk_level: "low",
        variant_suggestions: ["X thread version", "video teardown"],
      },
      {
        format: "before/after workflow carousel",
        hook: "From 0 posts/week to a system that runs itself.",
        angle: "Transformation",
        target_audience: "Founders overwhelmed by content",
        why_this_should_work: "Transformations sell. Self-projection is high.",
        hypothesis: "Transformation arcs convert better than feature lists.",
        platforms: ["linkedin", "tiktok"],
        metric_to_watch: "signups",
        risk_level: "medium",
        variant_suggestions: ["short founder-led video"],
      },
    ],
  }),

  generated_post: () => ({
    format: "problem-solution carousel",
    platform: "linkedin_carousel",
    hook: "You built the app. Nobody cares yet. Here's why.",
    angle: "Distribution is the new bottleneck",
    target_audience: "Solo technical founders post-launch",
    hypothesis: "Pain-first hook drives saves from founders stuck on distribution.",
    caption:
      "You built the app. Nobody cares yet.\n\nThe problem isn't your code. It's your distribution loop.\n\nA quick teardown of why most technical founders stall after launch — and what to do about it.",
    cta: "Run TrendWatch on your startup → autoscale.app",
    metric_to_watch: "save_rate",
    slides: [
      { slide_number: 1, headline: "You built the app.", body: "Nobody cares yet." },
      {
        slide_number: 2,
        headline: "The problem isn't your code.",
        body: "It's your distribution loop. Or the lack of one.",
      },
      {
        slide_number: 3,
        headline: "Building was the bottleneck.",
        body: "Now AI made building cheap. Attention is the new constraint.",
      },
      {
        slide_number: 4,
        headline: "Most founders post random things.",
        body: "Random outputs compound to zero.",
      },
      {
        slide_number: 5,
        headline: "Winners run experiments.",
        body: "Every post = a hypothesis + a metric to watch.",
      },
      {
        slide_number: 6,
        headline: "Compound the winners.",
        body: "Kill the losers. Repeat weekly.",
      },
      { slide_number: 7, headline: "Run TrendWatch on your startup.", body: "autoscale.app" },
    ],
  }),

  quality_gate: () => ({
    status: "pass",
    score: 0.87,
    failure_reasons: [],
    fix_instructions: [],
    risk_flags: [],
    approved_for_export: true,
  }),

  winner_diagnosis: () => ({
    winning_reason:
      "The pain-first hook + transferable carousel structure resonated with founders stuck post-launch. Save rate was 3.4× project average.",
    winning_elements: {
      hook: "You built the app. Nobody cares yet.",
      format: "problem-solution carousel",
      angle: "Distribution is the new bottleneck",
      audience: "Solo technical founders post-launch",
      cta: "Run TrendWatch on your startup",
      visual_style: "Bold headline + concise body, no AI-looking imagery",
    },
    recommended_next_actions: [
      "Generate 10 variants on the same hook with different ICPs.",
      "Test a founder-led video remix.",
      "Build next week's plan around save-rate hooks.",
    ],
    variant_plan: [
      { hook: "You shipped the app. The market still doesn't know.", angle: "Reframe" },
      { hook: "Your landing page is fine. Your distribution isn't.", angle: "Contrarian" },
      { hook: "Building was the easy part. Now what?", angle: "Question" },
      { hook: "From 0 to 1 was hard. From 1 to noticed is harder.", angle: "Journey" },
      { hook: "Your product is great. Nobody is looking.", angle: "Direct" },
      { hook: "Shipping = step 1. Distribution = step 0-100.", angle: "Math" },
      { hook: "The new bottleneck isn't code.", angle: "Industry shift" },
      { hook: "Why your 10x product gets 0.1x attention.", angle: "Math hook" },
      { hook: "You don't have a product problem. You have a distribution problem.", angle: "Diagnosis" },
      { hook: "Built it. Shipped it. Now build the loop.", angle: "Sequence" },
    ],
    learning_to_store:
      "Pain-first hooks targeted at post-launch founders drive 3×+ save rates. Keep slide-1 stark, max 7 slides, no AI imagery.",
  }),

  variants: () => ({
    variants: [
      { hook: "You shipped the app. The market still doesn't know.", angle: "Reframe" },
      { hook: "Your landing page is fine. Your distribution isn't.", angle: "Contrarian" },
      { hook: "Building was the easy part. Now what?", angle: "Question" },
      { hook: "From 0 to 1 was hard. From 1 to noticed is harder.", angle: "Journey" },
      { hook: "Your product is great. Nobody is looking.", angle: "Direct" },
      { hook: "Shipping = step 1. Distribution = step 0-100.", angle: "Math" },
      { hook: "The new bottleneck isn't code.", angle: "Industry shift" },
      { hook: "Why your 10x product gets 0.1x attention.", angle: "Math hook" },
      { hook: "You don't have a product problem.", angle: "Diagnosis" },
      { hook: "Built it. Shipped it. Now build the loop.", angle: "Sequence" },
    ],
  }),
};

export const mockAdapter: AIAdapter = {
  name: "mock",
  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const started = Date.now();
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));

    const kind = detectKind(params.prompt);
    const responder = kind ? RESPONDERS[kind] : null;
    const payload = responder ? responder() : { text: "Mock provider response. Configure a real provider in /settings." };
    const text = JSON.stringify(payload, null, 2);

    return {
      text,
      provider: "mock",
      model: params.model ?? "mock-default",
      latencyMs: Date.now() - started,
      promptTokens: Math.round(params.prompt.length / 4),
      completionTokens: Math.round(text.length / 4),
      costEstimate: 0,
      rawResponse: payload,
    };
  },
};
