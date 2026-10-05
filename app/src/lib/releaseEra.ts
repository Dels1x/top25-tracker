/**
 * Release-year/decade bucketing for a Track - the "Years"/"Decades" modes
 * alongside Leaderboard/Timeline's existing Artists/Genres modes. Unlike
 * genre classification (artistGenres.ts), this needs no hand-maintained
 * lookup table at all - every Track already carries its own `releaseDate`
 * straight from Spotify's catalog (buildData.ts), so the bucket is derived
 * directly from data already on hand, not a judgment call.
 *
 * A track counts toward exactly one year and one decade - unlike genres,
 * where a track can legitimately belong to several buckets via multiple
 * artists/subgenres, a song only has one release date.
 */

export const UNKNOWN_ERA = "Unknown";

/**
 * Pulls the 4-digit release year out of a track's raw `releaseDate`, or null
 * if unknown. Handles two real cases beyond a clean "YYYY-MM-DD"/"YYYY-MM"/
 * "YYYY" string: a missing releaseDate (47 of 3118 tracks in the real
 * dataset), and the literal sentinel "0000" Spotify's own catalog uses for
 * at least one track ("Imported Goods" by Action Bronson) when it has no
 * real release-date metadata - both are "unknown", not year 0.
 */
export function releaseYear(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.split("-")[0]);
  if (!year) return null; // NaN, or the "0000" sentinel
  return year;
}

/** "1994" -> "1990s". */
export function releaseDecade(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

/**
 * The year/decade bucket label(s) a track counts toward - a 1-element array
 * (or empty for UNTAGGED, mirroring genreBucketsForTrack's "no recognized
 * artist" case) so callers can reuse the same "flatMap over bucket list"
 * shape genre totals already use, even though a track only ever has one
 * release year.
 */
export function yearBucketForTrack(releaseDate: string | null): string {
  const year = releaseYear(releaseDate);
  return year === null ? UNKNOWN_ERA : String(year);
}

export function decadeBucketForTrack(releaseDate: string | null): string {
  const year = releaseYear(releaseDate);
  return year === null ? UNKNOWN_ERA : releaseDecade(year);
}
