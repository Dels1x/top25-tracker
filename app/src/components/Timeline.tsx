import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset } from "../data/types";
import {
  artistTotals,
  cumulativeArtistRankSeries,
  cumulativeArtistSeries,
  cumulativeDurationSeries,
  cumulativeEraSeries,
  cumulativeGenreSeries,
  durationTotals,
  eraTotals,
  genreTotals,
  sortedMonths,
  type EraGranularity,
  type StatsOptions,
} from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { usePersistedSetState, usePersistedState } from "../lib/usePersistedState";
import { useMonthRange } from "../lib/useMonthRange";
import { useGenreFilter } from "../lib/useGenreFilter";
import { RangePicker } from "./RangePicker";
import { GenreFilter } from "./GenreFilter";
import { ModeSwitch } from "./ModeSwitch";
import styles from "./Timeline.module.css";

interface TimelineProps {
  dataset: Dataset;
  person: string;
  scoringOptions: StatsOptions;
}

type Mode = "artists" | "genres" | "years" | "decades" | "placements" | "duration";

const DEFAULT_SHOWN = 6;

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

/**
 * Cumulative line chart over time, OR (via the Artists/Genres mode switch)
 * the same chart tracking major genres instead - these used to be two
 * separate tabs/components (Timeline + GenreTimeline), merged the same way
 * Leaderboard/GenreLeaderboard were, for the same reason: nearly identical
 * shape, differing only in which stats.ts functions back the chart. Unlike
 * Leaderboard's artist mode (which defaults to a top-N subset via its own
 * legend toggles), genre mode shows every genre by default - there are only
 * ~19 possible genres/subgenres (see artistGenres.ts), so no trimming is
 * needed the way there is for a potentially-hundreds-strong artist pool.
 *
 * "years"/"decades" modes track each line's release-year/decade bucket (see
 * releaseEra.ts) instead - same "show everything by default" behavior as
 * genre mode, since a person's history only ever spans a few dozen release
 * years/decades at most, same small-bucket-count reasoning.
 *
 * Also has its own GenreFilter panel (own persisted key, `timeline:${person}`
 * - independent of Leaderboard's per-person filter and Shared's "shared"
 * one, same "each tab's filter is its own thing" precedent Shared already
 * established) below the RangePicker, wired into StatsOptions.genreFilter
 * in every mode here too - it's a per-ARTIST filter (applied inside
 * allTracks) that doesn't care what the chart's lines are grouped by, same
 * reasoning Leaderboard/Shared both apply it in every one of their modes.
 */
