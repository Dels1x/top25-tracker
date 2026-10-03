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
import { artistTotals, cumulativeArtistSeries, sortedMonths } from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { usePersistedSetState, usePersistedState } from "../lib/usePersistedState";
import { MonthRangeSlider } from "./MonthRangeSlider";
import styles from "./Timeline.module.css";

interface TimelineProps {
  dataset: Dataset;
  person: string;
  includeDuplicates: boolean;
}

const DEFAULT_SHOWN = 6;

const PRESETS = [
  { label: "All time", months: null },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "Last 24 months", months: 24 },
] as const;

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function Timeline({ dataset, person, includeDuplicates }: TimelineProps) {
  const availableMonths = useMemo(() => sortedMonths(dataset, person), [dataset, person]);
  const lastIndex = Math.max(availableMonths.length - 1, 0);

  // Persisted per person as actual month strings (stable even if the number
  // of available months changes between sessions), but the slider/preset UI
  // operates on indices into availableMonths - converted both ways below.
  const [startMonth, setStartMonth] = usePersistedState(
    `top25tracker:timelineStart:${person}`,
    availableMonths[0] ?? ""
  );
  const [endMonth, setEndMonth] = usePersistedState(
    `top25tracker:timelineEnd:${person}`,
    availableMonths[lastIndex] ?? ""
  );

  const startIndex = Math.max(availableMonths.indexOf(startMonth), 0);
  const endIndexRaw = availableMonths.indexOf(endMonth);
  const endIndex = endIndexRaw === -1 ? lastIndex : endIndexRaw;

  const isFullRange = startIndex === 0 && endIndex === lastIndex;

  const rangeOptions = useMemo(
    () => ({
      startMonth: isFullRange ? undefined : availableMonths[startIndex],
      endMonth: isFullRange ? undefined : availableMonths[endIndex],
    }),
    [isFullRange, availableMonths, startIndex, endIndex]
  );

  const totals = useMemo(
    () => artistTotals(dataset, person, { includeDuplicates, ...rangeOptions }),
    [dataset, person, includeDuplicates, rangeOptions]
  );
  const allArtists = useMemo(() => totals.map((t) => t.artist), [totals]);
  const colorMap = useMemo(() => buildArtistColorMap(allArtists), [allArtists]);

  // Keyed per person - each person has a different artist pool, so "shown"
  // selections shouldn't bleed across people. Defaults to the top N artists
  // the first time this person is viewed; after that, whatever was saved.
  const [shown, setShown] = usePersistedSetState(
    `top25tracker:timelineShown:${person}`,
    () => allArtists.slice(0, DEFAULT_SHOWN)
  );

  const series = useMemo(
    () => cumulativeArtistSeries(dataset, person, allArtists, { includeDuplicates, ...rangeOptions }),
    [dataset, person, allArtists, includeDuplicates, rangeOptions]
  );

  function handleSliderChange(newStartIndex: number, newEndIndex: number) {
    setStartMonth(availableMonths[newStartIndex]);
    setEndMonth(availableMonths[newEndIndex]);
  }

  function applyPreset(monthsBack: number | null) {
    if (monthsBack === null) {
      setStartMonth(availableMonths[0]);
    } else {
      setStartMonth(availableMonths[Math.max(lastIndex - monthsBack + 1, 0)]);
    }
    setEndMonth(availableMonths[lastIndex]);
  }

  function toggle(artist: string) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(artist)) next.delete(artist);
      else next.add(artist);
      return next;
    });
  }

  function selectAll() {
    setShown(new Set(allArtists));
  }

  function selectNone() {
    setShown(new Set());
  }

  const visibleArtists = allArtists.filter((a) => shown.has(a));

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Cumulative songs over time</h2>
          <p className={styles.sub}>Toggle artists to compare their growth month over month</p>
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

      <div className={styles.rangeRow}>
        <div className={styles.rangeHeadRow}>
          <span className={styles.rangeLabel}>
            {formatMonth(availableMonths[startIndex] ?? "")} &rarr;{" "}
            {endIndex === lastIndex ? "now" : formatMonth(availableMonths[endIndex] ?? "")}
          </span>
          <div className={styles.presets}>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={styles.presetButton}
                onClick={() => applyPreset(preset.months)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <MonthRangeSlider
          months={availableMonths}
          startIndex={startIndex}
          endIndex={endIndex}
          onChange={handleSliderChange}
        />
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
            {visibleArtists.map((artist) => (
              <Line
                key={artist}
                type="monotone"
                dataKey={artist}
                stroke={colorMap.get(artist) ?? "var(--text-muted)"}
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
        {allArtists.map((artist) => {
          const active = shown.has(artist);
          const color = colorMap.get(artist) ?? "var(--text-muted)";
          return (
            <button
              key={artist}
              type="button"
              className={styles.legendItem}
              data-active={active}
              onClick={() => toggle(artist)}
            >
              <span
                className={styles.swatch}
                style={{ background: active ? color : "var(--axis)" }}
              />
              {artist}
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
