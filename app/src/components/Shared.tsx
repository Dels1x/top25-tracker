import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { sharedSongArtistTotals, sharedSongsForArtist, sharedSongs } from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import leaderboardStyles from "./Leaderboard.module.css";
import styles from "./Shared.module.css";

interface SharedProps {
  dataset: Dataset;
}

const PAGE_SIZE = 20;

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function Shared({ dataset }: SharedProps) {
  const [query, setQuery] = useState("");
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [artistLimit, setArtistLimit] = useState(PAGE_SIZE);

  const songs = useMemo(() => sharedSongs(dataset), [dataset]);

  // Leaderboard of artists by how many of the shared songs (ones that have
  // appeared in EVERY person's top 25 at some point) they're credited on -
  // see sharedSongArtistTotals in stats.ts. Counts by scoringArtists like
  // every other leaderboard in the app, so a shared Armand Hammer song
  // credits billy woods and E L U C I D individually too.
  const artistTotals = useMemo(() => sharedSongArtistTotals(dataset), [dataset]);
  const artistColorMap = useMemo(
    () => buildArtistColorMap(artistTotals.map((t) => t.artist)),
    [artistTotals]
  );
  const maxArtistTotal = artistTotals[0]?.total ?? 1;
  const visibleArtistTotals = artistTotals.slice(0, artistLimit);

  const isExpandedStillPresent = useMemo(
    () => expandedArtist !== null && artistTotals.some((t) => t.artist === expandedArtist),
    [expandedArtist, artistTotals]
  );
  const activeExpandedArtist = isExpandedStillPresent ? expandedArtist : null;

  const expandedArtistSongs = useMemo(() => {
    if (!activeExpandedArtist) return [];
    return sharedSongsForArtist(dataset, activeExpandedArtist);
  }, [dataset, activeExpandedArtist]);

  function toggleArtist(artist: string) {
    setExpandedArtist((prev) => (prev === artist ? null : artist));
  }

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

      <h3 className={styles.sectionHeading}>Artists on those songs</h3>
      <p className={styles.sectionSub}>
        {artistTotals.length} artists &middot; counts include feature credits and group/member
        attribution &middot; click an artist to see their shared songs
      </p>

      <ol className={leaderboardStyles.list}>
        {visibleArtistTotals.map((row, index) => {
          const pct = (row.total / maxArtistTotal) * 100;
          const color = artistColorMap.get(row.artist) ?? "var(--text-muted)";
          const isOpen = activeExpandedArtist === row.artist;
          return (
            <li key={row.artist} className={leaderboardStyles.item}>
              <button
                type="button"
                className={leaderboardStyles.row}
                onClick={() => toggleArtist(row.artist)}
                aria-expanded={isOpen}
              >
                <span className={leaderboardStyles.rank}>{index + 1}</span>
                <span className={leaderboardStyles.name} title={row.artist}>
                  {row.artist}
                </span>
                <div className={leaderboardStyles.barTrack}>
                  <motion.div
                    className={leaderboardStyles.bar}
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.015 }}
                  />
                </div>
                <span className={leaderboardStyles.value}>{row.total}</span>
                <span className={leaderboardStyles.chevron} data-open={isOpen} aria-hidden="true">
                  ▾
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className={leaderboardStyles.panelWrap}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <ul className={styles.artistSongList}>
                      {expandedArtistSongs.map((song) => (
                        <li key={song.trackKey} className={styles.artistSongRow}>
                          <span className={styles.artistSongTitle} title={song.title}>
                            {song.title}
                          </span>
                          <span
                            className={styles.artistSongArtists}
                            title={song.creditedArtists.join(", ")}
                          >
                            {song.creditedArtists.join(", ")}
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

      {artistLimit < artistTotals.length && (
        <button
          type="button"
          className={leaderboardStyles.more}
          onClick={() => setArtistLimit((n) => n + PAGE_SIZE)}
        >
          Show more ({artistTotals.length - artistLimit} remaining)
        </button>
      )}

      <h3 className={styles.sectionHeading}>The songs</h3>

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
