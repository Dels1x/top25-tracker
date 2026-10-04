# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project concept

A fun stats/visualization site for a recurring game played by the user and two friends: each month,
each person picks their top 25 favorite songs of that month, ranked 1 (best) to 25 (least, but still a
favorite). The site will turn the accumulated monthly lists into stats and charts — e.g. songs per
artist, a timeline of tracks added per artist per month (with per-artist show/hide toggles), and
possibly a "replay" animation of tracks being added over time.

## Commands

All commands run from `app/`:

- `npm run dev` — start the Vite dev server (auto-runs `build:data` first via the `predev` hook).
- `npm run build` — type-check + production build (auto-runs `build:data` first via `prebuild`).
- `npm run build:data` — regenerate `src/data/data.json` from the CSVs under `top25/csv/`. Run this
  manually any time you edit/add a CSV and want fresh data without a full dev-server restart.
- `npm run lint` — oxlint.
- `npm run preview` — serve the production build locally.

There is no test runner configured yet.

## Architecture

- **`app/scripts/buildData.ts`** — the entire data pipeline. Reads every `top25/csv/<person>/*.csv`,
  parses the Spotify/Exportify schema with Papa Parse, splits `Artist Name(s)` on `;`, applies group
  attribution, and writes the normalized result to `app/src/data/data.json`. This file is
  **gitignored and regenerated on every dev/build** (see `predev`/`prebuild` in `package.json`) — the
  CSVs are the single source of truth, never hand-edit `data.json`.
- **`app/scripts/artistAttribution.ts`** — the hand-maintained `SPOTIFY_MISSPELLINGS`,
  `ARTIST_ALIASES`, and `GROUP_MEMBERS` lookup tables, all applied at BUILD TIME (baked into
  `scoringArtists` in data.json) because they're certainties, not judgment calls. Add new cases here
  as they show up in someone's top 25. Resolution order matters: misspellings correct first, then
  aliases, then group expansion — so a group whose listed members are themselves aliased or
  misspelled still collapses to the right canonical person. See the scoring rules below for what each
  table is for and the current entries.
- **`app/src/lib/relatedProjects.ts`** — a separate, OPT-IN `RELATED_PROJECTS` table applied at
  RUNTIME (not baked into data.json) behind the "unite similar artists/groups" checkbox, for merges
  that are a reasonable judgment call rather than a certainty - see the scoring rules below.
- **`app/src/lib/knownProducers.ts`** — the `KNOWN_PRODUCERS` set behind the "show producers" checkbox
  (opt-in, default OFF), also applied at runtime - see the scoring rules below for why this can't be
  derived from the CSV and has to be a hand-maintained allowlist.
- **`app/src/data/types.ts`** — shared shape (`Dataset` / `MonthlyList` / `Track`) for the JSON produced
  by the build script and consumed by the frontend. Each `Track` carries both `creditedArtists` (as
  literally written in the CSV) and `scoringArtists` (after group expansion) — stats/charts should
  always aggregate on `scoringArtists`. `Dataset.groupNames` carries the `GROUP_MEMBERS` keys through
  to the frontend (see the "show duos" toggle below) — it's how the frontend learns which names are
  groups without duplicating that build-time table in `src/lib/`.
