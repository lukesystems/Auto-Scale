import { afterEach, describe, expect, it } from "vitest";
import { safeRelativeRedirect } from "@/lib/safe-redirect";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secret-crypto";
import { isPrivateIp } from "@/services/trendwatch/ingestion";
import { classifySourceDeterministically } from "@/services/trendwatch/classify-source";

afterEach(() => {
  delete process.env.POSTIZ_CREDENTIAL_ENCRYPTION_KEY;
});

describe("redirect security", () => {
  it("accepts local paths and rejects external or protocol-relative redirects", () => {
    expect(safeRelativeRedirect("/projects/abc?tab=1")).toBe("/projects/abc?tab=1");
    expect(safeRelativeRedirect("https://evil.example")).toBe("/projects");
    expect(safeRelativeRedirect("//evil.example/path")).toBe("/projects");
    expect(safeRelativeRedirect("/\\evil.example")).toBe("/projects");
  });
});

describe("credential encryption", () => {
  it("round-trips Postiz credentials without storing plaintext", () => {
    process.env.POSTIZ_CREDENTIAL_ENCRYPTION_KEY = "test-only-long-random-secret";
    const encrypted = encryptSecret("pst_secret_value");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain("pst_secret_value");
    expect(decryptSecret(encrypted)).toBe("pst_secret_value");
  });
});

describe("TrendWatch ingestion security", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects non-public address %s", (address) => {
    expect(isPrivateIp(address)).toBe(true);
  });

  it("allows representative public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("source classification", () => {
  it("builds a deterministic baseline without inventing metrics", () => {
    const result = classifySourceDeterministically({
      id: "source-1",
      source_url: null,
      platform: "linkedin",
      account_handle: "builder",
      account_type: "unknown",
      caption: "Three steps to avoid wasting time in your workflow. Follow for more.",
      published_at: null,
      follower_count: null,
      views: null,
      likes: null,
      saves: null,
      shares: null,
      comments: null,
      transferability_score: null,
      notes: null,
    });

    expect(result.format).toBe("how-to");
    expect(result.follower_count).toBeNull();
    expect(result.why_it_worked).toContain("Deterministic baseline");
  });
});
