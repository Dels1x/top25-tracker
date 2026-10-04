import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { listsForPerson } from "../lib/stats";
import { sliderTickIndices } from "../lib/sliderTicks";
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

/**
 * Formats a track's raw Spotify releaseDate for display - handles the three
 * precisions Spotify's API actually returns (full "YYYY-MM-DD", "YYYY-MM",
 * or just "YYYY" for an older/less-precisely-catalogued release) rather than
 * assuming full precision always parses cleanly - a bare "YYYY" passed to
 * `new Date()` would otherwise get misread as UTC midnight and can print the
 * wrong year in a timezone behind UTC. null (no release date in the source
 * row) renders nothing rather than "Invalid Date".
 */
function formatReleaseDate(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const parts = releaseDate.split("-");
  if (parts.length === 1) return parts[0]; // year-only precision
  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day || 1);
  return parts.length === 2
    ? date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTick(month: string): string {
  // Always just the year ("2024"), even for a half-yearly fallback tick
  // (July - only used when there's under ~2 years of data, see
  // sliderTickIndices) or a non-January edge tick (the actual first/last
  // month in someone's history, e.g. "Jul 2022") - the exact month is
  // already shown with full precision in the monthLabel above the
  // scrubber, so a tick only needs to mark "which year", and a longer
  // "Jul 2022" label collided with its "2023" neighbor at narrow widths
  // when every tick wasn't the same short length.
  return month.split("-")[0];
}

export function Replay({ dataset, person }: ReplayProps) {
  const months = useMemo(() => {
    const lists = listsForPerson(dataset, person);
    return [...lists].sort((a, b) => a.month.localeCompare(b.month));
  }, [dataset, person]);

  const monthStrings = useMemo(() => months.map((m) => m.month), [months]);
  // A lower targetMax than MonthRangeSlider's default (8) - Replay's
  // scrubber is a single full-bleed track with no range label sharing the
  // row, but tick LABELS still need breathing room between them, and with
  // every tick now showing just a 4-digit year (see formatTick) 6 fits
  // more comfortably than 8 at phone widths without crowding.
  const tickIndices = useMemo(() => sliderTickIndices(monthStrings, 6), [monthStrings]);
  const tickMax = Math.max(months.length - 1, 0);
  // Two adjacent ticks can land close enough together (in % position) that
  // their labels would collide - most commonly the true-edge tick (e.g. a
  // mid-year "Jul 2022" start) sitting right next to the first January
  // boundary a few months later, which is only a small fraction of a
  // multi-year span. Suppress a tick's LABEL (never its mark on the track -
  // every tick still gets a visible mark) when it's within MIN_GAP_PCT of
  // the last tick that kept its own label, same idea MonthRangeSlider uses
  // for its very last edge tick, generalized to any adjacent pair. A tick
  // whose label would exactly repeat the previous one (e.g. two ticks
  // landing in the same year) is suppressed outright regardless of spacing.
  const MIN_GAP_PCT = 16;
  const tickLabels = useMemo(() => {
    const labels = tickIndices.map((i) => formatTick(months[i].month));
    const { shown } = labels.reduce<{ shown: Array<string | null>; lastShownPct: number }>(
      (acc, label, idx) => {
        const pct = (tickIndices[idx] / tickMax) * 100;
        const isEdge = idx === 0 || idx === labels.length - 1;
        const isDuplicate = label === labels[idx - 1];
        const tooClose = !isEdge && pct - acc.lastShownPct < MIN_GAP_PCT;
        if (isDuplicate || tooClose) {
          acc.shown.push(null);
        } else {
          acc.shown.push(label);
          acc.lastShownPct = pct;
        }
        return acc;
      },
      { shown: [], lastShownPct: -Infinity }
    );
    return shown;
  }, [tickIndices, months, tickMax]);

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
  const max = Math.max(months.length - 1, 0);
  const progressPct = (index / max) * 100;

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

        <span className={styles.monthLabel}>{formatMonthLong(current.month)}</span>
      </div>

      <div className={styles.scrubberWrap}>
        <div className={styles.track}>
          <div className={styles.progress} style={{ width: `${progressPct}%` }} />
          {tickIndices.map((i) => (
            <span key={i} className={styles.yearMark} style={{ left: `${(i / max) * 100}%` }} />
          ))}
          <input
            type="range"
            className={styles.thumb}
            min={0}
            max={max}
            step={1}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
            aria-label="Replay position"
          />
        </div>
        <div className={styles.ticks}>
          {tickIndices.map((i, idx) =>
            tickLabels[idx] === null ? null : (
              <span key={i} className={styles.tick} style={{ left: `${(i / max) * 100}%` }}>
                {tickLabels[idx]}
              </span>
            )
          )}
        </div>
      </div>

      <ol className={styles.grid}>
        <AnimatePresence mode="popLayout">
          {current.tracks.map((track) => (
            <motion.li
              key={`${current.month}-${track.rank}`}
              className={styles.card}
              layout
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
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
                {(track.album || track.releaseDate) && (
                  <span className={styles.cardMeta} title={track.album}>
                    {track.album}
                    {track.album && formatReleaseDate(track.releaseDate) && " · "}
                    {formatReleaseDate(track.releaseDate)}
                  </span>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
