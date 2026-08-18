"use client";

import { useEffect, useMemo, useState } from "react";

type Team = {
  name: string;
  players: string;
};

type GameMode = "1v1" | "2v2" | "3p";

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

type BonusRules = Record<
  keyof BonusCounts,
  { enabled: boolean; value: number }
>;

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
  scores: number[];
  breakdowns: Breakdown[];
  soloPlayer?: number;
  sideScores?: number[];
};

type Game = {
  id: string;
  createdAt: string;
  mode: GameMode;
  target: number;
  teams: Team[];
  rounds: Round[];
  draft: Breakdown[];
  soloPlayer: number;
  bonusRules: BonusRules;
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
  description: string;
}> = [
  {
    key: "reale",
    label: "Burraco reale",
    short: "Reale",
    value: 300,
    description:
      "Sequenza dall’Asso al Re oppure dal 2 all’Asso, senza matta e con il 2 naturale dello stesso seme.",
  },
  {
    key: "realeSporco",
    label: "Burraco reale sporco",
    short: "Reale sporco",
    value: 250,
    description:
      "Sequenza dall’Asso al Re oppure dal 2 all’Asso, con il 2 naturale dello stesso seme e una matta.",
  },
  {
    key: "super",
    label: "Super burraco",
    short: "Super",
    value: 250,
    description: "Combinazione di otto carte dello stesso valore, senza alcuna matta.",
  },
  {
    key: "superSporco",
    label: "Super burraco sporco",
    short: "Super sporco",
    value: 200,
    description:
      "Combinazione di otto carte dello stesso valore accompagnate da una matta.",
  },
  {
    key: "pulito",
    label: "Burraco pulito",
    short: "Pulito",
    value: 200,
    description:
      "Almeno sette carte senza matte. La pinella è ammessa soltanto quando vale come 2 naturale.",
  },
  {
    key: "semipulito",
    label: "Burraco semipulito",
    short: "Semipulito",
    value: 150,
    description:
      "Sequenza con una matta prima o dopo almeno sette carte, oppure combinazione di almeno otto carte compresa la matta.",
  },
  {
    key: "sporco",
    label: "Burraco sporco",
    short: "Sporco",
    value: 100,
    description:
      "Almeno sette carte con una matta che non stia svolgendo il ruolo di 2 naturale.",
  },
];

function makeBonusRules(enableAll = false): BonusRules {
  return Object.fromEntries(
    BONUS_VALUES.map((bonus) => [
      bonus.key,
      {
        enabled: enableAll || bonus.key === "pulito" || bonus.key === "sporco",
        value: bonus.value,
      },
    ]),
  ) as BonusRules;
}

function normalizeBonusRules(rules?: Partial<BonusRules>): BonusRules {
  const legacyGame = !rules;
  return Object.fromEntries(
    BONUS_VALUES.map((bonus) => {
      const storedRule = rules?.[bonus.key];
      return [
        bonus.key,
        {
          enabled: storedRule?.enabled ?? legacyGame,
          value: Number.isFinite(storedRule?.value)
            ? Math.max(0, storedRule?.value ?? bonus.value)
            : bonus.value,
        },
      ];
    }),
  ) as BonusRules;
}

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

function pointsForBonuses(
  bonuses: BonusCounts,
  bonusRules: BonusRules = makeBonusRules(true),
) {
  return BONUS_VALUES.reduce(
    (total, bonus) =>
      total +
      (bonusRules[bonus.key].enabled
        ? bonuses[bonus.key] * bonusRules[bonus.key].value
        : 0),
    0,
  );
}

