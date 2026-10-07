/**
 * Album bucketing for the "Albums" mode alongside Leaderboard/Timeline/
 * Shared/Compare's existing Artists/Genres/Years/Decades/Duration modes.
 * Unlike duration (durationBuckets.ts) there's no numeric range to bucket -
 * every Track already carries its own `album` title straight from the CSV's
 * "Album Name" column (buildData.ts), so the "bucket" is just that string
 * literally, with no lookup table and no rounding/grouping logic at all.
 *
 * A track counts toward exactly one album - like release year/decade/
 * duration (and unlike genre), a song only appears on one album.
 */

export const UNKNOWN_ALBUM = "Unknown";

/**
 * The album bucket a track counts toward, or UNKNOWN_ALBUM for a
 * missing/blank album title (4 of 3118 real tracks - mostly spotify:local
 * rows with no catalog metadata) - same "Unknown" convention
 * yearBucketForTrack/durationBucketForTrack already use for other
 * missing-metadata cases.
 */
export function albumBucketForTrack(album: string | null | undefined): string {
  const trimmed = album?.trim();
  return trimmed ? trimmed : UNKNOWN_ALBUM;
}
