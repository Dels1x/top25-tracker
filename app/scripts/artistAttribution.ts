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
 * correct "Kill Bill: The Rapper" used elsewhere in the catalog), "RAP
 * FERRERIA" (typo'd/all-caps vs. "R.A.P. Ferreira"), and "KA" (all-caps vs.
 * the dominant "Ka" spelling used on the vast majority of his tracks).
 */
export const SPOTIFY_MISSPELLINGS: Record<string, string> = {
  "Kill Bill the Rapper": "Kill Bill: The Rapper",
  "RAP FERRERIA": "R.A.P. Ferreira",
  KA: "Ka",
  // Add more here as they turn up, e.g.:
  // "Kendrik Lamar": "Kendrick Lamar",
};

/**
 * alias name -> canonical name. Every occurrence of the alias (as a credited
 * artist on any track, for any person) is treated as the canonical name for
 * scoring purposes - including when an alias and its canonical name (or two
 * aliases of the same person) are credited together on the same track; that
 * still counts as one person, one point, not two. Reserved for an
 * unambiguous rename of the SAME stage identity (no real "these are
 * different projects" argument either way) - e.g. Milo -> R.A.P. Ferreira.
 *
 * A softer case - the same person's music released under a genuinely
 * different PROJECT name (Mount Eerie / The Microphones), or different
 * entities with overlapping membership (Team Sleep / Deftones) - is a
 * judgment call instead, and lives in the OPT-IN `RELATED_PROJECTS` table in
 * `src/lib/relatedProjects.ts`, applied at runtime behind the "unite similar
 * artists/groups" checkbox rather than forced here.
 */
export const ARTIST_ALIASES: Record<string, string> = {
  Milo: "R.A.P. Ferreira",
  "Tariq Trotter": "Black Thought", // his government name, used interchangeably by Spotify
  "No Malice": "Malice", // Clipse's Malice also records under "No Malice" (post-rededication alias)
  // Add more here only for a genuine rename of the same identity, e.g.:
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
  "Run The Jewels": ["Killer Mike", "El-P"],
  "Bad Meets Evil": ["Eminem", "Royce Da 5'9\""],
  // The Roots have had a large, shifting lineup over the years - only their
  // MC/frontman is expanded here, not every past member, same pattern as
  // the other duo-style entries above.
  "The Roots": ["Black Thought"],
  Clipse: ["Pusha T", "Malice"],
  "Black Star": ["Mos Def", "Talib Kweli"],
  "Gang Starr": ["Guru", "DJ Premier"],
  "Mobb Deep": ["Prodigy", "Havoc"],
  Outkast: ["Big Boi", "André 3000"],
  "Smif-N-Wessun": ["Tek", "Steele"],
  // Add more groups here as they show up.
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
