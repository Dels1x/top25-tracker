import type { Dataset, MonthlyList, Track } from "../data/types";
import { uniteRelatedProject } from "./relatedProjects";
import { isKnownProducer } from "./knownProducers";

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
 * Strips a trailing release-tag segment from a track title - e.g.
 * "Paradise II (feat. Norah Jones) - Single Version" and the same song's
 * album-release entry "Paradise II (feat. Norah Jones)" are the same
 * recording re-tagged by the distributor, not two different songs. Only
 * matches a segment built from a known descriptor word (a year, "explicit",
 * "album", "single", "radio", "extended", "anniversary", "deluxe", "tv",
 * "digital", "clean", "mono", "stereo") followed by a release noun
 * ("version"/"edit"/"edition"/"remaster[ed]") - so "(Remix)", "- Live", and
 * other suffixes that denote a genuinely different recording are left alone
 * and still count as distinct songs. "(feat. ...)" is never touched.
 */
const RELEASE_DESCRIPTOR =
  "(?:\\d{4}|digital|explicit|clean|album|single|radio|extended|anniversary|deluxe|tv|mono|stereo)";
const RELEASE_NOUN = "(?:version|edit|edition|remaster(?:ed)?)";
const RELEASE_TAG = `${RELEASE_DESCRIPTOR}(?:\\s+${RELEASE_DESCRIPTOR})*\\s+${RELEASE_NOUN}`;
const TRAILING_DASH_TAG = new RegExp(`\\s*[-–—]\\s*(${RELEASE_TAG})\\s*$`, "i");
const TRAILING_PAREN_TAG = new RegExp(`\\s*[([]\\s*(${RELEASE_TAG})\\s*[)\\]]\\s*$`, "i");

export function normalizeTitle(title: string): string {
  let t = title.trim();
  let prev: string;
  do {
    prev = t;
    t = t.replace(TRAILING_DASH_TAG, "").replace(TRAILING_PAREN_TAG, "").trim();
  } while (t !== prev);
  return t;
}

/**
 * Identifies "the same song" for duplicate-counting purposes: normalized
 * title + the credited artist list, as written (not the group-expanded
 * scoring list). ISRC/Spotify ID aren't used because locally-matched tracks
 * lack them.
 */
export function trackKey(track: Pick<Track, "title" | "creditedArtists">): string {
  return `${normalizeTitle(track.title).toLowerCase()}\u0000${track.creditedArtists
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
  /**
   * Restrict to months >= startMonth and/or <= endMonth (both "YYYY-MM",
   * inclusive). Applied BEFORE dedup, so "include duplicates off" only
   * considers a song's first occurrence within the range, not its first
   * occurrence ever - e.g. a song whose only in-range appearance is a repeat
   * of something from before the range still counts once, since within the
   * range it only shows up the one time.
   */
  startMonth?: string;
  endMonth?: string;
  /**
   * When true (default false), credits for a project in RELATED_PROJECTS
   * (src/lib/relatedProjects.ts) count toward its unified name instead of
   * the project's own name - e.g. "Team Sleep" credits count as "Deftones".
   * Unlike the build-time ARTIST_ALIASES/SPOTIFY_MISSPELLINGS tables baked
   * into scoringArtists, this is a judgment call the viewer opts into via
   * the "unite similar artists/groups" checkbox, not a certainty applied
   * unconditionally.
   */
  uniteRelatedProjects?: boolean;
  /**
   * When false (default - "show producers" checkbox OFF), credited names in
   * KNOWN_PRODUCERS (src/lib/knownProducers.ts) are dropped from
   * scoringArtists entirely - no points, invisible in Leaderboard/Timeline -
   * since whether a given track credits its producer at all is inconsistent
   * in this data, making producer counts unreliable by default. Does NOT
   * touch `creditedArtists` - the raw per-track credit list (song dropdown,
   * Replay) always shows what's literally on the record regardless of this
   * setting.
   */
  showProducers?: boolean;
}

function inRange(month: string, options?: StatsOptions): boolean {
  if (options?.startMonth && month < options.startMonth) return false;
  if (options?.endMonth && month > options.endMonth) return false;
  return true;
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
export function sortedMonths(dataset: Dataset, person?: string, options?: StatsOptions): string[] {
  const months = new Set<string>();
  for (const list of dataset.lists) {
    if (person && list.person !== person) continue;
    if (!inRange(list.month, options)) continue;
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
    if (!inRange(list.month, options)) continue;
    for (const track of list.tracks) {
      let scoringArtists = track.scoringArtists;
      if (options?.uniteRelatedProjects) {
        scoringArtists = Array.from(new Set(scoringArtists.map(uniteRelatedProject)));
      }
      if (!options?.showProducers) {
        scoringArtists = scoringArtists.filter((a) => !isKnownProducer(a));
      }
      out.push({ ...track, scoringArtists, month: list.month, person: list.person });
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
 * All tracks counting toward a given artist's score, newest month first -
 * the exact set backing their number in artistTotals (same options, same
 * dedup rule), for display in a "show me the songs" dropdown.
 */
export function tracksForArtist(
  dataset: Dataset,
  artist: string,
  person?: string,
  options?: StatsOptions
): Array<Track & { month: string; person: string }> {
  return allTracks(dataset, person, options)
    .filter((track) => track.scoringArtists.includes(artist))
    .sort((a, b) => b.month.localeCompare(a.month));
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
  const months = sortedMonths(dataset, person, options);
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
