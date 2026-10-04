/**
 * Hand-maintained exception list for the rare case where two GENUINELY
 * DIFFERENT recordings share both a title and a credited-artist list, so
 * trackKey (stats.ts) would otherwise incorrectly treat them as "the same
 * song" for dedup purposes. This is deliberately a narrow, explicit
 * exception table rather than a general change to trackKey's matching
 * rule (e.g. folding in album or ISRC everywhere) - ISRC isn't reliable
 * enough to use unconditionally (locally-matched `spotify:local:...` rows
 * have none at all - see trackKey's own doc comment), and album/ISRC CAN
 * legitimately change across a genuine re-release of the SAME song that
 * should still collapse together, which is exactly what normalizeTitle's
 * release-tag stripping already handles. So: only reach for this table
 * when an identical-title collision between two provably different
 * recordings actually turns up, the same way SPOTIFY_MISSPELLINGS/
 * ARTIST_ALIASES/GROUP_MEMBERS in artistAttribution.ts only grow when a
 * real case is spotted - don't try to solve the general problem here.
 *
 * Keyed by ISRC (reliable and unique per distinct recording when present,
 * unlike title/album which can coincidentally repeat) - each entry's value
 * is appended to that track's trackKey so it stops colliding with any
 * other same-titled/same-artist track that ISN'T in this table.
 *
 * Current case: delsix's "Outside" by Lupe Fiasco shows up twice -
 * 2023-07 (ISRC USVCQ2300006, album "Outside", from the "Samurai" era's
 * lead-up) and 2024-07 (ISRC US5KD2400018, album "Samurai") - these are
 * two different songs that happen to share a title and artist, not a
 * re-release of one song. Without this table, "include duplicates off"
 * would silently drop the 2024-07 one as if it were a repeat of the
 * 2023-07 pick.
 */
export const DISTINCT_RECORDING_ISRCS = new Set<string>([
  "USVCQ2300006", // "Outside" - Lupe Fiasco (2023-07, album "Outside")
  "US5KD2400018", // "Outside" - Lupe Fiasco (2024-07, album "Samurai") - different song, same title/artist
]);

/**
 * True if this track's ISRC is one of the known same-title/same-artist
 * collisions above - trackKey should fold the ISRC itself into the key
 * for any such track, so each distinct recording gets its own key instead
 * of only the ones with no ISRC at all sharing a fallback.
 */
export function isDistinctRecording(isrc: string | null): boolean {
  return isrc !== null && DISTINCT_RECORDING_ISRCS.has(isrc);
}
