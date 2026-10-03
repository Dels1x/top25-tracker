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
  always aggregate on `scoringArtists`.
- **`app/src/lib/stats.ts`** — pure aggregation functions (artist totals, per-month counts, cumulative
  time series) over a `Dataset`. UI components call these rather than recomputing aggregates inline.
  `StatsOptions.startMonth`/`endMonth` ("YYYY-MM", inclusive) restrict to a date range *before* dedup
  and before any totals/series are computed — so Timeline's range picker makes cumulative counts
  **restart from zero at the range start**, not just crop the x-axis of an otherwise all-time running
  total. Keep it that way; it's what "songs since January 2025" is supposed to mean here.
- **`app/src/lib/colors.ts`** — assigns each artist a fixed categorical color slot by stable rank order
  (see the dataviz skill's "color follows the entity, never its rank" rule) — a toggled-off artist must
  never cause the remaining artists to repaint.
- **`app/src/components/`** — `Leaderboard` (songs-per-artist bar list), `Timeline` (cumulative line
  chart with per-artist toggle legend), `Replay` (month-by-month animated reveal), plus `Layout` /
  `StatsRow` / `StatTile` shell pieces. `App.tsx` just wires person/view selection state and imports
  `data.json` directly (no runtime CSV parsing, no backend/API).
- Styling is CSS Modules per-component, with design tokens (colors, surfaces) as CSS custom properties
  in `src/index.css`, following the project's dataviz skill palette for both light and dark mode.
- **`app/src/lib/usePersistedState.ts`** — `usePersistedState`/`usePersistedSetState` wrap `useState`
  with a `localStorage` round-trip (no cookies/server — this is purely a per-browser UI convenience).
  Used for the active person, active view, the "include duplicates", "unite similar artists/groups",
  and "show producers" checkboxes, and the Timeline's selected-artist set. The Timeline's selection is persisted **per
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
  handful of credits) → "The Alchemist". Add new ones here as they're spotted —
  there's no automatic way to detect a typo'd artist name, so this is manual, same as the other tables
  here.
- **Alias merging** (always on, build-time): if the same real person has released music under more
  than one artist name (a rename, a side project that's really just them, an "FKA"), every alias
  should count toward ONE canonical name in the stats — don't let someone's songs get split across
  multiple "artists" just because the CSV credits them under whichever name was current at release
  time. Current cases (see `ARTIST_ALIASES` in `artistAttribution.ts`): "Milo" is an earlier stage name
  for the artist now credited as "R.A.P. Ferreira"; "Tariq Trotter" is Black Thought's government
  name, used interchangeably by Spotify; "No Malice" is an alias Clipse's Malice has also recorded
  under (added proactively — doesn't appear in the data yet, but will merge correctly whenever it
  does). If a track credits two aliases of the same person together (this happens — e.g. a track
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
duplicates, only renames. Not every person has a file for every month — e.g. Kazimir UH2O is missing
several months (`2023-10`, `2024-04`, `2026-01`) and has 27 tracks instead of 25 for `2022-10` — these
are real gaps/quirks in that person's data, not bugs to "fix" by inventing or dropping rows.
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
