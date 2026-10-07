/**
 * Track-length bucketing for the "Duration" mode alongside Leaderboard/
 * Timeline/Shared/Compare's existing Artists/Genres/Years/Decades modes.
 * Like releaseEra.ts, this needs no hand-maintained lookup table - every
 * Track already carries its own `durationMs` straight from the CSV's
 * "Duration (ms)" column (buildData.ts), so the bucket is derived directly
 * from data already on hand.
 *
 * A track counts toward exactly one duration bucket - like release year/
 * decade (and unlike genre), a song only has one length.
 */

export const UNKNOWN_DURATION = "Unknown";

/**
 * Ordered bucket labels, shortest to longest, so UI lists can sort by this
 * order rather than alphabetically. Per the project owner's own spec: 1
 * minute wide from 1 to 6 minutes (where most songs fall, so finer
 * granularity is useful there - "3-4 min" means 3:00-3:59, not 3:00-4:59),
 * then 2-minute-wide for 6-7/8-9 (i.e. "6-7 min" is 6:00-7:59), then the wide
 * tail bands (10-20/20-30/30+) for the rare long-form track (podcasts,
 * suites, DJ mixes) where minute-by-minute buckets would just produce a long
 * tail of empty rows.
 */
export const DURATION_BUCKETS: string[] = [
  "Under 1 min",
  "1-2 min",
  "2-3 min",
  "3-4 min",
  "4-5 min",
  "5-6 min",
  "6-7 min",
  "8-9 min",
  "10-20 min",
  "20-30 min",
  "Over 30 min",
  UNKNOWN_DURATION,
];

export function durationBucketForTrack(durationMs: number | null): string {
  if (durationMs === null || durationMs <= 0) return UNKNOWN_DURATION;
  const minutes = durationMs / 60_000;
  if (minutes < 1) return "Under 1 min";
  if (minutes < 2) return "1-2 min";
  if (minutes < 3) return "2-3 min";
  if (minutes < 4) return "3-4 min";
  if (minutes < 5) return "4-5 min";
  if (minutes < 6) return "5-6 min";
  if (minutes < 8) return "6-7 min";
  if (minutes < 10) return "8-9 min";
  if (minutes < 20) return "10-20 min";
  if (minutes < 30) return "20-30 min";
  return "Over 30 min";
}

/** "3:42" style human-readable formatting for a raw ms duration, or null if unknown. */
export function formatDuration(durationMs: number | null): string | null {
  if (durationMs === null || durationMs <= 0) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
