import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { artistTotals, sortedMonths, tracksForArtist } from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { useMonthRange } from "../lib/useMonthRange";
import { RangePicker } from "./RangePicker";
import styles from "./Leaderboard.module.css";

interface LeaderboardProps {
  dataset: Dataset;
  person: string;
  includeDuplicates: boolean;
}

const PAGE_SIZE = 20;

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function Leaderboard({ dataset, person, includeDuplicates }: LeaderboardProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<string | null>(null);

  const availableMonths = useMemo(() => sortedMonths(dataset, person), [dataset, person]);
  const { startIndex, endIndex, lastIndex, rangeOptions, handleSliderChange, applyPreset } =
    useMonthRange(availableMonths, `leaderboard:${person}`);

  const totals = useMemo(
    () => artistTotals(dataset, person, { includeDuplicates, ...rangeOptions }),
    [dataset, person, includeDuplicates, rangeOptions]
  );
  const colorMap = useMemo(
    () => buildArtistColorMap(totals.map((t) => t.artist)),
    [totals]
  );
  const max = totals[0]?.total ?? 1;
  const visible = totals.slice(0, limit);

  // Changing the range or duplicate-counting mode changes which artists
  // qualify at all - start back at the top rather than keep a "show more"
  // depth from a different filtered view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setLimit(PAGE_SIZE), [person, includeDuplicates, rangeOptions]);

  // If the range narrows and the expanded artist drops out of it entirely,
  // close the panel rather than show an empty "songs" list for them.
  const isExpandedStillPresent = useMemo(
    () => expanded !== null && totals.some((t) => t.artist === expanded),
    [expanded, totals]
  );
  const activeExpanded = isExpandedStillPresent ? expanded : null;

  const expandedTracks = useMemo(
    () =>
      activeExpanded
        ? tracksForArtist(dataset, activeExpanded, person, { includeDuplicates, ...rangeOptions })
        : [],
    [dataset, activeExpanded, person, includeDuplicates, rangeOptions]
  );

  function toggle(artist: string) {
    setExpanded((prev) => (prev === artist ? null : artist));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Songs per artist</h2>
        <p className={styles.sub}>
          {totals.length} artists &middot; counts include feature credits and group/member
          attribution{!includeDuplicates && " · repeat songs counted once"} &middot; click an
          artist to see their songs
        </p>
      </div>

      <RangePicker
        months={availableMonths}
        startIndex={startIndex}
        endIndex={endIndex}
        lastIndex={lastIndex}
        onSliderChange={handleSliderChange}
        onPreset={applyPreset}
      />

      <ol className={styles.list}>
        {visible.map((row, index) => {
          const pct = (row.total / max) * 100;
          const color = colorMap.get(row.artist) ?? "var(--text-muted)";
          const isOpen = activeExpanded === row.artist;
          return (
            <li key={row.artist} className={styles.item}>
              <button
                type="button"
                className={styles.row}
                onClick={() => toggle(row.artist)}
                aria-expanded={isOpen}
              >
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
                <span className={styles.chevron} data-open={isOpen} aria-hidden="true">
                  ▾
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className={styles.panelWrap}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <ul className={styles.songList}>
                      {expandedTracks.map((track, i) => (
                        <li key={`${track.month}-${track.rank}-${i}`} className={styles.songRow}>
                          <span className={styles.songMonth}>{formatMonth(track.month)}</span>
                          <span className={styles.songRank}>#{track.rank}</span>
                          <span className={styles.songTitle} title={track.title}>
                            {track.title}
                          </span>
                          <span className={styles.songArtists} title={track.creditedArtists.join(", ")}>
                            {track.creditedArtists.join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
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
