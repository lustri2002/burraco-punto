import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the Burraco Punto Online application shell", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bundle = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");

  assert.match(layout, /title: "Burraco Punto Online"/);
  assert.match(layout, /<html lang="it">/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(page, /Connessione alla partita/);
  assert.match(page, /Crea una partita/);
  assert.match(page, /Entra con il codice/);
  assert.ok(bundle.length > 0);
  assert.doesNotMatch(page, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("ships the online installable application manifest", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  );

  assert.equal(manifest.name, "Burraco Punto Online");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.lang, "it");
});

test("keeps every supported table mode and configurable scoring rules", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const game = await readFile(new URL("../lib/game.ts", import.meta.url), "utf8");

  assert.match(page, /\['1v1', '1 vs 1'\]/);
  assert.match(page, /\['2v2', '2 vs 2'\]/);
  assert.match(page, /\['3p', '3 giocatori'\]/);
  assert.match(page, /Chi ha preso il pozzetto da 18/);
  assert.match(page, /<details className="bonus-description">/);
  assert.match(game, /bonus\.key === "pulito" \|\| bonus\.key === "sporco"/);
  assert.match(game, /export function calculateScore/);
});

test("implements protected shared sessions and server-side confirmation", async () => {
  const route = await readFile(new URL("../app/api/session/route.ts", import.meta.url), "utf8");
  const migration = await readFile(
    new URL("../drizzle/0000_numerous_mattie_franklin.sql", import.meta.url),
    "utf8",
  );

  for (const action of ["create", "join", "start", "setSolo", "submit", "confirm", "undo"]) {
    assert.match(route, new RegExp(`action === "${action}"`));
  }
  assert.match(route, /hashToken\(token\)/);
  assert.match(route, /calculateScore\(breakdown, rules\)/);
  assert.match(route, /sideScores\[1\] \/ 2/);
  assert.match(route, /Solo l.host può eseguire questa operazione/);
  assert.match(migration, /CREATE TABLE `sessions`/);
  assert.match(migration, /CREATE TABLE `participants`/);
  assert.match(migration, /CREATE TABLE `round_submissions`/);
  assert.match(migration, /CREATE TABLE `rounds`/);
});
