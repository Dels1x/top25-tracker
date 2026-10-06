import type { Dataset, MonthlyList, Track } from "../data/types";
import { uniteRelatedProject } from "./relatedProjects";
import { isKnownProducer } from "./knownProducers";
import { genresForArtists } from "./artistGenres";
import { isDistinctRecording } from "./trackDisambiguation";
import { decadeBucketForTrack, yearBucketForTrack } from "./releaseEra";

/** One point per occurrence of an artist in `scoringArtists` across a track. */
export interface ArtistMonthCount {
  artist: string;
  month: string; // "YYYY-MM"
  count: number;
}

export interface ArtistTotal {
  artist: string;
  total: number;
  /**
   * Raw number of qualifying track occurrences behind `total` - always a
   * plain integer count, independent of `weightByRank` (which only scales
   * `total`'s per-track contribution, never how many tracks there are). Lets
   * the UI show "303pts (5)" when weighting is on, so the points figure
   * doesn't read as a mysterious number disconnected from "how many songs."
   */
  count: number;
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
 * scoring list). ISRC/Spotify ID aren't used GENERALLY because
 * locally-matched tracks lack them, and because a genuine re-release of the
 * same song can legitimately get a new ISRC (normalizeTitle's release-tag
 * stripping already handles that case via title matching instead).
 *
 * The one exception: trackDisambiguation.ts's small hand-maintained list of
 * ISRCs that are known to be GENUINELY DIFFERENT recordings which happen to
 * share a title + credited-artist list (e.g. two different Lupe Fiasco
 * songs both just called "Outside") - for those specific tracks, the ISRC
 * is folded into the key so they stop colliding with each other, instead of
 * incorrectly looking like one song repeated across two months.
 */
export function trackKey(track: Pick<Track, "title" | "creditedArtists" | "isrc">): string {
  const base = `${normalizeTitle(track.title).toLowerCase()}\u0000${track.creditedArtists
    .map((a) => a.toLowerCase().trim())
    .sort()
    .join(",")}`;
  return isDistinctRecording(track.isrc) ? `${base}\u0000${track.isrc}` : base;
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
  /**
   * When false (default - "show duos" checkbox OFF), a group/duo name
   * itself (dataset.groupNames, from GROUP_MEMBERS) is dropped from
   * scoringArtists - its members already get full credit via expansion
   * (see expandCreditedArtists in artistAttribution.ts), so showing the
   * group's own entry too is additional/optional context, not new points.
   * Does NOT touch `creditedArtists` - the raw per-track credit list (song
   * dropdown, Replay) always shows the group name if that's what's
   * literally on the record, regardless of this setting.
   */
  showDuos?: boolean;
  /**
   * When set, drops any scoringArtist whose OWN genre(s) (via
   * genresForArtists on that single artist, not the whole track) don't
   * intersect this set - powers the Leaderboard's genre filter checkboxes.
   * This is deliberately per-ARTIST, not per-track: a track by Kendrick
   * Lamar featuring Kali Uchis stays visible for Kali Uchis (R&B/Soul) even
   * with Hip-Hop unchecked, but Kendrick himself (Hip-Hop) still gets
   * dropped from that same track - checking the track's combined genre set
   * instead would incorrectly keep showing Kendrick just because a
   * differently-genred collaborator is also on the song. undefined/omitted
   * means no filter (show everyone), matching the "all checked" default in
   * the UI - an empty Set means "nothing selected", which correctly shows
   * nobody rather than silently falling back to unfiltered.
   */
  genreFilter?: Set<string>;
  /**
   * When set, drops any track whose rank (1 = favorite) is greater than this
   * number entirely - powers the Leaderboard's Top 1/3/5/10/25 buttons. This
   * is a per-TRACK cutoff, not a per-artist one (unlike genreFilter): an
   * artist's #12 song is simply excluded from every count/series/drill-down
   * when maxRank is 10, regardless of whether that same artist also has a
   * #3 song that month - it doesn't make the artist "qualify" and then count
   * everything they have. undefined/omitted means no cutoff (same as
   * "Top 25", the full list) - this mirrors how genreFilter distinguishes
   * undefined ("no filter") from an explicit value.
   */
  maxRank?: number;
  /**
   * When true (default false - "Weight by placement" checkbox), every count
   * this file produces is a sum of per-track POINTS (via rankPoints(rank))
   * instead of a flat 1 per occurrence - a #1 song is worth far more than a
   * #25 one. See rankPoints's own doc comment for the curve. Applied in
   * allTracks as a `points` field on each track (1 when this option is off,
   * so every downstream aggregator can unconditionally sum `points` instead
   * of branching on this option itself); every place that used to do
   * `total + 1` per track now does `total + track.points`.
   */
  weightByRank?: boolean;
}

/**
 * The point value of a single placement, when "weight by placement" is on -
 * a smooth, front-loaded curve (not a flat count) so a #1 song is worth
 * dramatically more than a #25 one, but the curve isn't a cliff: it's an
 * exponential decay down to a floor of 10 points, i.e.
 * `floor + (max - floor) * decay^(rank-1)`, anchored so rank 1 = 100 points
 * and rank 5 = 50 points (decay solved from those two anchors) - chosen to
 * match the project owner's own example curve (top 25 ~10, top 20 ~12.5, top
 * 15 ~15, top 10 ~25, top 5 ~50, top 1 ~100) closely across every rank, not
 * just at those sampled points. Values for rank 1..25: 100, 83.5, 70, 59, 50,
 * 42.7, 36.7, 31.8, 27.8, 24.5, 21.9, 19.7, 17.9, 16.5, 15.3, 14.3, 13.5,
 * 12.9, 12.3, 11.9, 11.6, 11.3, 11, 10.8, 10.7 - monotonically decreasing and
 * always > the floor (never reaches exactly 10, by design - rank 25 is still
 * "a favorite that month" per the project's own framing, not worthless).
 * A rank beyond 25 (the two historical overflow months, now cleaned up, or
 * any future one) still gets a sensible, ever-shrinking value rather than a
 * hardcoded floor or an error.
 */
