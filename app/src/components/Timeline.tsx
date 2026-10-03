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
import { artistTotals, cumulativeArtistSeries } from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import styles from "./Timeline.module.css";

interface TimelineProps {
  dataset: Dataset;
  person: string;
  includeDuplicates: boolean;
}

const DEFAULT_SHOWN = 6;

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function Timeline({ dataset, person, includeDuplicates }: TimelineProps) {
  const totals = useMemo(
    () => artistTotals(dataset, person, { includeDuplicates }),
    [dataset, person, includeDuplicates]
  );
  const allArtists = useMemo(() => totals.map((t) => t.artist), [totals]);
  const colorMap = useMemo(() => buildArtistColorMap(allArtists), [allArtists]);

  const [shown, setShown] = useState<Set<string>>(
    () => new Set(allArtists.slice(0, DEFAULT_SHOWN))
  );

  // Reset the default selection when switching person (different artist pool).
  const [lastPerson, setLastPerson] = useState(person);
  if (lastPerson !== person) {
    setLastPerson(person);
    setShown(new Set(allArtists.slice(0, DEFAULT_SHOWN)));
  }

  const series = useMemo(
    () => cumulativeArtistSeries(dataset, person, allArtists, { includeDuplicates }),
    [dataset, person, allArtists, includeDuplicates]
  );

  function toggle(artist: string) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(artist)) next.delete(artist);
      else next.add(artist);
      return next;
    });
  }

  const visibleArtists = allArtists.filter((a) => shown.has(a));

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Cumulative songs over time</h2>
        <p className={styles.sub}>Toggle artists to compare their growth month over month</p>
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
