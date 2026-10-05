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
  cumulativeArtistSeries,
  cumulativeEraSeries,
  cumulativeGenreSeries,
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

type Mode = "artists" | "genres" | "years" | "decades";

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
  const allArtists = useMemo(() => artistTotalsList.map((t) => t.artist), [artistTotalsList]);
  const allGenres = useMemo(() => genreTotalsList.map((t) => t.genre), [genreTotalsList]);
  const allEras = useMemo(() => eraTotalsList.map((t) => t.era), [eraTotalsList]);
  const allNames = isEraMode ? allEras : isGenreMode ? allGenres : allArtists;

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
  const colorMap = useMemo(
    () =>
      buildArtistColorMap(isEraMode ? stableEraOrder : isGenreMode ? stableGenreOrder : stableArtistOrder),
    [isEraMode, isGenreMode, stableEraOrder, stableGenreOrder, stableArtistOrder]
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
  const shown = isEraMode ? shownEras : isGenreMode ? shownGenres : shownArtists;
  const setShown = isEraMode ? setShownEras : isGenreMode ? setShownGenres : setShownArtists;

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
  const series = isEraMode ? eraSeries : isGenreMode ? genreSeries : artistSeries;

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
  const noun = mode === "decades" ? "decade" : mode === "years" ? "year" : isGenreMode ? "genre" : "artist";
  const byLabel =
    mode === "decades" ? "by decade " : mode === "years" ? "by year " : isGenreMode ? "by genre " : "";

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Cumulative songs {byLabel}over time</h2>
          <p className={styles.sub}>Toggle {noun}s to compare their growth month over month</p>
        </div>
        <div className={styles.bulkActions}>
          <ModeSwitch
            value={mode}
            options={[
              { value: "artists", label: "Artists" },
              { value: "genres", label: "Genres" },
              { value: "years", label: "Years" },
              { value: "decades", label: "Decades" },
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
            />
            <Tooltip content={<ChartTooltip colorMap={colorMap} />} />
            {visibleNames.map((name) => (
              <Line
                key={name}
                type="monotone"
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
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color?: string }>;
  label?: string;
  colorMap: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
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
          <span className={styles.tooltipValue}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}