const RANK_POINTS_FLOOR = 10;
const RANK_POINTS_MAX = 100;
const RANK_POINTS_DECAY = Math.pow((50 - RANK_POINTS_FLOOR) / (RANK_POINTS_MAX - RANK_POINTS_FLOOR), 1 / 4);

export function rankPoints(rank: number): number {
  return RANK_POINTS_FLOOR + (RANK_POINTS_MAX - RANK_POINTS_FLOOR) * Math.pow(RANK_POINTS_DECAY, rank - 1);
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
): Array<Track & { month: string; person: string; points: number }> {
  const groupNames = options?.showDuos ? null : new Set(dataset.groupNames);

  const out: Array<Track & { month: string; person: string; points: number }> = [];
  for (const list of dataset.lists) {
    if (person && list.person !== person) continue;
    if (!inRange(list.month, options)) continue;
    for (const track of list.tracks) {
      if (options?.maxRank !== undefined && track.rank > options.maxRank) continue;
      let scoringArtists = track.scoringArtists;
      if (options?.uniteRelatedProjects) {
        scoringArtists = Array.from(new Set(scoringArtists.map(uniteRelatedProject)));
      }
      if (!options?.showProducers) {
        scoringArtists = scoringArtists.filter((a) => !isKnownProducer(a));
      }
      if (groupNames) {
        scoringArtists = scoringArtists.filter((a) => !groupNames.has(a));
      }
      if (options?.genreFilter) {
        const filter = options.genreFilter;
        scoringArtists = scoringArtists.filter((a) =>
          genresForArtists([a]).some((g) => filter.has(g))
        );
      }
      // A track that no longer credits anyone (every artist filtered out,
      // by genre or otherwise) shouldn't appear at all - e.g. with the
      // genre filter, a Kendrick Lamar solo track has nothing left once
      // Hip-Hop is unchecked and should vanish, not show up with an empty
      // artist list.
      if (scoringArtists.length === 0) continue;
      const points = options?.weightByRank ? rankPoints(track.rank) : 1;
      out.push({ ...track, scoringArtists, month: list.month, person: list.person, points });
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
  const counts = new Map<string, number>();
  for (const track of allTracks(dataset, person, options)) {
    for (const artist of track.scoringArtists) {
      totals.set(artist, (totals.get(artist) ?? 0) + track.points);
      counts.set(artist, (counts.get(artist) ?? 0) + 1);
    }
  }
  return Array.from(totals.entries())
    .map(([artist, total]) => ({ artist, total, count: counts.get(artist) ?? 0 }))
    .sort((a, b) => b.total - a.total || a.artist.localeCompare(b.artist));
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
      counts.set(key, (counts.get(key) ?? 0) + track.points);
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

export interface GenreTotal {
  genre: string;
  total: number;
  /**
   * Raw number of qualifying track occurrences behind `total` - same
   * purpose as ArtistTotal.count (always a plain integer, independent of
   * weightByRank) so the UI can show "pts (count)" in genre mode too, now
   * that "weight by placement" applies there as well.
   */
  count: number;
}

export interface GenreMonthCount {
  genre: string;
  month: string;
  count: number;
}

/**
 * The major genre(s) a track counts toward, classified by its (already
 * attribution-resolved) scoringArtists rather than Spotify's own per-track
 * genre tags - see artistGenres.ts for why. Returns [UNTAGGED_GENRE] if none
 * of the track's artists are in ARTIST_GENRES. A track whose artists span
 * more than one genre (e.g. a Deftones feature on a rap song) counts toward
 * every one of them - same "counts toward everything it touches" rule as
 * scoringArtists itself.
 */
function genreBucketsForTrack(track: Pick<Track, "scoringArtists">): string[] {
  return genresForArtists(track.scoringArtists);
}

/** Total tracks per major genre across all months (optionally for one person). */
export function genreTotals(
  dataset: Dataset,
  person?: string,
  options?: StatsOptions
): GenreTotal[] {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const track of allTracks(dataset, person, options)) {
    for (const genre of genreBucketsForTrack(track)) {
      totals.set(genre, (totals.get(genre) ?? 0) + track.points);
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return Array.from(totals.entries())
    .map(([genre, total]) => ({ genre, total, count: counts.get(genre) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Per-month track counts per major genre, for building a time series chart. */
export function genreMonthCounts(
  dataset: Dataset,
  person?: string,
  options?: StatsOptions
): GenreMonthCount[] {
  const counts = new Map<string, number>(); // key: `${genre}\u0000${month}`
  for (const track of allTracks(dataset, person, options)) {
    for (const genre of genreBucketsForTrack(track)) {
      const key = `${genre}\u0000${track.month}`;
      counts.set(key, (counts.get(key) ?? 0) + track.points);
    }
  }
  return Array.from(counts.entries()).map(([key, count]) => {
    const [genre, month] = key.split("\u0000");
    return { genre, month, count };
  });
}

/**
 * All tracks counting toward a given major genre, newest month first - the
 * exact set backing its number in genreTotals (same options, same dedup
 * rule), for display in a "show me the songs" dropdown.
 */
export function tracksForGenre(
  dataset: Dataset,
  genre: string,
  person?: string,
  options?: StatsOptions
): Array<Track & { month: string; person: string }> {
  return allTracks(dataset, person, options)
    .filter((track) => genreBucketsForTrack(track).includes(genre))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Same shape as cumulativeArtistSeries, but for major genres. */
export function cumulativeGenreSeries(
  dataset: Dataset,
  person: string | undefined,
  topGenres: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const months = sortedMonths(dataset, person, options);
  const perMonth = genreMonthCounts(dataset, person, options);

  const lookup = new Map<string, number>();
  for (const { genre, month, count } of perMonth) {
    lookup.set(`${genre}\u0000${month}`, count);
  }

  const running = new Map<string, number>(topGenres.map((g) => [g, 0]));
  const series: CumulativeSeriesPoint[] = [];

  for (const month of months) {
    const point: CumulativeSeriesPoint = { month };
    for (const genre of topGenres) {
      const delta = lookup.get(`${genre}\u0000${month}`) ?? 0;
      const newTotal = (running.get(genre) ?? 0) + delta;
      running.set(genre, newTotal);
      point[genre] = newTotal;
    }
    series.push(point);
  }

  return series;
}

export type EraGranularity = "year" | "decade";

export interface EraTotal {
  era: string;
  total: number;
  /** Same purpose as GenreTotal.count / ArtistTotal.count - see those. */
  count: number;
}

export interface EraMonthCount {
  era: string;
  month: string;
  count: number;
}

/**
 * The release-year or release-decade bucket a track counts toward (see
 * releaseEra.ts) - a track only ever has one release date, so unlike
 * genreBucketsForTrack this is always exactly one bucket, never a union.
 */
function eraBucketForTrack(track: Pick<Track, "releaseDate">, granularity: EraGranularity): string {
  return granularity === "decade"
    ? decadeBucketForTrack(track.releaseDate)
    : yearBucketForTrack(track.releaseDate);
}

/** Total tracks per release year/decade across all months (optionally for one person). */
export function eraTotals(
  dataset: Dataset,
  granularity: EraGranularity,
  person?: string,
  options?: StatsOptions
): EraTotal[] {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const track of allTracks(dataset, person, options)) {
    const era = eraBucketForTrack(track, granularity);
    totals.set(era, (totals.get(era) ?? 0) + track.points);
    counts.set(era, (counts.get(era) ?? 0) + 1);
  }
  return Array.from(totals.entries())
    .map(([era, total]) => ({ era, total, count: counts.get(era) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Per-month track counts per release year/decade, for building a time series chart. */
export function eraMonthCounts(
  dataset: Dataset,
  granularity: EraGranularity,
  person?: string,
  options?: StatsOptions
): EraMonthCount[] {
  const counts = new Map<string, number>(); // key: `${era}\u0000${month}`
  for (const track of allTracks(dataset, person, options)) {
    const era = eraBucketForTrack(track, granularity);
    const key = `${era}\u0000${track.month}`;
    counts.set(key, (counts.get(key) ?? 0) + track.points);
  }
  return Array.from(counts.entries()).map(([key, count]) => {
    const [era, month] = key.split("\u0000");
    return { era, month, count };
  });
}

/**
 * All tracks counting toward a given release year/decade, newest month
 * first - the exact set backing its number in eraTotals (same options, same
 * dedup rule), for display in a "show me the songs" dropdown.
 */
export function tracksForEra(
  dataset: Dataset,
  granularity: EraGranularity,
  era: string,
  person?: string,
  options?: StatsOptions
): Array<Track & { month: string; person: string }> {
  return allTracks(dataset, person, options)
    .filter((track) => eraBucketForTrack(track, granularity) === era)
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Same shape as cumulativeArtistSeries, but for release years/decades. */
export function cumulativeEraSeries(
  dataset: Dataset,
  granularity: EraGranularity,
  person: string | undefined,
  topEras: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const months = sortedMonths(dataset, person, options);
  const perMonth = eraMonthCounts(dataset, granularity, person, options);

  const lookup = new Map<string, number>();
  for (const { era, month, count } of perMonth) {
    lookup.set(`${era}\u0000${month}`, count);
  }

  const running = new Map<string, number>(topEras.map((e) => [e, 0]));
  const series: CumulativeSeriesPoint[] = [];

  for (const month of months) {
    const point: CumulativeSeriesPoint = { month };
    for (const era of topEras) {
      const delta = lookup.get(`${era}\u0000${month}`) ?? 0;
      const newTotal = (running.get(era) ?? 0) + delta;
      running.set(era, newTotal);
      point[era] = newTotal;
    }
    series.push(point);
  }

  return series;
}

/** One person's first (earliest-month) and total count toward a selected artist set, for Compare's summary row. */
export interface PersonArtistSummary {
  person: string;
  total: number;
  firstMonth: string | null;
}

/**
 * Per-person total and earliest month for a selected set of artists (e.g.
 * one artist, or a group's members) - the "who got there first, who has the
 * most" summary above Compare's chart. firstMonth is null if that person has
 * zero matching tracks in range.
 */
export function personArtistSummaries(
  dataset: Dataset,
  people: string[],
  artists: string[],
  options?: StatsOptions
): PersonArtistSummary[] {
  const artistSet = new Set(artists);
  return people.map((person) => {
    let total = 0;
    let firstMonth: string | null = null;
    for (const track of allTracks(dataset, person, options)) {
      const matches = track.scoringArtists.filter((a) => artistSet.has(a)).length;
      if (matches === 0) continue;
      total += matches;
      if (firstMonth === null || track.month < firstMonth) firstMonth = track.month;
    }
    return { person, total, firstMonth };
  });
}

/**
 * Same shape as cumulativeArtistSeries, but one line per PERSON instead of
 * per artist - each point sums counts across every artist in `artists` for
 * that person, running cumulatively. This is what the Compare view uses to
 * answer "who got into billy woods earlier / more": pick one or more artists
 * (a group's members, say), and see each person's combined running total for
 * that selection side by side, rather than one line per artist per person.
 *
 * `options` (range/dedup/identity toggles) are applied independently per
 * person, same as every other stats function here - e.g. includeDuplicates
 * dedups each person's own history, not across people.
 */
export function cumulativeArtistSeriesByPerson(
  dataset: Dataset,
  people: string[],
  artists: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const artistSet = new Set(artists);
  // Union of months across all selected people, so a month only one person
  // has new entries in still appears on the shared x-axis.
  const months = Array.from(new Set(people.flatMap((p) => sortedMonths(dataset, p, options)))).sort();

  // key: `${person}\u0000${month}` -> count of selected-artist entries that month
  const perMonth = new Map<string, number>();
  for (const person of people) {
    for (const track of allTracks(dataset, person, options)) {
      const matches = track.scoringArtists.filter((a) => artistSet.has(a)).length;
      if (matches === 0) continue;
      const key = `${person}\u0000${track.month}`;
      perMonth.set(key, (perMonth.get(key) ?? 0) + matches);
    }
  }

  const running = new Map<string, number>(people.map((p) => [p, 0]));
  const series: CumulativeSeriesPoint[] = [];
  for (const month of months) {
    const point: CumulativeSeriesPoint = { month };
    for (const person of people) {
      const delta = perMonth.get(`${person}\u0000${month}`) ?? 0;
      const newTotal = (running.get(person) ?? 0) + delta;
      running.set(person, newTotal);
      point[person] = newTotal;
    }
    series.push(point);
  }
  return series;
}

/**
 * Compare's "Placements" mode: one line per PERSON, each showing where the
 * selected artist set stood in THAT PERSON'S OWN all-time artist leaderboard,
 * as of each month - the person-scoped equivalent of
 * cumulativeArtistRankSeries. There's no single cross-person leaderboard to
 * rank within (each person has their own independent Leaderboard tab), so
 * "placement" here means: build person X's own artistTotals-through-this-
 * month exactly like cumulativeArtistRankSeries does, but treat every artist
 * in `artists` (e.g. a group's members) as ONE combined pseudo-entry (summed
 * total) competing against every other individual artist in that person's
 * leaderboard - mirroring how cumulativeArtistSeriesByPerson already sums the
 * selected set into one number per person rather than one line per artist.
 * This answers "who ranks this artist/group highest in their own personal
 * top artists" rather than "who has the most points for them" (which is what
 * the Artists-mode line already answers) - a person who has fewer total
 * songs by this artist can still rank them #1 in their own leaderboard if
 * they simply have fewer artists overall, which the plain count line can't
 * show.
 *
 * Same null-for-"hasn't charted yet" / recompute-every-month-regardless
 * behavior as cumulativeArtistRankSeries, applied independently per person.
 */
export function artistRankSeriesByPerson(
  dataset: Dataset,
  people: string[],
  artists: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const artistSet = new Set(artists);
  const months = Array.from(new Set(people.flatMap((p) => sortedMonths(dataset, p, options)))).sort();

  // Per person: `${artist}\u0000${month}` -> delta that month (the combined
  // set folded into one pseudo-artist key). The key is the selection's own
  // sorted/joined artist names, not an arbitrary sentinel - a sentinel
  // chosen to always sort before (or after) every real name would
  // systematically win or lose every tie against a real artist regardless
  // of name, which isn't a real "placement." Using the real name(s) means
  // the alphabetical tiebreak below resolves a tie exactly the way it would
  // if the lead selected artist were competing standalone (no real artist
  // name can collide with a multi-artist joined string; a single-artist
  // selection collides with itself correctly, which is the desired case).
  const SELECTED_KEY = [...artistSet].sort().join(", ");
  const perPersonDelta = new Map<string, Map<string, number>>();
  const perPersonArtists = new Map<string, Set<string>>();

  for (const person of people) {
    const deltaLookup = new Map<string, number>();
    const everyArtist = new Set<string>();
    for (const { artist, month, count } of artistMonthCounts(dataset, person, options)) {
      const key = artistSet.has(artist) ? SELECTED_KEY : artist;
      everyArtist.add(key);
      const dkey = `${key}\u0000${month}`;
      deltaLookup.set(dkey, (deltaLookup.get(dkey) ?? 0) + count);
    }
    perPersonDelta.set(person, deltaLookup);
    perPersonArtists.set(person, everyArtist);
  }

  const runningByPerson = new Map<string, Map<string, number>>(people.map((p) => [p, new Map()]));
  const series: CumulativeSeriesPoint[] = [];

  for (const month of months) {
    const point: CumulativeSeriesPoint = { month };
    for (const person of people) {
      const running = runningByPerson.get(person)!;
      const deltaLookup = perPersonDelta.get(person)!;
      for (const artist of perPersonArtists.get(person)!) {
        const delta = deltaLookup.get(`${artist}\u0000${month}`) ?? 0;
        if (delta !== 0) running.set(artist, (running.get(artist) ?? 0) + delta);
      }
      const ranked = Array.from(running.entries())
        .filter(([, total]) => total > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const rank = ranked.findIndex(([key]) => key === SELECTED_KEY);
      point[person] = rank === -1 ? (null as unknown as number) : rank + 1;
    }
    series.push(point);
  }

  return series;
}

/** Same shape as PersonArtistSummary, but for a selected set of genres. */
export interface PersonGenreSummary {
  person: string;
  total: number;
  firstMonth: string | null;
}

/**
 * Per-person total and earliest month for a selected set of genres (e.g.
 * "Hip-Hop" + "Jazz Rap") - the genre equivalent of personArtistSummaries,
 * for Compare's "genres" mode. A track counts once per person per genre it
 * matches (same "counts toward every genre it touches" rule genreTotals
 * uses), not once per matching scoringArtist - genres aren't a per-artist
 * point system the way artist credits are.
 */
export function personGenreSummaries(
  dataset: Dataset,
  people: string[],
  genres: string[],
  options?: StatsOptions
): PersonGenreSummary[] {
  const genreSet = new Set(genres);
  return people.map((person) => {
    let total = 0;
    let firstMonth: string | null = null;
    for (const track of allTracks(dataset, person, options)) {
      const matches = genreBucketsForTrack(track).filter((g) => genreSet.has(g)).length;
      if (matches === 0) continue;
      total += matches;
      if (firstMonth === null || track.month < firstMonth) firstMonth = track.month;
    }
    return { person, total, firstMonth };
  });
}

/**
 * Genre equivalent of cumulativeArtistSeriesByPerson - one cumulative line
 * per PERSON, summing counts across every genre in `genres` for that person,
 * for Compare's "genres" mode (e.g. "who got into Hip-Hop earliest/most").
 */
export function cumulativeGenreSeriesByPerson(
  dataset: Dataset,
  people: string[],
  genres: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const genreSet = new Set(genres);
  const months = Array.from(new Set(people.flatMap((p) => sortedMonths(dataset, p, options)))).sort();

  const perMonth = new Map<string, number>();
  for (const person of people) {
    for (const track of allTracks(dataset, person, options)) {
      const matches = genreBucketsForTrack(track).filter((g) => genreSet.has(g)).length;
      if (matches === 0) continue;
      const key = `${person}\u0000${track.month}`;
      perMonth.set(key, (perMonth.get(key) ?? 0) + matches);
    }
  }

  const running = new Map<string, number>(people.map((p) => [p, 0]));
  const series: CumulativeSeriesPoint[] = [];
  for (const month of months) {
    const point: CumulativeSeriesPoint = { month };
    for (const person of people) {
      const delta = perMonth.get(`${person}\u0000${month}`) ?? 0;
      const newTotal = (running.get(person) ?? 0) + delta;
      running.set(person, newTotal);
      point[person] = newTotal;
    }
    series.push(point);
  }
  return series;
}

/** Same shape as PersonArtistSummary, but for a selected set of release years/decades. */
export interface PersonEraSummary {
  person: string;
  total: number;
  firstMonth: string | null;
}

/**
 * Per-person total and earliest month for a selected set of release
 * year/decade buckets - the era equivalent of personArtistSummaries, for
 * Compare's "years"/"decades" modes. A track only ever has ONE release
 * year/decade (eraBucketForTrack), so unlike personGenreSummaries there's no
 * multi-bucket union to worry about - a matching track contributes exactly 1,
 * never more, same as personArtistSummaries would for a single-artist
 * selection.
 */
export function personEraSummaries(
  dataset: Dataset,
  people: string[],
  granularity: EraGranularity,
  eras: string[],
  options?: StatsOptions
): PersonEraSummary[] {
  const eraSet = new Set(eras);
  return people.map((person) => {
    let total = 0;
    let firstMonth: string | null = null;
    for (const track of allTracks(dataset, person, options)) {
      if (!eraSet.has(eraBucketForTrack(track, granularity))) continue;
      total += 1;
      if (firstMonth === null || track.month < firstMonth) firstMonth = track.month;
    }
    return { person, total, firstMonth };
  });
}

/**
 * Era equivalent of cumulativeArtistSeriesByPerson - one cumulative line per
 * PERSON, summing counts across every release year/decade bucket in `eras`
 * for that person, for Compare's "years"/"decades" modes (e.g. "who got into
 * 2016 hip-hop earliest/most").
 */
export function cumulativeEraSeriesByPerson(
  dataset: Dataset,
  people: string[],
  granularity: EraGranularity,
  eras: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const eraSet = new Set(eras);
  const months = Array.from(new Set(people.flatMap((p) => sortedMonths(dataset, p, options)))).sort();

  const perMonth = new Map<string, number>();
  for (const person of people) {
    for (const track of allTracks(dataset, person, options)) {
      if (!eraSet.has(eraBucketForTrack(track, granularity))) continue;
      const key = `${person}\u0000${track.month}`;
      perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
    }
  }

  const running = new Map<string, number>(people.map((p) => [p, 0]));
  const series: CumulativeSeriesPoint[] = [];
  for (const month of months) {
    const point: CumulativeSeriesPoint = { month };
    for (const person of people) {
      const delta = perMonth.get(`${person}\u0000${month}`) ?? 0;
      const newTotal = (running.get(person) ?? 0) + delta;
      running.set(person, newTotal);
      point[person] = newTotal;
    }
    series.push(point);
  }
  return series;
}

/** One song that every person has had in their top 25 at some point, and when. */
export interface SharedSong {
  trackKey: string;
  title: string;
  album: string;
  creditedArtists: string[];
  /**
   * The resolved scoring artists (alias/misspelling/group-expanded) for this
   * song - same list a Leaderboard entry would credit, used by
   * sharedSongArtistTotals below rather than re-deriving it from
   * creditedArtists. Not shown directly in the Shared song list UI, which
   * still displays creditedArtists (the literal credit) like every other
   * song list in the app.
   */
  scoringArtists: string[];
  /**
   * Straight from the underlying Track (identical regardless of who picked
   * it or when, so there's no ambiguity the way there is with "rank" or
   * "month" for a song shared across people) - backs sharedSongEraTotals/
   * sharedSongsForEra's Years/Decades mode, same releaseYear/releaseDecade
   * bucketing releaseEra.ts already does for the per-person Leaderboard.
   */
  releaseDate: string | null;
  /** Every month (across every person) this song appeared, for display/sorting. */
  appearances: Array<{ person: string; month: string; rank: number }>;
}

/**
 * Per-person presence requirement for `songsByPresence` below:
 * - "required": the song must have appeared in this person's top 25 at some
 *   point for it to qualify at all.
 * - "excluded": the song must have NEVER appeared in this person's top 25
 *   for it to qualify.
 * - "any" (or simply absent from the map): this person's history doesn't
 *   affect qualification either way.
 */
export type PresenceRequirement = "required" | "excluded" | "any";

/**
 * Finds every song matching a per-person presence requirement (see
 * PresenceRequirement) - matched the same way duplicate songs are matched
 * elsewhere (trackKey: normalized title + credited-artist list), so
 * re-release title variants ("- Single Version" etc.) still count as the
 * same song across people the same way they do within one person's history.
 * Always considers each person's FULL history regardless of includeDuplicates
 * (that option is about counting repeats, not about which songs exist at
 * all) - startMonth/endMonth still apply if the caller wants to scope the
 * search to a date range.
 *
 * `presence` maps person -> requirement; a person missing from the map (or
 * explicitly "any") imposes no constraint. An all-"any" (or empty) map
 * degenerates to "every song that appeared anywhere, for anyone" - this is
 * the Shared tab's "all buttons set to any" case.
 */
export function songsByPresence(
  dataset: Dataset,
  presence: Map<string, PresenceRequirement>,
  options?: StatsOptions
): SharedSong[] {
  // scoringArtists is resolved the same way allTracks does (unite related
  // projects / drop known producers / drop group names if those options are
  // on), so the "Unite similar artists/groups", "Show producers", and "Show
  // duos" checkboxes affect who gets credit on a song exactly like they
  // affect the regular per-person Leaderboard. This never changes WHICH
  // songs qualify though - that's still keyed by trackKey (title + raw
  // credited artists), identical to how includeDuplicates only affects
  // counting, not identity.
  const groupNames = options?.showDuos ? null : new Set(dataset.groupNames);

  const byKey = new Map<string, SharedSong>();

  for (const list of dataset.lists) {
    if (!inRange(list.month, options)) continue;
    for (const track of list.tracks) {
      const key = trackKey(track);
      let entry = byKey.get(key);
      if (!entry) {
        let scoringArtists = track.scoringArtists;
        if (options?.uniteRelatedProjects) {
          scoringArtists = Array.from(new Set(scoringArtists.map(uniteRelatedProject)));
        }
        if (!options?.showProducers) {
          scoringArtists = scoringArtists.filter((a) => !isKnownProducer(a));
        }
        if (groupNames) {
          scoringArtists = scoringArtists.filter((a) => !groupNames.has(a));
        }
        entry = {
          trackKey: key,
          title: track.title,
          album: track.album,
          creditedArtists: track.creditedArtists,
          scoringArtists,
          releaseDate: track.releaseDate,
          appearances: [],
        };
        byKey.set(key, entry);
      }
      entry.appearances.push({ person: list.person, month: list.month, rank: track.rank });
    }
  }

  return Array.from(byKey.values())
    .filter((entry) => {
      const peoplePresent = new Set(entry.appearances.map((a) => a.person));
      for (const [person, requirement] of presence) {
        if (requirement === "required" && !peoplePresent.has(person)) return false;
        if (requirement === "excluded" && peoplePresent.has(person)) return false;
      }
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Finds every song that has appeared in EVERY person's top 25 at some point
 * (not necessarily the same month) - the Shared tab's original, simplest
 * case (every person's button set to "required"). Now a thin wrapper around
 * `songsByPresence`, kept separate since every other call site/doc comment
 * in this file already refers to "shared songs" as its own concept.
 */
export function sharedSongs(dataset: Dataset, options?: StatsOptions): SharedSong[] {
  const presence = new Map<string, PresenceRequirement>(dataset.people.map((p) => [p, "required"]));
  return songsByPresence(dataset, presence, options);
}

/**
 * Leaderboard of artists by how many "shared" songs (see sharedSongs above)
 * they're credited on - i.e. of the songs that have appeared in literally
 * everyone's top 25 at some point, which artists show up on the most of
 * them. Counts by scoringArtists (group/alias/misspelling-resolved), same as
 * every other leaderboard in the app, not the raw creditedArtists credit -
 * so a shared Armand Hammer song counts for billy woods and E L U C I D
 * individually too, same as it would in the regular per-person Leaderboard.
 * A song with multiple scoring artists counts once for each of them (same
 * "counts toward everyone it touches" rule artistTotals uses) - it does NOT
 * multiply by how many people's lists it appeared in, since a shared song
 * is one song, already guaranteed to be in all 3 lists by definition.
 *
 * `presence`, when given, overrides the "everyone required" default with an
 * arbitrary per-person requirement (see PresenceRequirement/songsByPresence)
 * - this is what powers the Shared tab's per-person required/any/excluded
 * buttons. Omitted, it falls back to the original "shared by everyone" set.
 */
/**
 * The same per-artist genre-filter cut allTracks applies - drops an
 * individual scoringArtist from a song if none of THEIR OWN genres are
 * selected, rather than hiding the whole song. Shared by
 * sharedSongArtistTotals/sharedSongGenreTotals/sharedSongEraTotals (and their
 * sharedSongsFor* counterparts) below, which all need a song's
 * genre-filtered artist list before counting/bucketing, same as how
 * Leaderboard's own genre/era modes still apply genreFilter at the artist
 * level underneath whatever the rows happen to be grouped by.
 */
function genreFilteredScoringArtists(song: SharedSong, options?: StatsOptions): string[] {
  if (!options?.genreFilter) return song.scoringArtists;
  const filter = options.genreFilter;
  return song.scoringArtists.filter((a) => genresForArtists([a]).some((g) => filter.has(g)));
}

export function sharedSongArtistTotals(
  dataset: Dataset,
  options?: StatsOptions,
  presence?: Map<string, PresenceRequirement>
): ArtistTotal[] {
  const songs = presence ? songsByPresence(dataset, presence, options) : sharedSongs(dataset, options);
  const totals = new Map<string, number>();
  for (const song of songs) {
    // Same per-artist genre filter allTracks applies - a shared song that's
    // a Kendrick Lamar/Kali Uchis collab, say, still drops Kendrick alone
    // when Hip-Hop is unchecked, rather than hiding the whole song.
    for (const artist of genreFilteredScoringArtists(song, options)) {
      totals.set(artist, (totals.get(artist) ?? 0) + 1);
    }
  }
  // Shared never weights by placement (see the stats.ts module doc on
  // weightByRank), so total is already a plain count here - count mirrors
  // it exactly, just to satisfy ArtistTotal's shape consistently.
  return Array.from(totals.entries())
    .map(([artist, total]) => ({ artist, total, count: total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * The subset of sharedSongs a given artist is credited on (by
 * scoringArtists) - backs a click-to-expand row in the Shared tab's artist
 * leaderboard. `presence` works the same way as in sharedSongArtistTotals -
 * omitted falls back to the original "shared by everyone" set.
 */
export function sharedSongsForArtist(
  dataset: Dataset,
  artist: string,
  options?: StatsOptions,
  presence?: Map<string, PresenceRequirement>
): SharedSong[] {
  const songs = presence ? songsByPresence(dataset, presence, options) : sharedSongs(dataset, options);
  return songs.filter((song) => song.scoringArtists.includes(artist));
}

/**
 * Genre equivalent of sharedSongArtistTotals - of the qualifying shared
 * songs, which major genres show up on the most of them, bucketed the same
 * way genreTotals buckets a per-person track (genreBucketsForTrack, i.e. by
 * each song's own resolved scoringArtists) so a song counts toward every
 * genre any of its credited artists belongs to, same "counts toward
 * everything it touches" rule as the regular Leaderboard's genre mode.
 * `options.genreFilter` still applies at the artist level first (same as
 * Leaderboard's own genre mode) - unchecking "Hip-Hop" drops hip-hop
 * artists' contribution to a mixed-genre song's bucketing, it doesn't hide
 * the "Hip-Hop" row itself (the row grouping and the artist-level filter are
 * different axes, same precedent as Leaderboard).
 */
export function sharedSongGenreTotals(
  dataset: Dataset,
  options?: StatsOptions,
  presence?: Map<string, PresenceRequirement>
): GenreTotal[] {
  const songs = presence ? songsByPresence(dataset, presence, options) : sharedSongs(dataset, options);
  const totals = new Map<string, number>();
  for (const song of songs) {
    const scoringArtists = genreFilteredScoringArtists(song, options);
    if (scoringArtists.length === 0) continue;
    for (const genre of genresForArtists(scoringArtists)) {
      totals.set(genre, (totals.get(genre) ?? 0) + 1);
    }
  }
  // Shared never weights by placement, so count mirrors total exactly, same
  // as sharedSongArtistTotals.
  return Array.from(totals.entries())
    .map(([genre, total]) => ({ genre, total, count: total }))
    .sort((a, b) => b.total - a.total);
}

/** The subset of sharedSongs belonging to a given major genre - genre equivalent of sharedSongsForArtist. */
export function sharedSongsForGenre(
  dataset: Dataset,
  genre: string,
  options?: StatsOptions,
  presence?: Map<string, PresenceRequirement>
): SharedSong[] {
  const songs = presence ? songsByPresence(dataset, presence, options) : sharedSongs(dataset, options);
  return songs.filter((song) => {
    const scoringArtists = genreFilteredScoringArtists(song, options);
    return scoringArtists.length > 0 && genresForArtists(scoringArtists).includes(genre);
  });
}

/**
 * Release-year/decade equivalent of sharedSongArtistTotals - of the
 * qualifying shared songs, which release year/decade shows up on the most of
 * them, bucketed by each song's own releaseDate (eraBucketForTrack) exactly
 * like the per-person Leaderboard's Years/Decades mode. A shared song only
 * has one release date regardless of who picked it or when, so (unlike the
 * artist/genre modes) there's no multi-bucket union here at all - same
 * "exactly one bucket" property eraTotals already has. `options.genreFilter`
 * still applies at the artist level first, same reasoning as
 * sharedSongGenreTotals - a song with zero artists left after that filter
 * drops out entirely (same as allTracks would drop it), same "a track that
 * no longer credits anyone doesn't count toward anything" rule.
 */
export function sharedSongEraTotals(
  dataset: Dataset,
  granularity: EraGranularity,
  options?: StatsOptions,
  presence?: Map<string, PresenceRequirement>
): EraTotal[] {
  const songs = presence ? songsByPresence(dataset, presence, options) : sharedSongs(dataset, options);
  const totals = new Map<string, number>();
  for (const song of songs) {
    if (genreFilteredScoringArtists(song, options).length === 0) continue;
    const era = eraBucketForTrack(song, granularity);
    totals.set(era, (totals.get(era) ?? 0) + 1);
  }
  return Array.from(totals.entries())
    .map(([era, total]) => ({ era, total, count: total }))
    .sort((a, b) => b.total - a.total);
}

/** The subset of sharedSongs belonging to a given release year/decade - era equivalent of sharedSongsForArtist. */
export function sharedSongsForEra(
  dataset: Dataset,
  granularity: EraGranularity,
  era: string,
  options?: StatsOptions,
  presence?: Map<string, PresenceRequirement>
): SharedSong[] {
  const songs = presence ? songsByPresence(dataset, presence, options) : sharedSongs(dataset, options);
  return songs.filter(
    (song) =>
      genreFilteredScoringArtists(song, options).length > 0 &&
      eraBucketForTrack(song, granularity) === era
  );
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

/**
 * Timeline's "Placements" mode: for each tracked artist, where did they stand
 * in the all-time Leaderboard ranking AS OF each month - i.e. re-run
 * artistTotals using only tracks through that month, then report that
 * artist's 1-indexed position in the resulting descending-by-total order
 * (1 = the #1 artist overall so far). This is a fundamentally different shape
 * from cumulativeArtistSeries: that one is a running total that only ever
 * goes up; this one can go up OR down even in a month the tracked artist gets
 * no new song at all, because every OTHER artist's total is still being
 * re-ranked around them each month too (someone else overtaking them moves
 * their placement even though their own count didn't change).
 *
 * A month before an artist's first-ever qualifying track has no meaningful
 * placement (they aren't on the leaderboard at all yet) and is `null` there -
 * the UI should render that as a gap, not a fabricated rank. From their first
 * chart onward, every subsequent month gets a real (possibly unchanged, if
 * nobody passed them) rank - this was an explicit product decision (recompute
 * every month regardless of whether this artist had a new song that month),
 * not a simplification.
 *
 * Built month-by-month via a single running-totals map rather than calling
 * artistTotals fresh per month (which would be O(months) full re-scans of
 * every track) - each month's leaderboard only needs that month's deltas
 * folded into the running totals already built, same incremental approach
 * cumulativeArtistSeries itself uses, just with a sort+indexOf per month on
 * top instead of a flat lookup.
 */
export function cumulativeArtistRankSeries(
  dataset: Dataset,
  person: string | undefined,
  trackedArtists: string[],
  options?: StatsOptions
): CumulativeSeriesPoint[] {
  const months = sortedMonths(dataset, person, options);
  const perMonth = artistMonthCounts(dataset, person, options);

  // `${artist}\u0000${month}` -> this artist's point delta in that month
  const deltaLookup = new Map<string, number>();
  // Every artist who has ANY delta in some month, so a month's full
  // leaderboard re-rank considers every artist who could possibly be ahead of
  // a tracked one, not just the tracked set itself.
  const everyArtist = new Set<string>();
  for (const { artist, month, count } of perMonth) {
    deltaLookup.set(`${artist}\u0000${month}`, count);
    everyArtist.add(artist);
  }

  const running = new Map<string, number>();
  const series: CumulativeSeriesPoint[] = [];

  for (const month of months) {
    for (const artist of everyArtist) {
      const delta = deltaLookup.get(`${artist}\u0000${month}`) ?? 0;
      if (delta !== 0) running.set(artist, (running.get(artist) ?? 0) + delta);
    }
    // Full leaderboard as of this month, descending by total - same
    // tiebreak (alphabetical) artistTotals itself uses, so "placement" here
    // matches what the Leaderboard tab would show if you looked at it with
    // the range end set to this same month.
    const ranked = Array.from(running.entries())
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const rankOf = new Map<string, number>();
    ranked.forEach(([artist], idx) => rankOf.set(artist, idx + 1));

    const point: CumulativeSeriesPoint = { month };
    for (const artist of trackedArtists) {
      const rank = rankOf.get(artist);
      // null (not undefined) for "hasn't charted yet" - Recharts skips a
      // null data point in a line (gap) rather than plotting it as 0, which
      // would otherwise read as "ranked #0", a nonsensical placement.
      point[artist] = rank ?? (null as unknown as number);
    }
    series.push(point);
  }

  return series;
}
