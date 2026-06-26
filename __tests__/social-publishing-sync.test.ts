import { describe, expect, it } from "vitest";
import {
  isGrowthSyncPlatform,
  mapAccountToConnectedAccountRow,
  normalizePublishingPlatform,
} from "@/services/social-publishing";

describe("social publishing account sync", () => {
  it("normalizes platform names for comparison", () => {
    expect(normalizePublishingPlatform("Instagram")).toBe("instagram");
    expect(normalizePublishingPlatform("Twitter/X")).toBe("x");
  });

  it("filters growth sync platforms", () => {
    expect(isGrowthSyncPlatform("tiktok")).toBe(true);
    expect(isGrowthSyncPlatform("linkedin")).toBe(false);
  });

  it("maps provider accounts into connected_accounts rows", () => {
    const row = mapAccountToConnectedAccountRow(
      {
        id: "acc_123",
        name: "My TikTok",
        platform: "tiktok",
        disabled: false,
        profile: "@founder",
        raw: {},
      },
      "project-uuid"
    );

    expect(row).toEqual({
      project_id: "project-uuid",
      platform: "tiktok",
      handle: "@founder",
      display_name: "My TikTok",
      postiz_account_id: "acc_123",
      postiz_provider_id: "tiktok",
      status: "active",
    });
  });

  it("drops unsupported growth platforms", () => {
    const row = mapAccountToConnectedAccountRow(
      {
        id: "acc_456",
        name: "Company Page",
        platform: "linkedin",
        disabled: false,
        profile: "company",
        raw: {},
      },
      "project-uuid"
    );
    expect(row).toBeNull();
  });
});
