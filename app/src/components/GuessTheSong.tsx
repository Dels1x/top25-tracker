import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset, Track } from "../data/types";
import { sortedMonths } from "../lib/stats";
import { directGenresForArtists } from "../lib/artistGenres";
import { useMonthRange } from "../lib/useMonthRange";
import { usePersistedSetState } from "../lib/usePersistedState";
import { RangePicker } from "./RangePicker";
import styles from "./GuessTheSong.module.css";

interface GuessTheSongProps {
  dataset: Dataset;
}

const WIN_SCORE = 30;
const ROUND_SECONDS = 30;
const OPTION_COUNT = 4;
/** How long to show the correct/incorrect reveal before auto-advancing. */
const REVEAL_MS = 1800;
/** Correct answer scoring: fastest possible answer scores MAX_POINTS, right
 * at the buzzer scores MIN_POINTS - linear in between. A timeout/wrong pick
 * always scores 0. */
const MIN_POINTS = 10;
const MAX_POINTS = 100;

interface PoolTrack {
  track: Track;
  person: string;
  month: string;
}

interface RoundOption {
  key: string;
  title: string;
  artists: string;
}

interface Round {
  correct: PoolTrack;
  options: RoundOption[];
  correctKey: string;
}

type RoundStatus = "playing" | "answered" | "timeout";

function optionKey(p: PoolTrack): string {
  return `${p.person}|${p.month}|${p.track.rank}`;
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Builds one round: picks a random correct track from the pool, then fills
 * 3 fake options preferring other tracks BY THE SAME ARTIST(S) first (the
 * trickiest, closest-call fakes), falling back to tracks sharing a genre
 * with the correct pick, and finally plain random tracks if both pools run
 * thin - per the project owner's own spec ("a mix of songs from the same
 * artist or from the same genre, a mix of that").
 */
function buildRound(pool: PoolTrack[]): Round | null {
  if (pool.length < OPTION_COUNT) return null;
  const correct = randomFrom(pool);
  if (!correct) return null;
  const correctKey = optionKey(correct);
  const correctArtists = new Set(correct.track.creditedArtists);
  const correctGenres = new Set(directGenresForArtists(correct.track.scoringArtists));

  const sameArtist: PoolTrack[] = [];
  const sameGenre: PoolTrack[] = [];
  const rest: PoolTrack[] = [];
  for (const p of pool) {
    if (optionKey(p) === correctKey) continue;
    // Avoid two options that are literally the same song (e.g. a duplicate
    // pick across people/months) - would make the question unanswerable.
    if (p.track.title === correct.track.title) continue;
    const isSameArtist = p.track.creditedArtists.some((a) => correctArtists.has(a));
    if (isSameArtist) {
      sameArtist.push(p);
      continue;
    }
    const genres = directGenresForArtists(p.track.scoringArtists);
    if (genres.some((g) => correctGenres.has(g))) {
      sameGenre.push(p);
    } else {
      rest.push(p);
    }
  }

  const fakes: PoolTrack[] = [];
  const seenTitles = new Set([correct.track.title]);
  function take(from: PoolTrack[]) {
    for (const candidate of shuffled(from)) {
      if (fakes.length >= OPTION_COUNT - 1) return;
      if (seenTitles.has(candidate.track.title)) continue;
      seenTitles.add(candidate.track.title);
      fakes.push(candidate);
    }
  }
  take(sameArtist);
  take(sameGenre);
  take(rest);
  if (fakes.length < OPTION_COUNT - 1) return null;

  const options = shuffled(
    [correct, ...fakes].map((p) => ({
      key: optionKey(p),
      title: p.track.title,
      artists: p.track.creditedArtists.join(", "),
    }))
  );

  return { correct, options, correctKey };
}

function randomFrom<T>(pool: T[]): T | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * The correct answer's score is linear in how much of the 30s clock is left
 * when the pick is made - answering instantly scores MAX_POINTS, answering
 * right at the buzzer still scores the MIN_POINTS floor (never 0 for a
 * correct-but-slow answer; only a timeout/wrong pick scores 0).
 */
function pointsForRemaining(remainingMs: number): number {
  const frac = Math.max(0, Math.min(1, remainingMs / (ROUND_SECONDS * 1000)));
  return Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * frac);
}

