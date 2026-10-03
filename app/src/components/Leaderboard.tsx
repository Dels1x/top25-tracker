import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { artistTotals } from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import styles from "./Leaderboard.module.css";

interface LeaderboardProps {
  dataset: Dataset;
  person: string;
  includeDuplicates: boolean;
}

const PAGE_SIZE = 20;

export function Leaderboard({ dataset, person, includeDuplicates }: LeaderboardProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);

  const totals = useMemo(
    () => artistTotals(dataset, person, { includeDuplicates }),
    [dataset, person, includeDuplicates]
  );
  const colorMap = useMemo(
    () => buildArtistColorMap(totals.map((t) => t.artist)),
    [totals]
  );
  const max = totals[0]?.total ?? 1;
  const visible = totals.slice(0, limit);

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Songs per artist</h2>
        <p className={styles.sub}>
          {totals.length} artists &middot; counts include feature credits and group/member
          attribution{!includeDuplicates && " · repeat songs counted once"}
        </p>
      </div>

      <ol className={styles.list}>
        {visible.map((row, index) => {
          const pct = (row.total / max) * 100;
          const color = colorMap.get(row.artist) ?? "var(--text-muted)";
          return (
            <li key={row.artist} className={styles.row}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.name} title={row.artist}>
                {row.artist}
              </span>
              <div className={styles.barTrack}>
                <motion.div
                  className={styles.bar}
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.015 }}
                />
              </div>
              <span className={styles.value}>{row.total}</span>
            </li>
          );
        })}
      </ol>

      {limit < totals.length && (
        <button type="button" className={styles.more} onClick={() => setLimit((n) => n + PAGE_SIZE)}>
          Show more ({totals.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
