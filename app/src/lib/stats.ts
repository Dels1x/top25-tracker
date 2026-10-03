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
  person?: string
): Array<Track & { month: string; person: string }> {
  const out: Array<Track & { month: string; person: string }> = [];
  for (const list of dataset.lists) {
    if (person && list.person !== person) continue;
    for (const track of list.tracks) {
      out.push({ ...track, month: list.month, person: list.person });
    }
  }
  return out;
}

/** Total scoring points per artist across all months (optionally for one person). */
export function artistTotals(dataset: Dataset, person?: string): ArtistTotal[] {
  const totals = new Map<string, number>();
  for (const track of allTracks(dataset, person)) {
    for (const artist of track.scoringArtists) {
      totals.set(artist, (totals.get(artist) ?? 0) + 1);
    }
  }
  return Array.from(totals.entries())
    .map(([artist, total]) => ({ artist, total }))
    .sort((a, b) => b.total - a.total);
}

/** Per-month point counts per artist, for building a time series chart. */
export function artistMonthCounts(dataset: Dataset, person?: string): ArtistMonthCount[] {
  const counts = new Map<string, number>(); // key: `${artist}\u0000${month}`
  for (const track of allTracks(dataset, person)) {
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
  topArtists: string[]
): CumulativeSeriesPoint[] {
  const months = sortedMonths(dataset, person);
  const perMonth = artistMonthCounts(dataset, person);

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
