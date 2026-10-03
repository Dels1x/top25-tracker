import type { Dataset, MonthlyList, Track } from "../data/types";

/** One point per occurrence of an artist in `scoringArtists` across a track. */
export interface ArtistMonthCount {
  artist: string;
  month: string; // "YYYY-MM"
  count: number;
}

export interface ArtistTotal {
  artist: string;
  total: number;
}

/**
 * Identifies "the same song" for duplicate-counting purposes: title + the
 * credited artist list, as written (not the group-expanded scoring list).
 * ISRC/Spotify ID aren't used because locally-matched tracks lack them.
 */
export function trackKey(track: Pick<Track, "title" | "creditedArtists">): string {
  return `${track.title.toLowerCase().trim()}\u0000${track.creditedArtists
    .map((a) => a.toLowerCase().trim())
    .sort()
    .join(",")}`;
}

export interface StatsOptions {
  /**
   * When false (default true), a song that appears in more than one month's
   * top 25 counts only once per artist overall - toward the FIRST month (by
   * date) it appeared in - instead of once per occurrence. Toggled by the
   * "include duplicates" checkbox in the UI.
   */
  includeDuplicates?: boolean;
}

/**
 * Given a person's (or everyone's) tracks in chronological order, returns the
 * subset to count when duplicates are excluded: the first occurrence of each
 * distinct song (by trackKey), dropping later repeats entirely.
 */
function dedupeFirstOccurrence<T extends Track & { month: string }>(tracks: T[]): T[] {
  const sorted = [...tracks].sort((a, b) => a.month.localeCompare(b.month));
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const track of sorted) {
    const key = trackKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(track);
  }
  return kept;
}

/** Sort key helper: "YYYY-MM" strings sort correctly as plain strings already. */
export function sortedMonths(dataset: Dataset, person?: string): string[] {
  const months = new Set<string>();
  for (const list of dataset.lists) {
    if (person && list.person !== person) continue;
    months.add(list.month);
  }
  return Array.from(months).sort();
}

export function listsForPerson(dataset: Dataset, person: string): MonthlyList[] {
  return dataset.lists.filter((l) => l.person === person);
}

/** Flatten a person's (or everyone's) tracks into a single array, each tagged with its month. */
export function allTracks(
  dataset: Dataset,
  person?: string,
  options?: StatsOptions
): Array<Track & { month: string; person: string }> {
  const out: Array<Track & { month: string; person: string }> = [];
  for (const list of dataset.lists) {
    if (person && list.person !== person) continue;
    for (const track of list.tracks) {
      out.push({ ...track, month: list.month, person: list.person });
    }
  }
  if (options?.includeDuplicates === false) {
    return dedupeFirstOccurrence(out);
  }
  return out;
}

/** Total scoring points per artist across all months (optionally for one person). */
export function artistTotals(
  dataset: Dataset,
  person?: string,
  options?: StatsOptions
): ArtistTotal[] {
  const totals = new Map<string, number>();
  for (const track of allTracks(dataset, person, options)) {
    for (const artist of track.scoringArtists) {
      totals.set(artist, (totals.get(artist) ?? 0) + 1);
    }
  }
  return Array.from(totals.entries())
    .map(([artist, total]) => ({ artist, total }))
    .sort((a, b) => b.total - a.total);
}

/** Per-month point counts per artist, for building a time series chart. */
export function artistMonthCounts(
  dataset: Dataset,
  person?: string,
  options?: StatsOptions
): ArtistMonthCount[] {
  const counts = new Map<string, number>(); // key: `${artist}\u0000${month}`
  for (const track of allTracks(dataset, person, options)) {
    for (const artist of track.scoringArtists) {
      const key = `${artist}\u0000${track.month}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).map(([key, count]) => {
    const [artist, month] = key.split("\u0000");
    return { artist, month, count };
  });
}

/**
 * Builds a cumulative running-total series per artist across all months in
 * the dataset (filling months with no new tracks as a flat carry-forward),
 * suitable for a line chart with one line per artist.
 */
export interface CumulativeSeriesPoint {
  month: string;
  [artist: string]: number | string;
}

export function cumulativeArtistSeries(
  dataset: Dataset,
  person: string | undefined,
  topArtists: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const months = sortedMonths(dataset, person);
  const perMonth = artistMonthCounts(dataset, person, options);

  const lookup = new Map<string, number>(); // `${artist}\u0000${month}` -> count this month
  for (const { artist, month, count } of perMonth) {
    lookup.set(`${artist}\u0000${month}`, count);
  }

  const running = new Map<string, number>(topArtists.map((a) => [a, 0]));
  const series: CumulativeSeriesPoint[] = [];

  for (const month of months) {
    const point: CumulativeSeriesPoint = { month };
    for (const artist of topArtists) {
      const delta = lookup.get(`${artist}\u0000${month}`) ?? 0;
      const newTotal = (running.get(artist) ?? 0) + delta;
      running.set(artist, newTotal);
      point[artist] = newTotal;
    }
    series.push(point);
  }

  return series;
}