/** Same official Spotify track embed Replay.tsx/Top25Fight.tsx use, but
 * clipped to a short height via an overflow-hidden wrapper so only the
 * scrub-bar strip is visible - Spotify's embed UI always shows cover
 * art/title/artist and there's no param to suppress that, so hiding it is
 * done in CSS, not via the embed's own options.
 * Tried `autoplay=1` (plus the iframe's `allow="autoplay"`) to start
 * playback automatically - verified via a headless Playwright check (both
 * with and without the browser's autoplay restrictions disabled entirely)
 * that Spotify's track embed does not actually honor that param, so real
 * autoplay isn't achievable here; the fix instead is making the real play
 * button fully clickable - see .playHitArea below, which overlays a
 * full-width invisible button aligned to the embed's own play button so the
 * whole clipped strip is clickable, not just the 1px sliver of the real
 * button that peeks into the crop. */
function HiddenSpotifyEmbed({ spotifyId }: { spotifyId: string }) {
  return (
    <div className={styles.embedClip}>
      <iframe
        key={spotifyId}
        className={styles.spotifyEmbed}
        src={`https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator`}
        width="100%"
        height="152"
        style={{ border: 0 }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title="Mystery track"
      />
    </div>
  );
}

export function GuessTheSong({ dataset }: GuessTheSongProps) {
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
  } = useMonthRange(availableMonths, "guess");

  // Which people's own picks are eligible to be drawn as the mystery track
  // (or used as a same-artist/same-genre fake option) - a plain checkmark
  // per person, defaulting to everyone selected, same
  // "everyone on by default" convention the genre filter uses. Unlike
  // Shared's 3-state PresenceFilter (which asks "did this person have this
  // SONG"), this is a simpler yes/no "is this person's pool in play at
  // all" - there's no meaningful "excluded" vs "any" distinction here, so a
  // plain checkbox set fits better than reusing the 3-state cycle control.
  const [includedPeople, setIncludedPeople] = usePersistedSetState(
    "top25tracker:guessIncludedPeople",
    () => dataset.people
  );

  function togglePerson(person: string) {
    setIncludedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(person)) next.delete(person);
      else next.add(person);
      return next;
    });
  }

  const pool = useMemo(() => {
    const items: PoolTrack[] = [];
    for (const list of dataset.lists) {
      if (!includedPeople.has(list.person)) continue;
      if (rangeOptions.startMonth && list.month < rangeOptions.startMonth) continue;
      if (rangeOptions.endMonth && list.month > rangeOptions.endMonth) continue;
      for (const track of list.tracks) {
        if (track.spotifyId) items.push({ track, person: list.person, month: list.month });
      }
    }
    return items;
  }, [dataset, includedPeople, rangeOptions.startMonth, rangeOptions.endMonth]);

  const [score, setScore] = useState(0);
  const [roundNum, setRoundNum] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [status, setStatus] = useState<RoundStatus>("playing");
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [lastPoints, setLastPoints] = useState(0);
  const [started, setStarted] = useState(false);
  const [noRound, setNoRound] = useState(false);

  const deadlineRef = useRef<number>(0);
  const [remainingMs, setRemainingMs] = useState(ROUND_SECONDS * 1000);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearRevealTimer() {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }

  function drawRound(nextRoundNum: number) {
    const r = buildRound(pool);
    if (!r) {
      setRound(null);
      setNoRound(true);
      return;
    }
    setNoRound(false);
    setRound(r);
    setRoundNum(nextRoundNum);
    setStatus("playing");
    setPickedKey(null);
    deadlineRef.current = Date.now() + ROUND_SECONDS * 1000;
    setRemainingMs(ROUND_SECONDS * 1000);
  }

  function startGame() {
    clearRevealTimer();
    setScore(0);
    setStarted(true);
    drawRound(1);
  }

  // Countdown tick, only while a round is actively being played.
  useEffect(() => {
    if (status !== "playing" || !round) return;
    const id = setInterval(() => {
      const left = deadlineRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setStatus("timeout");
        setLastPoints(0);
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [status, round]);

  // Auto-advance after a reveal pause, whether the round ended by pick or timeout.
  // score already reflects lastPoints by the time this runs (both setters
  // fire together in pick()), so just check score directly - no double-count.
  useEffect(() => {
    if (status !== "answered" && status !== "timeout") return;
    if (score >= WIN_SCORE) return;
    clearRevealTimer();
    revealTimerRef.current = setTimeout(() => {
      drawRound(roundNum + 1);
    }, REVEAL_MS);
    return clearRevealTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, score]);

  function pick(key: string) {
    if (status !== "playing" || !round) return;
    const left = Math.max(0, deadlineRef.current - Date.now());
    const correct = key === round.correctKey;
    const points = correct ? pointsForRemaining(left) : 0;
    setPickedKey(key);
    setLastPoints(points);
    setStatus("answered");
    setScore((s) => s + points);
  }

  const winner = score >= WIN_SCORE;
  const pctRemaining = (remainingMs / (ROUND_SECONDS * 1000)) * 100;

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Guess the Song</h2>
          <p className={styles.sub}>
            Listen, then pick the right title before the clock runs out. Faster correct answers
            score more. First to {WIN_SCORE} points wins.
          </p>
        </div>
      </div>

      <RangePicker
        months={availableMonths}
        startIndex={startIndex}
        endIndex={endIndex}
        lastIndex={lastIndex}
        availableYears={availableYears}
        onSliderChange={handleSliderChange}
        onPreset={applyPreset}
        onYear={applyYear}
      />

      <div className={styles.peopleRow} role="group" aria-label="Filter by whose songs are eligible">
        {dataset.people.map((person) => (
          <label key={person} className={styles.personCheckbox}>
            <input
              type="checkbox"
              checked={includedPeople.has(person)}
              onChange={() => togglePerson(person)}
            />
            {person}
          </label>
        ))}
      </div>

      {pool.length < OPTION_COUNT ? (
        <p className={styles.empty}>
          Not enough Spotify-matched songs in this time range to play - widen the range or
          include more people above.
        </p>
      ) : (
        <div className={styles.startRow}>
          <button type="button" className={styles.startButton} onClick={startGame}>
            {started ? "Restart" : "Start game"}
          </button>
          {started && <div className={styles.scoreDisplay}>Score: {score}</div>}
        </div>
      )}

      {started && noRound && (
        <p className={styles.empty}>
          Couldn't put together 4 distinct options from this pool - widen the time range and
          restart.
        </p>
      )}

      {started && winner && (
        <div className={styles.winnerBanner}>
          <div className={styles.winnerText}>You win!</div>
          <div className={styles.finalScore}>{score} points</div>
          <button type="button" className={styles.startButton} onClick={startGame}>
            Play again
          </button>
        </div>
      )}

      {started && !winner && round && (
        <div className={styles.game}>
          <div className={styles.timerRow}>
            <div className={styles.timerTrack}>
              <div
                className={styles.timerFill}
                style={{ width: `${pctRemaining}%` }}
                data-urgent={remainingMs < 8000}
              />
            </div>
            <div className={styles.timerLabel}>{Math.ceil(remainingMs / 1000)}s</div>
          </div>

          {round.correct.track.spotifyId && (
            <HiddenSpotifyEmbed spotifyId={round.correct.track.spotifyId} />
          )}

          <div className={styles.optionsGrid}>
            {round.options.map((opt) => {
              const isPicked = pickedKey === opt.key;
              const isCorrect = opt.key === round.correctKey;
              const revealed = status === "answered" || status === "timeout";
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={styles.optionButton}
                  disabled={status !== "playing"}
                  data-correct={revealed && isCorrect ? "true" : undefined}
                  data-wrong={revealed && isPicked && !isCorrect ? "true" : undefined}
                  onClick={() => pick(opt.key)}
                >
                  <span className={styles.optionTitle}>{opt.title}</span>
                  <span className={styles.optionArtists}>{opt.artists}</span>
                </button>
              );
            })}
          </div>

          {(status === "answered" || status === "timeout") && (
            <div className={styles.feedback}>
              {status === "timeout"
                ? "Time's up! +0"
                : pickedKey === round.correctKey
                  ? `Correct! +${lastPoints}`
                  : "Wrong! +0"}
            </div>
          )}

          <div className={styles.roundLabel}>Round {roundNum}</div>
        </div>
      )}
    </div>
  );
}
