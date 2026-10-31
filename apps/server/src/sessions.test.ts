import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatSessions, type ChatEvent } from "./sessions.js";
import { FakeAgent, MemoryStore, assistantText, fakeFactory, fakeOptions, toolCall } from "./test-helpers.js";

const fakeContext = (kind: "new" | "resume") => (kind === "new" ? "CONSIGNES" : "PROFIL A JOUR");

function setup(agents: FakeAgent[], store = new MemoryStore()) {
  const factory = fakeFactory(agents);
  const sessions = new ChatSessions({ factory, buildOptions: fakeOptions, buildContext: fakeContext, store });
  return { sessions, factory, store };
}

async function send(sessions: ChatSessions, text: string, hidden = false) {
  const events: ChatEvent[] = [];
  await sessions.send({ text, hidden }, (event) => events.push(event));
  return events;
}

test("envoie le message, diffuse les morceaux de réponse et enregistre la conversation", async () => {
  const agent = new FakeAgent("agent-1", { events: [assistantText("Bonjour "), assistantText("Monsieur.")] });
  const { sessions, store } = setup([agent]);

  const events = await send(sessions, "Salut");

  assert.deepEqual(
    events.map((e) => e.type),
    ["delta", "delta", "done"],
  );
  assert.equal(agent.sent[0].text, "CONSIGNES\n\n---\nMessage de l'utilisateur :\nSalut");
  assert.deepEqual(sessions.snapshot().messages.map((m) => [m.role, m.text]), [
    ["user", "Salut"],
    ["assistant", "Bonjour Monsieur."],
  ]);
  assert.equal(store.session?.agentId, "agent-1");
});

test("annonce la consultation de la documentation et sépare les textes avant/après outil", async () => {
  const agent = new FakeAgent("agent-1", {
    events: [assistantText("Je regarde."), toolCall("read"), toolCall("grep"), assistantText("Voici la réponse.")],
  });
  const { sessions } = setup([agent]);

  const events = await send(sessions, "Comment faire ?");

  assert.deepEqual(events.filter((e) => e.type === "status"), [{ type: "status", text: "Je consulte la documentation…" }]);
  const reply = sessions.snapshot().messages.at(-1)?.text;
  assert.equal(reply, "Je regarde.\n\nVoici la réponse.");
});

test("les messages cachés (lancement de l'onboarding) ne sont pas exposés", async () => {
  const agent = new FakeAgent("agent-1", { events: [assistantText("Bienvenue !")] });
  const { sessions } = setup([agent]);

  await send(sessions, "Bonjour", true);

  assert.deepEqual(sessions.snapshot().messages.map((m) => m.role), ["assistant"]);
});

test("les consignes ne sont jointes qu'au premier message de la conversation", async () => {
  const agent = new FakeAgent("agent-1");
  const { sessions } = setup([agent]);

  await send(sessions, "Première");
  await send(sessions, "Seconde");

  assert.match(agent.sent[0].text, /^CONSIGNES/);
  assert.equal(agent.sent[1].text, "Seconde");
  assert.equal(sessions.snapshot().messages[0].text, "Première");
});

test("une conversation reprise reçoit le profil à jour avec son premier message", async () => {
  const store = new MemoryStore({ agentId: "agent-old", messages: [{ role: "user", text: "Avant" }] });
  const agent = new FakeAgent("agent-old");
  const { sessions } = setup([agent], store);

  await sessions.resumeLast();
  await send(sessions, "Après");

  assert.equal(agent.sent[0].text, "PROFIL A JOUR\n\n---\nMessage de l'utilisateur :\nAprès");
});

test("si le run échoue, les consignes sont renvoyées au message suivant", async () => {
  const agent = new FakeAgent("agent-1", { status: "error", error: "panne" }, { events: [assistantText("Bonjour")] });
  const { sessions } = setup([agent]);

  const failed = await send(sessions, "Salut");
  assert.equal(failed.at(-1)?.type, "error");
  await send(sessions, "Salut encore");

  assert.match(agent.sent[1].text, /^CONSIGNES/);
});

test("une erreur de run est renvoyée comme évènement lisible sans planter", async () => {
  const agent = new FakeAgent("agent-1", { status: "error", error: "panne" });
  const { sessions } = setup([agent]);

  const events = await send(sessions, "Salut");

  const last = events.at(-1);
  assert.equal(last?.type, "error");
  assert.match((last as { message: string }).message, /panne/);
});

test("refuse un second envoi pendant qu'une réponse est en cours", async () => {
  let release!: () => void;
  const agent = new FakeAgent("agent-1");
  const originalSend = agent.send.bind(agent);
  agent.send = async (message) => {
    await new Promise<void>((resolve) => (release = resolve));
    return originalSend(message);
  };
  const { sessions } = setup([agent]);

  const first = send(sessions, "Première");
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(sessions.startNew(), /déjà en train de répondre/);
  release();
  await first;
});

test("nouvelle conversation : met à jour le profil si la conversation était substantielle", async () => {
  const first = new FakeAgent("agent-1");
  const second = new FakeAgent("agent-2");
  const { sessions } = setup([first, second]);

  await send(sessions, "Question 1");
  await send(sessions, "Question 2");
  await sessions.startNew();

  assert.equal(first.sent.length, 3);
  assert.match(first.sent[2].text, /save_profile/);
  assert.equal(first.closed, true);
  assert.equal(sessions.snapshot().messages.length, 0);
});

test("nouvelle conversation : pas de mise à jour du profil après un échange trivial", async () => {
  const first = new FakeAgent("agent-1");
  const { sessions } = setup([first, new FakeAgent("agent-2")]);

  await send(sessions, "Une seule question");
  await sessions.startNew();

  assert.equal(first.sent.length, 1);
  assert.equal(first.closed, true);
});

test("« Reprendre la dernière » pointe toujours sur la conversation précédente tant que rien n'est échangé", async () => {
  const old = new FakeAgent("agent-old");
  const { sessions, store } = setup([old, new FakeAgent("agent-new")]);

  await send(sessions, "Ancienne question");
  await sessions.startNew();
  assert.equal(store.session?.agentId, "agent-old");
  assert.equal(sessions.snapshot().canResume, true);
});

test("reprend la dernière conversation avec son historique", async () => {
  const store = new MemoryStore({
    agentId: "agent-old",
    messages: [
      { role: "user", text: "Volets ?" },
      { role: "assistant", text: "Voici comment faire." },
    ],
  });
  const { sessions, factory } = setup([new FakeAgent("agent-old")], store);

  assert.equal(await sessions.resumeLast(), true);
  assert.deepEqual(factory.resumed, ["agent-old"]);
  assert.equal(sessions.snapshot().messages.length, 2);
});

test("reprendre sans conversation enregistrée renvoie false", async () => {
  const { sessions } = setup([]);
  assert.equal(await sessions.resumeLast(), false);
});