- **`app/src/lib/stats.ts`** — pure aggregation functions (artist totals, per-month counts, cumulative
  time series) over a `Dataset`. UI components call these rather than recomputing aggregates inline.
  `StatsOptions.startMonth`/`endMonth` ("YYYY-MM", inclusive) restrict to a date range *before* dedup
  and before any totals/series are computed — so Timeline's range picker makes cumulative counts
  **restart from zero at the range start**, not just crop the x-axis of an otherwise all-time running
  total. Keep it that way; it's what "songs since January 2025" is supposed to mean here.
  `sharedSongs` is the one function here that isn't scoped to a single person - it looks across ALL
  of `dataset.lists` and finds songs that have appeared (at any rank, in any month) in literally every
  person's top 25, matched via the same `trackKey` used for duplicate detection (so re-release title
  variants still count as the same song across people, not just within one person's history). Each
  `SharedSong` carries the track's `album` and `scoringArtists` alongside `creditedArtists`/`title` -
  not shown directly in the Shared song list UI (which still displays `creditedArtists`, the literal
  credit, like every other song list in the app) but used by `sharedSongArtistTotals`/
  `sharedSongsForArtist` to power the artist leaderboard at the top of the Shared tab: which artists
  show up on the most of the shared songs, counted by `scoringArtists` (so a shared Armand Hammer
  song credits billy woods and E L U C I D individually too, same as the regular per-person
  Leaderboard) and once per artist per song, not multiplied by how many people's lists it appeared in
  (a shared song is one song, already guaranteed to be in everyone's list by definition).
  `sharedSongArtistTotals` also takes `StatsOptions.genreFilter` and applies it the same per-artist way
  `allTracks` does (drop a scoringArtist from a shared song if none of THEIR OWN genres are selected,
  not the whole song) - so it inherits the same "an artist with any selected subgenre still shows even
  if its plain parent genre is unchecked" behavior the regular Leaderboard already has; this is
  expected, not a bug, and was verified to match Leaderboard's own behavior under the same filter
  before relying on it.
  `sharedSongs` also resolves each `SharedSong`'s `scoringArtists` the same way `allTracks` does -
  honoring `uniteRelatedProjects`/`showProducers`/`showDuos` from `StatsOptions` - so the Shared tab's
  "Unite similar artists/groups"/"Show producers"/"Show duos" checkboxes (same `scoringOptions` object
  `App.tsx` builds for every other view) change who gets credit on a shared song exactly like they
  change the regular per-person Leaderboard: toggling "Show duos" on adds a group's own name (e.g.
  "Armand Hammer") back onto a shared song's `scoringArtists` alongside its already-expanded members,
  and toggling "Show producers" on stops silently dropping a `KNOWN_PRODUCERS` name from the same
  song. This only affects WHO gets counted, never WHICH songs qualify as "shared" - that membership
  test is still keyed by the raw `trackKey` (title + literal credited artists) and was verified
  unchanged (identical song count and `trackKey` set) across every toggle combination before relying
  on it. `includeDuplicates` has no effect here either way - each shared song already appears exactly
  once in the output regardless of how many months/people it shows up across, so there's nothing for
  that toggle to dedupe.
  `cumulativeArtistSeriesByPerson`/`personArtistSummaries` power the Compare view's "artists" mode
  (see below) - like `sharedSongs`, these aren't scoped to one person; they take an explicit `people`
  list and a selected artist *set* (e.g. a group's members) and sum counts across that whole set per
  person, per month - one cumulative line per PERSON, not per artist, since the point of Compare is
  "who got into this artist earlier / more", not re-showing Timeline's per-artist breakdown one person
  at a time. `cumulativeGenreSeriesByPerson`/`personGenreSummaries` are the exact same shape for
  Compare's "genres" mode, built on `genreBucketsForTrack` instead of a scoringArtists match - a track
  counts once per selected genre bucket it falls in (same "counts toward everything it touches" rule
  `genreTotals` already uses), so selecting both a subgenre and its auto-rolled-up parent (e.g.
  "Hip-Hop" + "Jazz Rap") double-counts a track that's in both buckets, same as summing two overlapping
  `genreTotals` rows by hand would - this is expected, not a bug to dedupe.
  `genreTotals`/`genreMonthCounts`/`tracksForGenre`/`cumulativeGenreSeries` mirror the artist-scoped
  functions but bucket by genre instead (see `artistGenres.ts`) - they only honor
  `includeDuplicates`/`startMonth`/`endMonth` from `StatsOptions`; the artist-identity options
  (`uniteRelatedProjects`/`showProducers`/`showDuos`) don't apply to genres and the genre UI components
  don't pass them through. Genre classification runs on each track's (already attribution-resolved)
  `scoringArtists`, not on raw `creditedArtists` - so a bare group credit still classifies correctly via
  the group's own `ARTIST_GENRES` entry even before member-expansion is considered.
- **`app/src/lib/artistGenres.ts`** — classifies genre by ARTIST, not by Spotify's per-track genre
  tags (an earlier version, `genreParents.ts`, did the latter and was replaced - see below for why).
  `ARTIST_GENRES` is a hand-maintained `artist name -> Genre[]` map (keyed by canonical
  `scoringArtists` spelling), built by going through the real artist list ordered by song count (most
  first) and classifying everyone confidently recognized; an artist not in the map contributes nothing
  and a track with no recognized artist falls back to `UNTAGGED_GENRE`, rather than guessing. An artist
  can genuinely have more than one genre (Phil Elverum -> Folk AND Rock across his two projects;
  Deftones -> Metal AND Shoegaze) - not a mistake to "clean up". `GENRES` includes both major genres
  and subgenres (regional/style hip-hop - East Coast, West Coast, Southern, Abstract, Experimental,
  Jazz Rap, Conscious, Gangsta Rap, Coke Rap, Chipmunk Soul; rock/other - Art Rock, Alternative Rock,
  Grunge, Emo, Neo-Psychedelia; pop/electronic - Noise Pop, Dream Pop, Glitch Pop, Indietronica;
  Shoegaze, Slowcore, Post-Rock, Trip Hop, Ambient) - and, as of the "Punk" addition, a subgenre can
  itself have its own subgenres (Rock > Punk > {Pop Punk, Post-Punk}) rather than every subgenre
  necessarily sitting one level below a major genre; see `GENRE_HIERARCHY`'s own doc comment and the
  `GenreFilter`/`useGenreFilter` entry below for how this nests arbitrarily deep, not just two levels.
  **The "Jazz" major genre is reserved for actual jazz musicians only** (Robert Glasper, Miles Davis,
  Thundercat, etc.) - a hip-hop artist whose sound samples/evokes jazz (Madlib, Nujabes, A Tribe
  Called Quest, Logic, Blu & Exile, McKinley Dixon, Saba, ...) gets the "Jazz Rap" SUBGENRE instead,
  which rolls up to "Hip-Hop" only, never to "Jazz" - don't blur this line, it was deliberately drawn
  this way so the Jazz bucket stays reliable (same reasoning as dropping Spotify's noisy "jazz rap"
  tag earlier). Similarly, "Abstract Hip-Hop" and "Experimental Hip-Hop" are related but distinct -
  an artist can have one, the other, or both (Danny Brown has both; JPEGMAFIA and redveil are
  Experimental only, not Abstract; Saba/Isaiah Rashad/Vince Staples are Jazz Rap, not Abstract) - check
  with the user before assuming which one(s) apply to a given artist, the line between them is a
  judgment call they've been actively refining.
  **`PARENT_GENRE` auto-expands every subgenre to its parent major genre(s) inside `genresForArtists`**
  (e.g. "Abstract Hip-Hop" -> also "Hip-Hop"; "Dream Pop" -> also "Pop"; "Shoegaze"/"Post-Rock"/"Art
  Rock"/etc. -> also "Rock") - this means an `ARTIST_GENRES` entry should list ONLY the most specific
  genre(s) that apply and must NEVER also list the parent by hand (billy woods is
  `["Abstract Hip-Hop", "East Coast Hip-Hop"]`, not `[..., "Hip-Hop"]` too - "Hip-Hop" is added
  automatically). If you add a new subgenre to `GENRES`, add its parent(s) to `PARENT_GENRE` in the
  same change, or it'll silently fail to roll up. Maintenance: add new artists highest-song-count-first
  (check actual counts via `scoringArtists` frequency in `data.json`, don't guess the ordering); if an
  artist isn't confidently recognized, leave them unmapped and ask, rather than guess.
  **A genre CAN legitimately have more than one parent in `PARENT_GENRE`** (e.g. "Indietronica" ->
  `["Electronic", "Pop"]`; "Shoegaze" -> `["Alternative Rock", "Indie Rock"]`) and `genresForArtists`
  correctly credits ALL of them transitively - that part was never the issue. What's different is
  `GENRE_HIERARCHY` (the tree the Leaderboard's genre filter UI renders): it files a multi-parent
  genre under its FIRST-listed parent ONLY, not every parent, so it shows up as exactly one checkbox
  in the filter, not two independent ones. An earlier version nested it under every parent, which put
  the SAME genre on screen twice with no indication they were the same thing - checking one didn't
  check the other, which read as broken rather than merely redundant once someone actually looked for
  it. The parent ORDER in a multi-parent `PARENT_GENRE` entry is therefore a real editorial choice
  (list the more natural/primary parent first), not an arbitrary tiebreak - it decides which branch
  the genre is filed under in the UI, while scoring stays unaffected by that ordering either way.
  **Why artist-based instead of Spotify's own genre tags**: Spotify's per-track tags turned out
  unreliable for this dataset specifically - "jazz rap", "plunderphonics", and "experimental" were
  applied as loose vibe-descriptors for ~any sample-heavy/abstract hip-hop (Freddie Gibbs, The
  Alchemist, Westside Gunn, even a straight drill cypher), not because those tracks have real
  jazz/electronic content (checked directly: 849/116/225 tagged tracks, 97%/87% also tagged hip-hop/rap
  for experimental/plunderphonics). An artist's genre doesn't flicker the way a crowd-sourced per-track
  tag does, and it's something a person who actually knows the artist/scene can just state directly -
  more stable and more accurate for this dataset, at the cost of needing manual upkeep as new artists
  show up (same tradeoff as the other hand-maintained tables in this project). The raw Spotify
  `genres` field is still parsed and stored on `Track.genres` untouched (unused by the Genres
  tabs now, but kept in the data in case it's useful later).
- **`app/src/lib/colors.ts`** — assigns each artist a fixed categorical color slot by stable rank order
  (see the dataviz skill's "color follows the entity, never its rank" rule) — a toggled-off artist must
  never cause the remaining artists to repaint. `buildArtistColorMap(orderedArtists)` itself just
  zips a name list against color slots in order - it has no opinion on what that list's ordering
  actually IS, so every caller is responsible for passing a STABLE ordering, not whatever's currently
  visible/filtered. This was a real bug until it was fixed: `Leaderboard`/`Timeline`/
  `GenreLeaderboard`/`GenreTimeline`/`Shared` used to build their color map straight from their own
  range/genre/rank/weight-filtered `totals` - so changing the date range, toggling a genre checkbox,
  or turning on "weight by placement" (see `useWeightByRank` below) could reorder that list and
  silently reassign colors out from under artists that never moved, breaking the "can tell an artist
  apart by color" property the whole point of color-coding by entity is for. Fixed by giving each of
  those 5 components a separate `stableOrder` memo - the same kind of all-time totals call
  (`artistTotals`/`genreTotals`/`sharedSongArtistTotals`) but with ONLY the identity-affecting options
  (`scoringOptions`, i.e. unite/producers/duos/includeDuplicates - never `rangeOptions`/`genreFilter`/
  `maxRank`/`weightByRank`) - and feeding `buildArtistColorMap` that instead of the view's own
  (possibly narrower, possibly differently-ordered) `totals`. An all-time, identity-toggles-only list
  is always a superset of any filtered view's artists/genres, so `colorMap.get()` never misses - a
  filter can only ever narrow or reorder who's VISIBLE, never introduce someone who isn't in the
  stable universe to begin with. `Compare` was already fine (keys its map on `dataset.people`
  directly, which is small and static) and didn't need this fix.
- **`app/src/components/`** — `Leaderboard` (songs-per-artist OR songs-per-genre bar list, toggled via
  an Artists/Genres `ModeSwitch` at the top — same visual language Compare's own mode switch
  established — with a `GenreFilter` panel and a `RankFilter` Top 1/3/5/10/25 control in artists mode
  only — both below, see their own entries — and, above the heading, the `StatsRow` tiles: Months
  tracked / Unique artists / Unique songs / Top artist, also artists-mode-only).
  **`Leaderboard` and `Timeline` used to each have a separate genre-scoped twin**
  (`GenreLeaderboard`/`GenreTimeline`, two more standalone tabs) that were nearly identical in shape
  to their artist counterpart - same list/chart layout, same CSS modules, differing only in which
  `stats.ts` functions backed them (`artistTotals`/`tracksForArtist`/`cumulativeArtistSeries` vs
  `genreTotals`/`tracksForGenre`/`cumulativeGenreSeries`) and in which artist-only controls applied.
  Both pairs were merged into one component each, mirroring how `Compare` already merges its own
  artists/genres split into one view instead of two tabs - `GenreLeaderboard.tsx`/`GenreTimeline.tsx`
  are deleted, and the view list shrank from 7 tabs to 5 (`Leaderboard`/`Timeline`/`Replay`/`Shared`/
  `Compare`). In `Leaderboard`'s genre mode: `RankFilter`, "weight by placement", the `GenreFilter`
  panel (filtering genre ROWS by genre makes no sense), pagination (only ~19 genre/subgenre buckets
  total, see `artistGenres.ts`, vs potentially hundreds of artists), and `StatsRow` (no genre
  equivalent for "Top artist") all hide - exactly matching what the old standalone
  `GenreLeaderboard` showed, nothing more or less. In `Timeline`'s genre mode, every genre is shown
  by default rather than a top-N subset (same as the old `GenreTimeline` default), with its own
  separate persisted "shown" set (`genreTimelineShown:${person}`, untouched from before) so toggling
  visible lines in one mode never bleeds into the other. **The 3 artist-identity toggles
  (unite/producers/duos) are NOT hidden in genre mode** in either component - this follows `Compare`'s
  own precedent (see below) of leaving them visible as harmless no-ops rather than something the
  component needs to hide per-mode; `App.tsx`'s old `GENRE_VIEWS` list (which hid them for the two
  standalone genre tabs) is gone entirely along with those tabs. Both components build TWO
  `stableOrder` color bases now (one for artists, one for genres - see the `colors.ts` entry above)
  and pick whichever matches the active mode, so switching modes never reshuffles colors any more
  than switching filters within one mode does. `Timeline` (cumulative line chart with per-artist/
  per-genre toggle legend depending on mode), `Replay` (month-by-month animated reveal), `Shared`
  (songs that have appeared in every person's top 25 at some point — see `sharedSongs` in `stats.ts`;
  unlike every other view this one is NOT scoped to the active person, and (like every view besides
  Leaderboard) has no `StatsRow` either — but it DOES still receive `scoringOptions` and show the
  `includeDuplicates`/`uniteRelatedProjects`/`showProducers`/`showDuos` checkboxes (`Shared` is not in
  `NO_TOGGLES_VIEWS`, only `Replay` is, since Replay always shows literal `creditedArtists` and never
  looks at `scoringArtists` at all) — the three identity checkboxes change who gets credit on a shared
  song exactly like they change the regular per-person Leaderboard (see the `sharedSongs` note above);
  `includeDuplicates` is accepted but inert here since a shared song already appears once regardless.
  Opens with an artist leaderboard — `sharedSongArtistTotals`/
  `sharedSongsForArtist` in `stats.ts` — ranking who shows up on the most shared songs, reusing
  `Leaderboard.module.css`'s bar-list row/rank/chevron styling, including the same `PAGE_SIZE = 20` /
  "Show more" button pattern, the same `GenreFilter` panel
  (its own `useGenreFilter("shared")` persistence key, separate from Leaderboard's per-person ones),
  and the same click-a-row-to-expand sortable song list (Date/Song/Album column headers, toggle
  sort direction on repeat click) - all mirroring Leaderboard's UX as closely as the shared-songs
  shape allows. Two differences forced by that shape: there's no Rank column (a shared song has no
  single rank - it was ranked differently by each person who had it), and "Date" sorts by each
  song's EARLIEST appearance across anyone's list (`earliestAppearance` in `Shared.tsx`) rather than
  a single rank/month a per-person track has. Shared's drill-down also needed its own 4-column
  `artistSongHeaderRow`/`artistSongRow` grid in `Shared.module.css` instead of reusing
  `Leaderboard`'s 5-column `.songRow` (which has a rank column Shared doesn't need). The existing
  song-list section stays unchanged below it, now under its own "The songs" subheading), `Compare`
  (pick one or more artists OR genres — toggled via the same `ModeSwitch` component Leaderboard/
  Timeline now also use — e.g. a group's members, or a genre like "Hip-Hop" —
  and see each person's cumulative count for that selection on one chart, one line per PERSON rather
  than per artist/genre, to answer "who got into this earlier / more"; also spans every person at
  once like `Shared` does, so no `StatsRow` either; in "artists" mode the artist-identity toggles
  (unite/producers/duos) still apply since you're picking artist names, so `App.tsx` doesn't hide
  them for Compare either - those toggles simply have no effect once the component switches into
  "genres" mode internally, same as `includeDuplicates` being the only option genre-scoped stats
  functions ever look at, and the same precedent Leaderboard/Timeline's own genre mode now follows;
  the
  picker is a search box + checkbox list sorted by combined all-people total [of whichever mode is
  active], with each mode's selection persisted separately (`compareArtists` / `compareGenres`
  localStorage keys) via `usePersistedSetState` and shown as removable chips; reuses the same
  `useMonthRange`/`RangePicker` date-range control as Leaderboard and Timeline, and the same
  per-person color assignment `Timeline` uses for *artists* but keyed on *people* instead, via
  `buildArtistColorMap(dataset.people)` — a general-purpose "assign a stable color per name" function
  despite its artist-specific name), plus `Layout` / `StatsRow` / `StatTile` / `ModeSwitch` shell
  pieces. `App.tsx` just wires person/view selection state and imports `data.json` directly (no
  runtime CSV parsing, no backend/API).
- **`app/src/components/ModeSwitch.tsx`** — the pill-shaped "Artists / Genres" (or similar) mode
  switch, originally built standalone inside `Compare.tsx` and extracted into its own small generic
  component (`<T extends string>`, a `value`/`options`/`onChange` triplet plus an `aria-label`) once
  `Leaderboard` and `Timeline` needed the exact same control - a true `role="tablist"` radio-like
  toggle, not checkboxes. All three callers (`Compare`, `Leaderboard`, `Timeline`) now share one
  implementation/one CSS module instead of three copies that could silently drift apart.
- **`app/src/components/GenreFilter.tsx`** + **`app/src/lib/useGenreFilter.ts`** — the Leaderboard's
  genre-filter checkboxes: one row per top-level genre from `GENRE_HIERARCHY`
  (`artistGenres.ts`), each with a disclosure arrow (only if it has subgenres) expanding a list of
  child rows underneath. **The nesting isn't fixed at two levels** - `GENRE_HIERARCHY` is a genuine
  tree (`GenreNode = { genre, subgenres: GenreNode[] }`) built from `PARENT_GENRE`, as deep as that
  map implies, and `GenreFilter.tsx` renders it via a single recursive `GenreNodeRow` component rather
  than a hardcoded two-level loop - a 3rd (or deeper) level just works with no component changes.
  "Punk" was the first real 3-level example: Rock > Punk > {Pop Punk, Post-Punk} (Pop Punk/Post-Punk
  used to parent directly to Rock; reparented under the new "Punk" node). Two more followed after a
  deliberate pass looking for other genuinely clean cases (not every candidate qualifies - see the
  rejected ones noted below): Hip-Hop > Gangsta Rap > Coke Rap (Coke Rap - Rick Ross, Clipse,
  Westside Gunn, Pusha T... - is a well-established NARRATIVE SUBTYPE specifically of Gangsta Rap,
  not a sibling genre of it) and Rock > Alternative Rock > Grunge (Grunge is historically classified
  as Alternative Rock's early-90s Seattle-scene subtype, not a sibling sitting directly under Rock).
  Both reparentings required cleaning up `ARTIST_GENRES` entries that previously listed the subgenre
  AND its now-indirect ancestor by hand (e.g. Clipse was `["East Coast Hip-Hop", "Coke Rap",
  "Gangsta Rap"]`, now just `["East Coast Hip-Hop", "Coke Rap"]` - the "Gangsta Rap" was redundant
  once "Coke Rap" implies it transitively) - verified every affected artist's FULL resolved genre set
  (via `genresForArtists`) is unchanged before/after for every multi-tag artist, and that an artist
  tagged with ONLY the deepest subgenre (Rick Ross was `["Southern Hip-Hop", "Coke Rap"]` with no
  explicit "Gangsta Rap") now correctly also resolves to "Gangsta Rap" through the new ancestor link -
  a small accuracy improvement that existed only because the reparenting was done, not a side effect
  to work around. Other candidates considered and explicitly REJECTED as too soft/speculative to
  justify restructuring: nesting Cloud Rap under Trap (genuinely its own lane, not clearly a subtype);
  nesting Dream Pop/Noise Pop/Shoegaze relative to each other (commonly discussed together but not in
  a clean parent/child way - they're cross-genre siblings, not nestable); nesting Darkwave under
  Gothic Rock (debatable - Darkwave reads closer to Post-Punk/synth-adjacent than Gothic Rock
  specifically); nesting Sampledelia under Plunderphonics (a real stylistic link but much softer than
  Coke Rap/Grunge, left as flat siblings for now). Checking/unchecking ANY
  node (`useGenreFilter`'s single `toggleNode`, replacing the old separate `toggleTopLevel`/
  `toggleSubgenre` pair now that there's no longer a meaningful distinction between "top-level" and
  "nested" toggle behavior) cascades to its ENTIRE descendant subtree, however deep - checking "Rock"
  cascades through "Punk" down to "Pop Punk"/"Post-Punk" too; checking "Punk" on its own only cascades
  to its own two children, leaving "Rock" and Rock's other subgenres untouched. A node can still be
  toggled independently of its ancestors/siblings once they're checked - unchecking just "Pop Punk"
  doesn't touch "Punk" or "Rock". Multiple genres selected = union (OR) - showing Hip-Hop + Rock shows
  anyone in either, not just crossover artists. Defaults to everything selected (matches the
  unfiltered leaderboard) - persisted per person via `usePersistedSetState`.
  `StatsOptions.genreFilter` (a `Set<string>`, consumed in `allTracks`) is `undefined` for "no filter"
  and an explicit empty `Set` for "nothing selected, show nobody" - these are deliberately different,
  don't conflate them. `GENRE_HIERARCHY` also carries a synthetic `UNTAGGED_GENRE` ("Unknown/Untagged")
  entry with no subgenres, so untagged artists get their own checkbox too, rather than always being
  shown/hidden unconditionally - when computing "select all", include `UNTAGGED_GENRE` alongside every
  real `GENRES` entry, or an "all checked" selection will silently exclude unclassified artists (this
  was a real bug caught during review - verify count parity with the truly-unfiltered case after any
  change here). `selectAll` only needs to list TOP-LEVEL genres (never subgenres, however deep) to be
  a correct "everyone shown" filter - every artist's resolved genre set from `genresForArtists` always
  includes at least one top-level genre (every ancestor chain terminates there, no matter how many
  subgenre hops it took to get there), so `filter.has(...)` always finds a match for a tagged artist
  as long as the top-level entries are all present; this held before the 3-level change and still
  holds after it, verified directly.
  **`genresForArtists` (`artistGenres.ts`) walks the FULL transitive ancestor chain**, not just one
  hop up - via a small recursive `addAncestors` helper - so an `ARTIST_GENRES` entry only ever needs
  to list the MOST SPECIFIC genre(s) that apply, same convention as before, but now correctly
  propagating through however many levels exist: an artist tagged just `["Pop Punk"]` automatically
  also counts toward "Punk" AND "Rock", not just "Punk" (a one-hop-only walk, which is what this
  function used to do before the 3-level change, would have silently stopped at "Punk" and never
  reached "Rock" - this was fixed as part of adding the 3rd level, verified against Paramore/Swans/
  Have A Nice Life, the dataset's real Pop Punk/Post-Punk-tagged artists).
  **The filter is applied per-ARTIST, not per-track** - `allTracks` checks each `scoringArtist`'s OWN
  genre(s) individually and drops that one artist if none of their genres are selected, rather than
  checking whether the track AS A WHOLE has any selected-genre artist on it. This matters for
  collabs across genres: with Hip-Hop unchecked, a Kendrick Lamar track featuring Kali Uchis (R&B/Soul)
  correctly drops Kendrick from that track's scoring but keeps Kali Uchis - checking the track's
  combined genre set first (an earlier, buggy version did this) would incorrectly keep Kendrick
  visible just because a differently-genred collaborator is also credited. A track left with zero
  scoringArtists after this per-artist filter is dropped entirely rather than kept with an empty list.
- **`app/src/components/RangePicker.tsx`** + **`app/src/lib/useMonthRange.ts`** — the date-range
  control shared by Leaderboard, Timeline, and Compare (the same one `RangePicker` call serves both
  artists and genres mode in Leaderboard/Timeline now - the mode switch doesn't change which range
  picker is shown, just what it's scoping): a live
  "{start} → {end}" label, the relative presets from `RANGE_PRESETS` (All time / Last 6/12/24 months),
  a row of calendar-year buttons, and the drag slider underneath. The year buttons are generated from
  `useMonthRange`'s `availableYears` - distinct `YYYY` prefixes pulled from that call's own
  `availableMonths` array, so they're inherently person-scoped wherever the caller's `availableMonths`
  already is: hryash started in 2024, so hryash only ever gets 2024/2025/2026 buttons, never 2022/2023,
  without any hardcoded per-person logic - it falls out naturally from `availableMonths` being
  `sortedMonths(dataset, person)` in every caller except Compare (which spans everyone, so its years
  are the union across all three people). Clicking a year (`applyYear`) sets the range to the first and
  last month THIS PERSON actually has within that calendar year, not always Jan-Dec - so a partial year
  (the very first or very last year in someone's history) still produces a sensible range instead of
  a slider position outside their real data. Each tab persists its own range independently per person
  (`storageKey` like `leaderboard:${person}` / `timeline:${person}` - see `useMonthRange`'s own doc
  comment) - the year buttons don't add a separate persistence key, they just call the same
  `setStartMonth`/`setEndMonth` the slider and relative presets already use.
- **`app/src/components/RankFilter.tsx`** + **`app/src/lib/useRankFilter.ts`** — the Leaderboard's
  Top 1/3/5/10/25 buttons: a segmented control (`role="radiogroup"`, styled like Compare's mode switch
  - one pill-shaped container, one filled/active button at a time) that acts as a true radio group,
  unlike the genre filter's checkboxes. `StatsOptions.maxRank` (consumed in `allTracks`, applied before
  any artist-level processing since rank is a whole-TRACK property, not a per-artist one like
  `genreFilter`) drops any track whose `rank` is greater than the selected number entirely - picking
  "Top 5" means an artist's count only includes tracks that were placed at #1-5 in whatever month they
  appeared, not "this artist had a #5 song somewhere, so count everything they have." A song ranked
  #12 that month is simply excluded, even for an artist who also has a #3 song - this is a per-track
  cutoff, not a per-artist qualifying filter. The "Top 25" button is the default/unfiltered state - the
  UI translates it to `maxRank: undefined` rather than the literal number 25. As of now every month in
  the data has exactly 25 tracks (the two earlier overflow cases - Kazimir UH2O's `2022-10` and
  delsix's `2023-04` - have both since been cleaned up, see the data-layout quirks note below), so this
  distinction is currently a no-op either way - but keep the `undefined` convention regardless, since
  a future month with more than 25 tracks is a real possibility this filter has to handle correctly
  (passing a literal `maxRank: 25` would incorrectly drop any such track), not a historical artifact to
  special-case around. Persisted per person via `usePersistedState`,
  defaulting to 25 (unfiltered), same convention
  as the genre filter. The per-artist drill-down (`tracksForArtist` call in `Leaderboard.tsx`) also
  passes `maxRank` through - a song excluded from an artist's total by the rank filter shouldn't
  reappear in their own song list either - but deliberately does NOT pass `genreFilter`, matching its
  pre-existing behavior of always showing an artist's full song list regardless of the genre
  checkboxes (genreFilter decides whether an artist qualifies at all, not which of their own songs to
  hide once they're shown).
- **`app/src/lib/useWeightByRank.ts`** + the "Weight by placement" `ToggleCheckbox` next to
  `RankFilter` in `Leaderboard.tsx` — an opt-in (default OFF), per-person-persisted checkbox that
  switches the leaderboard from flat "1 point per song" counting to `rankPoints(rank)` (`stats.ts`): a
  smooth, front-loaded curve (exponential decay down to a floor, `floor + (max-floor)*decay^(rank-1)`,
  anchored so rank 1 = 100 pts and rank 5 = 50 pts) rather than a flat count, so a #1 placement is
  worth far more than a #25 one without the curve being a hard cliff - the project owner's own example
  numbers (top 25 ~10, top 20 ~12.5, top 15 ~15, top 10 ~25, top 5 ~50, top 1 ~100) were the anchors
  this was fit against. `StatsOptions.weightByRank` is consumed inside `allTracks` itself: every track
  in its output now carries a `points` field (`rankPoints(track.rank)` when the option is on, else a
  flat `1`), and every summation in `stats.ts` that used to add a flat `1` per track/match now adds
  `track.points` instead - `artistTotals`, `artistMonthCounts`, `genreTotals`, `genreMonthCounts` (all
  consumed by Leaderboard/Timeline, in both their artists and genres modes) - so turning the checkbox on
  reshuffles rankings (an artist who charts #1-3 often can overtake one with a higher flat count but
  lower average placement) while every other toggle/filter (range, genre filter, rank filter, dedup)
  still composes with it normally, since it's just another multiplier on the same per-track loop.
  **Deliberately NOT wired into the Shared tab or Compare** (`sharedSongArtistTotals`,
  `personArtistSummaries`/`cumulativeArtistSeriesByPerson`, `personGenreSummaries`/
  `cumulativeGenreSeriesByPerson`) - a shared song was ranked differently by each of the three people,
  so "its placement" has no single meaning the way it does on a per-person Leaderboard row; those
  call sites simply never pass `weightByRank` through (their own `options`/`genreOptions` objects never
  set it), so `track.points` is always the flat `1` there regardless of the Leaderboard checkbox's
  state - this was an explicit scoping decision, not an oversight. `StatsRow`'s "Top artist" tile
  switches its detail text from "`N` songs" to "`N` pts" (rounded) when `options.weightByRank` is on,
  since the underlying `ArtistTotal.total` is now a fractional point sum, not a song count, in that
  mode - same reasoning, the Leaderboard row's own value column shows "`N`pts" instead of a plain
  integer when the checkbox is on. `ArtistTotal` also carries a `count` field alongside `total` -
  the plain integer number of qualifying track occurrences, computed in the same pass as `total` in
  `artistTotals` (and mirrored as `total` itself in `sharedSongArtistTotals`, which never weights) -
  so when weighting is on, both the leaderboard row value and the `StatsRow` "Top artist" detail can
  show "`N`pts (`count`)" (e.g. "2413pts (73)"), since a bare points figure alone doesn't communicate
  how many actual songs are behind it. Chose parentheses over brackets for this - reads as "here's the
  points, and by the way here's the song count" rather than brackets' more footnote-like connotation.
  The leaderboard row's value column width switched from a fixed pixel size to `max-content` in the
  CSS grid (both desktop and the `560px` mobile breakpoint) to accommodate the now-variable-length
  string without clipping or wrapping. Verified directly against the real dataset: turning the checkbox on
  for delsix reshuffles the top 5 (Logic overtakes Eminem, J. Cole enters the top 5) while the total
  artist count stays identical (439 either way - weighting changes ORDER and VALUE, never which
  artists qualify at all), and the sum of a drilled-down artist's own song points exactly matches
  their leaderboard total to the cent, confirming `StatsRow`/the row list/the drill-down all stay in
  sync off the one shared `combinedOptions` object the same way `maxRank`/`genreFilter` already do.
- Styling is CSS Modules per-component, with design tokens (colors, surfaces) as CSS custom properties
  in `src/index.css`, following the project's dataviz skill palette for both light and dark mode.
- **`app/src/lib/usePersistedState.ts`** — `usePersistedState`/`usePersistedSetState` wrap `useState`
  with a `localStorage` round-trip (no cookies/server — this is purely a per-browser UI convenience).
  Used for the active person, active view, the "include duplicates", "unite similar artists/groups",
  "show producers", and "show duos" checkboxes, and the Timeline's selected-artist set. The Timeline's
  selection is persisted **per
  person** (key includes the person name) since each person has a different artist pool. A stored
  person/view can go stale (dataset changes, old build) — `App.tsx` validates against
  `dataset.people`/the known view ids and falls back rather than rendering garbage; don't assume a
  value read back from storage is still valid.

### Scoring rules (per the project owner — not derivable from the data itself)

- Each track in a monthly top-25 list contributes to its artist's count/score for that month. Rank
  position (1–25) matters for "best of" framing but a track counts even at #25.
- **Features count**: if a track has a featured artist (e.g. "feat. X" in the title, or a secondary
  name in the artist field), the featured artist gets a full point too — same as the primary artist.
- **Misspelling correction** (always on, build-time): Spotify's own catalog occasionally credits an
  artist under a typo'd or malformed spelling (not a deliberate alias — just bad metadata on their
  end). These merge silently into the correctly-spelled name via `SPOTIFY_MISSPELLINGS` in
  `artistAttribution.ts` (checked before `ARTIST_ALIASES`, so a misspelled alias still resolves
  correctly). Current cases: "Kill Bill the Rapper" (missing colon, wrong case) → "Kill Bill: The
  Rapper"; "RAP FERRERIA" (typo'd/all-caps) → "R.A.P. Ferreira"; "KA" (all-caps, used on a few feature
  credits) → "Ka" (the dominant spelling on his own tracks); "Alchemist" (missing "The", used on a
  handful of credits) → "The Alchemist"; "Laurie Bird" and "NSB Archive" → "Natural Snow Buildings"
  (Spotify mislabels this project under a member's name and under a separate catalog/archive entry —
  not a small typo like the others, but the same class of fix: credited wrong on Spotify's end, not a
  real alternate identity). Add new ones here as they're spotted — there's no automatic way to detect
  a mislabeled artist name,
  so this is manual, same as the other tables here.
- **Alias merging** (always on, build-time): if the same real person has released music under more
  than one artist name (a rename, a side project that's really just them, an "FKA"), every alias
  should count toward ONE canonical name in the stats — don't let someone's songs get split across
  multiple "artists" just because the CSV credits them under whichever name was current at release
  time. Current cases (see `ARTIST_ALIASES` in `artistAttribution.ts`): "Milo" is an earlier stage name
  for the artist now credited as "R.A.P. Ferreira"; "Tariq Trotter" is Black Thought's government
  name, used interchangeably by Spotify; "No Malice" is an alias Clipse's Malice has also recorded
  under (added proactively — doesn't appear in the data yet, but will merge correctly whenever it
  does); "By Storm" is a rename/relaunch of the same group now credited as "Injury Reserve" (always
  co-credited together on every track, never shows up alone — an unambiguous rename, not a distinct
  project, so it's here rather than in the opt-in `RELATED_PROJECTS` table). If a track credits two
  aliases of the same person together (this happens — e.g. a track
  crediting both "Milo" and "R.A.P. Ferreira"), that's still one point for that person, not two. This
  table is reserved for an unambiguous rename of the SAME stage identity — a softer case (a genuinely
  different PROJECT name for the same person, or different entities with overlapping membership) is a
  judgment call instead and belongs in the opt-in `RELATED_PROJECTS` table described below, not here.
- **Group/duo attribution** (always on, build-time): if a track is credited to a duo/group whose
  individual members also have independent solo careers, and the track credit does NOT separately
  name those members, each member individually gets a full point in addition to (or standing in for)
  the group credit. Canonical example from the owner: a track credited to "Armand Hammer" (the duo)
  with no separate mention of billy woods or E L U C I D should award a full point to both billy woods
  and E L U C I D individually. Current entries in `GROUP_MEMBERS` (`artistAttribution.ts`): Armand
  Hammer, Run The Jewels, Bad Meets Evil, The Roots (only its MC Black Thought — it's had a large,
  shifting lineup over the years, unlike the clean duos), Clipse, Black Star, Gang Starr, Mobb Deep,
  Outkast, Smif-N-Wessun. This mapping is not in the CSVs and needs manual upkeep as new
  groups/duos show up.
- **"Unite similar artists/groups" toggle** (opt-in, runtime, default ON — `uniteRelatedProjects`
  option in `src/lib/stats.ts`, table in `src/lib/relatedProjects.ts`): for cases that are a reasonable
  judgment call rather than a certainty — a different PROJECT name for the same person (not just a
  renamed stage identity), or different bands/entities with meaningfully overlapping membership — this
  merges them into one name ONLY when the viewer opts in, unlike the always-on tables above. Current
  cases: "Mount Eerie" and "The Microphones" both unify under "Phil Elverum" (his main recording
  project was renamed partway through his career — the project names aren't interchangeable, but the
  person is); "Team Sleep" unifies under "Deftones" (a different band, but enough shared
  membership/frontperson overlap — Chino Moreno — that uniting them is a reasonable view of
  "Deftones-adjacent" output). When OFF, every name in `RELATED_PROJECTS` keeps its own separate count
  instead.
- **"Show producers" toggle** (opt-in, runtime, **default OFF** — `showProducers` option in
  `src/lib/stats.ts`, set in `src/lib/knownProducers.ts`): the Spotify/Exportify CSV schema has no
  dedicated producer column, so a producer only ever shows up because they happen to also be listed
  in `Artist Name(s)`, the same field a track's rapper/singer is listed in - and whether a given track
  credits its producer at all is inconsistent (most don't). Because of that, producer counts can't be
  trusted the way other artist counts can, so `KNOWN_PRODUCERS` is a hand-maintained allowlist of
  names that are unambiguously producer-only in this data (Kenny Segal, The Alchemist, Madlib, DJ
  Premier, etc.) - when the checkbox is off, those names are dropped from `scoringArtists` entirely
  (zero points, invisible in Leaderboard/Timeline), and restored when it's on. This never touches
  `creditedArtists` - the raw per-track list (song dropdown, Replay) always shows the literal credit
  regardless of the setting. Deliberately excludes anyone who is ALSO a legitimate lead artist
  somewhere in the data - e.g. J Dilla (sole credited artist on his own instrumental album, "Donuts")
  and El-P (a vocalist in Run The Jewels, already in `GROUP_MEMBERS`) - check for a dual-role case like
  that before adding a new name here.
- **"Show duos" toggle** (opt-in, runtime, **default OFF** — `showDuos` option in `src/lib/stats.ts`):
  since a group/duo's members already get full credit via `GROUP_MEMBERS` expansion (see "Group/duo
  attribution" above), the group's OWN name showing up as a separate leaderboard/timeline entry too is
  additional/optional context rather than new information - OFF hides the group name itself (e.g.
  "Armand Hammer", "Clipse") while its members (billy woods, E L U C I D, Pusha T, Malice, ...) keep
  their points exactly as before; ON shows the group as its own entry too, as it always did before this
  toggle existed. `Dataset.groupNames` (populated in `buildData.ts` from `Object.keys(GROUP_MEMBERS)`)
  is what lets the frontend know which `scoringArtists` entries are group names without re-deriving the
  build-time table - if you add a new entry to `GROUP_MEMBERS`, it's automatically covered by this
  toggle too, no separate list to update. Like the other runtime toggles, never touches
  `creditedArtists`.
- **"Include duplicates" toggle** (`includeDuplicates` option throughout `src/lib/stats.ts`): when off,
  a song that appears in more than one month's top 25 counts once overall per artist (toward its first
  chronological appearance), not once per occurrence. "The same song" is matched via `trackKey`
  (normalized title + credited-artist list), not raw title equality — Spotify/Exportify re-releases the
  same recording under multiple catalog titles (e.g. `"X - Single Version"` vs `"X"`, `"X - 2005
  Remaster"`), and those must still collapse together or the toggle undercounts. `normalizeTitle` in
  `stats.ts` strips a known, narrow set of trailing release-tag words (version/edit/edition/remaster +
  a descriptor like year/explicit/album/single/radio/extended/deluxe/tv/digital/mono/stereo) — it
  deliberately does NOT strip "(Remix)", "- Live", or other suffixes that denote an actually different
  recording someone chose on purpose, and never touches "(feat. ...)". If a future CSV introduces a new
  re-release tag style that isn't collapsing correctly, extend the descriptor/noun word lists there
  rather than loosening the match to something broader (a false merge of two genuinely different songs
  is worse than missing an exotic tag).
- **`app/src/lib/trackDisambiguation.ts`** — the inverse problem from the above: a hand-maintained
  exception list for the rare case where two GENUINELY DIFFERENT recordings happen to share both a
  title and a credited-artist list, which `trackKey` would otherwise incorrectly treat as "the same
  song" and silently drop one of them when "include duplicates" is off. `DISTINCT_RECORDING_ISRCS` is
  a `Set<string>` of ISRCs (not title/album, since those can coincidentally repeat too, and not
  Spotify ID since a locally-matched `spotify:local:...` row has none) - any track whose ISRC is in
  this set gets that ISRC folded into its `trackKey`, so it stops colliding with the other
  same-titled/same-artist track. Deliberately a narrow, explicit exception table rather than a general
  change to `trackKey` (e.g. always matching on ISRC, or on title+artist+album) - ISRC/album aren't
  safe to use unconditionally because a genuine RE-RELEASE of the same song (what the bullet above is
  about) can legitimately get a new ISRC or move to a different album, and that case must still
  collapse together, not split apart. Only add to this table when an identical-title collision between
  two provably different recordings actually turns up, the same way `SPOTIFY_MISSPELLINGS`/
  `ARTIST_ALIASES`/`GROUP_MEMBERS` only grow when a real case is spotted. Current case: delsix's
  "Outside" by Lupe Fiasco appears twice - 2023-07 (ISRC `USVCQ2300006`, album "Outside") and 2024-07
  (ISRC `US5KD2400018`, album "Samurai") - two different songs that happen to share a title and
  artist, not a re-release of one song; verified against the real dataset that both now count under
  "include duplicates off" (previously the 2024-07 one was silently dropped as if it were a repeat of
  the 2023-07 pick).

## Data layout

```
top25/csv/<person>/<YYYY>-<MM>.csv
```

e.g. `top25/csv/delsix/2024-04.csv` for the user's April 2024 top 25. One file per person per month —
this is an enforced naming convention, not something to detect. Three person folders exist today:
`delsix` (the project owner), `hryash`, and `Kazimir UH2O` (note the space in that folder name — it's
a valid person identifier, not a typo; code must not assume folder names are single tokens or lack
spaces). Code that discovers/parses these files should treat the folder name under `csv/` as an opaque
person identifier, never hardcode a specific name, and should get the month/year for a file **from its
filename**, never from any in-file "Added At"/date column — tracks get retroactively re-added (e.g.
swapping a single for the album version after it releases, or re-adding after an accidental removal),
so a track's add timestamp does not reliably reflect which month's top-25 list it belongs to. The
filename (i.e. which list it was placed in) is the source of truth for month attribution.

This convention was established by migrating from each person's original free-form export filenames
(inconsistent "Top 25 (Month Year).csv" / "Top_25_(Month_Year).csv" / "Apr25.csv" / "April_2023.csv"
styles, decorative suffixes like "_ANNIVERSARY"/"_ITS_BEEN_4_YEARS_BABY", a "Jule" typo for July, and
even Cyrillic-prefixed filenames for one person). Some of delsix's months had been exported twice by
different tools as redundant re-exports of the same 25 tracks (different columns, same songs) — those
extras were deleted, keeping one canonical file per month; hryash and Kazimir UH2O had no such
duplicates, only renames. As of now every person has a file for every month, July 2022 through
September 2025 — three of Kazimir UH2O's months (`2023-10`, `2024-04`, `2026-01`) were initially
missed on disk and added later under their original free-form names, then renamed to the convention.
Two months briefly had more than 25 tracks, both since cleaned up by the project owner (as of now
every month in the dataset has exactly 25):
Kazimir UH2O's `2022-10` had 27 - two of those (Cordae's "All Alone" and Boldy James's "Terms And
Conditions", both released well after October 2022 despite their `Added At` timestamps claiming that
month) turned out to be stray/misplaced rows rather than genuine October 2022 picks, and were removed.
delsix's `2023-04` had 26 for an unrelated reason - its #1 slot was a joke entry ("18" credited to
"Kazimir UH2O", clearly not a real pick), also removed, with every other track's rank shifting up by
one. Neither removal was this assistant inferring a fix on its own - both were the project owner's own
explicit call about their own data; don't assume a track with an odd `Added At` date, or a joke-looking
title, should be removed without that kind of explicit confirmation first. Don't assume every month
will always have a file for every person going
forward though — a gap can still be real (someone skipped a month) rather than something merely
forgotten on disk; if a month is missing, worth asking rather than assuming either way.
**New monthly files should be added directly as `YYYY-MM.csv`** to keep this consistent going forward —
don't reintroduce free-form naming for any person.

Note: filenames (and in-file `Added At` columns, where present) can carry dates in 2026 and later —
this is placeholder/test data reaching into the future, not a bug to "fix" to the current date.

### CSV schema

The canonical files are all Spotify/Exportify-style exports — header starts `Track URI,ISRC,Track
Name,Album Name,Artist Name(s),Release Date,Duration (ms),Popularity,Explicit,Added By,Added
At,Genres,Record Label,Danceability,Energy,...`. Rank/position is implicit in row order (row 1 = #1),
not a column. Multi-artist credits are **semicolon**-separated in `Artist Name(s)` (e.g.
`"Eminem;Dido"`) — parse with a real CSV parser regardless, since other fields (Genres, Track Name)
can contain commas.

- Can contain `spotify:local:...` URI rows for locally-matched files (no streaming ISRC) — these rows
  have empty ISRC and empty audio-feature columns; handle as valid tracks with missing metadata, not
  as errors.
- Don't assume every future monthly file will match this exact header forever (different export tools
  were used historically — see migration note above). Detect the schema from the header row rather
  than hardcoding column positions, and treat an unrecognized header as a signal to fall back to a
  more lenient parser rather than crashing.
