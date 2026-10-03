import { useState } from "react";
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

function App() {
  const [person, setPerson] = useState(dataset.people[0]);
  const [view, setView] = useState<View>("leaderboard");
  const [includeDuplicates, setIncludeDuplicates] = usePersistedState(
    "top25tracker:includeDuplicates",
    true
  );

  return (
    <Layout
      people={dataset.people}
      activePerson={person}
      onPersonChange={setPerson}
      view={view}
      onViewChange={setView}
    >
      <StatsRow dataset={dataset} person={person} includeDuplicates={includeDuplicates} />

      {view !== "replay" && (
        <div style={{ marginBottom: 16 }}>
          <DuplicatesToggle
            includeDuplicates={includeDuplicates}
            onChange={setIncludeDuplicates}
          />
        </div>
      )}

      {view === "leaderboard" && (
        <Leaderboard dataset={dataset} person={person} includeDuplicates={includeDuplicates} />
      )}
      {view === "timeline" && (
        <Timeline dataset={dataset} person={person} includeDuplicates={includeDuplicates} />
      )}
      {view === "replay" && <Replay dataset={dataset} person={person} />}
    </Layout>
  );
}

export default App;
