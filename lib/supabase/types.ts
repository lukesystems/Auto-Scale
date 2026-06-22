// Minimal AutoScale database type bindings.
// This is a hand-written subset that mirrors the SQL migrations under
// /supabase/migrations. Generate full types with `supabase gen types` later.

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type ProjectStatus = "brief_generating" | "brief_failed" | "brief_saved" | "active" | "paused" | "archived";

export type SourcePlatform =
  | "tiktok"
  | "instagram"
  | "x"
  | "linkedin"
  | "youtube"
  | "threads"
  | "pinterest"
  | "reddit"
  | "facebook"
  | "other";

export type AccountType =
  | "official"
  | "competitor"
  | "shadow"
  | "creator"
  | "partner"
  | "affiliate"
  | "review"
  | "unknown";

export type DistortionRisk = "low" | "medium" | "high";

export type GeneratedPostStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "rejected"
  | "exported"
  | "scheduled"
  | "posted"
  | "archived";

export type QualityStatus = "pass" | "revise" | "fail";

export type ExperimentStatus =
  | "draft"
  | "approved"
  | "exported"
  | "posted"
  | "measured"
  | "winner"
  | "neutral"
  | "loser"
  | "variant_created"
  | "killed";

export type AIRunStatus = "pending" | "running" | "success" | "failed" | "validation_failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          subscription_status: string;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };

      user_settings: {
        Row: {
          id: string;
          owner_id: string;
          provider_mode: string;
          onboarding_completed: boolean;
          preferred_llm_mode: string | null;
          default_project_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_settings"]["Row"]> & { owner_id: string };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Row"]>;
        Relationships: [];
      };

      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string | null;
          niche: string | null;
          product_url: string | null;
          product_brief_id: string | null;
          description: string | null;
          status: ProjectStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & {
          owner_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
        Relationships: [];
      };

      product_briefs: {
        Row: {
          id: string;
          project_id: string;
          source_url: string | null;
          product_name: string | null;
          one_line_description: string | null;
          category: string | null;
          product_type: string | null;
          product_summary: string | null;
          what_it_does: string | null;
          target_customer: string | null;
          target_audience: Json;
          primary_pain: string | null;
          user_pain_points: Json;
          core_promise: string | null;
          key_features: Json;
          key_benefits: Json;
          offer: string | null;
          cta: string | null;
          competitors: Json;
          likely_competitors: Json;
          alternative_solutions: Json;
          market_category: string | null;
          content_pillars: Json;
          positioning_angles: Json;
          content_angles: Json;
          platform_recommendations: Json;
          cta_suggestions: Json;
          founder_led_opportunities: Json;
          positioning_gaps: Json;
          confidence: Json;
          extraction_notes: Json;
          raw_extracted_content: Json;
          model_used: string | null;
          production_constraints: Json;
          brand_voice: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_briefs"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_briefs"]["Row"]>;
        Relationships: [];
      };

      competitors: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          url: string | null;
          notes: string | null;
          discovery_run_id: string | null;
          kind: "direct" | "indirect" | "creator" | "audience_magnet" | "community" | "unknown";
          confidence: "low" | "medium" | "high";
          strategy_profile: Json;
          evidence_urls: Json;
          discovered_at: string | null;
          source: "manual" | "deep_discovery";
          entity_key: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["competitors"]["Row"]> & {
          project_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitors"]["Row"]>;
        Relationships: [];
      };

      competitor_accounts: {
        Row: {
          id: string;
          competitor_id: string | null;
          project_id: string;
          platform: SourcePlatform;
          handle: string;
          url: string | null;
          account_type: AccountType;
          follower_count: number | null;
          discovery_run_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["competitor_accounts"]["Row"]> & {
          project_id: string;
          platform: SourcePlatform;
          handle: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_accounts"]["Row"]>;
        Relationships: [];
      };

      trendwatch_runs: {
        Row: {
          id: string;
          project_id: string;
          status: AIRunStatus;
          notes: string | null;
          source_count: number;
          insight_count: number;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["trendwatch_runs"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["trendwatch_runs"]["Row"]>;
        Relationships: [];
      };

      trendwatch_sources: {
        Row: {
          id: string;
          project_id: string;
          run_id: string | null;
          source_url: string | null;
          platform: SourcePlatform;
          account_handle: string | null;
          account_type: AccountType;
          caption: string | null;
          published_at: string | null;
          follower_count: number | null;
          views: number | null;
          likes: number | null;
          saves: number | null;
          shares: number | null;
          comments: number | null;
          format: string | null;
          hook: string | null;
          angle: string | null;
          visual_pattern: string | null;
          cta_pattern: string | null;
          audience_pain: string | null;
          why_it_worked: string | null;
          how_to_adapt: string | null;
          distortion_risk: DistortionRisk;
          transferability_score: number;
          signal_score: number;
          notes: string | null;
          screenshot_url: string | null;
          fetch_status: string;
          fetched_text: string | null;
          fetch_metadata: Json;
          confidence_score: number;
          scoring_reasons: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trendwatch_sources"]["Row"]> & {
          project_id: string;
          platform: SourcePlatform;
        };
        Update: Partial<Database["public"]["Tables"]["trendwatch_sources"]["Row"]>;
        Relationships: [];
      };

      trendwatch_insights: {
        Row: {
          id: string;
          project_id: string;
          run_id: string | null;
          source_id: string | null;
          insight: string;
          format: string | null;
          hook_pattern: string | null;
          angle: string | null;
          audience: string | null;
          signal_score: number;
          confidence_score: number | null;
          scoring_reasons: Json;
          recommended_experiment: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trendwatch_insights"]["Row"]> & {
          project_id: string;
          insight: string;
        };
        Update: Partial<Database["public"]["Tables"]["trendwatch_insights"]["Row"]>;
        Relationships: [];
      };

      hooks: {
        Row: {
          id: string;
          project_id: string;
          insight_id: string | null;
          hook: string;
          angle: string | null;
          format_hint: string | null;
          target_audience: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["hooks"]["Row"]> & {
          project_id: string;
          hook: string;
        };
        Update: Partial<Database["public"]["Tables"]["hooks"]["Row"]>;
        Relationships: [];
      };

      content_ideas: {
        Row: {
          id: string;
          project_id: string;
          insight_id: string | null;
          hook_id: string | null;
          format: string | null;
          hook: string | null;
          angle: string | null;
          target_audience: string | null;
          why_this_should_work: string | null;
          hypothesis: string | null;
          platforms: Json;
          metric_to_watch: string | null;
          risk_level: DistortionRisk;
          variant_suggestions: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["content_ideas"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_ideas"]["Row"]>;
        Relationships: [];
      };

      generated_posts: {
        Row: {
          id: string;
          project_id: string;
          content_idea_id: string | null;
          insight_id: string | null;
          format: string | null;
          platform: string | null;
          hook: string | null;
          angle: string | null;
          target_audience: string | null;
          hypothesis: string | null;
          caption: string | null;
          cta: string | null;
          metric_to_watch: string | null;
          status: GeneratedPostStatus;
          quality_score: number | null;
          quality_status: QualityStatus | null;
          quality_reasons: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["generated_posts"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["generated_posts"]["Row"]>;
        Relationships: [];
      };

      post_slides: {
        Row: {
          id: string;
          post_id: string;
          slide_number: number;
          headline: string | null;
          body: string | null;
          image_url: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["post_slides"]["Row"]> & {
          post_id: string;
          slide_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["post_slides"]["Row"]>;
        Relationships: [];
      };

      scheduled_posts: {
        Row: {
          id: string;
          project_id: string;
          post_id: string;
          platform: string | null;
          channel: string | null;
          scheduled_for: string | null;
          postiz_payload: Json;
          postiz_response: Json;
          status: string;
          error_message: string | null;
          remote_id: string | null;
          release_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["scheduled_posts"]["Row"]> & {
          project_id: string;
          post_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["scheduled_posts"]["Row"]>;
        Relationships: [];
      };

      postiz_connections: {
        Row: {
          id: string;
          owner_id: string;
          api_url: string | null;
          api_key: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["postiz_connections"]["Row"]> & {
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["postiz_connections"]["Row"]>;
        Relationships: [];
      };

      postiz_channels: {
        Row: {
          id: string;
          owner_id: string;
          integration_id: string;
          provider: string;
          platform: string;
          name: string;
          profile: string | null;
          disabled: boolean;
          raw_metadata: Json;
          synced_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["postiz_channels"]["Row"]> & {
          owner_id: string;
          integration_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["postiz_channels"]["Row"]>;
        Relationships: [];
      };

      experiments: {
        Row: {
          id: string;
          project_id: string;
          post_id: string | null;
          scheduled_post_id: string | null;
          status: ExperimentStatus;
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
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["experiments"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["experiments"]["Row"]>;
        Relationships: [];
      };

      winners: {
        Row: {
          id: string;
          project_id: string;
          experiment_id: string;
          winning_reason: string | null;
          winning_elements: Json;
          recommended_next_actions: Json;
          learning_to_store: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["winners"]["Row"]> & {
          project_id: string;
          experiment_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["winners"]["Row"]>;
        Relationships: [];
      };

      variants: {
        Row: {
          id: string;
          project_id: string;
          winner_id: string;
          post_id: string | null;
          hook: string | null;
          angle: string | null;
          format: string | null;
          target_audience: string | null;
          notes: string | null;
          status: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["variants"]["Row"]> & {
          project_id: string;
          winner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["variants"]["Row"]>;
        Relationships: [];
      };

      learnings: {
        Row: {
          id: string;
          project_id: string;
          source_winner_id: string | null;
          category: string | null;
          learning: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["learnings"]["Row"]> & {
          project_id: string;
          learning: string;
        };
        Update: Partial<Database["public"]["Tables"]["learnings"]["Row"]>;
        Relationships: [];
      };

      assets: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          kind: string;
          storage_path: string;
          url: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assets"]["Row"]> & {
          project_id: string;
          owner_id: string;
          kind: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["assets"]["Row"]>;
        Relationships: [];
      };

      ai_runs: {
        Row: {
          id: string;
          project_id: string | null;
          owner_id: string;
          kind: string;
          provider: string;
          model: string;
          prompt_version: string | null;
          input: Json;
          input_hash: string | null;
          raw_output: string | null;
          parsed_output: Json;
          status: AIRunStatus;
          validation_error: string | null;
          retry_count: number;
          latency_ms: number | null;
          cost_estimate: number | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_runs"]["Row"]> & {
          owner_id: string;
          kind: string;
          provider: string;
          model: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_runs"]["Row"]>;
        Relationships: [];
      };

      prompt_versions: {
        Row: {
          id: string;
          name: string;
          version: string;
          system: string | null;
          template: string | null;
          schema: Json;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prompt_versions"]["Row"]> & {
          name: string;
          version: string;
        };
        Update: Partial<Database["public"]["Tables"]["prompt_versions"]["Row"]>;
        Relationships: [];
      };

      exports: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          kind: string;
          status: string;
          file_path: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exports"]["Row"]> & {
          project_id: string;
          owner_id: string;
          kind: string;
        };
        Update: Partial<Database["public"]["Tables"]["exports"]["Row"]>;
        Relationships: [];
      };

      plans: {
        Row: {
          id: string;
          name: string;
          price_monthly: number | null;
          limits: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plans"]["Row"]> & {
          id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Row"]>;
        Relationships: [];
      };

      usage_counters: {
        Row: {
          id: string;
          owner_id: string;
          period_start: string;
          period_end: string;
          trendwatch_runs: number;
          content_ideas: number;
          generated_posts: number;
          ai_tokens: number;
        };
        Insert: Partial<Database["public"]["Tables"]["usage_counters"]["Row"]> & {
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_counters"]["Row"]>;
        Relationships: [];
      };

      product_site_crawls: {
        Row: {
          id: string;
          project_id: string;
          source_url: string;
          status: "running" | "success" | "partial" | "failed";
          primary_adapter: string;
          fallback_adapters: Json;
          pages_discovered: number;
          pages_crawled: number;
          pages_failed: number;
          error: string | null;
          metadata: Json;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_site_crawls"]["Row"]> & {
          project_id: string;
          source_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_site_crawls"]["Row"]>;
        Relationships: [];
      };

      product_site_pages: {
        Row: {
          id: string;
          crawl_id: string;
          project_id: string;
          url: string;
          final_url: string | null;
          page_type: string;
          title: string | null;
          description: string | null;
          markdown: string | null;
          body_text: string | null;
          headings: Json;
          ctas: Json;
          adapter_used: string;
          fetch_status: "pending" | "success" | "failed";
          error: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_site_pages"]["Row"]> & {
          crawl_id: string;
          project_id: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_site_pages"]["Row"]>;
        Relationships: [];
      };

      product_site_facts: {
        Row: {
          id: string;
          crawl_id: string;
          page_id: string | null;
          project_id: string;
          fact_type: string;
          fact_key: string | null;
          fact_value: string;
          confidence: "low" | "medium" | "high";
          evidence_snippet: string | null;
          source_url: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_site_facts"]["Row"]> & {
          crawl_id: string;
          project_id: string;
          fact_type: string;
          fact_value: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_site_facts"]["Row"]>;
        Relationships: [];
      };

      source_discovery_runs: {
        Row: {
          id: string;
          project_id: string;
          status: "running" | "success" | "partial" | "failed";
          queries: Json;
          primary_adapter: string;
          fallback_adapters: Json;
          candidates_found: number;
          error: string | null;
          metadata: Json;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["source_discovery_runs"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["source_discovery_runs"]["Row"]>;
        Relationships: [];
      };

      source_candidates: {
        Row: {
          id: string;
          discovery_run_id: string;
          project_id: string;
          url: string;
          canonical_url: string | null;
          title: string | null;
          snippet: string | null;
          source_type: string;
          platform: string;
          adapter: string;
          discovery_query: string | null;
          discovery_reason: string | null;
          relevance_score: number;
          enrich_status: "pending" | "enriched" | "failed" | "skipped";
          review_status: "pending" | "accepted" | "rejected";
          metadata: Json;
          competitor_id: string | null;
          entity_key: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["source_candidates"]["Row"]> & {
          discovery_run_id: string;
          project_id: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["source_candidates"]["Row"]>;
        Relationships: [];
      };

      market_pattern_runs: {
        Row: {
          id: string;
          project_id: string;
          status: "running" | "success" | "partial" | "failed";
          source_count: number;
          pattern_count: number;
          error: string | null;
          metadata: Json;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_pattern_runs"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_pattern_runs"]["Row"]>;
        Relationships: [];
      };

      market_patterns: {
        Row: {
          id: string;
          run_id: string;
          project_id: string;
          pattern_type: string;
          label: string;
          summary: string;
          why_it_matters: string | null;
          how_to_use: string | null;
          support_count: number;
          confidence: "low" | "medium" | "high";
          source_ids: Json;
          examples: Json;
          strength_score: number;
          transferability_score: number;
          signal_confidence: number;
          score_reasons: Json;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_patterns"]["Row"]> & {
          run_id: string;
          project_id: string;
          pattern_type: string;
          label: string;
          summary: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_patterns"]["Row"]>;
        Relationships: [];
      };

      market_pattern_evidence: {
        Row: {
          id: string;
          pattern_id: string;
          source_id: string;
          project_id: string;
          source_url: string | null;
          evidence_field: string;
          evidence_text: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_pattern_evidence"]["Row"]> & {
          pattern_id: string;
          source_id: string;
          project_id: string;
          evidence_field: string;
          evidence_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_pattern_evidence"]["Row"]>;
        Relationships: [];
      };

      market_pattern_source_scores: {
        Row: {
          id: string;
          pattern_id: string;
          source_id: string;
          project_id: string;
          relevance: number | null;
          format_transferability: number | null;
          conversion_intent: number | null;
          account_fit: number | null;
          signal_score: number;
          confidence_score: number;
          distortion_risk: "low" | "medium" | "high";
          reasons: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_pattern_source_scores"]["Row"]> & {
          pattern_id: string;
          source_id: string;
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_pattern_source_scores"]["Row"]>;
        Relationships: [];
      };

    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
