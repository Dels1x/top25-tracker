import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset, Track } from "../data/types";
import { listsForPerson } from "../lib/stats";
import { sliderTickIndices } from "../lib/sliderTicks";
import { directGenresForArtists, UNTAGGED_GENRE } from "../lib/artistGenres";
import { decadeBucketForTrack, yearBucketForTrack } from "../lib/releaseEra";
import { DURATION_BUCKETS, durationBucketForTrack, formatDuration } from "../lib/durationBuckets";
import { buildArtistColorMap } from "../lib/colors";
import styles from "./Replay.module.css";

interface ReplayProps {
  dataset: Dataset;
  person: string;
}

/**
 * Spotify's official oEmbed-style track embed - a real `<iframe>` pointed at
 * open.spotify.com rather than anything built from raw audio. This is the
 * only way to get an actual in-page "play" button at all: the Spotify Web
 * API/CSV export never expose raw audio, only metadata + a track ID, and
 * Spotify discontinued the old `preview_url` API field for new API users in
 * Nov 2024. Plays a 30s preview for any visitor; a visitor who happens to be
 * logged into Spotify Premium in that same browser tab gets the full track
 * instead - this component has no way to tell which, and doesn't need to.
 * No `spotifyId` (a `spotify:local:...` row with no streaming match) means
 * no embed is possible for that track - the caller skips rendering this at
 * all in that case rather than showing a broken iframe.
 */
