// Phase 2 stubs — discovery planner and runner.
// LLM decides queries; deterministic code executes search, dedupe, enrich, and storage.

export { saveSourceCandidates } from "../memory/save-source-candidates";

export async function planDiscovery(): Promise<never> {
  throw new Error("Discovery planner is Phase 2. Implement plan-discovery.ts first.");
}

export async function runDiscovery(): Promise<never> {
  throw new Error("Discovery runner is Phase 2. Implement run-discovery.ts first.");
}
