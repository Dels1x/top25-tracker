import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import {
  sharedSongArtistTotals,
  sharedSongDurationTotals,
  sharedSongEraTotals,
  sharedSongGenreTotals,
  sharedSongsForArtist,
  sharedSongsForDuration,
  sharedSongsForEra,
  sharedSongsForGenre,
  songsByPresence,
  type EraGranularity,
  type SharedSong,
  type StatsOptions,
} from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { useGenreFilter } from "../lib/useGenreFilter";
import { usePersistedState } from "../lib/usePersistedState";
import { usePresenceFilter } from "../lib/usePresenceFilter";
import { GenreFilter } from "./GenreFilter";
import { ModeSwitch } from "./ModeSwitch";
import { PresenceFilter } from "./PresenceFilter";
import leaderboardStyles from "./Leaderboard.module.css";
import styles from "./Shared.module.css";

interface SharedProps {
  dataset: Dataset;
  scoringOptions: StatsOptions;
}

type Mode = "artists" | "genres" | "years" | "decades" | "duration";

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
  const [mode, setMode] = usePersistedState<Mode>("top25tracker:sharedMode", "artists");
  const [query, setQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
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

  const isGenreMode = mode === "genres";
  const isEraMode = mode === "years" || mode === "decades";
  const isDurationMode = mode === "duration";
  const isArtistMode = mode === "artists";
  const eraGranularity: EraGranularity = mode === "decades" ? "decade" : "year";
  const noun =
    mode === "decades"
      ? "decade"
      : mode === "years"
        ? "year"
        : isDurationMode
          ? "duration"
          : isGenreMode
            ? "genre"
            : "artist";

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

  // Leaderboard of artists/genres/years/decades by how many of the
  // qualifying songs (per the active required/any/excluded buttons) they're
  // credited on/bucketed into - see sharedSongArtistTotals/
  // sharedSongGenreTotals/sharedSongEraTotals in stats.ts, mirroring the
  // per-person Leaderboard's own Artists/Genres/Years/Decades mode switch.
  // Counts by scoringArtists like every other leaderboard in the app in
  // artist mode, so a shared Armand Hammer song credits billy woods and
  // E L U C I D individually too.
  const genreOptions: StatsOptions = useMemo(
    () => ({ ...scoringOptions, genreFilter: selectedGenres }),
    [scoringOptions, selectedGenres]
  );
  const artistRows = useMemo(
    () => sharedSongArtistTotals(dataset, genreOptions, presenceMap),
    [dataset, genreOptions, presenceMap]
  );
  const genreRows = useMemo(
    () => sharedSongGenreTotals(dataset, genreOptions, presenceMap),
    [dataset, genreOptions, presenceMap]
  );
  const eraRows = useMemo(
    () => sharedSongEraTotals(dataset, eraGranularity, genreOptions, presenceMap),
    [dataset, eraGranularity, genreOptions, presenceMap]
  );
  const durationRows = useMemo(
    () => sharedSongDurationTotals(dataset, genreOptions, presenceMap),
    [dataset, genreOptions, presenceMap]
  );
  const totals: Array<{ name: string; total: number }> = isDurationMode
    ? durationRows.map((r) => ({ name: r.bucket, total: r.total }))
    : isEraMode
      ? eraRows.map((r) => ({ name: r.era, total: r.total }))
      : isGenreMode
        ? genreRows.map((r) => ({ name: r.genre, total: r.total }))
        : artistRows.map((r) => ({ name: r.artist, total: r.total }));

  // Color follows the ARTIST/GENRE/ERA, not its current rank under the
  // active genre filter - built from the unfiltered ordering (identity
  // toggles + presence filter only, no genreFilter) so toggling a genre
  // checkbox never reshuffles which color a row gets, same fix as
  // Leaderboard/Timeline/the genre views.
  const stableArtistOrder = useMemo(
    () => sharedSongArtistTotals(dataset, scoringOptions, presenceMap).map((t) => t.artist),
    [dataset, scoringOptions, presenceMap]
  );
  const stableGenreOrder = useMemo(
    () => sharedSongGenreTotals(dataset, scoringOptions, presenceMap).map((t) => t.genre),
    [dataset, scoringOptions, presenceMap]
  );
  const stableEraOrder = useMemo(
    () => sharedSongEraTotals(dataset, eraGranularity, scoringOptions, presenceMap).map((t) => t.era),
    [dataset, eraGranularity, scoringOptions, presenceMap]
  );
  const stableDurationOrder = useMemo(
    () => sharedSongDurationTotals(dataset, scoringOptions, presenceMap).map((t) => t.bucket),
    [dataset, scoringOptions, presenceMap]
  );
  const colorMap = useMemo(
    () =>
      buildArtistColorMap(
        isDurationMode
          ? stableDurationOrder
          : isEraMode
            ? stableEraOrder
            : isGenreMode
              ? stableGenreOrder
              : stableArtistOrder
      ),
    [isDurationMode, isEraMode, isGenreMode, stableDurationOrder, stableEraOrder, stableGenreOrder, stableArtistOrder]
  );
  const maxTotal = totals[0]?.total ?? 1;
  // No pagination in genre/era mode - only a handful of buckets total, same
  // as Leaderboard's own precedent.
  const visibleTotals = isArtistMode ? totals.slice(0, artistLimit) : totals;

  // Changing the mode, genre filter, presence buttons, or any identity
  // toggle changes which rows qualify at all (or reshuffles their ranking) -
  // start back at the top rather than keep a "show more" depth from a
  // different filtered view (same as Leaderboard does for its own filters).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setArtistLimit(PAGE_SIZE), [mode, selectedGenres, scoringOptions, presenceMap]);

  const isExpandedStillPresent = useMemo(
    () => expandedRow !== null && totals.some((t) => t.name === expandedRow),
    [expandedRow, totals]
  );
  const activeExpandedRow = isExpandedStillPresent ? expandedRow : null;

  const expandedSongs = useMemo(() => {
    if (!activeExpandedRow) return [];
    const result = isDurationMode
      ? sharedSongsForDuration(dataset, activeExpandedRow, genreOptions, presenceMap)
      : isEraMode
        ? sharedSongsForEra(dataset, eraGranularity, activeExpandedRow, genreOptions, presenceMap)
        : isGenreMode
          ? sharedSongsForGenre(dataset, activeExpandedRow, genreOptions, presenceMap)
          : sharedSongsForArtist(dataset, activeExpandedRow, genreOptions, presenceMap);
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
  }, [
    dataset,
    activeExpandedRow,
    isDurationMode,
    isEraMode,
    eraGranularity,
    isGenreMode,
    genreOptions,
    presenceMap,
    sortKey,
    sortDir,
  ]);

  function toggleRow(name: string) {
    setExpandedRow((prev) => (prev === name ? null : name));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setExpandedRow(null);
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

      <div className={styles.sectionHeadRow}>
        <div>
          <h3 className={styles.sectionHeading}>
            {noun.charAt(0).toUpperCase() + noun.slice(1)}s on those songs
          </h3>
          <p className={styles.sectionSub}>
            {isArtistMode
              ? `${totals.length} artists · counts include feature credits and group/member attribution`
              : `${totals.length} ${noun}s`} &middot; click a {noun} to see its shared songs
            {isEraMode &&
              eraRows.some((r) => r.era === "Unknown") &&
              " · \"Unknown\" is songs with no catalogued release date"}
            {isDurationMode &&
              durationRows.some((r) => r.bucket === "Unknown") &&
              " · \"Unknown\" is songs with no catalogued duration"}
          </p>
        </div>
        <ModeSwitch
          value={mode}
          options={[
            { value: "artists", label: "Artists" },
            { value: "genres", label: "Genres" },
            { value: "years", label: "Years" },
            { value: "decades", label: "Decades" },
            { value: "duration", label: "Duration" },
          ]}
          onChange={switchMode}
          aria-label="Rank by"
        />
      </div>

      <GenreFilter
        selected={selectedGenres}
        onToggle={toggleGenre}
        onSelectAll={selectAllGenres}
        onSelectNone={selectNoneGenres}
      />

      <ol className={leaderboardStyles.list}>
        {visibleTotals.map((row, index) => {
          const pct = (row.total / maxTotal) * 100;
          const color = colorMap.get(row.name) ?? "var(--text-muted)";
          const isOpen = activeExpandedRow === row.name;
          return (
            <li key={row.name} className={leaderboardStyles.item}>
              <button
                type="button"
                className={leaderboardStyles.row}
                onClick={() => toggleRow(row.name)}
                aria-expanded={isOpen}
              >
                <span className={leaderboardStyles.rank}>{index + 1}</span>
                <span className={leaderboardStyles.name} title={row.name}>
                  {row.name}
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
                      {expandedSongs.map((song) => (
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

      {isArtistMode && artistLimit < totals.length && (
        <button
          type="button"
          className={leaderboardStyles.more}
          onClick={() => setArtistLimit((n) => n + PAGE_SIZE)}
        >
          Show more ({totals.length - artistLimit} remaining)
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
