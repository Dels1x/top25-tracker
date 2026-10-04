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
  genreTotals,
  cumulativeGenreSeries,
  sortedMonths,
  type StatsOptions,
} from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { usePersistedSetState } from "../lib/usePersistedState";
import { useMonthRange } from "../lib/useMonthRange";
import { RangePicker } from "./RangePicker";
import styles from "./Timeline.module.css";

interface GenreTimelineProps {
  dataset: Dataset;
  person: string;
  scoringOptions: StatsOptions;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

/**
 * Same shape as Timeline, but tracking major genres instead of artists -
 * there are only ~19 possible genres/subgenres (see artistGenres.ts) so, unlike
 * Timeline, every genre is shown by default rather than just a top N.
 */
export function GenreTimeline({ dataset, person, scoringOptions }: GenreTimelineProps) {
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
  } = useMonthRange(availableMonths, `genre-timeline:${person}`);

  const genreOptions: StatsOptions = {
    includeDuplicates: scoringOptions.includeDuplicates,
    ...rangeOptions,
  };

  const totals = useMemo(
    () => genreTotals(dataset, person, genreOptions),
    [dataset, person, genreOptions]
  );
  const allGenres = useMemo(() => totals.map((t) => t.genre), [totals]);
  const colorMap = useMemo(() => buildArtistColorMap(allGenres), [allGenres]);

  const [shown, setShown] = usePersistedSetState(
    `top25tracker:genreTimelineShown:${person}`,
    () => allGenres
  );

  const series = useMemo(
    () => cumulativeGenreSeries(dataset, person, allGenres, genreOptions),
    [dataset, person, allGenres, genreOptions]
  );

  function toggle(genre: string) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }

  function selectAll() {
    setShown(new Set(allGenres));
  }

  function selectNone() {
    setShown(new Set());
  }

  const visibleGenres = allGenres.filter((g) => shown.has(g));

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Cumulative songs by genre over time</h2>
          <p className={styles.sub}>Toggle genres to compare their growth month over month</p>
        </div>
        <div className={styles.bulkActions}>
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
            {visibleGenres.map((genre) => (
              <Line
                key={genre}
                type="monotone"
                dataKey={genre}
                stroke={colorMap.get(genre) ?? "var(--text-muted)"}
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
        {allGenres.map((genre) => {
          const active = shown.has(genre);
          const color = colorMap.get(genre) ?? "var(--text-muted)";
          return (
            <button
              key={genre}
              type="button"
              className={styles.legendItem}
              data-active={active}
              onClick={() => toggle(genre)}
            >
              <span
                className={styles.swatch}
                style={{ background: active ? color : "var(--axis)" }}
              />
              {genre}
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
