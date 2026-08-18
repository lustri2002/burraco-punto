import { getD1 } from "../../../db";
import {
  calculateScore,
  normalizeBonusRules,
  normalizeBreakdown,
  requiredPlayers,
  type BonusRules,
  type GameMode,
  type Participant,
  type ScoreboardEntry,
  type SessionSnapshot,
  type SharedRound,
  type Submission,
} from "../../../lib/game";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  code: string;
  mode: GameMode;
  target: number;
  bonus_rules: string;
  status: "lobby" | "active" | "finished";
  round_number: number;
  solo_seat: number | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type ParticipantRow = {
  id: string;
  name: string;
  seat: number;
  side: number;
  is_host: number;
  token_hash?: string;
};

type RoundRow = {
  round_number: number;
  solo_seat: number | null;
  scores: string;
  side_scores: string;
  created_at: string;
};

type SubmissionRow = {
  side: number;
  participant_id: string;
  participant_name: string;
  score: number;
  breakdown: string;
  updated_at: string;
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function tokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function generateCode(db: D1Database) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    const existing = await db.prepare("SELECT id FROM sessions WHERE code = ?").bind(code).first();
    if (!existing) return code;
  }
  throw new ApiError("Non è stato possibile generare il codice. Riprova.", 503);
}

async function getSession(db: D1Database, code: string) {
  const session = await db
    .prepare("SELECT * FROM sessions WHERE code = ?")
    .bind(code)
    .first<SessionRow>();
  if (!session) throw new ApiError("Sessione non trovata.", 404);
  return session;
}

async function authenticate(
  db: D1Database,
  session: SessionRow,
  token: string,
) {
  if (!token) throw new ApiError("Accesso alla sessione non valido.", 401);
  const tokenHash = await hashToken(token);
  const participant = await db
    .prepare(
      `SELECT id, name, seat, side, is_host
       FROM participants
       WHERE session_id = ? AND token_hash = ?`,
    )
    .bind(session.id, tokenHash)
    .first<ParticipantRow>();
  if (!participant) throw new ApiError("Accesso alla sessione non valido.", 401);
  await db
    .prepare("UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(participant.id)
    .run();
  return participant;
}

function toParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.name,
    seat: row.seat,
    side: row.side,
    isHost: Boolean(row.is_host),
  };
}

function buildScoreboard(
  session: SessionRow,
  participants: Participant[],
  rounds: SharedRound[],
): ScoreboardEntry[] {
  const count = session.mode === "2v2" ? 2 : requiredPlayers(session.mode);
  const totals = Array.from({ length: count }, () => 0);
  rounds.forEach((round) => {
    round.scores.forEach((score, index) => {
      totals[index] = (totals[index] ?? 0) + score;
    });
  });

  return totals.map((total, index) => {
    if (session.mode === "2v2") {
      const names = participants
        .filter((participant) => participant.side === index)
        .map((participant) => participant.name);
      return {
        name: `Coppia ${index === 0 ? "A" : "B"}`,
        players: names.length ? names.join(" + ") : "In attesa",
        total,
      };
    }
    const participant = participants.find((item) => item.seat === index);
    return {
      name: participant?.name ?? `Giocatore ${index + 1}`,
      players: "",
      total,
    };
  });
}

