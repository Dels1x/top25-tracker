import { useMemo } from "react";
import type { Dataset } from "../data/types";
import { allTracks, artistTotals, listsForPerson } from "../lib/stats";
import { StatTile } from "./StatTile";
import styles from "./StatsRow.module.css";

interface StatsRowProps {
  dataset: Dataset;
  person: string;
  includeDuplicates: boolean;
}

export function StatsRow({ dataset, person, includeDuplicates }: StatsRowProps) {
  const stats = useMemo(() => {
    const lists = listsForPerson(dataset, person);
    const tracks = allTracks(dataset, person, { includeDuplicates });
    const totals = artistTotals(dataset, person, { includeDuplicates });
    const uniqueTitles = new Set(tracks.map((t) => `${t.title}\u0000${t.creditedArtists.join(",")}`));
    const topArtist = totals[0];
    const months = lists.map((l) => l.month).sort();
    return {
      monthsTracked: lists.length,
      totalEntries: tracks.length,
      uniqueSongs: uniqueTitles.size,
      uniqueArtists: totals.length,
      topArtist,
      firstMonth: months[0],
      lastMonth: months[months.length - 1],
    };
  }, [dataset, person, includeDuplicates]);

  return (
    <div className={styles.row}>
      <StatTile label="Months tracked" value={stats.monthsTracked} />
      <StatTile label="Unique artists" value={stats.uniqueArtists} />
      <StatTile label="Unique songs" value={stats.uniqueSongs} />
      <StatTile
        label="Top artist"
        value={stats.topArtist?.artist ?? "—"}
        detail={stats.topArtist ? `${stats.topArtist.total} points` : undefined}
      />
    </div>
  );
}
