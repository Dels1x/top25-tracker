import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { listsForPerson } from "../lib/stats";
import styles from "./Replay.module.css";

interface ReplayProps {
  dataset: Dataset;
  person: string;
}

function formatMonthLong(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function Replay({ dataset, person }: ReplayProps) {
  const months = useMemo(() => {
    const lists = listsForPerson(dataset, person);
    return [...lists].sort((a, b) => a.month.localeCompare(b.month));
  }, [dataset, person]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset position when switching person.
  const [lastPerson, setLastPerson] = useState(person);
  if (lastPerson !== person) {
    setLastPerson(person);
    setIndex(0);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setIndex((i) => {
        if (i >= months.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1400);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, months.length]);

  if (months.length === 0) {
    return <p>No data for this person yet.</p>;
  }

  const current = months[index];

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Replay</h2>
        <p className={styles.sub}>Watch the top 25 roll in, month by month</p>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => {
            if (index >= months.length - 1) setIndex(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : index >= months.length - 1 ? "Replay" : "Play"}
        </button>

        <input
          type="range"
          min={0}
          max={months.length - 1}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          className={styles.scrubber}
        />

        <span className={styles.monthLabel}>{formatMonthLong(current.month)}</span>
      </div>

      <div className={styles.grid}>
        <AnimatePresence mode="popLayout">
          {current.tracks.map((track) => (
            <motion.div
              key={`${current.month}-${track.rank}`}
              className={styles.card}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: (25 - track.rank) * 0.01 }}
            >
              <span className={styles.rank}>#{track.rank}</span>
              <div className={styles.cardBody}>
                <span className={styles.cardTitle} title={track.title}>
                  {track.title}
                </span>
                <span className={styles.cardArtist} title={track.creditedArtists.join(", ")}>
                  {track.creditedArtists.join(", ")}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
