import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import {
  sharedSongArtistTotals,
  sharedSongsForArtist,
  songsByPresence,
  type SharedSong,
  type StatsOptions,
} from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { useGenreFilter } from "../lib/useGenreFilter";
import { usePresenceFilter } from "../lib/usePresenceFilter";
import { GenreFilter } from "./GenreFilter";
import { PresenceFilter } from "./PresenceFilter";
import leaderboardStyles from "./Leaderboard.module.css";
import styles from "./Shared.module.css";

interface SharedProps {
  dataset: Dataset;
  scoringOptions: StatsOptions;
}

const PAGE_SIZE = 20;
const SONG_PAGE_SIZE = 100;

type SongSortKey = "date" | "title" | "album";
type SortDirection = "asc" | "desc";

const SONG_SORT_COLUMNS: Array<{ key: SongSortKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "title", label: "Song" },
  { key: "album", label: "Album" },
];

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Earliest appearance across all people/months for a shared song - the "date" sort key, since a shared song has no single rank/month like a per-person track does. */
function earliestAppearance(song: SharedSong): string {
  return song.appearances.reduce(
    (min, a) => (a.month < min ? a.month : min),
    song.appearances[0]?.month ?? ""
  );
}

export function Shared({ dataset, scoringOptions }: SharedProps) {
  const [query, setQuery] = useState("");
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [artistLimit, setArtistLimit] = useState(PAGE_SIZE);
  const [songLimit, setSongLimit] = useState(SONG_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SongSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const {
    selected: selectedGenres,
    toggleNode: toggleGenre,
    selectAll: selectAllGenres,
    selectNone: selectNoneGenres,
  } = useGenreFilter("shared");
  const { requirementFor, cycle: cyclePresence, presenceMap } = usePresenceFilter(dataset.people);

  // Which songs qualify changes with the per-person required/any/excluded
  // buttons (songsByPresence), but never with the identity toggles (that's
  // keyed by raw trackKey) - those only change WHO gets credited on a
  // qualifying song, resolved the same way allTracks does, honoring
  // uniteRelatedProjects/showProducers/showDuos from the shared options row.
  const songs = useMemo(
    () => songsByPresence(dataset, presenceMap, scoringOptions),
    [dataset, presenceMap, scoringOptions]
  );
  const allRequired = useMemo(
    () => dataset.people.every((p) => requirementFor(p) === "required"),
    [dataset.people, requirementFor]
  );
  const allAny = useMemo(
    () => dataset.people.every((p) => requirementFor(p) === "any"),
    [dataset.people, requirementFor]
  );

  // Leaderboard of artists by how many of the qualifying songs (per the
  // active required/any/excluded buttons) they're credited on - see
  // sharedSongArtistTotals in stats.ts. Counts by scoringArtists like every
  // other leaderboard in the app, so a shared Armand Hammer song credits
  // billy woods and E L U C I D individually too.
  const artistTotals = useMemo(
    () =>
      sharedSongArtistTotals(
        dataset,
        { ...scoringOptions, genreFilter: selectedGenres },
        presenceMap
      ),
    [dataset, scoringOptions, selectedGenres, presenceMap]
  );
  // Color follows the ARTIST, not their current rank under the active genre
  // filter - built from the unfiltered ordering (identity toggles + presence
  // filter only, no genreFilter) so toggling a genre checkbox never
  // reshuffles which color an artist gets, same fix as Leaderboard/Timeline/
  // the genre views.
  const stableArtistOrder = useMemo(
    () => sharedSongArtistTotals(dataset, scoringOptions, presenceMap).map((t) => t.artist),
    [dataset, scoringOptions, presenceMap]
  );
  const artistColorMap = useMemo(
    () => buildArtistColorMap(stableArtistOrder),
    [stableArtistOrder]
  );
  const maxArtistTotal = artistTotals[0]?.total ?? 1;
  const visibleArtistTotals = artistTotals.slice(0, artistLimit);

  // Changing the genre filter, the presence buttons, or any identity toggle
  // changes which artists qualify at all (or reshuffles their ranking) -
  // start back at the top rather than keep a "show more" depth from a
  // different filtered view (same as Leaderboard does for its own filters).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setArtistLimit(PAGE_SIZE), [selectedGenres, scoringOptions, presenceMap]);

  const isExpandedStillPresent = useMemo(
    () => expandedArtist !== null && artistTotals.some((t) => t.artist === expandedArtist),
    [expandedArtist, artistTotals]
  );
  const activeExpandedArtist = isExpandedStillPresent ? expandedArtist : null;

  const expandedArtistSongs = useMemo(() => {
    if (!activeExpandedArtist) return [];
    const result = sharedSongsForArtist(dataset, activeExpandedArtist, scoringOptions, presenceMap);
    return [...result].sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case "date":
          cmp = earliestAppearance(a).localeCompare(earliestAppearance(b));
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "album":
          cmp = a.album.localeCompare(b.album);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [dataset, activeExpandedArtist, sortKey, sortDir, scoringOptions, presenceMap]);

  function toggleArtist(artist: string) {
    setExpandedArtist((prev) => (prev === artist ? null : artist));
  }

  function handleSort(key: SongSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Date reads most naturally starting from newest; title/album read
      // most naturally starting A-first - same convention Leaderboard uses.
      setSortDir(key === "date" ? "desc" : "asc");
    }
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

  // The full song list can run into the hundreds (e.g. every song anyone's
  // ever picked, with all presence buttons on "any") and rendering every row
  // at once - each with its own framer-motion mount animation - is what was
  // causing the lag. Page it the same way the artist leaderboard above
  // already pages, just with a bigger page size since these rows are
  // smaller/simpler than the artist rows. Resets to the first page whenever
  // the underlying filtered set changes (search query or presence/identity
  // filters), same reasoning as the artistLimit reset above - an old "show
  // more" depth from a different filtered set isn't meaningful here either.
  useEffect(() => setSongLimit(SONG_PAGE_SIZE), [filtered]);
  const visibleSongs = filtered.slice(0, songLimit);

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>
          {allAny ? "Songs from everyone's top 25" : "Songs on everyone's top 25"}
        </h2>
        <p className={styles.sub}>
          {allRequired
            ? `${songs.length} songs have appeared in every one of ${dataset.people.length} people's top 25 at some point (not necessarily the same month)`
            : allAny
              ? `${songs.length} songs have appeared in anyone's top 25 at some point`
              : `${songs.length} songs match the filter below`}
        </p>
      </div>

      <PresenceFilter
        people={dataset.people}
        requirementFor={requirementFor}
        onCycle={cyclePresence}
      />

      <h3 className={styles.sectionHeading}>Artists on those songs</h3>
      <p className={styles.sectionSub}>
        {artistTotals.length} artists &middot; counts include feature credits and group/member
        attribution &middot; click an artist to see their shared songs
      </p>

      <GenreFilter
        selected={selectedGenres}
        onToggle={toggleGenre}
        onSelectAll={selectAllGenres}
        onSelectNone={selectNoneGenres}
      />

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
                    <div className={styles.artistSongHeaderRow}>
                      {SONG_SORT_COLUMNS.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          className={
                            col.key === "album"
                              ? `${styles.artistSongHeaderButton} ${styles.hideOnMobile}`
                              : styles.artistSongHeaderButton
                          }
                          onClick={() => handleSort(col.key)}
                          data-active={sortKey === col.key}
                        >
                          {col.label}
                          {sortKey === col.key && (
                            <span className={styles.sortArrow} aria-hidden="true">
                              {sortDir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </button>
                      ))}
                      <span className={styles.artistSongHeaderStatic}>Artist(s)</span>
                    </div>
                    <ul className={styles.artistSongList}>
                      {expandedArtistSongs.map((song) => (
                        <li key={song.trackKey} className={styles.artistSongRow}>
                          <span className={styles.artistSongDate}>
                            {formatMonth(earliestAppearance(song))}
                          </span>
                          <span className={styles.artistSongTitle} title={song.title}>
                            {song.title}
                          </span>
                          <span
                            className={`${styles.artistSongAlbum} ${styles.hideOnMobile}`}
                            title={song.album}
                          >
                            {song.album}
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
          {visibleSongs.map((song, index) => (
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

      {songLimit < filtered.length && (
        <button
          type="button"
          className={leaderboardStyles.more}
          onClick={() => setSongLimit((n) => n + SONG_PAGE_SIZE)}
        >
          Show more ({filtered.length - songLimit} remaining)
        </button>
      )}
    </div>
  );
}