function SpotifyEmbed({ spotifyId }: { spotifyId: string }) {
  return (
    <iframe
      key={spotifyId}
      className={styles.spotifyEmbed}
      src={`https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator`}
      width="100%"
      height="152"
      style={{ border: 0 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title="Spotify preview player"
    />
  );
}

function formatMonthLong(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * Formats a track's raw Spotify releaseDate for display - handles the three
 * precisions Spotify's API actually returns (full "YYYY-MM-DD", "YYYY-MM",
 * or just "YYYY" for an older/less-precisely-catalogued release) rather than
 * assuming full precision always parses cleanly - a bare "YYYY" passed to
 * `new Date()` would otherwise get misread as UTC midnight and can print the
 * wrong year in a timezone behind UTC. null (no release date in the source
 * row) renders nothing rather than "Invalid Date".
 */
function formatReleaseDate(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const parts = releaseDate.split("-");
  if (parts.length === 1) return parts[0]; // year-only precision
  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day || 1);
  return parts.length === 2
    ? date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Formats one month's top 25 as plain text for the clipboard, matching the
 * project owner's own spec: a "Top 25 of <Month> <Year>" header line, then
 * one line per track as "<rank>. <artist> - <title> (<album>) [<duration>]
 * [<genres>] [<release date>]" - mirroring the same per-track fields already
 * shown on each Replay card (album/release date/duration via
 * formatReleaseDate/formatDuration, genres via directGenresForArtists with
 * UNTAGGED_GENRE dropped, same "too noisy to show" call the cards already
 * make) rather than inventing a different field set just for the copy
 * output. A bracketed field is omitted entirely when its value is missing
 * (no album, no release date, no genres) rather than printing empty brackets.
 */
function formatMonthForCopy(month: string, tracks: Track[]): string {
  const header = `Top 25 of ${formatMonthLong(month)}`;
  const lines = tracks.map((track) => {
    const artists = track.creditedArtists.join(", ");
    // scoringArtists (not creditedArtists) for the genre lookup specifically -
    // ARTIST_GENRES is keyed by canonical name, so a track credited under a
    // misspelling/alias (e.g. "Sickboyrari", resolved to "Black Kray" at
    // build time) still finds its genre tags this way, even though the
    // artist name itself is still shown literally as credited.
    const genres = directGenresForArtists(track.scoringArtists).filter((g) => g !== UNTAGGED_GENRE);
    const parts = [`${track.rank}. ${artists} - ${track.title}`];
    if (track.album) parts.push(`(${track.album})`);
    const duration = formatDuration(track.durationMs);
    if (duration) parts.push(`[${duration}]`);
    if (genres.length > 0) parts.push(`[${genres.join(", ")}]`);
    const releaseDate = formatReleaseDate(track.releaseDate);
    if (releaseDate) parts.push(`[${releaseDate}]`);
    return parts.join(" ");
  });
  return [header, ...lines].join("\n");
}

function formatTick(month: string): string {
  // Always just the year ("2024"), even for a half-yearly fallback tick
  // (July - only used when there's under ~2 years of data, see
  // sliderTickIndices) or a non-January edge tick (the actual first/last
  // month in someone's history, e.g. "Jul 2022") - the exact month is
  // already shown with full precision in the monthLabel above the
  // scrubber, so a tick only needs to mark "which year", and a longer
  // "Jul 2022" label collided with its "2023" neighbor at narrow widths
  // when every tick wasn't the same short length.
  return month.split("-")[0];
}

/** One row (bucket name + count) in a MonthStatList breakdown, already sorted for display. */
interface MonthStatRow {
  name: string;
  count: number;
}

/**
 * One month's top 25, broken down 5 ways for the "fun stats" panel under the
 * card grid - Artists/Genres/Decades/Years/Duration, the same dimensions
 * Leaderboard/Timeline/Shared/Compare's own mode switch already covers, but
 * scoped to just the 25 tracks in the currently displayed month rather than
 * a person's whole history. Deliberately buckets by each track's literal
 * creditedArtists, never scoringArtists - Replay has never looked at the
 * artist-identity toggles (see NO_TOGGLES_VIEWS in App.tsx) and always shows
 * the literal per-track credit, so these breakdowns stay consistent with
 * that: "who does the card actually say", not a scored/resolved view.
 * Genre lookup specifically uses scoringArtists, not creditedArtists, so a
 * misspelled/aliased credit (e.g. "Sickboyrari" -> "Black Kray") still finds
 * its ARTIST_GENRES entry, which is keyed by canonical name - the Artists
 * breakdown itself still buckets by literal creditedArtists, unaffected.
 * Era/duration bucketing is artist-identity-independent either way
 * (decadeBucketForTrack/durationBucketForTrack don't look at artist names).
 *
 * Every dimension here sorts by count descending EXCEPT duration, which
 * sorts by DURATION_BUCKETS' own fixed short-to-long order - the exact same
 * exception durationTotals/sharedSongDurationTotals in stats.ts make, for
 * the same reason (a duration histogram reads naturally short-to-long, not
 * ranked by which band happens to have the most songs this month).
 */
function buildMonthStats(tracks: Track[]): Record<
  "artists" | "genres" | "decades" | "years" | "duration",
  MonthStatRow[]
> {
  const artists = new Map<string, number>();
  const genres = new Map<string, number>();
  const decades = new Map<string, number>();
  const years = new Map<string, number>();
  const duration = new Map<string, number>();

  for (const track of tracks) {
    for (const artist of track.creditedArtists) {
      artists.set(artist, (artists.get(artist) ?? 0) + 1);
    }
    for (const genre of directGenresForArtists(track.scoringArtists)) {
      if (genre === UNTAGGED_GENRE) continue; // same "too noisy to show" call as the card chips
      genres.set(genre, (genres.get(genre) ?? 0) + 1);
    }
    const decade = decadeBucketForTrack(track.releaseDate);
    decades.set(decade, (decades.get(decade) ?? 0) + 1);
    const year = yearBucketForTrack(track.releaseDate);
    years.set(year, (years.get(year) ?? 0) + 1);
    const bucket = durationBucketForTrack(track.durationMs);
    duration.set(bucket, (duration.get(bucket) ?? 0) + 1);
  }

  const byCountDesc = (m: Map<string, number>): MonthStatRow[] =>
    Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  return {
    artists: byCountDesc(artists),
    genres: byCountDesc(genres),
    decades: byCountDesc(decades),
    years: byCountDesc(years),
    duration: Array.from(duration.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => DURATION_BUCKETS.indexOf(a.name) - DURATION_BUCKETS.indexOf(b.name)),
  };
}

/**
 * One breakdown's bar list - a compact version of Leaderboard's own
 * rank/bar/value row (same visual language, smaller) rather than a new mark
 * type, since this is a secondary "fun stats" panel, not the page's primary
 * chart. `colorMap` is optional (only the Artists panel gets one, built from
 * this month's own artists - see the color-stability note on MonthStats
 * below for why this is a deliberately different stability rule than every
 * other `stableOrder` in the codebase) - every other dimension's bars render
 * in a single flat muted tone, since there's no cross-month entity for a
 * genre/decade/year/duration bucket's color to need to stay stable against.
 */
function MonthStatList({
  title,
  rows,
  colorMap,
}: {
  title: string;
  rows: MonthStatRow[];
  colorMap?: Map<string, string>;
}) {
  if (rows.length === 0) return null;
  const max = rows.reduce((m, r) => Math.max(m, r.count), 1);
  return (
    <div className={styles.statBlock}>
      <h4 className={styles.statTitle}>{title}</h4>
      <ol className={styles.statList}>
        {rows.map((row) => (
          <li key={row.name} className={styles.statRow}>
            <span className={styles.statName} title={row.name}>
              {row.name}
            </span>
            <div className={styles.statBarTrack}>
              <div
                className={styles.statBar}
                style={{
                  width: `${(row.count / max) * 100}%`,
                  background: colorMap?.get(row.name) ?? "var(--series-1)",
                }}
              />
            </div>
            <span className={styles.statValue}>{row.count}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Replay({ dataset, person }: ReplayProps) {
  const months = useMemo(() => {
    const lists = listsForPerson(dataset, person);
    return [...lists].sort((a, b) => a.month.localeCompare(b.month));
  }, [dataset, person]);

  const monthStrings = useMemo(() => months.map((m) => m.month), [months]);
  // A lower targetMax than MonthRangeSlider's default (8) - Replay's
  // scrubber is a single full-bleed track with no range label sharing the
  // row, but tick LABELS still need breathing room between them, and with
  // every tick now showing just a 4-digit year (see formatTick) 6 fits
  // more comfortably than 8 at phone widths without crowding.
  const tickIndices = useMemo(() => sliderTickIndices(monthStrings, 6), [monthStrings]);
  const tickMax = Math.max(months.length - 1, 0);
  // Two adjacent ticks can land close enough together (in % position) that
  // their labels would collide - most commonly the true-edge tick (e.g. a
  // mid-year "Jul 2022" start) sitting right next to the first January
  // boundary a few months later, which is only a small fraction of a
  // multi-year span. Suppress a tick's LABEL (never its mark on the track -
  // every tick still gets a visible mark) when it's within MIN_GAP_PCT of
  // the last tick that kept its own label, same idea MonthRangeSlider uses
  // for its very last edge tick, generalized to any adjacent pair. A tick
  // whose label would exactly repeat the previous one (e.g. two ticks
  // landing in the same year) is suppressed outright regardless of spacing.
  const MIN_GAP_PCT = 16;
  const tickLabels = useMemo(() => {
    const labels = tickIndices.map((i) => formatTick(months[i].month));
    const { shown } = labels.reduce<{ shown: Array<string | null>; lastShownPct: number }>(
      (acc, label, idx) => {
        const pct = (tickIndices[idx] / tickMax) * 100;
        const isEdge = idx === 0 || idx === labels.length - 1;
        const isDuplicate = label === labels[idx - 1];
        const tooClose = !isEdge && pct - acc.lastShownPct < MIN_GAP_PCT;
        if (isDuplicate || tooClose) {
          acc.shown.push(null);
        } else {
          acc.shown.push(label);
          acc.lastShownPct = pct;
        }
        return acc;
      },
      { shown: [], lastShownPct: -Infinity }
    );
    return shown;
  }, [tickIndices, months, tickMax]);

  // The scrubber position survives a page refresh, persisted as the actual
  // month STRING (not the raw index) under a per-person localStorage key -
  // same robustness reasoning useMonthRange's own startMonth/endMonth
  // persistence uses: an index alone would point at the wrong month if a
  // future data rebuild changes how many months exist before it. Read
  // directly from localStorage here (rather than via usePersistedState)
  // since the key itself is per-PERSON and this component instance stays
  // mounted across a person switch (see the lastPerson block below) -
  // usePersistedState only reads storage on first mount, so swapping its
  // key prop on a later render wouldn't re-read the new person's saved
  // month the way this plain helper does on every switch.
  function readSavedIndex(forPerson: string, monthList: typeof months): number {
    try {
      const saved = localStorage.getItem(`top25tracker:replayMonth:${forPerson}`);
      if (saved) {
        const i = monthList.findIndex((m) => m.month === saved);
        if (i !== -1) return i;
      }
    } catch {
      // ignore (private browsing etc.) - fall through to default
    }
    return 0;
  }

  const [index, setIndexRaw] = useState(() => readSavedIndex(person, months));
  const setIndex = (updater: number | ((prev: number) => number)) => {
    setIndexRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        const m = months[next];
        if (m) localStorage.setItem(`top25tracker:replayMonth:${person}`, m.month);
      } catch {
        // ignore (private browsing etc.)
      }
      return next;
    });
  };
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Which card (by "<month>-<rank>" key, same as each card's own React key)
  // currently has its Spotify embed open, if any. A single string rather
  // than a Set - at most one embed is ever shown at a time, deliberately:
  // mounting 25 Spotify iframes per month (one per card) up front would be
  // both wasteful (24 of them likely never get clicked) and would fight
  // over audio focus if multiple were somehow started. Clicking a different
  // card's "Preview" button swaps which one is open rather than stacking.
  const [openPreview, setOpenPreview] = useState<string | null>(null);

  // Brief "Copied!" feedback on the copy button after a successful clipboard
  // write - cleared on a timer rather than left permanent, same transient-
  // feedback pattern as GuessTheSong's own round feedback text.
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset position when switching person - restores that person's OWN saved
  // month (if any) rather than always jumping to 0, same persistence this
  // view now has for a plain page refresh.
  const [lastPerson, setLastPerson] = useState(person);
  if (lastPerson !== person) {
    setLastPerson(person);
    setIndexRaw(readSavedIndex(person, months));
    setPlaying(false);
    setOpenPreview(null);
  }

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setOpenPreview(null);
      setIndex((i) => {
        if (i >= months.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1400);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // person is included so the interval's setIndex closure (which persists
    // to a per-person localStorage key) never writes a stale person's key
    // after a switch that happens to leave months.length unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, months.length, person]);

  if (months.length === 0) {
    return <p>No data for this person yet.</p>;
  }

  const current = months[index];
  const max = Math.max(months.length - 1, 0);
  const progressPct = (index / max) * 100;
  const monthStats = buildMonthStats(current.tracks);
  // Colors here deliberately do NOT follow the codebase's usual
  // "stableOrder built from all-time totals" rule (see colors.ts) - this
  // panel is scoped to a single month and swaps its entire row set out
  // every time the scrubber moves, so there's no cross-month "same artist,
  // same color" property worth preserving; keying straight off this month's
  // own by-count order is enough to make the bars visually distinct from
  // each other within the one chart they're drawn on.
  const monthArtistColors = buildArtistColorMap(monthStats.artists.map((r) => r.name));

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Replay</h2>
        <p className={styles.sub}>Watch the top 25 roll in, month by month</p>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => {
            if (index >= months.length - 1) setIndex(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : index >= months.length - 1 ? "Replay" : "Play"}
        </button>

        <span className={styles.monthLabel}>{formatMonthLong(current.month)}</span>

        <button
          type="button"
          className={styles.copyButton}
          onClick={async () => {
            const text = formatMonthForCopy(current.month, current.tracks);
            await navigator.clipboard.writeText(text);
            setCopied(true);
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
            copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? "Copied!" : "Copy top 25"}
        </button>
      </div>

      <div className={styles.scrubberWrap}>
        <div className={styles.track}>
          <div className={styles.progress} style={{ width: `${progressPct}%` }} />
          {tickIndices.map((i) => (
            <span key={i} className={styles.yearMark} style={{ left: `${(i / max) * 100}%` }} />
          ))}
          <input
            type="range"
            className={styles.thumb}
            min={0}
            max={max}
            step={1}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
              setOpenPreview(null);
            }}
            aria-label="Replay position"
          />
        </div>
        <div className={styles.ticks}>
          {tickIndices.map((i, idx) =>
            tickLabels[idx] === null ? null : (
              <span key={i} className={styles.tick} style={{ left: `${(i / max) * 100}%` }}>
                {tickLabels[idx]}
              </span>
            )
          )}
        </div>
      </div>

      <ol className={styles.grid}>
        <AnimatePresence mode="popLayout">
          {current.tracks.map((track) => {
            const cardKey = `${current.month}-${track.rank}`;
            const isOpen = openPreview === cardKey;
            return (
              <motion.li
                key={cardKey}
                className={track.rank === 1 ? `${styles.card} ${styles.cardFirst}` : styles.card}
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.3, delay: (25 - track.rank) * 0.01 }}
              >
                <span className={styles.rank}>#{track.rank}</span>
                <div className={styles.cardBody}>
                  <span className={styles.cardTitle} title={track.title}>
                    {track.title}
                  </span>
                  <span className={styles.cardArtist} title={track.creditedArtists.join(", ")}>
                    {track.creditedArtists.join(", ")}
                  </span>
                  {(track.album || track.releaseDate || track.durationMs) && (
                    <span className={styles.cardMeta} title={track.album}>
                      {[track.album, formatReleaseDate(track.releaseDate), formatDuration(track.durationMs)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {(() => {
                    // Untagged songs are common (many artists in this
                    // dataset aren't in ARTIST_GENRES yet) - showing an
                    // "Unknown/Untagged" chip on most of 25 cards per month
                    // would be noise, not information, so that sentinel is
                    // suppressed here specifically (unlike the Leaderboard's
                    // genre filter, which needs it as a real, selectable
                    // bucket). scoringArtists (not creditedArtists) so a
                    // misspelled/aliased credit (e.g. "Sickboyrari") still
                    // resolves to its canonical name's ARTIST_GENRES entry.
                    const genres = directGenresForArtists(track.scoringArtists).filter(
                      (g) => g !== UNTAGGED_GENRE
                    );
                    if (genres.length === 0) return null;
                    return (
                      <span className={styles.cardGenres}>
                        {genres.map((genre) => (
                          <span key={genre} className={styles.genreChip}>
                            {genre}
                          </span>
                        ))}
                      </span>
                    );
                  })()}
                  {track.spotifyId &&
                    (isOpen ? (
                      <SpotifyEmbed spotifyId={track.spotifyId} />
                    ) : (
                      <button
                        type="button"
                        className={styles.previewButton}
                        onClick={() => setOpenPreview(cardKey)}
                      >
                        ▶ Preview on Spotify
                      </button>
                    ))}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <div className={styles.statsPanel}>
        <h3 className={styles.statsPanelHeading}>This month at a glance</h3>
        <div className={styles.statsGrid}>
          <MonthStatList title="Artists" rows={monthStats.artists} colorMap={monthArtistColors} />
          <MonthStatList title="Genres" rows={monthStats.genres} />
          <MonthStatList title="Decades" rows={monthStats.decades} />
          <MonthStatList title="Years" rows={monthStats.years} />
          <MonthStatList title="Length" rows={monthStats.duration} />
        </div>
      </div>
    </div>
  );
}
