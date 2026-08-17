"use client";

import { useEffect, useMemo, useState } from "react";

type Team = {
  name: string;
  players: string;
};

type CardCounts = {
  five: number;
  ten: number;
  fifteen: number;
  twenty: number;
  thirty: number;
};

type BonusCounts = {
  reale: number;
  realeSporco: number;
  super: number;
  superSporco: number;
  pulito: number;
  semipulito: number;
  sporco: number;
};

type Breakdown = {
  table: CardCounts;
  hand: CardCounts;
  bonuses: BonusCounts;
  closed: boolean;
  missedPot: boolean;
  adjustment: number;
};

type Round = {
  id: string;
  createdAt: string;
  scores: [number, number];
  breakdowns: [Breakdown, Breakdown];
};

type Game = {
  id: string;
  createdAt: string;
  target: number;
  teams: [Team, Team];
  rounds: Round[];
  draft: [Breakdown, Breakdown];
};

const ACTIVE_GAME_KEY = "burraco-punto-active-v1";
const ARCHIVE_KEY = "burraco-punto-archive-v1";

const CARD_VALUES: Array<{
  key: keyof CardCounts;
  label: string;
  hint: string;
  value: number;
}> = [
  { key: "five", label: "3—7", hint: "5 pt", value: 5 },
  { key: "ten", label: "8—K", hint: "10 pt", value: 10 },
  { key: "fifteen", label: "Assi", hint: "15 pt", value: 15 },
  { key: "twenty", label: "Pinelle", hint: "20 pt", value: 20 },
  { key: "thirty", label: "Jolly", hint: "30 pt", value: 30 },
];

const BONUS_VALUES: Array<{
  key: keyof BonusCounts;
  label: string;
  short: string;
  value: number;
}> = [
  { key: "reale", label: "Burraco reale", short: "Reale", value: 300 },
  {
    key: "realeSporco",
    label: "Burraco reale sporco",
    short: "Reale sporco",
    value: 250,
  },
  { key: "super", label: "Super burraco", short: "Super", value: 250 },
  {
    key: "superSporco",
    label: "Super burraco sporco",
    short: "Super sporco",
    value: 200,
  },
  { key: "pulito", label: "Burraco pulito", short: "Pulito", value: 200 },
  {
    key: "semipulito",
    label: "Burraco semipulito",
    short: "Semipulito",
    value: 150,
  },
  { key: "sporco", label: "Burraco sporco", short: "Sporco", value: 100 },
];

function emptyCards(): CardCounts {
  return { five: 0, ten: 0, fifteen: 0, twenty: 0, thirty: 0 };
}

function emptyBonuses(): BonusCounts {
  return {
    reale: 0,
    realeSporco: 0,
    super: 0,
    superSporco: 0,
    pulito: 0,
    semipulito: 0,
    sporco: 0,
  };
}

function emptyBreakdown(): Breakdown {
  return {
    table: emptyCards(),
    hand: emptyCards(),
    bonuses: emptyBonuses(),
    closed: false,
    missedPot: false,
    adjustment: 0,
  };
}

function pointsForCards(cards: CardCounts) {
  return CARD_VALUES.reduce(
    (total, card) => total + cards[card.key] * card.value,
    0,
  );
}

function pointsForBonuses(bonuses: BonusCounts) {
  return BONUS_VALUES.reduce(
    (total, bonus) => total + bonuses[bonus.key] * bonus.value,
    0,
  );
}

function calculateScore(breakdown: Breakdown) {
  return (
    pointsForCards(breakdown.table) -
    pointsForCards(breakdown.hand) +
    pointsForBonuses(breakdown.bonuses) +
    (breakdown.closed ? 100 : 0) -
    (breakdown.missedPot ? 100 : 0) +
    breakdown.adjustment
  );
}