async function buildSnapshot(
  db: D1Database,
  session: SessionRow,
  me: ParticipantRow | null,
): Promise<SessionSnapshot> {
  const participantRows = await db
    .prepare(
      `SELECT id, name, seat, side, is_host
       FROM participants WHERE session_id = ? ORDER BY seat ASC`,
    )
    .bind(session.id)
    .all<ParticipantRow>();
  const participants = participantRows.results.map(toParticipant);

  const roundRows = await db
    .prepare(
      `SELECT round_number, solo_seat, scores, side_scores, created_at
       FROM rounds WHERE session_id = ? ORDER BY round_number ASC`,
    )
    .bind(session.id)
    .all<RoundRow>();
  const rounds: SharedRound[] = roundRows.results.map((round) => ({
    roundNumber: round.round_number,
    soloSeat: round.solo_seat,
    scores: safeJson<number[]>(round.scores, []),
    sideScores: safeJson<number[]>(round.side_scores, []),
    createdAt: round.created_at,
  }));

  let submissions: Submission[] = [];
  if (me) {
    const rows = await db
      .prepare(
        `SELECT rs.side, rs.participant_id, p.name AS participant_name,
                rs.score, rs.breakdown, rs.updated_at
         FROM round_submissions rs
         JOIN participants p ON p.id = rs.participant_id
         WHERE rs.session_id = ? AND rs.round_number = ?
         ORDER BY rs.side ASC`,
      )
      .bind(session.id, session.round_number)
      .all<SubmissionRow>();
    submissions = rows.results.map((submission) => ({
      side: submission.side,
      participantId: submission.participant_id,
      participantName: submission.participant_name,
      score: submission.score,
      breakdown: normalizeBreakdown(safeJson(submission.breakdown, {})),
      updatedAt: submission.updated_at,
    }));
  }

  const scoreboard = buildScoreboard(session, participants, rounds);
  const highest = Math.max(...scoreboard.map((entry) => entry.total));
  const leaders = scoreboard
    .map((entry, index) => ({ index, total: entry.total }))
    .filter((entry) => entry.total === highest);
  const winnerIndex = highest >= session.target && leaders.length === 1
    ? leaders[0].index
    : null;

  return {
    code: session.code,
    mode: session.mode,
    target: session.target,
    status: session.status,
    roundNumber: session.round_number,
    soloSeat: session.solo_seat,
    version: session.version,
    bonusRules: normalizeBonusRules(safeJson<BonusRules>(session.bonus_rules, {})),
    participants,
    submissions,
    rounds,
    scoreboard,
    requiredPlayers: requiredPlayers(session.mode),
    me: me ? toParticipant(me) : null,
    winnerIndex,
  };
}

async function freshSnapshot(
  db: D1Database,
  code: string,
  participant: ParticipantRow | null,
) {
  return buildSnapshot(db, await getSession(db, code), participant);
}

