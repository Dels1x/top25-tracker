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
  personArtistSummaries,
  sortedMonths,
  type StatsOptions,
} from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { usePersistedSetState } from "../lib/usePersistedState";
import { useMonthRange } from "../lib/useMonthRange";
import { RangePicker } from "./RangePicker";
import styles from "./Compare.module.css";

interface CompareProps {
  dataset: Dataset;
  scoringOptions: StatsOptions;
}

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
 * Compare view: pick one or more artists (e.g. a group's members, or just
 * one name) and see each PERSON's cumulative count for that selection side
 * by side - one line per person, not per artist, since the point is "who
 * got into this artist earlier / listened more", not re-showing the
 * Timeline's per-artist breakdown. Spans all people like Shared does, so
 * there's no single "active person" scoping it - every person's full
 * history is always in play, independent of whichever person tab is
 * selected elsewhere in the app.
 */
export function Compare({ dataset, scoringOptions }: CompareProps) {
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const availableMonths = useMemo(() => sortedMonths(dataset, undefined), [dataset]);
  const { startIndex, endIndex, lastIndex, rangeOptions, handleSliderChange, applyPreset } =
    useMonthRange(availableMonths, "compare");

  const options: StatsOptions = { ...scoringOptions, ...rangeOptions };

  // Combined (all-people) totals, descending - what the artist picker lists,
  // so the most relevant names surface first without needing to search.
  const combinedTotals = useMemo(() => artistTotals(dataset, undefined, options), [dataset, options]);
  const allArtistNames = useMemo(() => combinedTotals.map((t) => t.artist), [combinedTotals]);

  const [selected, setSelected] = usePersistedSetState("top25tracker:compareArtists", () =>
    allArtistNames.slice(0, 1)
  );

  const selectedArtists = useMemo(
    () => allArtistNames.filter((a) => selected.has(a)),
    [allArtistNames, selected]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return combinedTotals.slice(0, 40);
    return combinedTotals.filter((t) => t.artist.toLowerCase().includes(q)).slice(0, 40);
  }, [combinedTotals, query]);

  function toggleArtist(artist: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(artist)) next.delete(artist);
      else next.add(artist);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  const people = dataset.people;
  const colorMap = useMemo(() => buildArtistColorMap(people), [people]);

  const series = useMemo(
    () => cumulativeArtistSeriesByPerson(dataset, people, selectedArtists, options),
    [dataset, people, selectedArtists, options]
  );

  const summaries = useMemo(
    () => personArtistSummaries(dataset, people, selectedArtists, options),
    [dataset, people, selectedArtists, options]
  );
  const earliestMonth = summaries
    .map((s) => s.firstMonth)
    .filter((m): m is string => m !== null)
    .sort()[0];

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Compare across people</h2>
          <p className={styles.sub}>
            Pick one or more artists to see each person's cumulative count side by side - who
            started listening earlier, and how much
          </p>
        </div>
      </div>

      <div className={styles.picker}>
        <div className={styles.searchRow}>
          <input
            type="text"
            className={styles.search}
            placeholder="Search artists to compare..."
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
          {selectedArtists.length > 0 && (
            <button type="button" className={styles.toggleButton} onClick={clearAll}>
              Clear
            </button>
          )}
        </div>

        {pickerOpen && (
          <ul className={styles.optionList}>
            {matches.length === 0 && <li className={styles.noMatches}>No matching artists.</li>}
            {matches.map((t) => (
              <li key={t.artist}>
                <label className={styles.optionLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(t.artist)}
                    onChange={() => toggleArtist(t.artist)}
                  />
                  <span className={styles.optionName}>{t.artist}</span>
                  <span className={styles.optionCount}>{t.total}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {selectedArtists.length > 0 && (
          <div className={styles.chips}>
            {selectedArtists.map((artist) => (
              <button
                key={artist}
                type="button"
                className={styles.chip}
                onClick={() => toggleArtist(artist)}
                title="Remove"
              >
                {artist}
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
        onSliderChange={handleSliderChange}
        onPreset={applyPreset}
      />

      {selectedArtists.length === 0 ? (
        <p className={styles.empty}>Select at least one artist above to compare.</p>
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
