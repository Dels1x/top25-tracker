import { useMemo, useState } from "react";
import type { Dataset, Track } from "../data/types";
import { listsForPerson, sortedMonths } from "../lib/stats";
import { usePersistedState } from "../lib/usePersistedState";
import { useMonthRange } from "../lib/useMonthRange";
import { RangePicker } from "./RangePicker";
import styles from "./Top25Fight.module.css";

interface Top25FightProps {
  dataset: Dataset;
}

const WIN_SCORE = 30;

interface FightTrack {
  track: Track;
  person: string;
  month: string;
}

interface FightState {
  scoreA: number;
  scoreB: number;
  round: number;
  current: [FightTrack, FightTrack] | null;
}

function defaultState(): FightState {
  return { scoreA: 0, scoreB: 0, round: 0, current: null };
}

/**
 * Only tracks with a spotifyId can be played in-app at all (no spotifyId
 * means a spotify:local:... row with no streaming match - see SpotifyEmbed's
 * own doc comment in Replay.tsx) - "only spotify songs can be in the game"
 * per the project owner's own spec, so the pool is filtered down before a
 * single random pick ever happens, not filtered-and-retried per pick.
 * `startMonth`/`endMonth` (both inclusive, undefined = no bound) restrict
 * the draw to a time range, same "YYYY-MM" convention StatsOptions uses
 * elsewhere - a month outside the range is dropped from the pool entirely,
 * same as it being dropped for having no spotifyId.
 */
function spotifyEligiblePool(
  dataset: Dataset,
  person: string,
  startMonth?: string,
  endMonth?: string
): FightTrack[] {
  const pool: FightTrack[] = [];
  for (const list of listsForPerson(dataset, person)) {
    if (startMonth && list.month < startMonth) continue;
    if (endMonth && list.month > endMonth) continue;
    for (const track of list.tracks) {
      if (track.spotifyId) pool.push({ track, person, month: list.month });
    }
  }
  return pool;
}

function randomFrom(pool: FightTrack[]): FightTrack | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Same official Spotify track embed Replay.tsx uses - see that file's doc
 * comment for why this is the only way to get real in-page playback. */
