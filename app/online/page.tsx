"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BONUS_VALUES,
  CARD_VALUES,
  calculateScore,
  emptyBreakdown,
  formatScore,
  makeBonusRules,
  modeLabel,
  pointsForBonuses,
  type BonusRules,
  type Breakdown,
  type CardCounts,
  type GameMode,
  type SessionSnapshot,
} from "../../lib/game";

const SESSION_KEY = "burraco-punto-online-session-v1";

type Credentials = { code: string; token: string };
type Screen = "home" | "create" | "join";

async function requestSession(code: string, token = "") {
  const response = await fetch(`/api/session?code=${encodeURIComponent(code)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  const data = (await response.json()) as { session?: SessionSnapshot; error?: string };
  if (!response.ok || !data.session) throw new Error(data.error ?? "Sessione non disponibile.");
  return data.session;
}

async function sendAction(
  action: string,
  body: Record<string, unknown>,
  token = "",
) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = (await response.json()) as {
    token?: string;
    session?: SessionSnapshot;
    error?: string;
  };
  if (!response.ok || !data.session) throw new Error(data.error ?? "Operazione non riuscita.");
  return data;
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
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Aggiungi uno a ${label}`} onClick={() => onChange(value + 1)}>
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
  const subtotal = CARD_VALUES.reduce(
    (total, card) => total + counts[card.key] * card.value,
    0,
  );
  return (
    <section className="count-section">
      <div className="section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <strong className={negative ? "negative" : "positive"}>
          {negative && subtotal > 0 ? "−" : "+"}{subtotal}
        </strong>
      </div>
      <div className="card-counter-grid">
        {CARD_VALUES.map((card) => (
          <div className="card-counter" key={card.key}>
            <div><span>{card.label}</span><small>{card.hint}</small></div>
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

function RoundEditor({
  title,
  subtitle,
  breakdown,
  rules,
  onChange,
}: {
  title: string;
  subtitle: string;
  breakdown: Breakdown;
  rules: BonusRules;
  onChange: (breakdown: Breakdown) => void;
}) {
  const score = calculateScore(breakdown, rules);
  const enabledBonuses = BONUS_VALUES.filter((bonus) => rules[bonus.key].enabled);
  return (
    <div className="round-editor">
      <div className="editor-intro">
        <div>
          <p className="eyebrow">Il tuo conteggio</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="live-score"><small>Parziale</small><strong>{score > 0 ? "+" : ""}{formatScore(score)}</strong></div>
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
          <div><h3>Burraco</h3><p>Aggiungi quelli completati.</p></div>
          <strong className="positive">+{formatScore(pointsForBonuses(breakdown.bonuses, rules))}</strong>
        </div>
        <div className="bonus-grid">
          {enabledBonuses.map((bonus) => (
            <div className="bonus-counter" key={bonus.key}>
              <div><span>{bonus.short}</span><small>+{rules[bonus.key].value}</small></div>
              <Stepper
                compact
                value={breakdown.bonuses[bonus.key]}
                label={bonus.label}
                onChange={(value) => onChange({
                  ...breakdown,
                  bonuses: { ...breakdown.bonuses, [bonus.key]: value },
                })}
              />
            </div>
          ))}
        </div>
      </section>
      <section className="count-section switches-section">
        <label className="switch-row">
          <span><strong>Chiusura</strong><small>Bonus di 100 punti</small></span>
          <input
            type="checkbox"
            checked={breakdown.closed}
            onChange={(event) => onChange({ ...breakdown, closed: event.target.checked })}
          />
        </label>
        <label className="switch-row">
          <span><strong>Pozzetto non preso</strong><small>Penalità di 100 punti</small></span>
          <input
            type="checkbox"
            checked={breakdown.missedPot}
            onChange={(event) => onChange({ ...breakdown, missedPot: event.target.checked })}
          />
        </label>
        <label className="adjustment-row">
          <span><strong>Correzione manuale</strong><small>Per penalità o regole di casa</small></span>
          <input
            type="number"
            inputMode="numeric"
            step="5"
            value={breakdown.adjustment || ""}
            placeholder="0"
            onChange={(event) => onChange({
              ...breakdown,
              adjustment: Number(event.target.value) || 0,
            })}
          />
        </label>
      </section>
    </div>
  );
}

function BonusSetup({ rules, onChange }: { rules: BonusRules; onChange: (rules: BonusRules) => void }) {
  return (
    <fieldset className="bonus-setup">
      <legend>Tipi di burraco</legend>
      <p>Attiva quelli che usate e imposta il relativo punteggio.</p>
      <div className="bonus-setup-list">
        {BONUS_VALUES.map((bonus) => {
          const rule = rules[bonus.key];
          return (
            <div className={`bonus-setup-row${rule.enabled ? " enabled" : ""}`} key={bonus.key}>
              <label className="bonus-enable">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => onChange({
                    ...rules,
                    [bonus.key]: { ...rule, enabled: event.target.checked },
                  })}
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
                  onChange={(event) => onChange({
                    ...rules,
                    [bonus.key]: { ...rule, value: Math.max(0, Number(event.target.value) || 0) },
                  })}
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
  );
}

function CreateSession({ onCancel, onCreated }: {
  onCancel: () => void;
  onCreated: (session: SessionSnapshot, token: string) => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("2v2");
  const [target, setTarget] = useState(2005);
  const [rules, setRules] = useState<BonusRules>(() => makeBonusRules());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="setup-shell online-setup">
      <button className="back-button" type="button" onClick={onCancel}>← Indietro</button>
      <form className="setup-card" onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await sendAction("create", { name, mode, target, bonusRules: rules });
          onCreated(result.session!, result.token!);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Operazione non riuscita.");
        } finally {
          setBusy(false);
        }
      }}>
        <div className="setup-card-heading"><p className="eyebrow">Nuova sessione</p><h2>Configura la partita</h2></div>
        <label className="full-field">Il tuo nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alessio" maxLength={24} required /></label>
        <fieldset className="mode-choice">
          <legend>Modalità</legend>
          <div>
            {([['1v1', '1 vs 1'], ['2v2', '2 vs 2'], ['3p', '3 giocatori']] as Array<[GameMode, string]>).map(([value, label]) => (
              <button type="button" key={value} className={mode === value ? "selected" : ""} onClick={() => setMode(value)}>{label}</button>
            ))}
          </div>
        </fieldset>
        {mode === "3p" && <p className="mode-note">Pozzetti da 18 e 11. L’host indica il giocatore solo a ogni smazzata.</p>}
        <BonusSetup rules={rules} onChange={setRules} />
        <fieldset className="target-choice">
          <legend>Si gioca fino a</legend>
          <div>
            {[1005, 1505, 2005].map((value) => <button type="button" key={value} className={target === value ? "selected" : ""} onClick={() => setTarget(value)}>{formatScore(value)}</button>)}
          </div>
          <label className="custom-target">Obiettivo personalizzato<input type="number" min="100" step="5" value={target} onChange={(event) => setTarget(Math.max(100, Number(event.target.value) || 100))} /></label>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Creazione…" : "Crea sessione"}<span>→</span></button>
      </form>
    </main>
  );
}

function JoinSession({ initialCode, onCancel, onJoined }: {
  initialCode: string;
  onCancel: () => void;
  onJoined: (session: SessionSnapshot, token: string) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<SessionSnapshot | null>(null);
  const [name, setName] = useState("");
  const [side, setSide] = useState(1);
  const [busy, setBusy] = useState(initialCode.length === 6);
  const [error, setError] = useState("");

  const lookup = useCallback(async (value = code) => {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(normalized);
    if (normalized.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      setPreview(await requestSession(normalized));
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : "Sessione non trovata.");
    } finally {
      setBusy(false);
    }
  }, [code]);

  useEffect(() => {
    if (initialCode.length !== 6) return;
    let cancelled = false;
    requestSession(initialCode)
      .then((session) => {
        if (!cancelled) setPreview(session);
      })
      .catch((caught) => {
        if (!cancelled) {
          setPreview(null);
          setError(caught instanceof Error ? caught.message : "Sessione non trovata.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, [initialCode]);

  return (
    <main className="setup-shell online-setup">
      <button className="back-button" type="button" onClick={onCancel}>← Indietro</button>
      <form className="setup-card" onSubmit={async (event) => {
        event.preventDefault();
        if (!preview) { await lookup(); return; }
        setBusy(true);
        setError("");
        try {
          const result = await sendAction("join", { code: preview.code, name, side });
          onJoined(result.session!, result.token!);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Ingresso non riuscito.");
        } finally {
          setBusy(false);
        }
      }}>
        <div className="setup-card-heading"><p className="eyebrow">Partecipa</p><h2>Entra con il codice</h2></div>
        <label className="full-field">Codice sessione<input className="code-input" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setPreview(null); }} placeholder="ABC123" maxLength={6} required /></label>
        {!preview && <button className="secondary-button lookup-button" type="button" disabled={busy || code.length !== 6} onClick={() => void lookup()}>{busy ? "Cerco…" : "Trova partita"}</button>}
        {preview && (
          <div className="join-preview">
            <div><small>Partita trovata</small><strong>{modeLabel(preview.mode)} · obiettivo {formatScore(preview.target)}</strong></div>
            <span>{preview.participants.length}/{preview.requiredPlayers}</span>
          </div>
        )}
        {preview && <label className="full-field">Il tuo nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Marco" maxLength={24} required /></label>}
        {preview?.mode === "2v2" && (
          <fieldset className="team-choice"><legend>Con quale coppia giochi?</legend><div>
            {[0, 1].map((value) => <button type="button" key={value} className={side === value ? "selected" : ""} onClick={() => setSide(value)}>Coppia {value === 0 ? "A" : "B"}</button>)}
          </div></fieldset>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {preview && <button className="primary-button" disabled={busy} type="submit">{busy ? "Ingresso…" : "Entra nella lobby"}<span>→</span></button>}
      </form>
    </main>
  );
}

function Scoreboard({ session }: { session: SessionSnapshot }) {
  return (
    <section className={`scoreboard scoreboard--${session.scoreboard.length}`}>
      {session.scoreboard.map((entry, index) => {
        const progress = Math.max(0, Math.min(100, (entry.total / session.target) * 100));
        return (
          <div className={`score-team score-team--${index}`} key={`${entry.name}-${index}`}>
            <span className="score-team-name">{entry.name}</span>
            {entry.players && <small className="score-players">{entry.players}</small>}
            <strong>{formatScore(entry.total)}</strong>
            <span className="score-target">su {formatScore(session.target)}</span>
            <span className="progress-track"><span style={{ width: `${progress}%` }} /></span>
          </div>
        );
      })}
    </section>
  );
}

function Lobby({ session, token, onUpdate, onLeave }: {
  session: SessionSnapshot;
  token: string;
  onUpdate: (session: SessionSnapshot) => void;
  onLeave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const joinLink = typeof window === "undefined" ? "" : `${window.location.origin}/online?join=${session.code}`;
  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Partita di Burraco", text: `Entra con il codice ${session.code}`, url: joinLink });
    } else {
      await navigator.clipboard.writeText(joinLink);
      setMessage("Link copiato");
    }
  }
  return (
    <main className="online-shell">
      <SessionHeading session={session} onLeave={onLeave} />
      <section className="code-card">
        <small>Codice sessione</small><strong>{session.code}</strong>
        <button type="button" onClick={() => void share()}>Condividi invito</button>
        {message && <span>{message}</span>}
      </section>
      <section className="lobby-card">
        <div className="section-heading"><div><h2>Lobby</h2><p>{session.participants.length} di {session.requiredPlayers} giocatori</p></div><span className="live-dot">online</span></div>
        <div className="participant-list">
          {Array.from({ length: session.requiredPlayers }, (_, seat) => {
            const participant = session.participants.find((item) => item.seat === seat);
            return <div className={`participant-row${participant ? " joined" : ""}`} key={seat}><span>{participant ? participant.name.slice(0, 1).toUpperCase() : "·"}</span><div><strong>{participant?.name ?? "In attesa"}</strong><small>{participant ? `${participant.isHost ? "Host · " : ""}${session.mode === "2v2" ? `Coppia ${participant.side === 0 ? "A" : "B"}` : `Giocatore ${seat + 1}`}` : "Invita un giocatore"}</small></div></div>;
          })}
        </div>
        {session.me?.isHost ? (
          <button className="primary-button lobby-start" disabled={busy || session.participants.length !== session.requiredPlayers} type="button" onClick={async () => {
            setBusy(true); setMessage("");
            try { onUpdate((await sendAction("start", { code: session.code }, token)).session!); }
            catch (caught) { setMessage(caught instanceof Error ? caught.message : "Operazione non riuscita."); }
            finally { setBusy(false); }
          }}>{busy ? "Avvio…" : "Inizia la partita"}<span>→</span></button>
        ) : <p className="waiting-note">La partita inizierà quando l’host avrà avviato la sessione.</p>}
        {message && !message.includes("copiato") && <p className="form-error">{message}</p>}
      </section>
    </main>
  );
}

function SessionHeading({ session, onLeave }: { session: SessionSnapshot; onLeave: () => void }) {
  return (
    <header className="session-heading">
      <div><a className="brand" href="#top"><span className="brand-mark">B</span><span>Burraco Online</span></a><small>{modeLabel(session.mode)} · codice {session.code}</small></div>
      <button type="button" onClick={onLeave}>Esci</button>
    </header>
  );
}

function SharedGame({ session, token, onUpdate, onLeave }: {
  session: SessionSnapshot;
  token: string;
  onUpdate: (session: SessionSnapshot) => void;
  onLeave: () => void;
}) {
  const [draft, setDraft] = useState<Breakdown>(() => emptyBreakdown());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"score" | "history">("score");
  const me = session.me;
  const mySide = !me
    ? null
    : session.mode === "3p"
      ? session.soloSeat === null ? null : me.seat === session.soloSeat ? 0 : 1
      : me.side;
  const mySubmission = session.submissions.find((submission) => submission.side === mySide);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset when the authoritative server submission changes */
    setDraft(mySubmission?.breakdown ?? emptyBreakdown());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [session.roundNumber, mySide, mySubmission?.updatedAt, mySubmission?.breakdown]);

  const role = useMemo(() => {
    if (!me || mySide === null) return null;
    if (session.mode === "3p") {
      if (mySide === 0) return { title: `Solo · ${me.name}`, subtitle: "Pozzetto da 18 · punteggio intero" };
      const pair = session.participants.filter((participant) => participant.seat !== session.soloSeat).map((participant) => participant.name);
      return { title: "Coppia", subtitle: `${pair.join(" + ")} · il totale verrà diviso a metà` };
    }
    if (session.mode === "2v2") {
      const names = session.participants.filter((participant) => participant.side === mySide).map((participant) => participant.name);
      return { title: `Coppia ${mySide === 0 ? "A" : "B"}`, subtitle: names.join(" + ") };
    }
    return { title: me.name, subtitle: "Il tuo punteggio" };
  }, [me, mySide, session.mode, session.participants, session.soloSeat]);

  async function action(name: string, payload: Record<string, unknown> = {}) {
    setBusy(name); setError("");
    try { onUpdate((await sendAction(name, { code: session.code, ...payload }, token)).session!); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Operazione non riuscita."); }
    finally { setBusy(""); }
  }

  const bothSubmitted = session.submissions.some((item) => item.side === 0) && session.submissions.some((item) => item.side === 1);
  return (
    <div className="online-game" id="top">
      <div className="online-shell">
        <SessionHeading session={session} onLeave={onLeave} />
        <Scoreboard session={session} />
        {session.status === "finished" && (
          <section className="winner-banner"><div><strong>{session.winnerIndex === null ? "Partita terminata" : `${session.scoreboard[session.winnerIndex].name} ha vinto`}</strong><p>Risultato sincronizzato su tutti i dispositivi.</p></div></section>
        )}
        <nav className="tab-bar"><button className={tab === "score" ? "active" : ""} onClick={() => setTab("score")}>Partita</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Storico <span>{session.rounds.length}</span></button></nav>

        {tab === "score" && session.status === "active" && (
          <>
            <section className="round-status-card">
              <div><small>Smazzata</small><strong>#{session.roundNumber}</strong></div>
              <div className="submission-dots"><span className={session.submissions.some((item) => item.side === 0) ? "done" : ""}>Lato 1</span><span className={session.submissions.some((item) => item.side === 1) ? "done" : ""}>Lato 2</span></div>
            </section>

            {session.mode === "3p" && session.me?.isHost && (
              <section className="three-player-setup online-solo-picker">
                <div><strong>Chi ha preso il pozzetto da 18?</strong><small>La scelta assegna automaticamente il lato solo e la coppia.</small></div>
                <div className="solo-choice">{session.participants.map((participant) => <button type="button" className={session.soloSeat === participant.seat ? "selected" : ""} key={participant.id} disabled={busy === "setSolo"} onClick={() => void action("setSolo", { soloSeat: participant.seat })}>{participant.name}</button>)}</div>
              </section>
            )}

            {session.mode === "3p" && session.soloSeat === null ? (
              <section className="waiting-panel"><span>18</span><h2>In attesa del pozzetto</h2><p>{session.me?.isHost ? "Scegli chi ha preso il pozzetto da 18." : "L’host sta indicando chi gioca da solo."}</p></section>
            ) : role ? (
              <>
                <RoundEditor title={role.title} subtitle={role.subtitle} breakdown={draft} rules={session.bonusRules} onChange={setDraft} />
                <div className="submit-bar">
                  <div>{mySubmission ? <><strong>Conteggio inviato</strong><small>Ultimo invio di {mySubmission.participantName}</small></> : <><strong>Non ancora inviato</strong><small>Puoi modificarlo anche dopo l’invio.</small></>}</div>
                  <button className="primary-button" disabled={busy === "submit"} type="button" onClick={() => void action("submit", { breakdown: draft })}>{busy === "submit" ? "Invio…" : mySubmission ? "Aggiorna" : "Invia punti"}<span>→</span></button>
                </div>
              </>
            ) : null}

            <section className="host-confirm-card">
              <div className="section-heading"><div><h3>Riepilogo smazzata</h3><p>L’host conferma quando entrambi i lati hanno inviato.</p></div></div>
              <div className="side-submissions">{[0, 1].map((side) => { const submission = session.submissions.find((item) => item.side === side); return <div key={side} className={submission ? "ready" : ""}><span>{session.mode === "3p" ? side === 0 ? "Solo" : "Coppia" : session.mode === "2v2" ? `Coppia ${side === 0 ? "A" : "B"}` : session.scoreboard[side]?.name}</span><strong>{submission ? `${submission.score > 0 ? "+" : ""}${formatScore(submission.score)}` : "In attesa"}</strong>{submission && <small>di {submission.participantName}</small>}</div>; })}</div>
              {session.me?.isHost ? <button className="primary-button confirm-button" type="button" disabled={!bothSubmitted || busy === "confirm"} onClick={() => void action("confirm")}>{busy === "confirm" ? "Conferma…" : "Conferma smazzata"}<span>✓</span></button> : <p className="waiting-note">Dopo i due invii, l’host confermerà la smazzata.</p>}
            </section>
          </>
        )}

        {tab === "score" && session.status === "finished" && <History session={session} onUndo={session.me?.isHost ? () => void action("undo") : undefined} />}
        {tab === "history" && <History session={session} onUndo={session.me?.isHost && session.rounds.length ? () => void action("undo") : undefined} />}
        {error && <div className="toast toast--error" role="alert">{error}</div>}
      </div>
    </div>
  );
}

function History({ session, onUndo }: { session: SessionSnapshot; onUndo?: () => void }) {
  const cumulative = session.rounds.reduce<number[][]>((items, round) => {
    const previous = items.at(-1) ?? session.scoreboard.map(() => 0);
    items.push(previous.map((score, index) => score + (round.scores[index] ?? 0)));
    return items;
  }, []);
  return (
    <section className="round-list shared-history">
      <div className="round-list-head" style={{ gridTemplateColumns: `0.65fr repeat(${session.scoreboard.length}, 1fr)` }}><span>Smazzata</span>{session.scoreboard.map((entry, index) => <span key={`${entry.name}-${index}`}>{entry.name}</span>)}</div>
      {session.rounds.length === 0 ? <div className="history-empty">Nessuna smazzata confermata.</div> : [...session.rounds].reverse().map((round, reverseIndex) => { const index = session.rounds.length - 1 - reverseIndex; const solo = round.soloSeat === null ? "" : session.participants.find((participant) => participant.seat === round.soloSeat)?.name; return <div className="round-row" key={round.roundNumber} style={{ gridTemplateColumns: `0.65fr repeat(${session.scoreboard.length}, 1fr)` }}><span>#{round.roundNumber}{solo && <small>{solo} solo</small>}</span>{round.scores.map((score, scoreIndex) => <span key={scoreIndex}><strong>{score > 0 ? "+" : ""}{formatScore(score)}</strong><small>{formatScore(cumulative[index][scoreIndex])} tot.</small></span>)}</div>; })}
      {onUndo && <button className="text-button" type="button" onClick={onUndo}>Annulla ultima smazzata</button>}
    </section>
  );
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [error, setError] = useState("");
  const [initialJoinCode, setInitialJoinCode] = useState("");

  const refresh = useCallback(async (current: Credentials, quiet = false) => {
    try {
      const next = await requestSession(current.code, current.token);
      setSession((previous) => !previous || previous.version !== next.version ? next : previous);
      if (!quiet) setError("");
    } catch (caught) {
      if (!quiet) setError(caught instanceof Error ? caught.message : "Sessione non disponibile.");
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- credentials and join links are browser-only */
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Credentials;
        setCredentials(parsed);
        void refresh(parsed);
      } catch { window.localStorage.removeItem(SESSION_KEY); }
    } else {
      const joinCode = new URL(window.location.href).searchParams.get("join")?.toUpperCase().slice(0, 6) ?? "";
      if (joinCode) { setInitialJoinCode(joinCode); setScreen("join"); }
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  useEffect(() => {
    if (!credentials) return;
    const interval = window.setInterval(() => void refresh(credentials, true), 2500);
    return () => window.clearInterval(interval);
  }, [credentials, refresh]);

  function enter(nextSession: SessionSnapshot, token: string) {
    const next = { code: nextSession.code, token };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    window.history.replaceState({}, "", window.location.pathname);
    setCredentials(next); setSession(nextSession); setError("");
  }

  function leave() {
    window.localStorage.removeItem(SESSION_KEY);
    setCredentials(null); setSession(null); setScreen("home"); setError("");
  }

  if (!hydrated || (credentials && !session)) {
    return <main className="loading-shell"><span className="brand-mark">B</span><p>{error || "Connessione alla partita…"}</p>{error && <button className="secondary-button" onClick={leave}>Torna all’inizio</button>}</main>;
  }
  if (session && credentials) {
    return session.status === "lobby"
      ? <Lobby session={session} token={credentials.token} onUpdate={setSession} onLeave={leave} />
      : <SharedGame session={session} token={credentials.token} onUpdate={setSession} onLeave={leave} />;
  }
  if (screen === "create") return <CreateSession onCancel={() => setScreen("home")} onCreated={enter} />;
  if (screen === "join") return <JoinSession initialCode={initialJoinCode} onCancel={() => { setScreen("home"); setInitialJoinCode(""); }} onJoined={enter} />;

  return (
    <>
      <header className="landing-header"><a className="brand" href="#top"><span className="brand-mark">B</span><span>Burraco Online</span></a><span className="online-badge">multi-dispositivo</span></header>
      <main className="online-home" id="top">
        <section className="online-hero"><p className="eyebrow">Partita condivisa</p><h1>Ognuno conta dal proprio telefono.</h1><p>Create una sessione, entrate con il codice e confermate insieme ogni smazzata.</p></section>
        <section className="entry-grid">
          <button type="button" className="entry-card entry-card--primary" onClick={() => setScreen("create")}><span>01</span><div><strong>Crea una partita</strong><small>Configura le regole e invita gli altri.</small></div><b>→</b></button>
          <button type="button" className="entry-card" onClick={() => setScreen("join")}><span>02</span><div><strong>Entra con il codice</strong><small>Collegati a una sessione già creata.</small></div><b>→</b></button>
        </section>
        <p className="online-footnote">Nessun account richiesto. La sessione si aggiorna automaticamente.</p>
      </main>
    </>
  );
}