function calculateScore(
  breakdown: Breakdown,
  bonusRules: BonusRules = makeBonusRules(true),
) {
  return (
    pointsForCards(breakdown.table) -
    pointsForCards(breakdown.hand) +
    pointsForBonuses(breakdown.bonuses, bonusRules) +
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

function modeLabel(mode: GameMode) {
  if (mode === "3p") return "3 giocatori · 18 + 11";
  return mode === "2v2" ? "2 vs 2" : "1 vs 1";
}

function defaultTeams(mode: GameMode): Team[] {
  if (mode === "2v2") {
    return [
      { name: "Coppia A", players: "" },
      { name: "Coppia B", players: "" },
    ];
  }

  const count = mode === "3p" ? 3 : 2;
  return Array.from({ length: count }, (_, index) => ({
    name: `Giocatore ${index + 1}`,
    players: "",
  }));
}

function makeGame(
  mode: GameMode,
  teams: Team[],
  target: number,
  bonusRules: BonusRules,
): Game {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode,
    target,
    teams,
    rounds: [],
    draft: Array.from({ length: mode === "3p" ? 2 : teams.length }, () => emptyBreakdown()),
    soloPlayer: 0,
    bonusRules: normalizeBonusRules(bonusRules),
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

function normalizeGame(game: Game | null): Game | null {
  if (!game || !Array.isArray(game.teams) || game.teams.length < 2) return null;
  const storedMode = game.mode as GameMode | "1v1v1" | undefined;
  const mode: GameMode = storedMode === "1v1v1"
    ? "3p"
    : storedMode ??
    (game.teams.length === 3
      ? "3p"
      : game.teams.some((team) => team.players || /^coppia\b/i.test(team.name))
        ? "2v2"
        : "1v1");
  const draftLength = mode === "3p" ? 2 : game.teams.length;
  const soloPlayer = Number.isInteger(game.soloPlayer) && game.soloPlayer >= 0 && game.soloPlayer < 3
    ? game.soloPlayer
    : 0;
  return {
    ...game,
    mode,
    soloPlayer,
    bonusRules: normalizeBonusRules(game.bonusRules),
    draft: Array.from({ length: draftLength }, (_, index) =>
      storedMode === "1v1v1" ? emptyBreakdown() : (game.draft?.[index] ?? emptyBreakdown()),
    ),
    rounds: (game.rounds ?? []).map((round) => ({
      ...round,
      scores: game.teams.map((_, index) => round.scores?.[index] ?? 0),
      breakdowns: Array.from(
        { length: draftLength },
        (_, index) => round.breakdowns?.[index] ?? emptyBreakdown(),
      ),
    })),
  };
}

function getThreePlayerSides(game: Game): Team[] {
  const solo = game.teams[game.soloPlayer];
  const pair = game.teams.filter((_, index) => index !== game.soloPlayer);
  return [
    { name: solo.name, players: "Pozzetto da 18 · gioca da solo" },
    { name: "Coppia", players: `${pair[0].name} + ${pair[1].name} · pozzetto da 11` },
  ];
}

function distributeThreePlayerScores(game: Game, sideScores: number[]) {
  return game.teams.map((_, index) =>
    index === game.soloPlayer ? (sideScores[0] ?? 0) : (sideScores[1] ?? 0) / 2,
  );
}

function getGameTotals(game: Game): number[] {
  return game.rounds.reduce<number[]>(
    (totals, round) => totals.map((total, index) => total + (round.scores[index] ?? 0)),
    game.teams.map(() => 0),
  );
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function downloadGameSummary(game: Game) {
  const totals = getGameTotals(game);
  const width = 1080;
  const rowHeight = 62;
  const tableTop = 580;
  const firstRoundBaseline = tableTop + 92;
  const lastRoundBaseline = firstRoundBaseline + Math.max(0, game.rounds.length - 1) * rowHeight;
  const height = Math.max(1350, lastRoundBaseline + 150);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;

  const colors = ["#153f32", "#e96049", "#c8942d"];
  context.fillStyle = "#f4efe5";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#153f32";
  context.fillRect(0, 0, width, 250);
  context.fillStyle = "#ffffff";
  context.font = "700 58px system-ui, sans-serif";
  context.fillText("Segnapunti Burraco", 70, 100);
  context.font = "400 28px system-ui, sans-serif";
  context.fillStyle = "rgba(255,255,255,.72)";
  const date = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(game.createdAt));
  context.fillText(`${date} · ${modeLabel(game.mode)} · obiettivo ${formatScore(game.target)}`, 70, 158);
  context.fillText(`${game.rounds.length} smazzate`, 70, 205);

  const gap = 18;
  const cardWidth = (width - 140 - gap * (game.teams.length - 1)) / game.teams.length;
  game.teams.forEach((team, index) => {
    const x = 70 + index * (cardWidth + gap);
    context.fillStyle = "#fffdf8";
    drawRoundedRect(context, x, 300, cardWidth, 210, 26);
    context.fillStyle = colors[index] ?? colors[0];
    context.fillRect(x, 300, cardWidth, 12);
    context.font = "700 25px system-ui, sans-serif";
    context.fillText(team.name.slice(0, 20), x + 24, 365, cardWidth - 48);
    if (team.players) {
      context.fillStyle = "#68776f";
      context.font = "400 18px system-ui, sans-serif";
      context.fillText(team.players.slice(0, 28), x + 24, 398, cardWidth - 48);
    }
    context.fillStyle = "#17352c";
    context.font = "700 62px system-ui, sans-serif";
    context.fillText(formatScore(totals[index]), x + 24, 475, cardWidth - 48);
  });

  const labelWidth = 130;
  const scoreWidth = (width - 140 - labelWidth) / game.teams.length;
  context.fillStyle = "#17352c";
  context.font = "700 30px system-ui, sans-serif";
  context.fillText("Smazzate", 70, tableTop - 24);
  context.font = "700 18px system-ui, sans-serif";
  context.fillStyle = "#68776f";
  game.teams.forEach((team, index) => {
    context.textAlign = "right";
    context.fillText(
      team.name.slice(0, 14),
      70 + labelWidth + scoreWidth * (index + 1) - 10,
      tableTop + 22,
    );
  });
  context.textAlign = "left";

  game.rounds.forEach((round, roundIndex) => {
    const y = firstRoundBaseline + roundIndex * rowHeight;
    if (roundIndex % 2 === 0) {
      context.fillStyle = "#ebe5da";
      drawRoundedRect(context, 70, y - 35, width - 140, 52, 10);
    }
    context.fillStyle = "#68776f";
    context.font = "600 19px system-ui, sans-serif";
    const soloLabel = game.mode === "3p" && round.soloPlayer !== undefined
      ? ` · ${game.teams[round.soloPlayer]?.name ?? ""} solo`
      : "";
    context.fillText(`#${roundIndex + 1}${soloLabel}`, 88, y);
    round.scores.forEach((score, index) => {
      context.fillStyle = "#17352c";
      context.font = "700 22px system-ui, sans-serif";
      context.textAlign = "right";
      context.fillText(
        `${score > 0 ? "+" : ""}${formatScore(score)}`,
        70 + labelWidth + scoreWidth * (index + 1) - 10,
        y,
      );
    });
    context.textAlign = "left";
  });

  context.fillStyle = "#68776f";
  context.font = "400 18px system-ui, sans-serif";
  context.fillText("Generato con Segnapunti Burraco", 70, height - 60);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `burraco-${safeFilename(game.teams.map((team) => team.name).join("-")) || "partita"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
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

function Setup({
  archive,
  onStart,
}: {
  archive: Game[];
  onStart: (game: Game) => void;
}) {
  const [mode, setMode] = useState<GameMode>("2v2");
  const [teams, setTeams] = useState<Team[]>(defaultTeams("2v2"));
  const [target, setTarget] = useState(2005);
  const [bonusRules, setBonusRules] = useState<BonusRules>(() => makeBonusRules());

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    setTeams(defaultTeams(nextMode));
  }

  function updateTeam(index: number, patch: Partial<Team>) {
    setTeams((current) =>
      current.map((team, teamIndex) =>
        teamIndex === index ? { ...team, ...patch } : team,
      ),
    );
  }

  return (
    <main className="setup-shell">
      <section className="setup-copy">
        <h1>Segnapunti Burraco</h1>
        <p className="setup-lede">
          Scegli la modalità, inserisci i nomi e inizia.
        </p>
      </section>

      <form
        className="setup-card"
        onSubmit={(event) => {
          event.preventDefault();
          onStart(
            makeGame(
              mode,
              teams.map((team, index) => ({
                ...team,
                name:
                  team.name.trim() ||
                  (mode === "2v2" ? `Coppia ${String.fromCharCode(65 + index)}` : `Giocatore ${index + 1}`),
              })),
              target,
              bonusRules,
            ),
          );
        }}
      >
        <div className="setup-card-heading">
          <h2>Nuova partita</h2>
        </div>

        <fieldset className="mode-choice">
          <legend>Modalità</legend>
          <div>
            {([
              ["1v1", "1 vs 1"],
              ["2v2", "2 vs 2"],
              ["3p", "3 giocatori"],
            ] as Array<[GameMode, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={mode === value ? "selected" : ""}
                onClick={() => changeMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {mode === "3p" && (
          <p className="mode-note">
            Pozzetti da 18 e 11: chi prende il primo gioca da solo, gli altri due in coppia.
          </p>
        )}

        <div className="team-setup-list">
          {teams.map((team, index) => (
            <div
              className={`team-setup team-setup--${index}${mode !== "2v2" ? " team-setup--single" : ""}`}
              key={`${mode}-${index}`}
            >
              <label>
                {mode === "2v2" ? "Nome coppia" : `Giocatore ${index + 1}`}
                <input
                  value={team.name}
                  onChange={(event) => updateTeam(index, { name: event.target.value })}
                  autoComplete="off"
                />
              </label>
              {mode === "2v2" && (
                <label>
                  Componenti <small>facoltativo</small>
                  <input
                    value={team.players}
                    onChange={(event) => updateTeam(index, { players: event.target.value })}
                    placeholder={index === 0 ? "Alessio e Giulia" : "Marco e Sara"}
                    autoComplete="off"
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        <fieldset className="bonus-setup">
          <legend>Tipi di burraco</legend>
          <p>Attiva quelli che usate e imposta il relativo punteggio.</p>
          <div className="bonus-setup-list">
            {BONUS_VALUES.map((bonus) => {
              const rule = bonusRules[bonus.key];
              return (
                <div className={`bonus-setup-row${rule.enabled ? " enabled" : ""}`} key={bonus.key}>
                  <label className="bonus-enable">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) =>
                        setBonusRules((current) => ({
                          ...current,
                          [bonus.key]: { ...current[bonus.key], enabled: event.target.checked },
                        }))
                      }
                    />
                    <span>{bonus.label}</span>
                  </label>
                  <label className="bonus-points">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="5"
                      disabled={!rule.enabled}
                      value={rule.value}
                      aria-label={`Punti per ${bonus.label}`}
                      onChange={(event) =>
                        setBonusRules((current) => ({
                          ...current,
                          [bonus.key]: {
                            ...current[bonus.key],
                            value: Math.max(0, Number(event.target.value) || 0),
                          },
                        }))
                      }
                    />
                    <span>punti</span>
                  </label>
                  <details className="bonus-description">
                    <summary>Che cos’è</summary>
                    <p>{bonus.description}</p>
                  </details>
                </div>
              );
            })}
          </div>
        </fieldset>

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
          <label className="custom-target">
            Oppure inserisci un obiettivo personalizzato
            <input
              type="number"
              inputMode="numeric"
              min="100"
              step="5"
              value={target}
              onChange={(event) => setTarget(Math.max(100, Number(event.target.value) || 100))}
            />
          </label>
        </fieldset>

        <button className="primary-button" type="submit">
          Inizia la partita <span aria-hidden="true">→</span>
        </button>
        <p className="local-note">Partita e storico vengono salvati su questo dispositivo.</p>
      </form>

      {archive.length > 0 && (
        <section className="setup-archive">
          <h2>Partite precedenti</h2>
          {archive.slice(0, 5).map((archivedGame) => (
            <div className="archive-row" key={archivedGame.id}>
              <div>
                <strong>{archivedGame.teams.map((team) => team.name).join(" · ")}</strong>
                <small>{getGameTotals(archivedGame).map(formatScore).join(" — ")}</small>
              </div>
              <button
                type="button"
                className="download-button"
                onClick={() => downloadGameSummary(archivedGame)}
              >
                Scarica PNG
              </button>
            </div>
          ))}
        </section>
      )}
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
  totals: number[];
  activeTeam: number;
  onSelect: (team: number) => void;
}) {
  return (
    <section
      className={`scoreboard scoreboard--${game.teams.length}`}
      aria-label="Punteggio della partita"
    >
      {game.teams.map((team, index) => {
        const progress = Math.max(
          0,
          Math.min(100, (totals[index] / game.target) * 100),
        );
        return (
          <button
            type="button"
            className={`score-team score-team--${index}${
              activeTeam === index ? " active" : ""
            }`}
            key={`${team.name}-${index}`}
            onClick={() => onSelect(index)}
            disabled={game.mode === "3p"}
            aria-pressed={game.mode === "3p" ? undefined : activeTeam === index}
          >
            <span className="score-team-name">{team.name}</span>
            <strong>{formatScore(totals[index])}</strong>
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
  bonusRules,
  onChange,
}: {
  team: Team;
  breakdown: Breakdown;
  bonusRules: BonusRules;
  onChange: (breakdown: Breakdown) => void;
}) {
  const score = calculateScore(breakdown, bonusRules);
  const bonusPoints = pointsForBonuses(breakdown.bonuses, bonusRules);
  const enabledBonuses = BONUS_VALUES.filter(
    (bonus) => bonusRules[bonus.key].enabled,
  );

  return (
    <div className="round-editor">
      <div className="editor-intro">
        <div>
          <p className="eyebrow">Conteggio smazzata</p>
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
            <p>Aggiungi quelli completati.</p>
          </div>
          <strong className="positive">+{bonusPoints}</strong>
        </div>
        <div className="bonus-grid">
          {enabledBonuses.map((bonus) => (
            <div className="bonus-counter" key={bonus.key}>
              <div>
                <span>{bonus.short}</span>
                <small>+{bonusRules[bonus.key].value}</small>
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
        {enabledBonuses.length === 0 && (
          <p className="no-bonuses">Nessun tipo di burraco attivo per questa partita.</p>
        )}
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
  totals: number[];
  archive: Game[];
  onUndo: () => void;
  onFinish: () => void;
}) {
  const cumulative = game.rounds.reduce<number[][]>(
    (items, round) => {
      const previous = items.at(-1) ?? game.teams.map(() => 0);
      items.push(previous.map((score, index) => score + (round.scores[index] ?? 0)));
      return items;
    },
    [],
  );

  return (
    <div className="history-view">
      <section className="history-hero">
        <h2>Storico partita</h2>
        <p>{game.rounds.length ? `${game.rounds.length} smazzate registrate` : "Nessuna smazzata registrata"}</p>
      </section>

      {game.rounds.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">♢</span>
          <h3>Nessuna smazzata ancora</h3>
          <p>Vai su “Partita” per inserire il primo punteggio.</p>
        </div>
      ) : (
        <section className="round-list" aria-label="Storico smazzate">
          <div
            className="round-list-head"
            style={{ gridTemplateColumns: `0.55fr repeat(${game.teams.length}, 1fr)` }}
          >
            <span>Smazzata</span>
            {game.teams.map((team, index) => <span key={`${team.name}-${index}`}>{team.name}</span>)}
          </div>
          {[...game.rounds].reverse().map((round, reversedIndex) => {
            const originalIndex = game.rounds.length - 1 - reversedIndex;
            return (
              <div
                className="round-row"
                key={round.id}
                style={{ gridTemplateColumns: `0.55fr repeat(${game.teams.length}, 1fr)` }}
              >
                <span>
                  #{originalIndex + 1}
                  {game.mode === "3p" && round.soloPlayer !== undefined && (
                    <small>{game.teams[round.soloPlayer]?.name} solo</small>
                  )}
                </span>
                {game.teams.map((_, index) => (
                  <span key={index}>
                    <strong>{round.scores[index] > 0 ? "+" : ""}{round.scores[index]}</strong>
                    <small>{formatScore(cumulative[originalIndex][index])} tot.</small>
                  </span>
                ))}
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
          <strong>{totals.map(formatScore).join(" — ")}</strong>
        </div>
        <div className="summary-actions">
          {game.rounds.length > 0 && (
            <button type="button" className="download-button" onClick={() => downloadGameSummary(game)}>
              Scarica riepilogo
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onFinish}>
            Termina e archivia
          </button>
        </div>
      </section>

      {archive.length > 0 && (
        <section className="archive-section">
          <div className="section-heading">
            <div>
              <h3>Partite precedenti</h3>
            </div>
          </div>
          {archive.slice(0, 5).map((archivedGame) => {
            const archivedTotals = getGameTotals(archivedGame);
            return (
              <div className="archive-row" key={archivedGame.id}>
                <div>
                  <strong>{archivedGame.teams.map((team) => team.name).join(" · ")}</strong>
                  <small>
                    {new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(archivedGame.createdAt))}
                  </small>
                </div>
                <div className="archive-result">
                  <strong>{archivedTotals.map(formatScore).join(" — ")}</strong>
                  <button
                    type="button"
                    className="download-button download-button--small"
                    onClick={() => downloadGameSummary(archivedGame)}
                  >
                    PNG
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Rules({ mode, bonusRules }: { mode: GameMode; bonusRules: BonusRules }) {
  return (
    <div className="rules-view">
      <section className="history-hero">
        <h2>Regole di calcolo</h2>
        <p>Valori configurati per questa partita.</p>
      </section>

      <section className="rules-card">
        <h3>Valore delle carte</h3>
        <div className="rule-values">
          {CARD_VALUES.map((card) => (
            <div key={card.key}><span>{card.label}</span><strong>{card.value}</strong></div>
          ))}
        </div>
      </section>

      {mode === "3p" && (
        <section className="rules-card three-player-rules">
          <h3>Modalità a 3 · 18 + 11</h3>
          <ol>
            <li>Chi prende il pozzetto da 18 continua da solo.</li>
            <li>Gli altri due formano la coppia e usano il pozzetto da 11.</li>
            <li>La prima chiusura termina la smazzata.</li>
            <li>Il punteggio del solo è intero; quello della coppia viene diviso a metà.</li>
            <li>Si mantiene questa modalità fino al punteggio obiettivo.</li>
          </ol>
        </section>
      )}

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
          {BONUS_VALUES.filter((bonus) => bonusRules[bonus.key].enabled).map((bonus) => (
            <div key={bonus.key}>
              <span>{bonus.label}</span>
              <strong>+{bonusRules[bonus.key].value}</strong>
            </div>
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
  const [activeTeam, setActiveTeam] = useState(0);
  const [tab, setTab] = useState<"game" | "history" | "rules">("game");
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- local storage is available only after hydration */
    setGame(normalizeGame(readJson<Game | null>(ACTIVE_GAME_KEY, null)));
    setArchive(
      readJson<Game[]>(ARCHIVE_KEY, [])
        .map((archivedGame) => normalizeGame(archivedGame))
        .filter((archivedGame): archivedGame is Game => archivedGame !== null),
    );
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
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

  const totals = useMemo<number[]>(() => {
    if (!game) return [];
    return getGameTotals(game);
  }, [game]);

  if (!hydrated) {
    return (
      <main className="loading-shell" role="status">
        <span className="brand-mark" aria-hidden="true">B</span>
        <p>Caricamento…</p>
      </main>
    );
  }

  if (!game) {
    return (
      <>
        <header className="landing-header">
          <a className="brand" href="#top" aria-label="Segnapunti Burraco, home">
            <span className="brand-mark" aria-hidden="true">B</span>
            <span>Segnapunti Burraco</span>
          </a>
        </header>
        <Setup
          archive={archive}
          onStart={(newGame) => {
            setGame(newGame);
            setActiveTeam(0);
            setTab("game");
          }}
        />
      </>
    );
  }

  const sideDraftScores = game.draft.map((breakdown) =>
    calculateScore(breakdown, game.bonusRules),
  );
  const draftScores = game.mode === "3p"
    ? distributeThreePlayerScores(game, sideDraftScores)
    : sideDraftScores;
  const hasDraftData = game.draft.some((breakdown) => !isBreakdownEmpty(breakdown));
  const hasThreePlayerClosure = game.draft.some((breakdown) => breakdown.closed);
  const canSave = hasDraftData && (game.mode !== "3p" || hasThreePlayerClosure);
  const highestScore = Math.max(...totals);
  const leaders = totals
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => score === highestScore);
  const winnerIndex = highestScore >= game.target && leaders.length === 1 ? leaders[0].index : null;

  function updateDraft(teamIndex: number, breakdown: Breakdown) {
    if (!game) return;
    const draft = [...game.draft];
    draft[teamIndex] = breakdown;
    if (game.mode === "3p" && breakdown.closed) {
      const otherIndex = teamIndex === 0 ? 1 : 0;
      draft[otherIndex] = { ...draft[otherIndex], closed: false };
    }
    setGame({ ...game, draft });
  }

  function selectSoloPlayer(playerIndex: number) {
    if (!game || game.mode !== "3p") return;
    setGame({ ...game, soloPlayer: playerIndex });
    setActiveTeam(0);
  }

  function saveRound() {
    if (!game || !canSave) return;
    const round: Round = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      scores: draftScores,
      breakdowns: game.draft,
      soloPlayer: game.mode === "3p" ? game.soloPlayer : undefined,
      sideScores: game.mode === "3p" ? sideDraftScores : undefined,
    };
    setGame({
      ...game,
      rounds: [...game.rounds, round],
      draft: Array.from(
        { length: game.mode === "3p" ? 2 : game.teams.length },
        () => emptyBreakdown(),
      ),
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
    const finished = {
      ...game,
      draft: Array.from(
        { length: game.mode === "3p" ? 2 : game.teams.length },
        () => emptyBreakdown(),
      ),
    };
    downloadGameSummary(finished);
    setArchive((current) => [finished, ...current].slice(0, 30));
    setGame(null);
    setTab("game");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="Segnapunti Burraco, torna in alto">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>Segnapunti Burraco</span>
        </a>
        <span className="round-pill">Smazzata {game.rounds.length + 1}</span>
      </header>

      <main className="game-shell" id="top">
        <Scoreboard
          game={game}
          totals={totals}
          activeTeam={game.mode === "3p" ? -1 : activeTeam}
          onSelect={(team) => {
            if (game.mode === "3p") return;
            setActiveTeam(team);
            setTab("game");
          }}
        />

        {winnerIndex !== null && (
          <section className="winner-banner" role="status">
            <div>
              <strong>{game.teams[winnerIndex].name} ha raggiunto {formatScore(game.target)} punti.</strong>
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
            {game.mode === "3p" && (
              <section className="three-player-setup" aria-label="Ruoli della smazzata">
                <div>
                  <strong>Chi ha preso il pozzetto da 18?</strong>
                  <small>Giocherà da solo per questa smazzata.</small>
                </div>
                <div className="solo-choice">
                  {game.teams.map((player, index) => (
                    <button
                      type="button"
                      className={game.soloPlayer === index ? "selected" : ""}
                      aria-pressed={game.soloPlayer === index}
                      onClick={() => selectSoloPlayer(index)}
                      key={`${player.name}-${index}`}
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {game.mode === "3p" && (
              <nav className="side-choice" aria-label="Conteggio solo o coppia">
                {getThreePlayerSides(game).map((side, index) => (
                  <button
                    type="button"
                    className={activeTeam === index ? "active" : ""}
                    aria-pressed={activeTeam === index}
                    onClick={() => setActiveTeam(index)}
                    key={index}
                  >
                    <span>{index === 0 ? "Solo" : "Coppia"}</span>
                    <strong>{index === 0 ? side.name : side.players.split(" · ")[0]}</strong>
                  </button>
                ))}
              </nav>
            )}

            <RoundEditor
              team={game.mode === "3p" ? getThreePlayerSides(game)[activeTeam] : game.teams[activeTeam]}
              breakdown={game.draft[activeTeam]}
              bonusRules={game.bonusRules}
              onChange={(breakdown) => updateDraft(activeTeam, breakdown)}
            />

            {game.mode === "3p" && activeTeam === 1 && (
              <p className="pair-split-note">
                Parziale coppia: {formatScore(sideDraftScores[1])} · {formatScore(sideDraftScores[1] / 2)} punti a testa
              </p>
            )}

            <section
              className="round-recap"
              style={{ gridTemplateColumns: `repeat(${game.teams.length}, 1fr)` }}
            >
              {game.teams.map((team, index) => (
                <div key={`${team.name}-${index}`}>
                  <span>{team.name}</span>
                  <strong>{draftScores[index] > 0 ? "+" : ""}{draftScores[index]}</strong>
                </div>
              ))}
            </section>

            <div className="save-bar">
              <p>
                <span aria-hidden="true">{game.mode === "3p" && !hasThreePlayerClosure ? "!" : "✓"}</span>
                {game.mode === "3p" && !hasThreePlayerClosure
                  ? "Indica chi ha chiuso per salvare"
                  : "Bozza salvata automaticamente"}
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

        {tab === "rules" && <Rules mode={game.mode} bonusRules={game.bonusRules} />}
      </main>

      {savedMessage && (
        <div className="toast" role="status">Smazzata salvata ✓</div>
      )}
    </div>
  );
}