function assertHost(participant: ParticipantRow) {
  if (!participant.is_host) throw new ApiError("Solo l’host può eseguire questa operazione.", 403);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get("code"));
    if (code.length !== 6) throw new ApiError("Inserisci un codice di 6 caratteri.");
    const db = getD1();
    const session = await getSession(db, code);
    const token = tokenFromRequest(request);
    const me = token ? await authenticate(db, session, token) : null;
    return json({ session: await buildSnapshot(db, session, me) });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError("Errore del server.", 500);
    return json({ error: apiError.message }, apiError.status);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const db = getD1();

    if (action === "create") {
      const mode = body.mode as GameMode;
      if (!(["1v1", "2v2", "3p"] as string[]).includes(mode)) {
        throw new ApiError("Modalità non valida.");
      }
      const hostName = normalizeName(body.name);
      if (hostName.length < 2) throw new ApiError("Inserisci il tuo nome.");
      const target = Math.min(10000, Math.max(100, Math.round(Number(body.target) || 2005)));
      const bonusRules = normalizeBonusRules(body.bonusRules as Partial<BonusRules>);
      const code = await generateCode(db);
      const sessionId = crypto.randomUUID();
      const participantId = crypto.randomUUID();
      const token = randomToken();
      const tokenHash = await hashToken(token);
      await db.batch([
        db
          .prepare(
            `INSERT INTO sessions
             (id, code, mode, target, bonus_rules, status, round_number, solo_seat, version)
             VALUES (?, ?, ?, ?, ?, 'lobby', 1, NULL, 1)`,
          )
          .bind(sessionId, code, mode, target, JSON.stringify(bonusRules)),
        db
          .prepare(
            `INSERT INTO participants
             (id, session_id, name, seat, side, is_host, token_hash)
             VALUES (?, ?, ?, 0, 0, 1, ?)`,
          )
          .bind(participantId, sessionId, hostName, tokenHash),
      ]);
      const session = await getSession(db, code);
      const me = await authenticate(db, session, token);
      return json({ token, session: await buildSnapshot(db, session, me) }, 201);
    }

    const code = normalizeCode(body.code);
    if (code.length !== 6) throw new ApiError("Codice sessione non valido.");
    let session = await getSession(db, code);

    if (action === "join") {
      if (session.status !== "lobby") throw new ApiError("La partita è già iniziata.", 409);
      const name = normalizeName(body.name);
      if (name.length < 2) throw new ApiError("Inserisci il tuo nome.");
      const rows = await db
        .prepare("SELECT seat, side FROM participants WHERE session_id = ? ORDER BY seat ASC")
        .bind(session.id)
        .all<{ seat: number; side: number }>();
      if (rows.results.length >= requiredPlayers(session.mode)) {
        throw new ApiError("La sessione è al completo.", 409);
      }
      const usedSeats = new Set(rows.results.map((row) => row.seat));
      const seat = Array.from({ length: requiredPlayers(session.mode) }, (_, index) => index)
        .find((index) => !usedSeats.has(index));
      if (seat === undefined) throw new ApiError("La sessione è al completo.", 409);

      let side = seat;
      if (session.mode === "2v2") {
        side = Number(body.side);
        if (side !== 0 && side !== 1) throw new ApiError("Scegli una coppia.");
        const sideCount = rows.results.filter((row) => row.side === side).length;
        if (sideCount >= 2) throw new ApiError("Questa coppia è già completa.", 409);
      }

      const token = randomToken();
      const tokenHash = await hashToken(token);
      const participantId = crypto.randomUUID();
      await db.batch([
        db
          .prepare(
            `INSERT INTO participants
             (id, session_id, name, seat, side, is_host, token_hash)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
          )
          .bind(participantId, session.id, name, seat, side, tokenHash),
        db
          .prepare(
            "UPDATE sessions SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(session.id),
      ]);
      session = await getSession(db, code);
      const me = await authenticate(db, session, token);
      return json({ token, session: await buildSnapshot(db, session, me) }, 201);
    }

    const participant = await authenticate(db, session, tokenFromRequest(request));

    if (action === "start") {
      assertHost(participant);
      if (session.status !== "lobby") throw new ApiError("La partita è già iniziata.", 409);
      const count = await db
        .prepare("SELECT COUNT(*) AS total FROM participants WHERE session_id = ?")
        .bind(session.id)
        .first<{ total: number }>();
      if ((count?.total ?? 0) !== requiredPlayers(session.mode)) {
        throw new ApiError("Attendi che tutti i giocatori entrino nella sessione.", 409);
      }
      await db
        .prepare(
          `UPDATE sessions SET status = 'active', version = version + 1,
           updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(session.id)
        .run();
    } else if (action === "setSolo") {
      assertHost(participant);
      if (session.status !== "active" || session.mode !== "3p") {
        throw new ApiError("Operazione non disponibile.", 409);
      }
      const soloSeat = Number(body.soloSeat);
      const exists = await db
        .prepare("SELECT id FROM participants WHERE session_id = ? AND seat = ?")
        .bind(session.id, soloSeat)
        .first();
      if (!exists) throw new ApiError("Giocatore non valido.");
      await db.batch([
        db
          .prepare("DELETE FROM round_submissions WHERE session_id = ? AND round_number = ?")
          .bind(session.id, session.round_number),
        db
          .prepare(
            `UPDATE sessions SET solo_seat = ?, version = version + 1,
             updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
          .bind(soloSeat, session.id),
      ]);
    } else if (action === "submit") {
      if (session.status !== "active") throw new ApiError("La partita non è attiva.", 409);
      if (session.mode === "3p" && session.solo_seat === null) {
        throw new ApiError("L’host deve prima indicare chi ha preso il pozzetto da 18.", 409);
      }
      const side = session.mode === "3p"
        ? participant.seat === session.solo_seat ? 0 : 1
        : participant.side;
      const breakdown = normalizeBreakdown(body.breakdown);
      const rules = normalizeBonusRules(safeJson<BonusRules>(session.bonus_rules, {}));
      const score = calculateScore(breakdown, rules);
      await db.batch([
        db
          .prepare(
            `INSERT INTO round_submissions
             (id, session_id, round_number, side, participant_id, breakdown, score, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(session_id, round_number, side)
             DO UPDATE SET participant_id = excluded.participant_id,
                           breakdown = excluded.breakdown,
                           score = excluded.score,
                           updated_at = CURRENT_TIMESTAMP`,
          )
          .bind(
            crypto.randomUUID(),
            session.id,
            session.round_number,
            side,
            participant.id,
            JSON.stringify(breakdown),
            score,
          ),
        db
          .prepare(
            "UPDATE sessions SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(session.id),
      ]);
    } else if (action === "confirm") {
      assertHost(participant);
      if (session.status !== "active") throw new ApiError("La partita non è attiva.", 409);
      const submissionRows = await db
        .prepare(
          `SELECT side, score, breakdown FROM round_submissions
           WHERE session_id = ? AND round_number = ? ORDER BY side ASC`,
        )
        .bind(session.id, session.round_number)
        .all<{ side: number; score: number; breakdown: string }>();
      if (
        submissionRows.results.length !== 2 ||
        submissionRows.results[0]?.side !== 0 ||
        submissionRows.results[1]?.side !== 1
      ) {
        throw new ApiError("Manca il conteggio di uno dei due lati.", 409);
      }
      const closures = submissionRows.results.map(
        (submission) => normalizeBreakdown(safeJson(submission.breakdown, {})).closed,
      );
      if (closures.filter(Boolean).length > 1) {
        throw new ApiError("La chiusura può essere assegnata a un solo lato.", 409);
      }
      if (session.mode === "3p" && !closures.some(Boolean)) {
        throw new ApiError("Indicate quale lato ha chiuso la smazzata.", 409);
      }

      const sideScores = submissionRows.results.map((submission) => submission.score);
      let scores = sideScores;
      if (session.mode === "3p") {
        if (session.solo_seat === null) throw new ApiError("Seleziona il giocatore solo.", 409);
        scores = Array.from({ length: 3 }, (_, seat) =>
          seat === session.solo_seat ? sideScores[0] : sideScores[1] / 2,
        );
      }

      const previousRows = await db
        .prepare("SELECT scores FROM rounds WHERE session_id = ? ORDER BY round_number ASC")
        .bind(session.id)
        .all<{ scores: string }>();
      const totals = scores.map((score, index) =>
        previousRows.results.reduce(
          (total, round) => total + (safeJson<number[]>(round.scores, [])[index] ?? 0),
          score,
        ),
      );
      const highest = Math.max(...totals);
      const leaders = totals.filter((total) => total === highest).length;
      const nextStatus = highest >= session.target && leaders === 1 ? "finished" : "active";

      await db.batch([
        db
          .prepare(
            `INSERT INTO rounds
             (id, session_id, round_number, solo_seat, scores, side_scores)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            session.id,
            session.round_number,
            session.solo_seat,
            JSON.stringify(scores),
            JSON.stringify(sideScores),
          ),
        db
          .prepare("DELETE FROM round_submissions WHERE session_id = ? AND round_number = ?")
          .bind(session.id, session.round_number),
        db
          .prepare(
            `UPDATE sessions SET status = ?, round_number = round_number + 1,
             solo_seat = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .bind(nextStatus, session.mode === "3p" ? null : session.solo_seat, session.id),
      ]);
    } else if (action === "undo") {
      assertHost(participant);
      const lastRound = session.round_number - 1;
      if (lastRound < 1) throw new ApiError("Non ci sono smazzate da annullare.", 409);
      await db.batch([
        db
          .prepare("DELETE FROM round_submissions WHERE session_id = ? AND round_number = ?")
          .bind(session.id, session.round_number),
        db
          .prepare("DELETE FROM rounds WHERE session_id = ? AND round_number = ?")
          .bind(session.id, lastRound),
        db
          .prepare(
            `UPDATE sessions SET status = 'active', round_number = ?, solo_seat = ?,
             version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
          .bind(lastRound, session.mode === "3p" ? null : session.solo_seat, session.id),
      ]);
    } else if (action === "finish") {
      assertHost(participant);
      await db
        .prepare(
          `UPDATE sessions SET status = 'finished', version = version + 1,
           updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(session.id)
        .run();
    } else {
      throw new ApiError("Operazione non riconosciuta.", 404);
    }

    session = await getSession(db, code);
    return json({ session: await freshSnapshot(db, code, participant) });
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : "Errore del server.";
    if (message.includes("no such table")) {
      return json({ error: "Database non ancora inizializzato." }, 503);
    }
    return json({ error: "Errore del server." }, 500);
  }
}
