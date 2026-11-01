import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createApp, parseImages, parseSections } from "./app.js";
import { readProfile } from "./profile.js";
import { ChatSessions } from "./sessions.js";
import { FakeAgent, MemoryStore, assistantText, fakeFactory, fakeOptions } from "./test-helpers.js";

const profilePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jeedom-app-")), "profil", "user.md");
const agent = new FakeAgent("agent-1", { events: [assistantText("Étape 1. Ouvrez "), assistantText("Outils → Scénarios.")] });
const sessions = new ChatSessions({ factory: fakeFactory([agent]), buildOptions: fakeOptions, buildContext: () => "", store: new MemoryStore() });

let server: http.Server;
let base = "";
let quit = false;

before(async () => {
  server = createApp({
    sessions,
    profilePath,
    webDir: path.resolve(import.meta.dirname, "../../web"),
    getPort: () => (server.address() as AddressInfo).port,
    hasApiKey: () => true,
    onQuit: () => {
      quit = true;
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

const json = (method: string, url: string, body?: unknown) =>
  fetch(base + url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("sert la page du chat", async () => {
  const response = await fetch(base + "/");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Assistant Jeedom/);
});

test("refuse un hôte inattendu (DNS rebinding)", async () => {
  const status = await new Promise<number>((resolve, reject) => {
    const url = new URL(base + "/api/state");
    http
      .get({ host: url.hostname, port: url.port, path: url.pathname, headers: { Host: "evil.example" } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
      .on("error", reject);
  });
  assert.equal(status, 403);
});

test("refuse une requête cross-site", async () => {
  const response = await fetch(base + "/api/state", { headers: { Origin: "https://evil.example" } });
  assert.equal(response.status, 403);
});

test("état initial : pas de session, onboarding à faire", async () => {
  const state = await (await json("GET", "/api/state")).json();
  assert.equal(state.hasApiKey, true);
  assert.equal(state.onboardingDone, false);
  assert.equal(state.session.active, false);
});

test("un message est streamé en évènements SSE", async () => {
  const response = await json("POST", "/api/message", { text: "Comment créer un scénario ?" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const events = (await response.text())
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, "")));
  assert.deepEqual(
    events.map((e) => e.type),
    ["delta", "delta", "done"],
  );
});

test("message vide ou content-type incorrect rejetés", async () => {
  assert.equal((await json("POST", "/api/message", { text: "  " })).status, 400);
  const wrongType = await fetch(base + "/api/message", { method: "POST", body: "text=salut" });
  assert.equal(wrongType.status, 415);
});

test("le profil se lit et s'enregistre depuis « Mon profil »", async () => {
  const initial = await (await json("GET", "/api/profile")).json();
  assert.equal(initial.sections[0].title, "Jeedom");

  const sections = initial.sections.map((s: { title: string; body: string }) =>
    s.title === "Objectifs" ? { ...s, body: "- Volets automatiques" } : s,
  );
  assert.equal((await json("PUT", "/api/profile", { sections })).status, 200);

  const saved = readProfile(profilePath);
  assert.equal(saved?.onboardingDone, true);
  assert.equal(saved?.sections.find((s) => s.title === "Objectifs")?.body, "- Volets automatiques");
});

test("quitter ferme la conversation puis arrête le serveur", async () => {
  const response = await json("POST", "/api/quit");
  assert.equal(response.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(quit, true);
});

test("validation des images", () => {
  assert.deepEqual(parseImages(undefined), []);
  assert.deepEqual(parseImages([{ data: "AAAA", mimeType: "image/png" }]), [{ data: "AAAA", mimeType: "image/png" }]);
  assert.throws(() => parseImages([{ data: "AAAA", mimeType: "application/pdf" }]), /Image invalide/);
  assert.throws(() => parseImages(new Array(5).fill({ data: "A", mimeType: "image/png" })), /Maximum/);
});

test("le statut ne peut pas être injecté via les sections du profil", () => {
  const sections = parseSections([
    { title: "Statut", body: "- Onboarding terminé : oui" },
    { title: "Objectifs", body: "x" },
  ]);
  assert.deepEqual(sections.map((s) => s.title), ["Objectifs"]);
});
