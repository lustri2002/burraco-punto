export type GameMode = "1v1" | "2v2" | "3p";

export type CardCounts = {
  five: number;
  ten: number;
  fifteen: number;
  twenty: number;
  thirty: number;
};

export type BonusCounts = {
  reale: number;
  realeSporco: number;
  super: number;
  superSporco: number;
  pulito: number;
  semipulito: number;
  sporco: number;
};

export type BonusRules = Record<
  keyof BonusCounts,
  { enabled: boolean; value: number }
>;

export type Breakdown = {
  table: CardCounts;
  hand: CardCounts;
  bonuses: BonusCounts;
  closed: boolean;
  missedPot: boolean;
  adjustment: number;
};

export type Participant = {
  id: string;
  name: string;
  seat: number;
  side: number;
  isHost: boolean;
};

export type Submission = {
  side: number;
  participantId: string;
  participantName: string;
  score: number;
  breakdown: Breakdown;
  updatedAt: string;
};

export type SharedRound = {
  roundNumber: number;
  soloSeat: number | null;
  scores: number[];
  sideScores: number[];
  createdAt: string;
};

export type ScoreboardEntry = {
  name: string;
  players: string;
  total: number;
};

export type SessionSnapshot = {
  code: string;
  mode: GameMode;
  target: number;
  status: "lobby" | "active" | "finished";
  roundNumber: number;
  soloSeat: number | null;
  version: number;
  bonusRules: BonusRules;
  participants: Participant[];
  submissions: Submission[];
  rounds: SharedRound[];
  scoreboard: ScoreboardEntry[];
  requiredPlayers: number;
  me: Participant | null;
  winnerIndex: number | null;
};

export const CARD_VALUES: Array<{
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

export const BONUS_VALUES: Array<{
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

export function makeBonusRules(enableAll = false): BonusRules {
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

export function normalizeBonusRules(rules?: Partial<BonusRules>): BonusRules {
  return Object.fromEntries(
    BONUS_VALUES.map((bonus) => {
      const stored = rules?.[bonus.key];
      return [
        bonus.key,
        {
          enabled: stored?.enabled ?? (bonus.key === "pulito" || bonus.key === "sporco"),
          value: Number.isFinite(stored?.value)
            ? Math.max(0, Math.round(stored?.value ?? bonus.value))
            : bonus.value,
        },
      ];
    }),
  ) as BonusRules;
}

export function emptyCards(): CardCounts {
  return { five: 0, ten: 0, fifteen: 0, twenty: 0, thirty: 0 };
}

export function emptyBonuses(): BonusCounts {
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

export function emptyBreakdown(): Breakdown {
  return {
    table: emptyCards(),
    hand: emptyCards(),
    bonuses: emptyBonuses(),
    closed: false,
    missedPot: false,
    adjustment: 0,
  };
}

export function pointsForCards(cards: CardCounts) {
  return CARD_VALUES.reduce(
    (total, card) => total + cards[card.key] * card.value,
    0,
  );
}

export function pointsForBonuses(bonuses: BonusCounts, rules: BonusRules) {
  return BONUS_VALUES.reduce(
    (total, bonus) =>
      total +
      (rules[bonus.key].enabled
        ? bonuses[bonus.key] * rules[bonus.key].value
        : 0),
    0,
  );
}

export function calculateScore(breakdown: Breakdown, rules: BonusRules) {
  return (
    pointsForCards(breakdown.table) -
    pointsForCards(breakdown.hand) +
    pointsForBonuses(breakdown.bonuses, rules) +
    (breakdown.closed ? 100 : 0) -
    (breakdown.missedPot ? 100 : 0) +
    breakdown.adjustment
  );
}

function safeCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(200, Math.max(0, Math.floor(number))) : 0;
}

export function normalizeBreakdown(value: unknown): Breakdown {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Breakdown>;
  const table = (source.table ?? {}) as Partial<CardCounts>;
  const hand = (source.hand ?? {}) as Partial<CardCounts>;
  const bonuses = (source.bonuses ?? {}) as Partial<BonusCounts>;
  return {
    table: Object.fromEntries(
      CARD_VALUES.map((card) => [card.key, safeCount(table[card.key])]),
    ) as CardCounts,
    hand: Object.fromEntries(
      CARD_VALUES.map((card) => [card.key, safeCount(hand[card.key])]),
    ) as CardCounts,
    bonuses: Object.fromEntries(
      BONUS_VALUES.map((bonus) => [bonus.key, safeCount(bonuses[bonus.key])]),
    ) as BonusCounts,
    closed: source.closed === true,
    missedPot: source.missedPot === true,
    adjustment: Math.min(10000, Math.max(-10000, Math.round(Number(source.adjustment) || 0))),
  };
}

export function requiredPlayers(mode: GameMode) {
  return mode === "2v2" ? 4 : mode === "3p" ? 3 : 2;
}

export function modeLabel(mode: GameMode) {
  if (mode === "3p") return "3 giocatori · 18 + 11";
  return mode === "2v2" ? "2 vs 2" : "1 vs 1";
}

export function formatScore(score: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(score);
}
