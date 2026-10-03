/**
 * Group/duo -> constituent member attribution.
 *
 * Rule (per project owner): if a track credit names a group/duo whose members
 * also have independent solo careers, and the credit does NOT separately list
 * those members by name, each member gets a full point too (in addition to the
 * group itself getting its own point as a distinct "artist").
 *
 * This table is not derivable from the CSVs - it has to be maintained by hand
 * as new groups show up in the top 25s. Keys must match the artist name exactly
 * as it appears in the CSV `Artist Name(s)` field (case-sensitive, after the
 * per-row name is split on ';').
 */
export const GROUP_MEMBERS: Record<string, string[]> = {
  "Armand Hammer": ["billy woods", "E L U C I D"],
  // Add more groups here as they show up, e.g.:
  // "Run The Jewels": ["Killer Mike", "El-P"],
  // "Clipse": ["Pusha T", "No Malice"],
};

/**
 * Given the list of credited artist names for a track (already split on the
 * schema's artist delimiter), return the full list of artists who should get
 * a point: the credited names themselves, plus any group members implied by
 * GROUP_MEMBERS for credited names that are known groups.
 *
 * If a member is ALREADY separately credited on the track (e.g. "Armand
 * Hammer, billy woods" explicitly lists billy woods), we don't need to add
 * them again - the Set dedupes that for us.
 */
export function expandCreditedArtists(creditedNames: string[]): string[] {
  const result = new Set<string>();
  for (const name of creditedNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    result.add(trimmed);
    const members = GROUP_MEMBERS[trimmed];
    if (members) {
      for (const member of members) {
        result.add(member);
      }
    }
  }
  return Array.from(result);
}