function SpotifyEmbed({ spotifyId }: { spotifyId: string }) {
  return (
    <iframe
      key={spotifyId}
      className={styles.spotifyEmbed}
      src={`https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator`}
      width="100%"
      height="152"
      style={{ border: 0 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title="Spotify preview player"
    />
  );
}

function FighterCard({
  fight,
  side,
  disabled,
  onPick,
}: {
  fight: FightTrack;
  side: "A" | "B";
  disabled: boolean;
  onPick: () => void;
}) {
  const { track, person, month } = fight;
  return (
    <div className={styles.card}>
      <div className={styles.cardPerson}>{person}'s pick</div>
      <div className={styles.cardTitle} title={track.title}>
        {track.title}
      </div>
      <div className={styles.cardArtists}>{track.creditedArtists.join(", ")}</div>
      <div className={styles.cardMeta}>
        #{track.rank} &middot; {month}
      </div>
      {track.spotifyId && <SpotifyEmbed spotifyId={track.spotifyId} />}
      <button
        type="button"
        className={styles.pickButton}
        data-side={side}
        disabled={disabled}
        onClick={onPick}
      >
        This one wins
      </button>
    </div>
  );
}

export function Top25Fight({ dataset }: Top25FightProps) {
  const [personA, setPersonA] = usePersistedState(
    "top25tracker:fight:personA",
    dataset.people[0]
  );
  const [personB, setPersonB] = usePersistedState(
    "top25tracker:fight:personB",
    dataset.people[1] ?? dataset.people[0]
  );
  const [state, setState] = usePersistedState<FightState>(
    "top25tracker:fight:state",
    defaultState()
  );

  const activePersonA = dataset.people.includes(personA) ? personA : dataset.people[0];
  const activePersonB = dataset.people.includes(personB)
    ? personB
    : dataset.people[1] ?? dataset.people[0];

  // Spans everyone, like Compare's own range picker (sortedMonths(dataset,
  // undefined)) - Side A/B can be any two people, so the range has to cover
  // whichever combination is picked, not just one side's own history.
  const availableMonths = useMemo(() => sortedMonths(dataset, undefined), [dataset]);
  const {
    startIndex,
    endIndex,
    lastIndex,
    rangeOptions,
    availableYears,
    handleSliderChange,
    applyPreset,
    applyYear,
  } = useMonthRange(availableMonths, "fight");

  const poolA = useMemo(
    () =>
      spotifyEligiblePool(dataset, activePersonA, rangeOptions.startMonth, rangeOptions.endMonth),
    [dataset, activePersonA, rangeOptions.startMonth, rangeOptions.endMonth]
  );
  const poolB = useMemo(
    () =>
      spotifyEligiblePool(dataset, activePersonB, rangeOptions.startMonth, rangeOptions.endMonth),
    [dataset, activePersonB, rangeOptions.startMonth, rangeOptions.endMonth]
  );

  // Tracks "something about the matchup setup changed since the match
  // started" (either side's person, or the time range) - a mid-match edit
  // to any of these shouldn't silently discard progress, but the player
  // should be nudged to restart rather than keep playing against a stale
  // setup. Deliberately not persisted - it's just a one-session nudge.
  const [configChanged, setConfigChanged] = useState(false);

  function drawRound(round: number): FightState {
    const a = randomFrom(poolA);
    const b = randomFrom(poolB);
    return {
      scoreA: 0,
      scoreB: 0,
      round,
      current: a && b ? [a, b] : null,
    };
  }

  function startMatch() {
    setState(drawRound(1));
    setConfigChanged(false);
  }

  function nextRound() {
    setState((prev) => {
      const a = randomFrom(poolA);
      const b = randomFrom(poolB);
      return {
        ...prev,
        round: prev.round + 1,
        current: a && b ? [a, b] : null,
      };
    });
  }

  function pickWinner(side: "A" | "B") {
    setState((prev) => {
      const scoreA = prev.scoreA + (side === "A" ? 1 : 0);
      const scoreB = prev.scoreB + (side === "B" ? 1 : 0);
      if (scoreA >= WIN_SCORE || scoreB >= WIN_SCORE) {
        return { ...prev, scoreA, scoreB, current: null };
      }
      const a = randomFrom(poolA);
      const b = randomFrom(poolB);
      return {
        scoreA,
        scoreB,
        round: prev.round + 1,
        current: a && b ? [a, b] : null,
      };
    });
  }

  const matchStarted = state.round > 0;
  const winner =
    state.scoreA >= WIN_SCORE ? activePersonA : state.scoreB >= WIN_SCORE ? activePersonB : null;
  const noEligibleTracks = poolA.length === 0 || poolB.length === 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Top 25 Fight</h2>
          <p className={styles.sub}>
            Two songs, one winner. First to {WIN_SCORE} points takes the match.
          </p>
        </div>
      </div>

      <div className={styles.pickerRow}>
        <label className={styles.pickerLabel}>
          Side A
          <select
            className={styles.pickerSelect}
            value={activePersonA}
            onChange={(e) => {
              setPersonA(e.target.value);
              setConfigChanged(true);
            }}
          >
            {dataset.people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.vs}>vs</span>
        <label className={styles.pickerLabel}>
          Side B
          <select
            className={styles.pickerSelect}
            value={activePersonB}
            onChange={(e) => {
              setPersonB(e.target.value);
              setConfigChanged(true);
            }}
          >
            {dataset.people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className={styles.startButton} onClick={startMatch}>
          {matchStarted ? "Restart match" : "Start match"}
        </button>
      </div>

      <RangePicker
        months={availableMonths}
        startIndex={startIndex}
        endIndex={endIndex}
        lastIndex={lastIndex}
        availableYears={availableYears}
        onSliderChange={(a, b) => {
          handleSliderChange(a, b);
          setConfigChanged(true);
        }}
        onPreset={(months) => {
          applyPreset(months);
          setConfigChanged(true);
        }}
        onYear={(year) => {
          applyYear(year);
          setConfigChanged(true);
        }}
      />

      {noEligibleTracks && (
        <p className={styles.empty}>
          One of these two has no songs with a Spotify match in this time range to play - widen the
          range or pick someone else.
        </p>
      )}

      {!noEligibleTracks && configChanged && matchStarted && (
        <p className={styles.sub}>
          Changed the matchup - hit "Restart match" to start a fresh game with the new setup.
        </p>
      )}

      {!noEligibleTracks && matchStarted && (
        <>
          <div className={styles.scoreRow}>
            <div className={styles.scoreBlock}>
              <div className={styles.scoreName}>{activePersonA}</div>
              <div className={styles.scoreValue}>{state.scoreA}</div>
            </div>
            <div className={styles.roundLabel}>Round {state.round}</div>
            <div className={styles.scoreBlock}>
              <div className={styles.scoreName}>{activePersonB}</div>
              <div className={styles.scoreValue}>{state.scoreB}</div>
            </div>
          </div>

          {winner ? (
            <div className={styles.winnerBanner}>
              <div className={styles.winnerText}>{winner} wins the match!</div>
              <div className={styles.finalScore}>
                {state.scoreA} - {state.scoreB}
              </div>
              <button type="button" className={styles.startButton} onClick={startMatch}>
                Play again
              </button>
            </div>
          ) : (
            state.current && (
              <div className={styles.matchup}>
                <FighterCard
                  fight={state.current[0]}
                  side="A"
                  disabled={false}
                  onPick={() => pickWinner("A")}
                />
                <div className={styles.matchupVs}>VS</div>
                <FighterCard
                  fight={state.current[1]}
                  side="B"
                  disabled={false}
                  onPick={() => pickWinner("B")}
                />
              </div>
            )
          )}

          {!winner && !state.current && (
            <p className={styles.empty}>
              Couldn't draw a round - try restarting the match.
              <button type="button" className={styles.startButton} onClick={nextRound}>
                Retry
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