export function Timeline({ dataset, person, scoringOptions }: TimelineProps) {
  const [mode, setMode] = usePersistedState<Mode>("top25tracker:timelineMode", "artists");
  const isGenreMode = mode === "genres";
  const isEraMode = mode === "years" || mode === "decades";
  // Placements is artist-scoped (see the "Artists only" product decision in
  // cumulativeArtistRankSeries's own doc comment) - it reuses the exact same
  // artist list/shown-set/color assignment as plain "artists" mode, only the
  // chart's Y value (rank instead of running count) and axis orientation
  // differ, so it piggybacks on every `isGenreMode`/`isEraMode`-false branch
  // below rather than needing its own parallel allArtists/shownArtists state.
  const isPlacementsMode = mode === "placements";
  const isDurationMode = mode === "duration";
  const eraGranularity: EraGranularity = mode === "decades" ? "decade" : "year";

  const availableMonths = useMemo(() => sortedMonths(dataset, person), [dataset, person]);

  const {
    startIndex,
    endIndex,
    lastIndex,
    rangeOptions,
    availableYears,
    handleSliderChange,
    applyPreset,
    applyYear,
  } = useMonthRange(availableMonths, `timeline:${person}`);
  // Own persisted key (not shared with Leaderboard's per-person filter, even
  // though both are keyed by the same person) - same "each tab's filter is
  // independent" precedent Shared's own "shared" key establishes, so
  // toggling a genre off here never silently changes what Leaderboard shows
  // for this person, or vice versa.
  const {
    selected: selectedGenres,
    toggleNode: toggleGenre,
    selectAll: selectAllGenres,
    selectNone: selectNoneGenres,
  } = useGenreFilter(`timeline:${person}`);

  // GenreFilter is a per-ARTIST filter (StatsOptions.genreFilter, applied
  // inside allTracks) - it doesn't care what the chart's lines are grouped
  // by, so it applies in every mode here too, same precedent Leaderboard/
  // Shared already established. includeDuplicates/startMonth/endMonth are
  // meaningful for genres/eras too; only the artist-identity options
  // (unite/producers/duos) don't apply there, same as before.
  const genreOptions: StatsOptions = useMemo(
    () => ({
      includeDuplicates: scoringOptions.includeDuplicates,
      ...rangeOptions,
      genreFilter: selectedGenres,
    }),
    [scoringOptions.includeDuplicates, rangeOptions, selectedGenres]
  );

  const artistTotalsList = useMemo(
    () =>
      artistTotals(dataset, person, { ...scoringOptions, ...rangeOptions, genreFilter: selectedGenres }),
    [dataset, person, scoringOptions, rangeOptions, selectedGenres]
  );
  const genreTotalsList = useMemo(
    () => genreTotals(dataset, person, genreOptions),
    [dataset, person, genreOptions]
  );
  const eraTotalsList = useMemo(
    () => eraTotals(dataset, eraGranularity, person, genreOptions),
    [dataset, eraGranularity, person, genreOptions]
  );
  const durationTotalsList = useMemo(
    () => durationTotals(dataset, person, genreOptions),
    [dataset, person, genreOptions]
  );
  const allArtists = useMemo(() => artistTotalsList.map((t) => t.artist), [artistTotalsList]);
  const allGenres = useMemo(() => genreTotalsList.map((t) => t.genre), [genreTotalsList]);
  const allEras = useMemo(() => eraTotalsList.map((t) => t.era), [eraTotalsList]);
  const allDurations = useMemo(() => durationTotalsList.map((t) => t.bucket), [durationTotalsList]);
  const allNames = isDurationMode ? allDurations : isEraMode ? allEras : isGenreMode ? allGenres : allArtists;

  // Color follows the ARTIST/GENRE/ERA, not its current rank within the
  // selected range - built from the all-time ordering (identity toggles
  // only, no range) so narrowing/widening the range never reshuffles which
  // color a line gets, the same fix applied to Leaderboard.
  const stableArtistOrder = useMemo(
    () => artistTotals(dataset, person, scoringOptions).map((t) => t.artist),
    [dataset, person, scoringOptions]
  );
  const stableGenreOrder = useMemo(
    () =>
      genreTotals(dataset, person, { includeDuplicates: scoringOptions.includeDuplicates }).map(
        (t) => t.genre
      ),
    [dataset, person, scoringOptions.includeDuplicates]
  );
  const stableEraOrder = useMemo(
    () =>
      eraTotals(dataset, eraGranularity, person, {
        includeDuplicates: scoringOptions.includeDuplicates,
      }).map((t) => t.era),
    [dataset, eraGranularity, person, scoringOptions.includeDuplicates]
  );
  const stableDurationOrder = useMemo(
    () =>
      durationTotals(dataset, person, { includeDuplicates: scoringOptions.includeDuplicates }).map(
        (t) => t.bucket
      ),
    [dataset, person, scoringOptions.includeDuplicates]
  );
  const colorMap = useMemo(
    () =>
      buildArtistColorMap(
        isDurationMode
          ? stableDurationOrder
          : isEraMode
            ? stableEraOrder
            : isGenreMode
              ? stableGenreOrder
              : stableArtistOrder
      ),
    [isDurationMode, isEraMode, isGenreMode, stableDurationOrder, stableEraOrder, stableGenreOrder, stableArtistOrder]
  );

  // Keyed per person AND per mode - each person has a different artist
  // pool, and artists/genres/eras are entirely different name spaces, so
  // "shown" selections shouldn't bleed across any of them. Defaults to the
  // top N artists the first time this person is viewed in artist mode;
  // genre/era modes default to everything shown (same as the old
  // GenreTimeline), since there are only a couple dozen possible buckets at
  // most either way. Years and decades get their own separate persisted set
  // too (not shared with each other) since switching granularity changes
  // the bucket names entirely (e.g. "1994" vs "1990s").
  const [shownArtists, setShownArtists] = usePersistedSetState(
    `top25tracker:timelineShown:${person}`,
    () => allArtists.slice(0, DEFAULT_SHOWN)
  );
  const [shownGenres, setShownGenres] = usePersistedSetState(
    `top25tracker:genreTimelineShown:${person}`,
    () => allGenres
  );
  const [shownEras, setShownEras] = usePersistedSetState(
    `top25tracker:eraTimelineShown:${eraGranularity}:${person}`,
    () => allEras
  );
  const [shownDurations, setShownDurations] = usePersistedSetState(
    `top25tracker:durationTimelineShown:${person}`,
    () => allDurations
  );
  const shown = isDurationMode
    ? shownDurations
    : isEraMode
      ? shownEras
      : isGenreMode
        ? shownGenres
        : shownArtists;
  const setShown = isDurationMode
    ? setShownDurations
    : isEraMode
      ? setShownEras
      : isGenreMode
        ? setShownGenres
        : setShownArtists;

  const artistSeries = useMemo(
    () =>
      cumulativeArtistSeries(dataset, person, allArtists, {
        ...scoringOptions,
        ...rangeOptions,
        genreFilter: selectedGenres,
      }),
    [dataset, person, allArtists, scoringOptions, rangeOptions, selectedGenres]
  );
  const genreSeries = useMemo(
    () => cumulativeGenreSeries(dataset, person, allGenres, genreOptions),
    [dataset, person, allGenres, genreOptions]
  );
  const eraSeries = useMemo(
    () => cumulativeEraSeries(dataset, eraGranularity, person, allEras, genreOptions),
    [dataset, eraGranularity, person, allEras, genreOptions]
  );
  const durationSeries = useMemo(
    () => cumulativeDurationSeries(dataset, person, allDurations, genreOptions),
    [dataset, person, allDurations, genreOptions]
  );
  // Placements: same artist list as plain artist mode, but the value per
  // month is this artist's 1-indexed RANK in the all-time leaderboard as of
  // that month (see cumulativeArtistRankSeries), not a running count - a
  // fundamentally different series shape, computed separately rather than
  // derived from artistSeries.
  const placementSeries = useMemo(
    () =>
      cumulativeArtistRankSeries(dataset, person, allArtists, {
        ...scoringOptions,
        ...rangeOptions,
        genreFilter: selectedGenres,
      }),
    [dataset, person, allArtists, scoringOptions, rangeOptions, selectedGenres]
  );
  const series = isPlacementsMode
    ? placementSeries
    : isDurationMode
      ? durationSeries
      : isEraMode
        ? eraSeries
        : isGenreMode
          ? genreSeries
          : artistSeries;

  function toggle(name: string) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll() {
    setShown(new Set(allNames));
  }

  function selectNone() {
    setShown(new Set());
  }

  function switchMode(next: Mode) {
    setMode(next);
  }

  const visibleNames = allNames.filter((n) => shown.has(n));
  const noun =
    mode === "decades"
      ? "decade"
      : mode === "years"
        ? "year"
        : isDurationMode
          ? "duration"
          : isGenreMode
            ? "genre"
            : "artist";
  const byLabel =
    mode === "decades"
      ? "by decade "
      : mode === "years"
        ? "by year "
        : isDurationMode
          ? "by duration "
          : isGenreMode
            ? "by genre "
            : "";

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>
            {isPlacementsMode ? "Leaderboard placement over time" : `Cumulative songs ${byLabel}over time`}
          </h2>
          <p className={styles.sub}>
            {isPlacementsMode
              ? "Toggle artists to compare where they stood in the all-time leaderboard, month by month"
              : `Toggle ${noun}s to compare their growth month over month`}
          </p>
        </div>
        <div className={styles.bulkActions}>
          <ModeSwitch
            value={mode}
            options={[
              { value: "artists", label: "Artists" },
              { value: "genres", label: "Genres" },
              { value: "years", label: "Years" },
              { value: "decades", label: "Decades" },
              { value: "placements", label: "Placements" },
              { value: "duration", label: "Duration" },
            ]}
            onChange={switchMode}
            aria-label="Track by"
          />
          <button type="button" className={styles.bulkButton} onClick={selectAll}>
            Select all
          </button>
          <button type="button" className={styles.bulkButton} onClick={selectNone}>
            Select none
          </button>
        </div>
      </div>

      <RangePicker
        months={availableMonths}
        startIndex={startIndex}
        endIndex={endIndex}
        lastIndex={lastIndex}
        availableYears={availableYears}
        onSliderChange={handleSliderChange}
        onPreset={applyPreset}
        onYear={applyYear}
      />

      <GenreFilter
        selected={selectedGenres}
        onToggle={toggleGenre}
        onSelectAll={selectAllGenres}
        onSelectNone={selectNoneGenres}
      />

      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              stroke="var(--axis)"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={28}
              // Placements is a RANK, not a count - #1 is the best possible
              // value, so the axis is flipped (1 at top) and anchored to
              // start at 1 rather than 0, which a plain count axis always
              // does. `reversed` on its own still lets the domain's auto-max
              // float normally; connectNulls is NOT set on the Line below for
              // this mode on purpose - see cumulativeArtistRankSeries's doc
              // comment on why a gap (hasn't charted yet) should render as a
              // true gap, not a line jumping straight from nothing to a rank.
              // `scale="sqrt"` on top of that (a real, explicit product
              // request, not a cosmetic add) is what actually makes the
              // visual distance meaningful: going from #200 to #190 is a
              // trivial move far down an artist's climb, while #10 to #1 is
              // a much harder, more competitive stretch of the leaderboard -
              // a LINEAR rank axis draws both as the identical 10-unit gap,
              // which understates how much harder the low end is. A plain
              // log scale was tried first and rejected as too aggressive -
              // it compressed the whole tail into an unreadably thin sliver
              // (e.g. #10->#1 vs #200->#190 came out ~45x, vs sqrt's much
              // gentler ~6x for the same two gaps) - sqrt keeps "harder at
              // the top" without crushing the rest of the chart. Safe here
              // specifically because rank is always >= 1, never 0 or
              // negative - this isn't reused for any count-based axis in
              // this file.
              reversed={isPlacementsMode}
              scale={isPlacementsMode ? "sqrt" : "auto"}
              domain={isPlacementsMode ? [1, "auto"] : undefined}
              tickFormatter={isPlacementsMode ? (v: number) => `#${v}` : undefined}
            />
            <Tooltip content={<ChartTooltip colorMap={colorMap} isRank={isPlacementsMode} />} />
            {visibleNames.map((name) => (
              <Line
                key={name}
                // "natural" gives Placements mode a visibly softer, rounder
                // curve than "monotone" between months, while still passing
                // exactly through every real rank value - nothing is
                // smoothed away, unlike a "basis" curve which would
                // approximate rather than hit each point exactly. Every
                // other mode keeps "monotone", which is the right choice for
                // a cumulative count: it guarantees the curve never dips
                // below a true step between two points, a property that
                // doesn't matter for a rank series (which legitimately goes
                // up and down) but does matter for a running total.
                type={isPlacementsMode ? "natural" : "monotone"}
                dataKey={name}
                stroke={colorMap.get(name) ?? "var(--text-muted)"}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
                isAnimationActive={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.legend}>
        {allNames.map((name) => {
          const active = shown.has(name);
          const color = colorMap.get(name) ?? "var(--text-muted)";
          return (
            <button
              key={name}
              type="button"
              className={styles.legendItem}
              data-active={active}
              onClick={() => toggle(name)}
            >
              <span
                className={styles.swatch}
                style={{ background: active ? color : "var(--axis)" }}
              />
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  colorMap,
  isRank,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color?: string }>;
  label?: string;
  colorMap: Map<string, string>;
  /**
   * Placements mode: lower is better, so the tooltip sorts ASCENDING
   * (rank #1 first) instead of the usual descending-by-value, and each
   * value renders as "#N" rather than a bare count. Recharts already omits
   * a line from `payload` entirely when its value is null (hasn't charted
   * yet that month), so no extra filtering is needed here for that case.
   */
  isRank?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort((a, b) => (isRank ? a.value - b.value : b.value - a.value));
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipMonth}>{label ? formatMonth(label) : ""}</div>
      {sorted.map((p) => (
        <div key={p.dataKey} className={styles.tooltipRow}>
          <span
            className={styles.swatch}
            style={{ background: colorMap.get(p.dataKey) ?? "var(--text-muted)" }}
          />
          <span className={styles.tooltipName}>{p.dataKey}</span>
          <span className={styles.tooltipValue}>{isRank ? `#${p.value}` : p.value}</span>
        </div>
      ))}
    </div>
  );
}
