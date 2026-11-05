/**
 * Hand-maintained corrections for a track's `Release Date` when Spotify's own
 * catalog has it wrong - same class of problem as SPOTIFY_MISSPELLINGS in
 * artistAttribution.ts (bad metadata on Spotify's end, not a judgment call),
 * applied at build time so it's baked into data.json and every consumer
 * (Leaderboard/Timeline/Replay's Years/Decades mode, Replay's card meta
 * line, etc.) sees the corrected date with no runtime awareness needed.
 *
 * Keyed by artist + ALBUM title (both exactly as they appear in the CSV's
 * `Artist Name(s)`/`Album Name` columns) rather than per-track - a release
 * date is a property of the ALBUM, so one entry corrects every track Spotify
 * credits to that artist/album combo at once, matching how the mistake
 * actually originates (Spotify has the wrong date for the whole release, not
 * one song on it). Only add an entry here once a real case is confirmed
 * wrong - this is a narrow, explicit exception table like
 * SPOTIFY_MISSPELLINGS/ARTIST_ALIASES/GROUP_MEMBERS/
 * DISTINCT_RECORDING_ISRCS, not a general reconciliation against some other
 * source of truth.
 *
 * Current case: Bark Psychosis's "Codename: Dustsucker" - Spotify's catalog
 * lists 2005-04-19 (its later/wider reissue date), but the album actually
 * released 2004-09-01.
 */
const RELEASE_DATE_CORRECTIONS: Record<string, string> = {
  "Bark Psychosis\u0000Codename: Dustsucker": "2004-09-01",
  // Add more here as "artist\u0000album" -> "YYYY-MM-DD", e.g.:
  // "Some Artist\u0000Some Album": "1999-01-01",
};

function correctionKey(artist: string, album: string): string {
  return `${artist}\u0000${album}`;
}

/**
 * Returns the corrected release date for this artist/album, or `fallback`
 * (Spotify's own value) unchanged if no correction applies. `artist` should
 * be the track's own primary/first credited artist as written in the CSV -
 * matching SPOTIFY_MISSPELLINGS's convention of keying on the exact credited
 * spelling, not a resolved/canonical one, since this runs before
 * attribution resolution in buildData.ts.
 */
export function correctedReleaseDate(
  artist: string,
  album: string,
  fallback: string | null
): string | null {
  return RELEASE_DATE_CORRECTIONS[correctionKey(artist, album)] ?? fallback;
}
