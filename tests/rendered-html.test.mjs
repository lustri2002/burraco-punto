import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Segnapunti Burraco application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="it">/i);
  assert.match(html, /<title>Segnapunti Burraco<\/title>/i);
  assert.match(html, /Caricamento/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("ships the offline application manifest", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  );

  assert.equal(manifest.name, "Segnapunti Burraco");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.lang, "it");
});

test("supports flexible tables, the 18 + 11 mode, and downloadable summaries", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /"1v1" \| "2v2" \| "3p"/);
  assert.match(page, /Chi ha preso il pozzetto da 18/);
  assert.match(page, /sideScores\[1\].*\/ 2/);
  assert.match(page, /firstRoundBaseline = tableTop \+ 92/);
  assert.match(page, /Scarica riepilogo/);
  assert.match(page, /canvas\.toDataURL\("image\/png"\)/);
});

test("supports configurable burraco bonuses without changing the solo player from the scoreboard", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /bonus\.key === "pulito" \|\| bonus\.key === "sporco"/);
  assert.match(page, /Attiva quelli che usate e imposta il relativo punteggio/);
  assert.match(page, /disabled=\{game\.mode === "3p"\}/);
  assert.match(page, /calculateScore\(breakdown, game\.bonusRules\)/);
});
