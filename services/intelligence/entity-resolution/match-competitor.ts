import { entityKeysFor, nameEntityKey, primaryEntityKey } from "./entity-key";

export interface CompetitorIdentity {
  id: string;
  name: string;
  entityKey: string | null;
  evidenceUrls: string[];
}

export interface CompetitorMatchInput {
  name?: string | null;
  urls?: Array<string | null | undefined>;
}

/**
 * Find an existing competitor that represents the same entity as the input.
 * Strategy (most-specific first):
 *   1. Same primary entity key (domain or handle).
 *   2. Any of the input's keys appears in any of the competitor's keys.
 *   3. Slugified name match.
 *
 * Returns null when nothing matches — the caller should insert a new row.
 */
export function findMatchingCompetitor(
  input: CompetitorMatchInput,
  existing: CompetitorIdentity[]
): CompetitorIdentity | null {
  const incomingPrimary = primaryEntityKey({ urls: input.urls, name: input.name });
  const incomingKeys = new Set(entityKeysFor({ name: input.name }).concat(
    (input.urls ?? []).flatMap((u) => (u ? entityKeysFor({ url: u }) : []))
  ));
  const incomingNameKey = nameEntityKey(input.name ?? null);

  // Primary key match (domain or handle)
  if (incomingPrimary) {
    for (const competitor of existing) {
      if (competitor.entityKey && competitor.entityKey === incomingPrimary) {
        return competitor;
      }
    }
  }

  // Any key overlap (domain, handle, or alternate URLs)
  for (const competitor of existing) {
    const competitorKeys = competitorKeySet(competitor);
    for (const key of incomingKeys) {
      if (competitorKeys.has(key)) return competitor;
    }
  }

  // Name slug fallback — last resort
  if (incomingNameKey) {
    for (const competitor of existing) {
      if (nameEntityKey(competitor.name) === incomingNameKey) return competitor;
    }
  }

  return null;
}

function competitorKeySet(competitor: CompetitorIdentity): Set<string> {
  const keys = new Set<string>();
  if (competitor.entityKey) keys.add(competitor.entityKey);
  for (const key of entityKeysFor({ name: competitor.name })) keys.add(key);
  for (const url of competitor.evidenceUrls) {
    for (const key of entityKeysFor({ url })) keys.add(key);
  }
  return keys;
}

/**
 * Bulk-link source candidates to competitors by entity key. Pure: returns the
 * mapping that should be persisted; the caller writes it to the DB.
 */
export interface CandidateForLinking {
  id: string;
  url: string;
}

export function linkCandidatesByEntity(
  candidates: CandidateForLinking[],
  competitors: CompetitorIdentity[]
): Map<string, string> {
  const links = new Map<string, string>();
  if (!candidates.length || !competitors.length) return links;

  // Index competitor keys for O(1) lookup
  const keyToCompetitorId = new Map<string, string>();
  for (const competitor of competitors) {
    for (const key of competitorKeySet(competitor)) {
      // First-write-wins so a competitor with a strong primary key
      // owns ambiguous keys like name slugs.
      if (!keyToCompetitorId.has(key)) keyToCompetitorId.set(key, competitor.id);
    }
  }

  for (const candidate of candidates) {
    for (const key of entityKeysFor({ url: candidate.url })) {
      const competitorId = keyToCompetitorId.get(key);
      if (competitorId) {
        links.set(candidate.id, competitorId);
        break;
      }
    }
  }

  return links;
}
