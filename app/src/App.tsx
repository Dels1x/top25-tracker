import rawData from "./data/data.json";
import type { Dataset } from "./data/types";
import { Layout } from "./components/Layout";
import { StatsRow } from "./components/StatsRow";
import { Leaderboard } from "./components/Leaderboard";
import { Timeline } from "./components/Timeline";
import { Replay } from "./components/Replay";
import { ToggleCheckbox } from "./components/ToggleCheckbox";
import { usePersistedState } from "./lib/usePersistedState";
import type { StatsOptions } from "./lib/stats";

const dataset = rawData as Dataset;

type View = "leaderboard" | "timeline" | "replay";
const VALID_VIEWS: View[] = ["leaderboard", "timeline", "replay"];

function App() {
  const [person, setPerson] = usePersistedState("top25tracker:person", dataset.people[0]);
  const [view, setView] = usePersistedState<View>("top25tracker:view", "leaderboard");
  const [includeDuplicates, setIncludeDuplicates] = usePersistedState(
    "top25tracker:includeDuplicates",
    true
  );
  const [uniteRelatedProjects, setUniteRelatedProjects] = usePersistedState(
    "top25tracker:uniteRelatedProjects",
    true
  );
  const [showProducers, setShowProducers] = usePersistedState(
    "top25tracker:showProducers",
    false
  );

  // A stored person/view can go stale (a friend's folder renamed, or an old
  // build used a different View id) - fall back rather than render garbage.
  const activePerson = dataset.people.includes(person) ? person : dataset.people[0];
  const activeView = VALID_VIEWS.includes(view) ? view : "leaderboard";

  const scoringOptions: StatsOptions = { includeDuplicates, uniteRelatedProjects, showProducers };

  return (
    <Layout
      people={dataset.people}
      activePerson={activePerson}
      onPersonChange={setPerson}
      view={activeView}
      onViewChange={setView}
    >
      <StatsRow dataset={dataset} person={activePerson} scoringOptions={scoringOptions} />

      {activeView !== "replay" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
          <ToggleCheckbox
            checked={includeDuplicates}
            onChange={setIncludeDuplicates}
            label="Count repeat songs every time they appear"
          />
          <ToggleCheckbox
            checked={uniteRelatedProjects}
            onChange={setUniteRelatedProjects}
            label="Unite similar artists/groups (e.g. Team Sleep → Deftones)"
          />
          <ToggleCheckbox
            checked={showProducers}
            onChange={setShowProducers}
            label="Show producers (credits are inconsistent, off by default)"
          />
        </div>
      )}

      {activeView === "leaderboard" && (
        <Leaderboard dataset={dataset} person={activePerson} scoringOptions={scoringOptions} />
      )}
      {activeView === "timeline" && (
        <Timeline dataset={dataset} person={activePerson} scoringOptions={scoringOptions} />
      )}
      {activeView === "replay" && <Replay dataset={dataset} person={activePerson} />}
    </Layout>
  );
}

export default App;
