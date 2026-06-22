import { describe, it, expect } from "vitest";
import {
  domainEntityKey,
  entityKeysFor,
  extractRegistrableDomain,
  handleEntityKey,
  isPlatformHost,
  nameEntityKey,
  primaryEntityKey,
} from "@/services/intelligence/entity-resolution/entity-key";
import {
  findMatchingCompetitor,
  linkCandidatesByEntity,
  type CompetitorIdentity,
} from "@/services/intelligence/entity-resolution/match-competitor";

describe("entity-key.extractRegistrableDomain", () => {
  it("strips www and subdomains", () => {
    expect(extractRegistrableDomain("https://www.roui.dev/pricing")).toBe("roui.dev");
    expect(extractRegistrableDomain("https://blog.roui.dev/post")).toBe("roui.dev");
  });

  it("respects multi-part public suffixes", () => {
    expect(extractRegistrableDomain("https://example.co.uk/about")).toBe("example.co.uk");
  });

  it("returns null for invalid urls", () => {
    expect(extractRegistrableDomain("not a url")).toBeNull();
  });
});

describe("entity-key.domainEntityKey", () => {
  it("produces stable domain keys", () => {
    expect(domainEntityKey("https://www.roui.dev")).toBe("domain:roui.dev");
    expect(domainEntityKey("https://roui.dev/pricing")).toBe("domain:roui.dev");
  });

  it("rejects platform hosts so different creators don't collapse", () => {
    expect(domainEntityKey("https://www.youtube.com/@roui")).toBeNull();
    expect(domainEntityKey("https://x.com/roui")).toBeNull();
    expect(isPlatformHost("youtube.com")).toBe(true);
  });
});

describe("entity-key.handleEntityKey", () => {
  it("extracts X handles", () => {
    expect(handleEntityKey("https://x.com/roui")).toBe("handle:x:roui");
    expect(handleEntityKey("https://twitter.com/RoUI")).toBe("handle:x:roui");
  });

  it("ignores tweet/post permalinks (no profile to identify)", () => {
    expect(handleEntityKey("https://x.com/roui/status/12345")).toBe("handle:x:roui");
  });

  it("extracts youtube @handles and channel paths", () => {
    expect(handleEntityKey("https://www.youtube.com/@roui")).toBe("handle:youtube:roui");
    expect(handleEntityKey("https://youtube.com/channel/UC123")).toBe("handle:youtube:uc123");
  });

  it("extracts subreddits and reddit users", () => {
    expect(handleEntityKey("https://www.reddit.com/r/roblox/comments/abc")).toBe(
      "handle:reddit:r/roblox"
    );
    expect(handleEntityKey("https://www.reddit.com/user/somebody")).toBe(
      "handle:reddit:u/somebody"
    );
  });

  it("returns null for non-platform hosts", () => {
    expect(handleEntityKey("https://roui.dev/pricing")).toBeNull();
  });
});

describe("entity-key.nameEntityKey", () => {
  it("slugifies and rejects very short names", () => {
    expect(nameEntityKey("RoUI Design System")).toBe("name:rouidesignsystem");
    expect(nameEntityKey("ai")).toBeNull();
    expect(nameEntityKey("")).toBeNull();
  });
});

describe("entity-key.primaryEntityKey", () => {
  it("prefers domain over handle over name", () => {
    expect(
      primaryEntityKey({
        urls: ["https://x.com/roui", "https://roui.dev"],
        name: "RoUI",
      })
    ).toBe("domain:roui.dev");
  });

  it("falls back to handle when only platform URLs are present", () => {
    expect(
      primaryEntityKey({
        urls: ["https://x.com/roui"],
        name: "RoUI",
      })
    ).toBe("handle:x:roui");
  });

  it("falls back to name when no URLs are present", () => {
    expect(primaryEntityKey({ name: "RoUI Design" })).toBe("name:rouidesign");
  });
});

describe("entity-key.entityKeysFor", () => {
  it("returns all keys for a URL+name pair, deduped", () => {
    const keys = entityKeysFor({ url: "https://roui.dev/pricing", name: "RoUI" });
    expect(keys).toContain("domain:roui.dev");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("findMatchingCompetitor", () => {
  const existing: CompetitorIdentity[] = [
    {
      id: "c-roui",
      name: "RoUI",
      entityKey: "domain:roui.dev",
      evidenceUrls: ["https://roui.dev", "https://x.com/roui"],
    },
    {
      id: "c-other",
      name: "Other Tool",
      entityKey: "domain:othertool.com",
      evidenceUrls: ["https://othertool.com"],
    },
  ];

  it("matches by primary domain key", () => {
    const m = findMatchingCompetitor(
      { name: "RoUI Pricing", urls: ["https://blog.roui.dev/post"] },
      existing
    );
    expect(m?.id).toBe("c-roui");
  });

  it("matches via evidence URL handle when input has no domain", () => {
    const m = findMatchingCompetitor(
      { name: "Some thread", urls: ["https://x.com/roui/status/123"] },
      existing
    );
    expect(m?.id).toBe("c-roui");
  });

  it("returns null when nothing overlaps", () => {
    const m = findMatchingCompetitor(
      { name: "Brand New", urls: ["https://newco.io"] },
      existing
    );
    expect(m).toBeNull();
  });

  it("falls back to slugified name when no URL keys match", () => {
    const m = findMatchingCompetitor({ name: "ro u i" }, existing);
    expect(m?.id).toBe("c-roui");
  });
});

describe("linkCandidatesByEntity", () => {
  const competitors: CompetitorIdentity[] = [
    {
      id: "c-roui",
      name: "RoUI",
      entityKey: "domain:roui.dev",
      evidenceUrls: ["https://roui.dev", "https://x.com/roui"],
    },
  ];

  it("links candidates that share a domain or handle key", () => {
    const links = linkCandidatesByEntity(
      [
        { id: "cand-1", url: "https://roui.dev/pricing" },
        { id: "cand-2", url: "https://x.com/roui/status/9" },
        { id: "cand-3", url: "https://unrelated.io" },
      ],
      competitors
    );

    expect(links.get("cand-1")).toBe("c-roui");
    expect(links.get("cand-2")).toBe("c-roui");
    expect(links.has("cand-3")).toBe(false);
  });

  it("returns an empty map when there are no competitors", () => {
    expect(linkCandidatesByEntity([{ id: "x", url: "https://roui.dev" }], [])).toEqual(
      new Map()
    );
  });
});
