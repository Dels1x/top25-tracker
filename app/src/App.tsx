import rawData from "./data/data.json";
import type { Dataset } from "./data/types";
import { Layout } from "./components/Layout";
import { StatsRow } from "./components/StatsRow";
import { Leaderboard } from "./components/Leaderboard";
import { Timeline } from "./components/Timeline";
import { Replay } from "./components/Replay";
import { DuplicatesToggle } from "./components/DuplicatesToggle";
import { usePersistedState } from "./lib/usePersistedState";

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

  // A stored person/view can go stale (a friend's folder renamed, or an old
  // build used a different View id) - fall back rather than render garbage.
  const activePerson = dataset.people.includes(person) ? person : dataset.people[0];
  const activeView = VALID_VIEWS.includes(view) ? view : "leaderboard";

  return (
    <Layout
      people={dataset.people}
      activePerson={activePerson}
      onPersonChange={setPerson}
      view={activeView}
      onViewChange={setView}
    >
      <StatsRow dataset={dataset} person={activePerson} includeDuplicates={includeDuplicates} />

      {activeView !== "replay" && (
        <div style={{ marginBottom: 16 }}>
          <DuplicatesToggle
            includeDuplicates={includeDuplicates}
            onChange={setIncludeDuplicates}
          />
        </div>
      )}

      {activeView === "leaderboard" && (
        <Leaderboard dataset={dataset} person={activePerson} includeDuplicates={includeDuplicates} />
      )}
      {activeView === "timeline" && (
        <Timeline dataset={dataset} person={activePerson} includeDuplicates={includeDuplicates} />
      )}
      {activeView === "replay" && <Replay dataset={dataset} person={activePerson} />}
    </Layout>
  );
}

export default App;
