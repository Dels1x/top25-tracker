/**
 * Artist-identity rules: deciding who actually gets credit/points for a
 * track, beyond what's literally written in the CSV. Three separate concerns
 * live here, applied in order (misspellings and aliases both resolve before
 * group expansion, so a group whose listed "members" are themselves aliases
 * or misspelled still resolves to the right canonical person):
 *
 * 1. MISSPELLING correction - Spotify's own catalog occasionally credits an
 *    artist under a typo'd or malformed spelling of their real name (not a
 *    deliberate alias - just bad metadata on their end). These should merge
 *    silently into the correctly-spelled name; there's no "both spellings
 *    are valid" nuance the way there is with a real alias.
 * 2. ALIAS canonicalization - the same person released music under more
 *    than one artist name over time (a rename, a side alias, a "FKA"). Every
 *    alias should collapse into ONE canonical name for scoring, so the
 *    person's songs aren't split across multiple "artists" in the stats.
 * 3. GROUP -> MEMBER expansion - a duo/group whose individual members also
 *    have independent solo careers; crediting the group implicitly credits
 *    each member too (see expandCreditedArtists below).
 *
 * None of these tables are derivable from the CSVs - all are hand-maintained
 * as new cases show up in someone's top 25. Keys/values must match the
 * artist name exactly as it appears in the CSV `Artist Name(s)` field
 * (case-sensitive, after the per-row name is split on the schema's artist
 * delimiter).
 */

/**
 * misspelled/malformed credit -> correctly spelled name, as it should read
 * everywhere in the app. Unlike ARTIST_ALIASES below, these aren't a
 * different name the artist actually used - they're just how Spotify's
 * catalog happened to credit the track, and should be invisible once fixed.
 * Found so far: "Kill Bill the Rapper" (missing colon/wrong case, vs. the
 * correct "Kill Bill: The Rapper" used elsewhere in the catalog) and "RAP
 * FERRERIA" (typo'd/all-caps vs. "R.A.P. Ferreira").
 */
export const SPOTIFY_MISSPELLINGS: Record<string, string> = {
  "Kill Bill the Rapper": "Kill Bill: The Rapper",
  "RAP FERRERIA": "R.A.P. Ferreira",
  // Add more here as they turn up, e.g.:
  // "Kendrik Lamar": "Kendrick Lamar",
};

/**
 * alias name -> canonical name. Every occurrence of the alias (as a credited
 * artist on any track, for any person) is treated as the canonical name for
 * scoring purposes - including when an alias and its canonical name (or two
 * aliases of the same person) are credited together on the same track; that
 * still counts as one person, one point, not two.
 */
export const ARTIST_ALIASES: Record<string, string> = {
  "Mount Eerie": "Phil Elverum",
  "The Microphones": "Phil Elverum",
  Milo: "R.A.P. Ferreira",
  // Add more aliases here as they show up, e.g.:
  // "Lil Ugly Mane": "Shawn Kemp",
};

/**
 * Group/duo -> constituent member attribution.
 *
 * Rule (per project owner): if a track credit names a group/duo whose members
 * also have independent solo careers, and the credit does NOT separately list
 * those members by name, each member gets a full point too (in addition to the
 * group itself getting its own point as a distinct "artist").
 */
export const GROUP_MEMBERS: Record<string, string[]> = {
  "Armand Hammer": ["billy woods", "E L U C I D"],
  // Add more groups here as they show up, e.g.:
  // "Run The Jewels": ["Killer Mike", "El-P"],
  // "Clipse": ["Pusha T", "No Malice"],
};

function canonicalize(name: string): string {
  const corrected = SPOTIFY_MISSPELLINGS[name] ?? name;
  return ARTIST_ALIASES[corrected] ?? corrected;
}

/**
 * Given the list of credited artist names for a track (already split on the
 * schema's artist delimiter), return the full list of artists who should get
 * a point: each credited name resolved to its canonical identity, plus any
 * group members implied by GROUP_MEMBERS for credited names that are known
 * groups.
 *
 * The Set naturally dedupes: a member already separately credited on the
 * track (e.g. "Armand Hammer, billy woods"), or two aliases of the same
 * person credited together (e.g. "Milo, R.A.P. Ferreira"), both collapse to
 * one entry rather than double-counting.
 */
export function expandCreditedArtists(creditedNames: string[]): string[] {
  const result = new Set<string>();
  for (const name of creditedNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const canonical = canonicalize(trimmed);
    result.add(canonical);
    const members = GROUP_MEMBERS[canonical];
    if (members) {
      for (const member of members) {
        result.add(canonicalize(member));
      }
    }
  }
  return Array.from(result);
}
