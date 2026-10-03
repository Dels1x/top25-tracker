import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { sharedSongs } from "../lib/stats";
import styles from "./Shared.module.css";

interface SharedProps {
  dataset: Dataset;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function Shared({ dataset }: SharedProps) {
  const [query, setQuery] = useState("");

  const songs = useMemo(() => sharedSongs(dataset), [dataset]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.creditedArtists.some((a) => a.toLowerCase().includes(q))
    );
  }, [songs, query]);

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Songs on everyone's top 25</h2>
        <p className={styles.sub}>
          {songs.length} songs have appeared in every one of {dataset.people.length} people's top
          25 at some point (not necessarily the same month)
        </p>
      </div>

      <input
        type="text"
        className={styles.search}
        placeholder="Filter by song or artist..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className={styles.empty}>No matches.</p>
      ) : (
        <ol className={styles.list}>
          {filtered.map((song, index) => (
            <motion.li
              key={song.trackKey}
              className={styles.item}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.4) }}
            >
              <div className={styles.songInfo}>
                <span className={styles.title}>{song.title}</span>
                <span className={styles.artists}>{song.creditedArtists.join(", ")}</span>
              </div>
              <ul className={styles.appearances}>
                {song.appearances
                  .slice()
                  .sort((a, b) => a.person.localeCompare(b.person) || a.month.localeCompare(b.month))
                  .map((a, i) => (
                    <li key={i} className={styles.appearance}>
                      <span className={styles.person}>{a.person}</span>
                      <span className={styles.appearanceDetail}>
                        {formatMonth(a.month)} &middot; #{a.rank}
                      </span>
                    </li>
                  ))}
              </ul>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}
