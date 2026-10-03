import { useState } from "react";
import rawData from "./data/data.json";
import type { Dataset } from "./data/types";
import { Layout } from "./components/Layout";
import { StatsRow } from "./components/StatsRow";
import { Leaderboard } from "./components/Leaderboard";
import { Timeline } from "./components/Timeline";
import { Replay } from "./components/Replay";

const dataset = rawData as Dataset;

type View = "leaderboard" | "timeline" | "replay";

function App() {
  const [person, setPerson] = useState(dataset.people[0]);
  const [view, setView] = useState<View>("leaderboard");

  return (
    <Layout
      people={dataset.people}
      activePerson={person}
      onPersonChange={setPerson}
      view={view}
      onViewChange={setView}
    >
      <StatsRow dataset={dataset} person={person} />

      {view === "leaderboard" && <Leaderboard dataset={dataset} person={person} />}
      {view === "timeline" && <Timeline dataset={dataset} person={person} />}
      {view === "replay" && <Replay dataset={dataset} person={person} />}
    </Layout>
  );
}

export default App;
