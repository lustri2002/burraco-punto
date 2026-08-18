import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    mode: text("mode").notNull(),
    target: integer("target").notNull(),
    bonusRules: text("bonus_rules").notNull(),
    status: text("status").notNull().default("lobby"),
    roundNumber: integer("round_number").notNull().default(1),
    soloSeat: integer("solo_seat"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("sessions_code_idx").on(table.code)],
);

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    seat: integer("seat").notNull(),
    side: integer("side").notNull(),
    isHost: integer("is_host", { mode: "boolean" }).notNull().default(false),
    tokenHash: text("token_hash").notNull(),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("participants_session_seat_idx").on(table.sessionId, table.seat),
    uniqueIndex("participants_session_token_idx").on(table.sessionId, table.tokenHash),
  ],
);

export const roundSubmissions = sqliteTable(
  "round_submissions",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    side: integer("side").notNull(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    breakdown: text("breakdown").notNull(),
    score: integer("score").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("round_submissions_side_idx").on(
      table.sessionId,
      table.roundNumber,
      table.side,
    ),
  ],
);

export const rounds = sqliteTable(
  "rounds",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    soloSeat: integer("solo_seat"),
    scores: text("scores").notNull(),
    sideScores: text("side_scores").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("rounds_session_number_idx").on(table.sessionId, table.roundNumber),
  ],
);
