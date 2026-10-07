/** One track entry in a person's monthly top 25, normalized across CSV schemas. */
export interface Track {
  /** 1 = favorite, 25 = least favorite (but still a favorite that month). */
  rank: number;
  title: string;
  /** All artists credited on the track as written in the source data (no group expansion). */
  creditedArtists: string[];
  /**
   * All artists who get a scoring point for this track: creditedArtists plus
   * any group members implied by the group/duo lookup table. This is the
   * list stats/charts should use when counting "songs per artist".
   */
  scoringArtists: string[];
  album: string;
  releaseDate: string | null;
  /** Straight from the CSV's "Duration (ms)" column; null if missing/unparseable. */
  durationMs: number | null;
  spotifyId: string | null;
  isrc: string | null;
  genres: string[];
}

/** One person's top 25 for a single month. */
export interface MonthlyList {
  person: string;
  /** "YYYY-MM" */
  month: string;
  year: number;
  monthNum: number;
  tracks: Track[];
}

/** The full normalized dataset, written to data.json and consumed by the app. */
export interface Dataset {
  people: string[];
  lists: MonthlyList[];
  generatedAt: string;
  /**
   * Every group/duo name from GROUP_MEMBERS (scripts/artistAttribution.ts),
   * copied here so the frontend can know "is this scoringArtists entry a
   * duo/group name, or an individual" without re-deriving the build-time
   * table - powers the "show duos" checkbox, which hides the group's own
   * entry (its members already get full credit via expansion, so showing
   * the group too is additional, optional context rather than new points).
   */
  groupNames: string[];
}