function isBreakdownEmpty(breakdown: Breakdown) {
  return (
    pointsForCards(breakdown.table) === 0 &&
    pointsForCards(breakdown.hand) === 0 &&
    pointsForBonuses(breakdown.bonuses) === 0 &&
    !breakdown.closed &&
    !breakdown.missedPot &&
    breakdown.adjustment === 0
  );
}

function formatScore(score: number) {
  return new Intl.NumberFormat("it-IT").format(score);
}

function makeGame(
  teams: [Team, Team],
  target: number,
): Game {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    target,
    teams,
    rounds: [],
    draft: [emptyBreakdown(), emptyBreakdown()],
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function Stepper({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={`stepper${compact ? " stepper--compact" : ""}`}>
      <button
        type="button"
        aria-label={`Togli uno da ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
      >
        −
      </button>
      <output aria-live="polite" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button
        type="button"
        aria-label={`Aggiungi uno a ${label}`}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function CardCounter({
  title,
  description,
  counts,
  negative,
  onChange,
}: {
  title: string;
  description: string;
  counts: CardCounts;
  negative?: boolean;
  onChange: (counts: CardCounts) => void;
}) {
  const subtotal = pointsForCards(counts);

  return (
    <section className="count-section">
      <div className="section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <strong className={negative ? "negative" : "positive"}>
          {negative && subtotal > 0 ? "−" : "+"}
          {subtotal}
        </strong>
      </div>
      <div className="card-counter-grid">
        {CARD_VALUES.map((card) => (
          <div className="card-counter" key={card.key}>
            <div>
              <span>{card.label}</span>
              <small>{card.hint}</small>
            </div>
            <Stepper
              value={counts[card.key]}
              label={`${title}, ${card.label}`}
              onChange={(value) => onChange({ ...counts, [card.key]: value })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function Setup({ onStart }: { onStart: (game: Game) => void }) {
  const [teamA, setTeamA] = useState<Team>({ name: "Coppia A", players: "" });
  const [teamB, setTeamB] = useState<Team>({ name: "Coppia B", players: "" });
  const [target, setTarget] = useState(2005);

  return (
    <main className="setup-shell">
      <section className="setup-copy">
        <p className="eyebrow">Segnapunti per le sere d’estate</p>
        <h1>
          Le carte sul tavolo.<br />
          <em>I conti a noi.</em>
        </h1>
        <p className="setup-lede">
          Conta carte, burraco e penalità con pochi tocchi. La classifica si
          aggiorna da sola, smazzata dopo smazzata.
        </p>
        <div className="setup-promise" aria-label="Caratteristiche">
          <span>Funziona offline</span>
          <span>Nessun account</span>
          <span>Zero pubblicità</span>
        </div>
      </section>

      <form
        className="setup-card"
        onSubmit={(event) => {
          event.preventDefault();
          onStart(
            makeGame(
              [
                { ...teamA, name: teamA.name.trim() || "Coppia A" },
                { ...teamB, name: teamB.name.trim() || "Coppia B" },
              ],
              target,
            ),
          );
        }}
      >
        <div className="setup-card-heading">
          <span className="card-suit" aria-hidden="true">♣</span>
          <div>
            <p className="eyebrow">Nuova partita</p>
            <h2>Chi si sfida?</h2>
          </div>
        </div>

        <div className="team-setup team-setup--a">
          <label>
            Nome coppia
            <input
              value={teamA.name}
              onChange={(event) => setTeamA({ ...teamA, name: event.target.value })}
              autoComplete="off"
            />
          </label>
          <label>
            Giocatori <small>facoltativo</small>
            <input
              value={teamA.players}
              onChange={(event) =>
                setTeamA({ ...teamA, players: event.target.value })
              }
              placeholder="Alessio e Giulia"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="versus" aria-hidden="true"><span>VS</span></div>

        <div className="team-setup team-setup--b">
          <label>
            Nome coppia
            <input
              value={teamB.name}
              onChange={(event) => setTeamB({ ...teamB, name: event.target.value })}
              autoComplete="off"
            />
          </label>
          <label>
            Giocatori <small>facoltativo</small>
            <input
              value={teamB.players}
              onChange={(event) =>
                setTeamB({ ...teamB, players: event.target.value })
              }
              placeholder="Marco e Sara"
              autoComplete="off"
            />
          </label>
        </div>

        <fieldset className="target-choice">
          <legend>Si gioca fino a</legend>
          <div>
            {[1005, 1505, 2005].map((value) => (
              <button
                key={value}
                type="button"
                className={target === value ? "selected" : ""}
                onClick={() => setTarget(value)}
              >
                {formatScore(value)}
              </button>
            ))}
          </div>
        </fieldset>

        <button className="primary-button" type="submit">
          Inizia la partita <span aria-hidden="true">→</span>
        </button>
        <p className="local-note">I dati restano soltanto su questo dispositivo.</p>
      </form>
    </main>
  );
}

function Scoreboard({
  game,
  totals,
  activeTeam,
  onSelect,
}: {
  game: Game;
  totals: [number, number];
  activeTeam: 0 | 1;
  onSelect: (team: 0 | 1) => void;
}) {
  return (
    <section className="scoreboard" aria-label="Punteggio della partita">
      {game.teams.map((team, index) => {
        const teamIndex = index as 0 | 1;
        const progress = Math.max(
          0,
          Math.min(100, (totals[teamIndex] / game.target) * 100),
        );
        return (
          <button
            type="button"
            className={`score-team score-team--${teamIndex === 0 ? "a" : "b"}${
              activeTeam === teamIndex ? " active" : ""
            }`}
            key={team.name}
            onClick={() => onSelect(teamIndex)}
            aria-pressed={activeTeam === teamIndex}
          >
            <span className="score-team-name">{team.name}</span>
            <strong>{formatScore(totals[teamIndex])}</strong>
            <span className="score-target">su {formatScore(game.target)}</span>
            <span className="progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </span>
          </button>
        );
      })}
    </section>
  );
}

function RoundEditor({
  team,
  breakdown,
  onChange,
}: {
  team: Team;
  breakdown: Breakdown;
  onChange: (breakdown: Breakdown) => void;
}) {
  const score = calculateScore(breakdown);
  const bonusPoints = pointsForBonuses(breakdown.bonuses);

  return (
    <div className="round-editor">
      <div className="editor-intro">
        <div>
          <p className="eyebrow">Smazzata in corso</p>
          <h2>{team.name}</h2>
          {team.players && <p>{team.players}</p>}
        </div>
        <div className="live-score" aria-label={`Parziale ${score} punti`}>
          <small>Parziale</small>
          <strong>{score > 0 ? "+" : ""}{formatScore(score)}</strong>
        </div>
      </div>

      <CardCounter
        title="Carte a terra"
        description="Quante carte per ogni valore?"
        counts={breakdown.table}
        onChange={(table) => onChange({ ...breakdown, table })}
      />

      <CardCounter
        title="Carte rimaste in mano"
        description="Vengono sottratte in automatico."
        counts={breakdown.hand}
        negative
        onChange={(hand) => onChange({ ...breakdown, hand })}
      />

      <section className="count-section">
        <div className="section-heading">
          <div>
            <h3>Burraco</h3>
            <p>Aggiungi quelli completati dalla coppia.</p>
          </div>
          <strong className="positive">+{bonusPoints}</strong>
        </div>
        <div className="bonus-grid">
          {BONUS_VALUES.map((bonus) => (
            <div className="bonus-counter" key={bonus.key}>
              <div>
                <span>{bonus.short}</span>
                <small>+{bonus.value}</small>
              </div>
              <Stepper
                compact
                value={breakdown.bonuses[bonus.key]}
                label={bonus.label}
                onChange={(value) =>
                  onChange({
                    ...breakdown,
                    bonuses: { ...breakdown.bonuses, [bonus.key]: value },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="count-section switches-section">
        <label className="switch-row">
          <span>
            <strong>Chiusura</strong>
            <small>Bonus di 100 punti</small>
          </span>
          <input
            type="checkbox"
            checked={breakdown.closed}
            onChange={(event) =>
              onChange({ ...breakdown, closed: event.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>
            <strong>Pozzetto non preso</strong>
            <small>Penalità di 100 punti</small>
          </span>
          <input
            type="checkbox"
            checked={breakdown.missedPot}
            onChange={(event) =>
              onChange({ ...breakdown, missedPot: event.target.checked })
            }
          />
        </label>
        <label className="adjustment-row">
          <span>
            <strong>Correzione manuale</strong>
            <small>Per penalità o regole di casa</small>
          </span>
          <input
            type="number"
            inputMode="numeric"
            step="5"
            value={breakdown.adjustment || ""}
            placeholder="0"
            aria-label="Correzione manuale del punteggio"
            onChange={(event) =>
              onChange({
                ...breakdown,
                adjustment: Number(event.target.value) || 0,
              })
            }
          />
        </label>
      </section>
    </div>
  );
}

function History({
  game,
  totals,
  archive,
  onUndo,
  onFinish,
}: {
  game: Game;
  totals: [number, number];
  archive: Game[];
  onUndo: () => void;
  onFinish: () => void;
}) {
  const cumulative = game.rounds.reduce<Array<[number, number]>>(
    (items, round) => {
      const previous = items.at(-1) ?? [0, 0];
      items.push([
        previous[0] + round.scores[0],
        previous[1] + round.scores[1],
      ]);
      return items;
    },
    [],
  );

  return (
    <div className="history-view">
      <section className="history-hero">
        <p className="eyebrow">Diario della partita</p>
        <h2>{game.rounds.length ? `${game.rounds.length} smazzate giocate` : "Si parte da zero"}</h2>
        <p>Ogni punteggio resta salvato su questo dispositivo.</p>
      </section>

      {game.rounds.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">♢</span>
          <h3>Nessuna smazzata ancora</h3>
          <p>Vai su “Partita” per inserire il primo punteggio.</p>
        </div>
      ) : (
        <section className="round-list" aria-label="Storico smazzate">
          <div className="round-list-head">
            <span>Smazzata</span>
            <span>{game.teams[0].name}</span>
            <span>{game.teams[1].name}</span>
          </div>
          {[...game.rounds].reverse().map((round, reversedIndex) => {
            const originalIndex = game.rounds.length - 1 - reversedIndex;
            return (
              <div className="round-row" key={round.id}>
                <span>#{originalIndex + 1}</span>
                <span>
                  <strong>{round.scores[0] > 0 ? "+" : ""}{round.scores[0]}</strong>
                  <small>{formatScore(cumulative[originalIndex][0])} tot.</small>
                </span>
                <span>
                  <strong>{round.scores[1] > 0 ? "+" : ""}{round.scores[1]}</strong>
                  <small>{formatScore(cumulative[originalIndex][1])} tot.</small>
                </span>
              </div>
            );
          })}
          <button type="button" className="text-button" onClick={onUndo}>
            Annulla ultima smazzata
          </button>
        </section>
      )}

      <section className="match-summary">
        <div>
          <small>Risultato attuale</small>
          <strong>{formatScore(totals[0])} — {formatScore(totals[1])}</strong>
        </div>
        <button type="button" className="secondary-button" onClick={onFinish}>
          Termina e archivia
        </button>
      </section>

      {archive.length > 0 && (
        <section className="archive-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Partite precedenti</p>
              <h3>Archivio del tavolo</h3>
            </div>
          </div>
          {archive.slice(0, 5).map((archivedGame) => {
            const archivedTotals = archivedGame.rounds.reduce<[number, number]>(
              (scores, round) => [
                scores[0] + round.scores[0],
                scores[1] + round.scores[1],
              ],
              [0, 0],
            );
            return (
              <div className="archive-row" key={archivedGame.id}>
                <div>
                  <strong>{archivedGame.teams[0].name} · {archivedGame.teams[1].name}</strong>
                  <small>
                    {new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(archivedGame.createdAt))}
                  </small>
                </div>
                <strong>{formatScore(archivedTotals[0])} — {formatScore(archivedTotals[1])}</strong>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Rules() {
  return (
    <div className="rules-view">
      <section className="history-hero">
        <p className="eyebrow">Come facciamo i conti</p>
        <h2>Regole chiare, niente discussioni.</h2>
        <p>Il profilo predefinito segue il Codice di gara FITAB.</p>
      </section>

      <section className="rules-card">
        <h3>Valore delle carte</h3>
        <div className="rule-values">
          {CARD_VALUES.map((card) => (
            <div key={card.key}><span>{card.label}</span><strong>{card.value}</strong></div>
          ))}
        </div>
      </section>

      <section className="rules-card">
        <h3>Formula della smazzata</h3>
        <p className="formula">
          carte a terra <b>−</b> carte in mano <b>+</b> burraco <b>+</b> chiusura <b>−</b> penalità
        </p>
        <p>
          Se il pozzetto è stato preso ma non giocato, conta le sue carte nella sezione
          “Carte rimaste in mano”.
        </p>
      </section>

      <section className="rules-card">
        <h3>Bonus burraco</h3>
        <div className="bonus-rules">
          {BONUS_VALUES.map((bonus) => (
            <div key={bonus.key}><span>{bonus.label}</span><strong>+{bonus.value}</strong></div>
          ))}
          <div><span>Chiusura</span><strong>+100</strong></div>
          <div><span>Pozzetto non preso</span><strong>−100</strong></div>
        </div>
      </section>

      <a
        className="source-link"
        href="https://www.fitab.it/documenti/2025F00003.pdf"
        target="_blank"
        rel="noreferrer"
      >
        Consulta il Codice di gara FITAB <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [archive, setArchive] = useState<Game[]>([]);
  const [activeTeam, setActiveTeam] = useState<0 | 1>(0);
  const [tab, setTab] = useState<"game" | "history" | "rules">("game");
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    setGame(readJson<Game | null>(ACTIVE_GAME_KEY, null));
    setArchive(readJson<Game[]>(ARCHIVE_KEY, []));
    setHydrated(true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (game) {
      window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(game));
    } else {
      window.localStorage.removeItem(ACTIVE_GAME_KEY);
    }
  }, [game, hydrated]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
    }
  }, [archive, hydrated]);

  const totals = useMemo<[number, number]>(() => {
    if (!game) return [0, 0];
    return game.rounds.reduce<[number, number]>(
      (scores, round) => [
        scores[0] + round.scores[0],
        scores[1] + round.scores[1],
      ],
      [0, 0],
    );
  }, [game]);

  if (!hydrated) {
    return (
      <main className="loading-shell" role="status">
        <span className="brand-mark" aria-hidden="true">B<span>•</span></span>
        <p>Prepariamo il tavolo…</p>
      </main>
    );
  }

  if (!game) {
    return (
      <>
        <header className="landing-header">
          <a className="brand" href="#top" aria-label="Burraco Punto, home">
            <span className="brand-mark" aria-hidden="true">B<span>•</span></span>
            <span>Burraco <b>Punto</b></span>
          </a>
        </header>
        <Setup
          onStart={(newGame) => {
            setGame(newGame);
            setTab("game");
          }}
        />
      </>
    );
  }

  const draftScores: [number, number] = [
    calculateScore(game.draft[0]),
    calculateScore(game.draft[1]),
  ];
  const canSave = !isBreakdownEmpty(game.draft[0]) || !isBreakdownEmpty(game.draft[1]);
  const winnerIndex =
    totals[0] >= game.target || totals[1] >= game.target
      ? totals[0] === totals[1]
        ? null
        : totals[0] > totals[1]
          ? 0
          : 1
      : null;

  function updateDraft(teamIndex: 0 | 1, breakdown: Breakdown) {
    if (!game) return;
    const draft: [Breakdown, Breakdown] = [...game.draft];
    draft[teamIndex] = breakdown;
    setGame({ ...game, draft });
  }

  function saveRound() {
    if (!game || !canSave) return;
    const round: Round = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      scores: draftScores,
      breakdowns: game.draft,
    };
    setGame({
      ...game,
      rounds: [...game.rounds, round],
      draft: [emptyBreakdown(), emptyBreakdown()],
    });
    setActiveTeam(0);
    setSavedMessage(true);
    window.setTimeout(() => setSavedMessage(false), 2400);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function undoRound() {
    if (!game || game.rounds.length === 0) return;
    setGame({ ...game, rounds: game.rounds.slice(0, -1) });
  }

  function finishGame() {
    if (!game) return;
    if (game.rounds.length === 0) {
      if (!window.confirm("Questa partita non ha ancora smazzate. Vuoi eliminarla?")) return;
      setGame(null);
      return;
    }
    if (!window.confirm("Archiviare questa partita e prepararne una nuova?")) return;
    const finished = { ...game, draft: [emptyBreakdown(), emptyBreakdown()] as [Breakdown, Breakdown] };
    setArchive((current) => [finished, ...current].slice(0, 30));
    setGame(null);
    setTab("game");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="Burraco Punto, torna in alto">
          <span className="brand-mark" aria-hidden="true">B<span>•</span></span>
          <span>Burraco <b>Punto</b></span>
        </a>
        <span className="round-pill">Smazzata {game.rounds.length + 1}</span>
      </header>

      <main className="game-shell" id="top">
        <Scoreboard
          game={game}
          totals={totals}
          activeTeam={activeTeam}
          onSelect={(team) => {
            setActiveTeam(team);
            setTab("game");
          }}
        />

        {winnerIndex !== null && (
          <section className="winner-banner" role="status">
            <span aria-hidden="true">★</span>
            <div>
              <strong>{game.teams[winnerIndex].name} ha superato {formatScore(game.target)}!</strong>
              <p>Potete archiviare la partita oppure continuare a giocare.</p>
            </div>
            <button type="button" onClick={finishGame}>Archivia</button>
          </section>
        )}

        <nav className="tab-bar" aria-label="Sezioni dell'app">
          <button className={tab === "game" ? "active" : ""} onClick={() => setTab("game")}>Partita</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            Storico {game.rounds.length > 0 && <span>{game.rounds.length}</span>}
          </button>
          <button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>Regole</button>
        </nav>

        {tab === "game" && (
          <>
            <RoundEditor
              team={game.teams[activeTeam]}
              breakdown={game.draft[activeTeam]}
              onChange={(breakdown) => updateDraft(activeTeam, breakdown)}
            />

            <section className="round-recap">
              <div>
                <span>{game.teams[0].name}</span>
                <strong>{draftScores[0] > 0 ? "+" : ""}{draftScores[0]}</strong>
              </div>
              <span className="recap-divider">questa smazzata</span>
              <div>
                <span>{game.teams[1].name}</span>
                <strong>{draftScores[1] > 0 ? "+" : ""}{draftScores[1]}</strong>
              </div>
            </section>

            <div className="save-bar">
              <p>
                <span aria-hidden="true">✓</span>
                La bozza viene salvata a ogni tocco
              </p>
              <button type="button" className="primary-button" disabled={!canSave} onClick={saveRound}>
                Salva smazzata <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}

        {tab === "history" && (
          <History
            game={game}
            totals={totals}
            archive={archive}
            onUndo={undoRound}
            onFinish={finishGame}
          />
        )}

        {tab === "rules" && <Rules />}
      </main>

      {savedMessage && (
        <div className="toast" role="status">Smazzata salvata ✓</div>
      )}
    </div>
  );
}
