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
          crawl_mode: "llm" | "heuristic";
          approval_policy: "auto_approve_all" | "ask_at_critical" | "ask_at_every_stage";
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
          ai_model_slug: string | null;
          ai_model_source: "curated" | "advanced" | null;
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

      trendhop_runs: {
        Row: {
          id: string;
          project_id: string;
          status: "pending" | "running" | "success" | "failed";
          trigger: "manual" | "scheduled";
          started_at: string | null;
          completed_at: string | null;
          error: string | null;
          item_count: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trendhop_runs"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["trendhop_runs"]["Row"]>;
        Relationships: [];
      };

      trendhop_items: {
        Row: {
          id: string;
          run_id: string;
          project_id: string;
          platform: string;
          trend_name: string;
          why_hot: string | null;
          references: Json;
          product_angle: string | null;
          suggested_hook: string | null;
          suggested_concept: string | null;
          recency_score: number | null;
          confidence: number | null;
          dismissed_at: string | null;
          promoted_video_concept_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trendhop_items"]["Row"]> & {
          run_id: string;
          project_id: string;
          platform: string;
          trend_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["trendhop_items"]["Row"]>;
        Relationships: [];
      };

      trendwatch_schedules: {
        Row: {
          id: string;
          project_id: string;
          cadence_days: number;
          next_run_at: string | null;
          enabled: boolean;
          last_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trendwatch_schedules"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["trendwatch_schedules"]["Row"]>;
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

      postbridge_connections: {
        Row: {
          id: string;
          owner_id: string;
          api_key: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["postbridge_connections"]["Row"]> & {
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["postbridge_connections"]["Row"]>;
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

      video_evidence: {
        Row: {
          id: string;
          project_id: string;
          competitor_id: string | null;
          source_candidate_id: string | null;
          platform: "tiktok" | "instagram" | "youtube" | "other";
          video_url: string;
          canonical_url: string;
          account_handle: string | null;
          account_url: string | null;
          caption: string | null;
          title: string | null;
          hashtags: Json;
          sound: string | null;
          duration_seconds: number | null;
          view_count: number | null;
          like_count: number | null;
          comment_count: number | null;
          share_count: number | null;
          posted_at: string | null;
          linked_urls: Json;
          detected_hook: string | null;
          detected_cta: string | null;
          format_guess: string;
          topic_guess: string | null;
          source_confidence: number;
          fetch_status: "pending" | "success" | "failed" | "skipped";
          fetch_method: string;
          raw_source_type: "video" | "profile" | "unknown";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_evidence"]["Row"]> & {
          project_id: string;
          video_url: string;
          canonical_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_evidence"]["Row"]>;
        Relationships: [];
      };

      video_metrics_snapshots: {
        Row: {
          id: string;
          video_evidence_id: string;
          view_count: number | null;
          like_count: number | null;
          comment_count: number | null;
          share_count: number | null;
          captured_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_metrics_snapshots"]["Row"]> & {
          video_evidence_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_metrics_snapshots"]["Row"]>;
        Relationships: [];
      };

      video_patterns: {
        Row: {
          id: string;
          project_id: string;
          pattern_type: "hook" | "format" | "cta" | "topic" | "cadence" | "link";
          label: string;
          description: string | null;
          evidence_count: number;
          confidence: number;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_patterns"]["Row"]> & {
          project_id: string;
          pattern_type: Database["public"]["Tables"]["video_patterns"]["Row"]["pattern_type"];
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_patterns"]["Row"]>;
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

      // ===================================================================
      // Growth Run spine (migration 0014_growth_run.sql)
      // Closed video loop: brief → trend → strategy → loadout → concepts →
      // scripts → storyboards → assets → videos → schedule → tracking →
      // compound → learning. Columns below are the v1 touched surface;
      // DB defaults cover anything not listed in Insert.
      // ===================================================================

      project_growth_settings: {
        Row: {
          project_id: string;
          operation_mode: "manual" | "assisted" | "managed";
          primary_cta_type:
            | "start_free" | "join_waitlist" | "book_demo" | "download_app" | "buy_now" | "custom";
          booking_url: string | null;
          booking_provider: "google_calendar" | "calendly" | "manual" | "none";
          default_cta_label: string | null;
          default_cta_url: string | null;
          blocked_topics: Json;
          blocked_claims: Json;
          blocked_competitors: Json;
          distribution_preference: "all_accounts" | "selected" | "export_only";
          selected_account_ids: Json;
          autopilot_enabled: boolean;
          max_runs_per_day: number;
          run_cooldown_hours: number;
          max_active_runs: number;
          onboarding_completed: boolean;
          winner_signup_threshold: number;
          weak_completion_threshold: number;
          weak_click_rate_threshold: number;
          flat_views_threshold: number;
          promising_save_rate_threshold: number;
          strong_save_rate_threshold: number;
          production_format: "pain_led" | "slide" | "ai_broll_short" | "objection" | "comparison" | "demo_short";
          audio_mode: "music_only" | "voiceover" | "voiceover_bgm";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["project_growth_settings"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_growth_settings"]["Row"]>;
        Relationships: [];
      };

      platform_video_variants: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          video_id: string;
          concept_id: string;
          platform: "tiktok" | "instagram" | "youtube";
          render_profile: string;
          final_asset_id: string | null;
          public_url: string | null;
          duration_seconds: number | null;
          width: number | null;
          height: number | null;
          status: "pending" | "rendering" | "ready" | "failed" | "shared";
          error: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["platform_video_variants"]["Row"]> & {
          project_id: string;
          growth_run_id: string;
          video_id: string;
          concept_id: string;
          platform: "tiktok" | "instagram" | "youtube";
          render_profile: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_video_variants"]["Row"]>;
        Relationships: [];
      };

      audio_assets: {
        Row: {
          id: string;
          project_id: string | null;
          source_type: "licensed" | "royalty_free" | "uploaded" | "native_platform_reference";
          provider: string | null;
          title: string;
          artist: string | null;
          storage_path: string | null;
          file_url: string | null;
          license_status: "cleared" | "royalty_free" | "user_owned" | "reference_only" | "unknown";
          platform: "tiktok" | "instagram" | "youtube" | null;
          external_sound_id: string | null;
          usage_notes: string | null;
          bpm: number | null;
          mood: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audio_assets"]["Row"]> & {
          title: string;
          source_type: Database["public"]["Tables"]["audio_assets"]["Row"]["source_type"];
        };
        Update: Partial<Database["public"]["Tables"]["audio_assets"]["Row"]>;
        Relationships: [];
      };

      autopilot_decision_log: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string | null;
          decision_type: string;
          outcome: string;
          reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["autopilot_decision_log"]["Row"]> & {
          project_id: string;
          decision_type: string;
          outcome: string;
        };
        Update: Partial<Database["public"]["Tables"]["autopilot_decision_log"]["Row"]>;
        Relationships: [];
      };

      growth_runs: {
        Row: {
          id: string;
          project_id: string;
          status:
            | "pending" | "running" | "awaiting_user_input" | "awaiting_approval" | "scheduled"
            | "live" | "completed" | "failed" | "cancelled";
          paused_at_phase: string | null;
          current_stage: number;
          execution_mode: "sequential_first" | "stage_only";
          target_stage: number | null;
          trigger: "manual" | "autopilot" | "scheduled";
          approval_mode: "manual" | "per_format" | "autopilot";
          posting_aggressiveness: "conservative" | "balanced" | "aggressive";
          brand_constraints: Json;
          target_platforms: Json;
          phase:
            | "brief" | "autobrief" | "deep_discovery" | "video_discovery" | "pattern_mining"
            | "trendhop" | "videotrend" | "strategy" | "loadout" | "concepts"
            | "scripts" | "storyboards" | "assets" | "videos" | "captions"
            | "approval" | "schedule" | "live" | "compound" | "done";
          phase_status: Json;
          options: Json;
          error: string | null;
          notes: string | null;
          parent_run_id: string | null;
          distribution_mode: "postiz" | "export_only";
          batch_kind: "exploration" | "exploitation";
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["growth_runs"]["Row"]> & { project_id: string };
        Update: Partial<Database["public"]["Tables"]["growth_runs"]["Row"]>;
        Relationships: [];
      };

      growth_run_sla_events: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          stage_id: number | null;
          phase: string;
          status: "pending" | "running" | "succeeded" | "failed" | "skipped";
          queued_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          duration_ms: number | null;
          provider_latency_ms: number | null;
          retry_count: number;
          details: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["growth_run_sla_events"]["Row"]> & {
          project_id: string;
          growth_run_id: string;
          phase: string;
          status: "pending" | "running" | "succeeded" | "failed" | "skipped";
        };
        Update: Partial<Database["public"]["Tables"]["growth_run_sla_events"]["Row"]>;
        Relationships: [];
      };

      video_trend_reports: {
        Row: {
          id: string;
          growth_run_id: string;
          project_id: string;
          winning_structures: Json;
          hook_patterns: Json;
          opening_frames: Json;
          cta_patterns: Json;
          audience_language: Json;
          platform_patterns: Json;
          recommended_experiments: Json;
          competitor_gaps: Json;
          repurposable_formats: Json;
          evidence_video_ids: Json;
          confidence: number;
          raw_output: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_trend_reports"]["Row"]> & {
          growth_run_id: string; project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_trend_reports"]["Row"]>;
        Relationships: [];
      };

      video_strategies: {
        Row: {
          id: string;
          growth_run_id: string;
          project_id: string;
          platform_mix: Json;
          video_type_mix: Json;
          campaign_hypotheses: Json;
          rationale: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_strategies"]["Row"]> & {
          growth_run_id: string; project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_strategies"]["Row"]>;
        Relationships: [];
      };

      posting_loadouts: {
        Row: {
          id: string;
          growth_run_id: string;
          project_id: string;
          per_account_plan: Json;
          total_videos_planned: number;
          duration_days: number;
          connected_account_ids: Json;
          distribution_mode: "postiz" | "export_only";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["posting_loadouts"]["Row"]> & {
          growth_run_id: string; project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["posting_loadouts"]["Row"]>;
        Relationships: [];
      };

      connected_accounts: {
        Row: {
          id: string;
          project_id: string;
          platform: "tiktok" | "instagram" | "youtube";
          handle: string;
          display_name: string | null;
          postiz_account_id: string | null;
          postiz_provider_id: string | null;
          status: "active" | "paused" | "disconnected" | "flagged";
          max_posts_per_day: number;
          min_minutes_between_posts: number;
          persona: string | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["connected_accounts"]["Row"]> & {
          project_id: string; platform: "tiktok" | "instagram" | "youtube"; handle: string;
        };
        Update: Partial<Database["public"]["Tables"]["connected_accounts"]["Row"]>;
        Relationships: [];
      };

      account_health_log: {
        Row: {
          id: string;
          connected_account_id: string;
          project_id: string;
          event: string;
          severity: "info" | "warn" | "critical";
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["account_health_log"]["Row"]> & {
          connected_account_id: string; project_id: string; event: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_health_log"]["Row"]>;
        Relationships: [];
      };

      format_fingerprints: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          name: string;
          fingerprint_key: string;
          video_type:
            | "slide" | "demo" | "founder_pov" | "pain_led"
            | "trend_remix" | "ai_broll" | "objection" | "comparison" | "carousel";
          platform: "tiktok" | "instagram" | "youtube";
          hook_mechanism: string;
          visual_grammar: string;
          script_structure: Json;
          cta_pattern: string;
          business_hypothesis: string;
          transferability_score: number;
          distortion_risk: "low" | "medium" | "high" | "unknown";
          confidence: number;
          missing_evidence: Json;
          evidence_video_ids: Json;
          source_pattern_ids: Json;
          status: "candidate" | "testing" | "winner" | "iterate" | "killed";
          paused_until: string | null;
          compound_action: "scale" | "iterate" | "kill" | "inconclusive" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["format_fingerprints"]["Row"]> & {
          project_id: string;
          growth_run_id: string;
          name: string;
          fingerprint_key: string;
          video_type: Database["public"]["Tables"]["format_fingerprints"]["Row"]["video_type"];
          platform: Database["public"]["Tables"]["format_fingerprints"]["Row"]["platform"];
          hook_mechanism: string;
          visual_grammar: string;
          cta_pattern: string;
          business_hypothesis: string;
        };
        Update: Partial<Database["public"]["Tables"]["format_fingerprints"]["Row"]>;
        Relationships: [];
      };

      controlled_experiments: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          format_fingerprint_id: string;
          tested_variable: "hook" | "format";
          audience_pain: string;
          fixed_body: string;
          fixed_cta: string;
          fixed_audience: string;
          evaluation_window_days: number;
          status: "planned" | "running" | "evaluating" | "scale" | "iterate" | "kill" | "complete";
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["controlled_experiments"]["Row"]> & {
          project_id: string;
          growth_run_id: string;
          format_fingerprint_id: string;
          tested_variable: "hook" | "format";
          audience_pain: string;
          fixed_body: string;
          fixed_cta: string;
          fixed_audience: string;
        };
        Update: Partial<Database["public"]["Tables"]["controlled_experiments"]["Row"]>;
        Relationships: [];
      };

      experiment_cells: {
        Row: {
          id: string;
          project_id: string;
          experiment_id: string;
          concept_id: string;
          variant_label: string;
          variable_value: string;
          hypothesis: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["experiment_cells"]["Row"]> & {
          project_id: string;
          experiment_id: string;
          concept_id: string;
          variant_label: string;
          variable_value: string;
          hypothesis: string;
        };
        Update: Partial<Database["public"]["Tables"]["experiment_cells"]["Row"]>;
        Relationships: [];
      };

      trend_receipts: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          concept_id: string;
          format_fingerprint_id: string;
          evidence_video_ids: Json;
          source_pattern_ids: Json;
          observed_evidence: Json;
          strategic_inference: Json;
          expected_signal: string;
          reasoning: string;
          confidence: number;
          missing_evidence: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trend_receipts"]["Row"]> & {
          project_id: string;
          growth_run_id: string;
          concept_id: string;
          format_fingerprint_id: string;
          expected_signal: string;
          reasoning: string;
        };
        Update: Partial<Database["public"]["Tables"]["trend_receipts"]["Row"]>;
        Relationships: [];
      };

      video_concepts: {
        Row: {
          id: string;
          growth_run_id: string | null;
          project_id: string;
          video_type:
            | "slide" | "demo" | "founder_pov" | "pain_led"
            | "trend_remix" | "ai_broll" | "objection" | "comparison" | "carousel";
          platform: "tiktok" | "instagram" | "youtube";
          target_length_seconds: number;
          hook: string;
          angle: string | null;
          promise: string | null;
          cta: string | null;
          hypothesis: string | null;
          production_mode:
            | "fast_slides" | "demo_short" | "ai_broll_short"
            | "founder_pov" | "reference_remix" | "ugc_presenter_later" | null;
          source_pattern_id: string | null;
          evidence_video_ids: Json;
          trendhop_item_id: string | null;
          queued_for_next_run: boolean;
          render_approved: boolean;
          demo_clip_url: string | null;
          status: "draft" | "scripted" | "approved" | "killed";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_concepts"]["Row"]> & {
          project_id: string;
          video_type: Database["public"]["Tables"]["video_concepts"]["Row"]["video_type"];
          platform: "tiktok" | "instagram" | "youtube";
          hook: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_concepts"]["Row"]>;
        Relationships: [];
      };

      video_scripts: {
        Row: {
          id: string;
          concept_id: string;
          project_id: string;
          hook_line: string;
          body_lines: Json;
          cta_line: string | null;
          voiceover_full: string | null;
          on_screen_text: Json;
          total_words: number;
          estimated_duration_seconds: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_scripts"]["Row"]> & {
          concept_id: string; project_id: string; hook_line: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_scripts"]["Row"]>;
        Relationships: [];
      };

      storyboards: {
        Row: {
          id: string;
          concept_id: string;
          project_id: string;
          production_job_id: string | null;
          aspect_ratio: string;
          total_duration_seconds: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["storyboards"]["Row"]> & {
          concept_id: string; project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["storyboards"]["Row"]>;
        Relationships: [];
      };

      storyboard_scenes: {
        Row: {
          id: string;
          storyboard_id: string;
          production_job_id: string | null;
          scene_index: number;
          role: "hook" | "context" | "demo" | "proof" | "cta" | "outro" | "transition";
          duration_seconds: number;
          visual_intent: string;
          on_screen_text: string | null;
          voiceover_line: string | null;
          asset_method: "slide" | "fal_clip" | "screen_demo" | "stock" | "image" | "user_upload";
          asset_prompt: string | null;
          purpose: "hook" | "problem" | "mechanism" | "proof" | "demo" | "cta" | "outro" | null;
          scene_type: string | null;
          visual_method:
            | "slide" | "screenshot" | "screen_recording"
            | "ai_broll" | "founder_clip" | "ugc_clip" | null;
          subtitle_text: string | null;
          overlay_text: string | null;
          asset_id: string | null;
          status: "planned" | "rendering" | "ready" | "failed" | "skipped";
          error: string | null;
          metadata: Json;
        };
        Insert: Partial<Database["public"]["Tables"]["storyboard_scenes"]["Row"]> & {
          storyboard_id: string;
          scene_index: number;
          role: Database["public"]["Tables"]["storyboard_scenes"]["Row"]["role"];
          visual_intent: string;
        };
        Update: Partial<Database["public"]["Tables"]["storyboard_scenes"]["Row"]>;
        Relationships: [];
      };

      generated_assets: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string | null;
          concept_id: string | null;
          scene_id: string | null;
          production_job_id: string | null;
          kind:
            | "slide_image" | "fal_image" | "fal_clip" | "voiceover" | "subtitle" | "caption_ass"
            | "music" | "final_mp4" | "thumbnail";
          provider: string | null;
          provider_request_id: string | null;
          storage_path: string | null;
          public_url: string | null;
          duration_seconds: number | null;
          status: "pending" | "running" | "succeeded" | "failed" | "skipped";
          error: string | null;
          cost_cents: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["generated_assets"]["Row"]> & {
          project_id: string;
          kind: Database["public"]["Tables"]["generated_assets"]["Row"]["kind"];
        };
        Update: Partial<Database["public"]["Tables"]["generated_assets"]["Row"]>;
        Relationships: [];
      };

      video_production_jobs: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          video_id: string;
          concept_id: string;
          production_mode: string | null;
          platform_profile: string;
          status:
            | "queued"
            | "planning"
            | "generating_assets"
            | "generating_audio"
            | "generating_subs"
            | "assembling"
            | "uploading"
            | "quality_check"
            | "ready"
            | "failed"
            | "partial";
          current_stage: string | null;
          error: string | null;
          metadata: Json;
          queued_at: string | null;
          stage_started_at: string | null;
          render_started_at: string | null;
          render_completed_at: string | null;
          render_duration_ms: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_production_jobs"]["Row"]> & {
          project_id: string;
          growth_run_id: string;
          video_id: string;
          concept_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_production_jobs"]["Row"]>;
        Relationships: [];
      };

      videos: {
        Row: {
          id: string;
          concept_id: string;
          growth_run_id: string;
          project_id: string;
          final_asset_id: string | null;
          thumbnail_asset_id: string | null;
          duration_seconds: number | null;
          aspect_ratio: string;
          status:
            | "pending" | "rendering" | "ready" | "approved"
            | "rejected" | "killed" | "posted" | "failed";
          approval_status: "pending_review" | "approved" | "rejected" | "auto_approved";
          approved_by: string | null;
          approved_at: string | null;
          hash_signature: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["videos"]["Row"]> & {
          concept_id: string; growth_run_id: string; project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["videos"]["Row"]>;
        Relationships: [];
      };

      video_captions: {
        Row: {
          id: string;
          video_id: string;
          project_id: string;
          connected_account_id: string | null;
          platform: "tiktok" | "instagram" | "youtube";
          caption: string;
          hashtags: Json;
          cta: string | null;
          variation_seed: string | null;
          variation_score: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_captions"]["Row"]> & {
          video_id: string;
          project_id: string;
          platform: "tiktok" | "instagram" | "youtube";
          caption: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_captions"]["Row"]>;
        Relationships: [];
      };

      schedule_items: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          video_id: string;
          caption_id: string | null;
          connected_account_id: string;
          platform: "tiktok" | "instagram" | "youtube";
          scheduled_for: string;
          status:
            | "queued" | "approved" | "sending" | "scheduled"
            | "posted" | "failed" | "cancelled" | "retrying";
          postiz_post_id: string | null;
          postiz_payload: Json;
          postiz_response: Json;
          posted_url: string | null;
          posted_at: string | null;
          failure_reason: string | null;
          postiz_status: string | null;
          postiz_status_synced_at: string | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["schedule_items"]["Row"]> & {
          project_id: string;
          growth_run_id: string;
          video_id: string;
          connected_account_id: string;
          platform: "tiktok" | "instagram" | "youtube";
          scheduled_for: string;
        };
        Update: Partial<Database["public"]["Tables"]["schedule_items"]["Row"]>;
        Relationships: [];
      };

      tracked_links: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string | null;
          video_id: string | null;
          schedule_item_id: string | null;
          connected_account_id: string | null;
          short_code: string;
          destination_url: string;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          click_count: number;
          intent_type: "product" | "demo_intent" | "lead_intent" | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tracked_links"]["Row"]> & {
          project_id: string; short_code: string; destination_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["tracked_links"]["Row"]>;
        Relationships: [];
      };

      link_click_events: {
        Row: {
          id: string;
          tracked_link_id: string;
          project_id: string;
          user_agent: string | null;
          referrer: string | null;
          ip_hash: string | null;
          country: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["link_click_events"]["Row"]> & {
          tracked_link_id: string; project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["link_click_events"]["Row"]>;
        Relationships: [];
      };

      pixel_events: {
        Row: {
          id: string;
          project_id: string;
          tracked_link_id: string | null;
          video_id: string | null;
          event_name: string;
          session_id: string | null;
          visitor_hash: string | null;
          url: string | null;
          referrer: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pixel_events"]["Row"]> & {
          project_id: string; event_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["pixel_events"]["Row"]>;
        Relationships: [];
      };

      signup_events: {
        Row: {
          id: string;
          project_id: string;
          tracked_link_id: string | null;
          video_id: string | null;
          external_user_id: string | null;
          email_hash: string | null;
          source: "webhook" | "pixel" | "manual" | "api";
          activated: boolean;
          activated_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["signup_events"]["Row"]> & { project_id: string };
        Update: Partial<Database["public"]["Tables"]["signup_events"]["Row"]>;
        Relationships: [];
      };

      payment_events: {
        Row: {
          id: string;
          project_id: string;
          tracked_link_id: string | null;
          video_id: string | null;
          signup_event_id: string | null;
          amount_cents: number;
          currency: string;
          external_payment_id: string | null;
          source: "webhook" | "manual" | "api";
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_events"]["Row"]> & { project_id: string };
        Update: Partial<Database["public"]["Tables"]["payment_events"]["Row"]>;
        Relationships: [];
      };

      video_run_metrics: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          schedule_item_id: string;
          video_id: string;
          source: "manual" | "platform_api" | "derived";
          views: number | null;
          watch_time_seconds: number | null;
          completion_rate: number | null;
          three_sec_hold_rate: number | null;
          likes: number | null;
          comments: number | null;
          shares: number | null;
          saves: number | null;
          profile_visits: number | null;
          link_clicks: number | null;
          signups: number | null;
          activated_users: number | null;
          paid_users: number | null;
          revenue_cents: number | null;
          captured_at: string;
          notes: string | null;
          metadata: Json;
        };
        Insert: Partial<Database["public"]["Tables"]["video_run_metrics"]["Row"]> & {
          project_id: string; growth_run_id: string; schedule_item_id: string; video_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_run_metrics"]["Row"]>;
        Relationships: [];
      };

      metrics_snapshots: {
        Row: {
          id: string;
          project_id: string;
          schedule_item_id: string | null;
          video_id: string | null;
          growth_experiment_result_id: string | null;
          remote_post_id: string | null;
          platform: string;
          source: "postbridge" | "manual" | "tiktok" | "instagram" | "youtube";
          fetched_at: string;
          views: number | null;
          likes: number | null;
          comments: number | null;
          shares: number | null;
          saves: number | null;
          watch_time_seconds: number | null;
          impressions: number | null;
          engagement_rate: number | null;
          raw: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["metrics_snapshots"]["Row"]> & {
          project_id: string;
          platform: string;
          source: Database["public"]["Tables"]["metrics_snapshots"]["Row"]["source"];
        };
        Update: Partial<Database["public"]["Tables"]["metrics_snapshots"]["Row"]>;
        Relationships: [];
      };

      growth_experiment_results: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          video_id: string;
          classification:
            | "winner" | "promising" | "flat" | "kill";
          diagnosis: string | null;
          metric_summary: Json;
          next_action:
            | "variant" | "rewrite_hook" | "rewrite_cta" | "retarget"
            | "kill" | "increase_volume" | "review";
          confidence: number;
          controlled_experiment_id: string | null;
          format_fingerprint_id: string | null;
          latest_metrics_snapshot_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["growth_experiment_results"]["Row"]> & {
          project_id: string; growth_run_id: string; video_id: string;
          classification: Database["public"]["Tables"]["growth_experiment_results"]["Row"]["classification"];
        };
        Update: Partial<Database["public"]["Tables"]["growth_experiment_results"]["Row"]>;
        Relationships: [];
      };

      winner_variants: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string;
          source_video_id: string;
          experiment_result_id: string | null;
          child_growth_run_id: string | null;
          variant_type:
            | "hook_swap" | "cta_swap" | "length_swap"
            | "format_swap" | "angle_swap" | "platform_repurpose";
          variant_brief: Json;
          spawned_concept_id: string | null;
          status: "queued" | "generated" | "approved" | "live" | "killed";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["winner_variants"]["Row"]> & {
          project_id: string; growth_run_id: string; source_video_id: string;
          variant_type: Database["public"]["Tables"]["winner_variants"]["Row"]["variant_type"];
        };
        Update: Partial<Database["public"]["Tables"]["winner_variants"]["Row"]>;
        Relationships: [];
      };

      kill_decisions: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string | null;
          video_id: string | null;
          scope: "video" | "format" | "hook" | "platform" | "account";
          scope_value: string | null;
          reason: string;
          metric_evidence: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kill_decisions"]["Row"]> & {
          project_id: string;
          scope: Database["public"]["Tables"]["kill_decisions"]["Row"]["scope"];
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["kill_decisions"]["Row"]>;
        Relationships: [];
      };

      autopilot_rules: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          enabled: boolean;
          rule_type:
            | "generation_volume" | "posting_cadence" | "approval"
            | "variant_spawn" | "kill" | "volume_adjust" | "account_health";
          trigger: Json;
          action: Json;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["autopilot_rules"]["Row"]> & {
          project_id: string; name: string;
          rule_type: Database["public"]["Tables"]["autopilot_rules"]["Row"]["rule_type"];
        };
        Update: Partial<Database["public"]["Tables"]["autopilot_rules"]["Row"]>;
        Relationships: [];
      };

      video_quality_scores: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string | null;
          concept_id: string | null;
          video_id: string;
          hook_strength: number;
          clarity: number;
          pacing: number;
          text_density: number;
          cta_strength: number;
          platform_fit: number;
          brand_safety: number;
          duplicate_risk: number;
          claim_risk: number;
          overall_score: number;
          block_reason: string | null;
          pass_reasons: Json;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_quality_scores"]["Row"]> & {
          project_id: string;
          video_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_quality_scores"]["Row"]>;
        Relationships: [];
      };

      daily_growth_packs: {
        Row: {
          id: string;
          project_id: string;
          pack_date: string;
          posting_recommendation: string | null;
          metadata: Json;
          generated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_growth_packs"]["Row"]> & {
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_growth_packs"]["Row"]>;
        Relationships: [];
      };

      daily_growth_pack_items: {
        Row: {
          id: string;
          pack_id: string;
          item_type:
            | "ready_video" | "queued_video" | "trend_hook" | "winner_variant"
            | "pattern_to_test" | "format_to_avoid" | "posting_recommendation";
          title: string;
          body: string | null;
          reference_id: string | null;
          reference_type: string | null;
          priority: number;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_growth_pack_items"]["Row"]> & {
          pack_id: string;
          item_type: Database["public"]["Tables"]["daily_growth_pack_items"]["Row"]["item_type"];
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_growth_pack_items"]["Row"]>;
        Relationships: [];
      };

      autopilot_skip_log: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string | null;
          video_id: string | null;
          connected_account_id: string | null;
          reason: string;
          details: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["autopilot_skip_log"]["Row"]> & {
          project_id: string;
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["autopilot_skip_log"]["Row"]>;
        Relationships: [];
      };

      learning_memory: {
        Row: {
          id: string;
          project_id: string;
          growth_run_id: string | null;
          kind:
            | "format_performance" | "hook_performance" | "cta_performance"
            | "platform_performance" | "audience_signal" | "account_signal"
            | "timing_signal" | "generic";
          key: string;
          value: Json;
          weight: number;
          evidence_count: number;
          last_seen_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["learning_memory"]["Row"]> & {
          project_id: string;
          kind: Database["public"]["Tables"]["learning_memory"]["Row"]["kind"];
          key: string;
        };
        Update: Partial<Database["public"]["Tables"]["learning_memory"]["Row"]>;
        Relationships: [];
      };

    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
