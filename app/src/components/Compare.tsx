import { useMemo, useState } from "react";
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
  cumulativeArtistSeriesByPerson,
  cumulativeGenreSeriesByPerson,
  genreTotals,
  personArtistSummaries,
  personGenreSummaries,
  sortedMonths,
  type StatsOptions,
} from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { usePersistedSetState, usePersistedState } from "../lib/usePersistedState";
import { useMonthRange } from "../lib/useMonthRange";
import { RangePicker } from "./RangePicker";
import { ModeSwitch } from "./ModeSwitch";
import styles from "./Compare.module.css";

interface CompareProps {
  dataset: Dataset;
  scoringOptions: StatsOptions;
}

type Mode = "artists" | "genres";

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function formatMonthLong(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * Compare view: pick one or more artists OR genres (toggled via `mode` -
 * never mixed in the same selection, same as Leaderboard/GenreLeaderboard
 * being separate tabs rather than one combined picker) and see each
 * PERSON's cumulative count for that selection side by side - one line per
 * person, not per artist/genre, since the point is "who got into this
 * earlier / listened more", not re-showing Timeline/GenreTimeline's
 * per-artist-or-genre breakdown. Spans all people like Shared does, so
 * there's no single "active person" scoping it - every person's full
 * history is always in play, independent of whichever person tab is
 * selected elsewhere in the app.
 *
 * In "genres" mode the artist-identity toggles (unite/producers/duos) are
 * irrelevant (same reasoning as GenreLeaderboard/GenreTimeline) - the caller
 * (App.tsx) still passes `scoringOptions` through unconditionally since only
 * `includeDuplicates` actually matters here either way, and genreTotals/
 * genreBucketsForTrack simply don't look at the identity-only fields.
 */
export function Compare({ dataset, scoringOptions }: CompareProps) {
  const [mode, setMode] = usePersistedState<Mode>("top25tracker:compareMode", "artists");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const availableMonths = useMemo(() => sortedMonths(dataset, undefined), [dataset]);
  const {
    startIndex,
    endIndex,
    lastIndex,
    rangeOptions,
    availableYears,
    handleSliderChange,
    applyPreset,
    applyYear,
  } = useMonthRange(availableMonths, "compare");

  const options: StatsOptions = { ...scoringOptions, ...rangeOptions };

  // Combined (all-people) totals, descending - what the picker lists, so
  // the most relevant names surface first without needing to search.
  const combinedArtistTotals = useMemo(
    () => artistTotals(dataset, undefined, options),
    [dataset, options]
  );
  const combinedGenreTotals = useMemo(
    () => genreTotals(dataset, undefined, options),
    [dataset, options]
  );

  const allArtistNames = useMemo(
    () => combinedArtistTotals.map((t) => t.artist),
    [combinedArtistTotals]
  );
  const allGenreNames = useMemo(() => combinedGenreTotals.map((t) => t.genre), [combinedGenreTotals]);

  const [selectedArtistSet, setSelectedArtistSet] = usePersistedSetState(
    "top25tracker:compareArtists",
    () => allArtistNames.slice(0, 1)
  );
  const [selectedGenreSet, setSelectedGenreSet] = usePersistedSetState(
    "top25tracker:compareGenres",
    () => allGenreNames.slice(0, 1)
  );

  const isGenreMode = mode === "genres";
  const allNames = isGenreMode ? allGenreNames : allArtistNames;
  const selected = isGenreMode ? selectedGenreSet : selectedArtistSet;
  const setSelected = isGenreMode ? setSelectedGenreSet : setSelectedArtistSet;
  const combinedTotals: Array<{ name: string; total: number }> = isGenreMode
    ? combinedGenreTotals.map((t) => ({ name: t.genre, total: t.total }))
    : combinedArtistTotals.map((t) => ({ name: t.artist, total: t.total }));

  const selectedNames = useMemo(
    () => allNames.filter((a) => selected.has(a)),
    [allNames, selected]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return combinedTotals.slice(0, 40);
    return combinedTotals.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 40);
  }, [combinedTotals, query]);

  function toggleName(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  function switchMode(next: Mode) {
    setMode(next);
    setQuery("");
  }

  const people = dataset.people;
  const colorMap = useMemo(() => buildArtistColorMap(people), [people]);

  const series = useMemo(
    () =>
      isGenreMode
        ? cumulativeGenreSeriesByPerson(dataset, people, selectedNames, options)
        : cumulativeArtistSeriesByPerson(dataset, people, selectedNames, options),
    [dataset, people, selectedNames, options, isGenreMode]
  );

  const summaries = useMemo(
    () =>
      isGenreMode
        ? personGenreSummaries(dataset, people, selectedNames, options)
        : personArtistSummaries(dataset, people, selectedNames, options),
    [dataset, people, selectedNames, options, isGenreMode]
  );
  const earliestMonth = summaries
    .map((s) => s.firstMonth)
    .filter((m): m is string => m !== null)
    .sort()[0];

  const noun = isGenreMode ? "genre" : "artist";
  const nounPlural = isGenreMode ? "genres" : "artists";

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Compare across people</h2>
          <p className={styles.sub}>
            Pick one or more {nounPlural} to see each person's cumulative count side by side - who
            started listening earlier, and how much
          </p>
        </div>
        <ModeSwitch
          value={mode}
          options={[
            { value: "artists", label: "Artists" },
            { value: "genres", label: "Genres" },
          ]}
          onChange={switchMode}
          aria-label="Compare by"
        />
      </div>

      <div className={styles.picker}>
        <div className={styles.searchRow}>
          <input
            type="text"
            className={styles.search}
            placeholder={`Search ${nounPlural} to compare...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setPickerOpen(true)}
          />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
          >
            {pickerOpen ? "Hide list" : "Browse list"}
          </button>
          {selectedNames.length > 0 && (
            <button type="button" className={styles.toggleButton} onClick={clearAll}>
              Clear
            </button>
          )}
        </div>

        {pickerOpen && (
          <ul className={styles.optionList}>
            {matches.length === 0 && (
              <li className={styles.noMatches}>No matching {nounPlural}.</li>
            )}
            {matches.map((t) => (
              <li key={t.name}>
                <label className={styles.optionLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(t.name)}
                    onChange={() => toggleName(t.name)}
                  />
                  <span className={styles.optionName}>{t.name}</span>
                  <span className={styles.optionCount}>{t.total}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {selectedNames.length > 0 && (
          <div className={styles.chips}>
            {selectedNames.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.chip}
                onClick={() => toggleName(name)}
                title="Remove"
              >
                {name}
                <span className={styles.chipX} aria-hidden="true">
                  ×
                </span>
              </button>
            ))}
          </div>
        )}
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

      {selectedNames.length === 0 ? (
        <p className={styles.empty}>Select at least one {noun} above to compare.</p>
      ) : (
        <>
          <div className={styles.summaryRow}>
            {summaries
              .slice()
              .sort((a, b) => b.total - a.total)
              .map((s) => (
                <div key={s.person} className={styles.summaryTile}>
                  <span
                    className={styles.summarySwatch}
                    style={{ background: colorMap.get(s.person) ?? "var(--text-muted)" }}
                  />
                  <span className={styles.summaryPerson}>{s.person}</span>
                  <span className={styles.summaryTotal}>{s.total}</span>
                  <span className={styles.summaryDetail}>
                    {s.firstMonth
                      ? `since ${formatMonthLong(s.firstMonth)}${
                          s.firstMonth === earliestMonth ? " · first" : ""
                        }`
                      : "no songs in range"}
                  </span>
                </div>
              ))}
          </div>

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
                {people.map((person) => (
                  <Line
                    key={person}
                    type="monotone"
                    dataKey={person}
                    stroke={colorMap.get(person) ?? "var(--text-muted)"}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
                    isAnimationActive={true}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
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
