import { useMemo } from "react";
import type { Dataset } from "../data/types";
import { allTracks, artistTotals, sortedMonths, type StatsOptions } from "../lib/stats";
import { StatTile } from "./StatTile";
import styles from "./StatsRow.module.css";

interface StatsRowProps {
  dataset: Dataset;
  person: string;
  /**
   * Combined options - scoring toggles AND the active range/genre filter,
   * exactly like whatever's passed to the view's own artistTotals/allTracks
   * calls - so every number here always matches what's visibly computed
   * below it (e.g. "Top artist" is always the leaderboard's own #1 row for
   * the currently selected range, never a stale all-time figure).
   */
  options: StatsOptions;
}

export function StatsRow({ dataset, person, options }: StatsRowProps) {
  const stats = useMemo(() => {
    const months = sortedMonths(dataset, person, options);
    const tracks = allTracks(dataset, person, options);
    const totals = artistTotals(dataset, person, options);
    const uniqueTitles = new Set(tracks.map((t) => `${t.title}\u0000${t.creditedArtists.join(",")}`));
    const topArtist = totals[0];
    return {
      monthsTracked: months.length,
      totalEntries: tracks.length,
      uniqueSongs: uniqueTitles.size,
      uniqueArtists: totals.length,
      topArtist,
      firstMonth: months[0],
      lastMonth: months[months.length - 1],
    };
  }, [dataset, person, options]);

  return (
    <div className={styles.row}>
      <StatTile label="Months tracked" value={stats.monthsTracked} />
      <StatTile label="Unique artists" value={stats.uniqueArtists} />
      <StatTile label="Unique songs" value={stats.uniqueSongs} />
      <StatTile
        label="Top artist"
        value={stats.topArtist?.artist ?? "—"}
        detail={stats.topArtist ? `${stats.topArtist.total} songs` : undefined}
      />
    </div>
  );
}
