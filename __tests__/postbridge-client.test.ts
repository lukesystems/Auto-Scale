import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPostBridgeAccounts,
  testPostBridgeConnection,
} from "@/services/postbridge/client";

describe("postbridge client", () => {
  const creds = { apiKey: "pb_live_test_key", apiUrl: "https://api.post-bridge.com/v1" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Bearer auth and resolved base URL for connection test", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "1", platform: "tiktok", username: "@demo" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await testPostBridgeConnection(creds);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.post-bridge.com/v1/social-accounts",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer pb_live_test_key",
        }),
      })
    );
  });

  it("maps social accounts from data envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "sa-1",
              platform: "instagram",
              display_name: "Brand IG",
              username: "@brand",
              disabled: false,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const accounts = await fetchPostBridgeAccounts(creds);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: "sa-1",
      name: "Brand IG",
      platform: "instagram",
      profile: "@brand",
      disabled: false,
    });
  });
});
