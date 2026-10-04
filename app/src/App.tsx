import rawData from "./data/data.json";
import type { Dataset } from "./data/types";
import { Layout } from "./components/Layout";
import { Leaderboard } from "./components/Leaderboard";
import { Timeline } from "./components/Timeline";
import { Replay } from "./components/Replay";
import { Shared } from "./components/Shared";
import { Compare } from "./components/Compare";
import { ToggleCheckbox } from "./components/ToggleCheckbox";
import { usePersistedState } from "./lib/usePersistedState";
import type { StatsOptions } from "./lib/stats";

const dataset = rawData as Dataset;

// "genres"/"genreTimeline" used to be their own views (GenreLeaderboard/
// GenreTimeline) - merged into Leaderboard/Timeline's own Artists/Genres
// mode switch instead (same idea as Compare's switch), since the two were
// nearly identical in shape. GENRE_VIEWS (which used to hide the
// artist-identity toggles for those two view ids) is gone along with them -
// Leaderboard/Timeline now always show the 3 identity toggles even in genre
// mode, matching Compare's own precedent of leaving them visible as
// harmless no-ops there rather than hiding them per-mode.
type View = "leaderboard" | "timeline" | "replay" | "shared" | "compare";
const VALID_VIEWS: View[] = ["leaderboard", "timeline", "replay", "shared", "compare"];
// Replay always shows literal creditedArtists, never scoringArtists, so the
// identity toggles (and the dedup toggle) have nothing to affect there.
// Shared DOES use scoringArtists (via sharedSongs) so it keeps the toggles.
const NO_TOGGLES_VIEWS: View[] = ["replay"];

function App() {
  const [person, setPerson] = usePersistedState("top25tracker:person", dataset.people[0]);
  const [view, setView] = usePersistedState<View>("top25tracker:view", "leaderboard");
  const [includeDuplicates, setIncludeDuplicates] = usePersistedState(
    "top25tracker:includeDuplicates",
    false
  );
  const [uniteRelatedProjects, setUniteRelatedProjects] = usePersistedState(
    "top25tracker:uniteRelatedProjects",
    true
  );
  const [showProducers, setShowProducers] = usePersistedState(
    "top25tracker:showProducers",
    false
  );
  const [showDuos, setShowDuos] = usePersistedState("top25tracker:showDuos", false);

  // A stored person/view can go stale (a friend's folder renamed, or an old
  // build used a different View id) - fall back rather than render garbage.
  const activePerson = dataset.people.includes(person) ? person : dataset.people[0];
  const activeView = VALID_VIEWS.includes(view) ? view : "leaderboard";

  const scoringOptions: StatsOptions = {
    includeDuplicates,
    uniteRelatedProjects,
    showProducers,
    showDuos,
  };

  return (
    <Layout
      people={dataset.people}
      activePerson={activePerson}
      onPersonChange={setPerson}
      view={activeView}
      onViewChange={setView}
    >
      {!NO_TOGGLES_VIEWS.includes(activeView) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
          <ToggleCheckbox
            checked={includeDuplicates}
            onChange={setIncludeDuplicates}
            label="Count repeat songs every time they appear"
          />
          {/* Artist-identity options are inert once Leaderboard/Timeline/
              Compare switch into genre mode internally - harmless no-ops
              there rather than something App.tsx needs to hide per-view. */}
          <ToggleCheckbox
            checked={uniteRelatedProjects}
            onChange={setUniteRelatedProjects}
            label="Unite similar artists/groups"
          />
          <ToggleCheckbox
            checked={showProducers}
            onChange={setShowProducers}
            label="Show producers"
          />
          <ToggleCheckbox checked={showDuos} onChange={setShowDuos} label="Show duos" />
        </div>
      )}

      {activeView === "leaderboard" && (
        <Leaderboard dataset={dataset} person={activePerson} scoringOptions={scoringOptions} />
      )}
      {activeView === "timeline" && (
        <Timeline dataset={dataset} person={activePerson} scoringOptions={scoringOptions} />
      )}
      {activeView === "replay" && <Replay dataset={dataset} person={activePerson} />}
      {activeView === "shared" && <Shared dataset={dataset} scoringOptions={scoringOptions} />}
      {activeView === "compare" && <Compare dataset={dataset} scoringOptions={scoringOptions} />}
    </Layout>
  );
}

export default App;
