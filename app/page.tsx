import Link from "next/link";

export default function ModeHome() {
  return (
    <div className="mode-landing" id="top">
      <header className="landing-header">
        <a className="brand" href="#top">
          <span className="brand-mark">B</span>
          <span>Burraco Punto</span>
        </a>
      </header>

      <main className="mode-home">
        <section className="mode-intro">
          <p className="eyebrow">Segnapunti Burraco</p>
          <h1>Come volete giocare?</h1>
          <p>Scegliete dove inserire i punti. Regole e calcolo restano gli stessi.</p>
        </section>

        <section className="mode-grid" aria-label="Modalità disponibili">
          <Link className="mode-card mode-card--offline" href="/offline">
            <span className="mode-card-number">01</span>
            <div>
              <small>Un solo dispositivo</small>
              <h2>Su questo telefono</h2>
              <p>Una persona inserisce tutti i punteggi. Le partite restano salvate in locale.</p>
            </div>
            <strong aria-hidden="true">→</strong>
          </Link>

          <Link className="mode-card mode-card--online" href="/online">
            <span className="mode-card-number">02</span>
            <div>
              <small>Più dispositivi</small>
              <h2>Partita condivisa</h2>
              <p>Create un codice e ciascuno inserisce i propri punti dal suo telefono.</p>
            </div>
            <strong aria-hidden="true">→</strong>
          </Link>
        </section>
      </main>
    </div>
  );
}
