import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatSessions, type ChatEvent } from "./sessions.js";
import { FakeAgent, MemoryStore, assistantText, fakeFactory, fakeOptions, toolCall } from "./test-helpers.js";
import { memoryToolAuditWriter, type ToolAuditEvent, type ToolAuditWriter } from "./tool-audit.js";

const fakeContext = (kind: "new" | "resume") => (kind === "new" ? "CONSIGNES" : "PROFIL A JOUR");

function setup(
  agents: FakeAgent[],
  store = new MemoryStore(),
  toolAuditWriter: ToolAuditWriter = () => undefined,
) {
  const factory = fakeFactory(agents);
  const sessions = new ChatSessions({
    factory,
    buildOptions: fakeOptions,
    buildContext: fakeContext,
    store,
    toolAuditWriter,
  });
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

test("audite socle, webFetch, skill et save_profile sur un run", async () => {
  const auditLog: ToolAuditEvent[] = [];
  const agent = new FakeAgent("agent-audit", {
    events: [
      toolCall("read", { call_id: "a", status: "running", args: { path: "socle/scenarios.md" } }),
      toolCall("read", { call_id: "a", status: "completed", args: { path: "socle/scenarios.md" } }),
      toolCall("webFetch", { call_id: "b", status: "completed", args: { url: "https://doc.jeedom.com/fr_FR/core/" } }),
      toolCall("read", { call_id: "c", status: "completed", args: { path: "skills/onboarding/SKILL.md" } }),
      toolCall("save_profile", { call_id: "d", status: "completed", args: { content: "profil complet" } }),
      assistantText("Réponse."),
    ],
  });
  const { sessions } = setup([agent], new MemoryStore(), memoryToolAuditWriter(auditLog));

  const events = await send(sessions, "Aide-moi");

  assert.deepEqual(
    events.filter((e) => e.type === "status").map((e) => (e.type === "status" ? e.text : "")),
    ["Je consulte la documentation…", "Je consulte la doc en ligne…", "Je mets à jour votre profil…"],
  );
  assert.equal(auditLog.length, 4);
  assert.ok(auditLog.every((e) => e.runId === auditLog[0].runId && e.agentId === "agent-audit"));
  assert.equal(auditLog.filter((e) => e.kind === "socle").length, 1);
  assert.equal(auditLog.filter((e) => e.kind === "webFetch").length, 1);
  assert.equal(auditLog.filter((e) => e.kind === "skill").length, 1);
  assert.equal(auditLog.filter((e) => e.kind === "save_profile").length, 1);
  assert.equal(auditLog.find((e) => e.kind === "webFetch")?.url, "https://doc.jeedom.com/fr_FR/core/");
  assert.equal(auditLog.find((e) => e.kind === "skill")?.skill, "onboarding");
  assert.equal(auditLog.find((e) => e.kind === "save_profile")?.contentChars, "profil complet".length);
});

test("scénario hors socle : audit exige webFetch ≥ 1 quand l'agent fetch la doc", async () => {
  const auditLog: ToolAuditEvent[] = [];
  const agent = new FakeAgent("agent-hors-socle", {
    events: [
      toolCall("read", { call_id: "idx", status: "completed", args: { path: "socle/00-index.md" } }),
      toolCall("grep", {
        call_id: "miss",
        status: "completed",
        args: { path: "socle", pattern: "widget custom inconnu" },
      }),
      toolCall("webFetch", {
        call_id: "doc",
        status: "completed",
        args: { url: "https://doc.jeedom.com/fr_FR/core/4.5/dashboard/" },
      }),
      assistantText("D'après la doc en ligne…"),
    ],
  });
  const { sessions } = setup([agent], new MemoryStore(), memoryToolAuditWriter(auditLog));

  await send(sessions, "Comment configurer un widget custom hors fiches socle ?");

  assert.ok(auditLog.filter((e) => e.kind === "webFetch").length >= 1);
  assert.equal(
    auditLog.find((e) => e.kind === "webFetch")?.url,
    "https://doc.jeedom.com/fr_FR/core/4.5/dashboard/",
  );
  assert.ok(auditLog.every((e) => e.status !== "error"));
});

test("audit : webFetch en erreur compte comme appelé (≠ absent) avec status/error", async () => {
  const auditLog: ToolAuditEvent[] = [];
  const agent = new FakeAgent("agent-fetch-err", {
    events: [
      toolCall("read", { call_id: "s", status: "completed", args: { path: "socle/00-index.md" } }),
      toolCall("webFetch", {
        call_id: "wf",
        status: "running",
        args: { url: "https://doc.jeedom.com/fr_FR/core/save/" },
      }),
      toolCall("webFetch", {
        call_id: "wf",
        status: "error",
        args: { url: "https://doc.jeedom.com/fr_FR/core/save/" },
        result: { status: "error", error: { message: "HTTP 500" } },
      }),
      assistantText("La page doc n'a pas chargé."),
    ],
  });
  const { sessions } = setup([agent], new MemoryStore(), memoryToolAuditWriter(auditLog));

  await send(sessions, "Détail Save hors socle");

  const wf = auditLog.filter((e) => e.kind === "webFetch");
  assert.equal(wf.length, 1);
  assert.equal(wf[0]?.status, "error");
  assert.equal(wf[0]?.error, "HTTP 500");
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
  const auditLog: ToolAuditEvent[] = [];
  const first = new FakeAgent(
    "agent-1",
    { events: [assistantText("OK")] },
    { events: [assistantText("OK")] },
    {
      events: [
        toolCall("save_profile", {
          call_id: "sp",
          status: "completed",
          args: { content: "## Statut\n- Onboarding terminé : oui" },
        }),
        assistantText("OK"),
      ],
    },
  );
  const second = new FakeAgent("agent-2");
  const finalizePrompt = "FINALIZE refine-profile save_profile";
  const sessions = new ChatSessions({
    factory: fakeFactory([first, second]),
    buildOptions: fakeOptions,
    buildContext: fakeContext,
    store: new MemoryStore(),
    finalizePrompt,
    toolAuditWriter: memoryToolAuditWriter(auditLog),
  });

  await send(sessions, "Question 1");
  await send(sessions, "Question 2");
  await sessions.startNew();

  assert.equal(first.sent.length, 3);
  assert.equal(first.sent[2].text, finalizePrompt);
  assert.equal(first.closed, true);
  assert.equal(sessions.snapshot().messages.length, 0);

  const finalizeEvents = auditLog.filter((e) => e.agentId === "agent-1");
  assert.ok(finalizeEvents.length >= 2);
  assert.ok(finalizeEvents.every((e) => e.runId === finalizeEvents[0].runId));
  assert.ok(finalizeEvents.some((e) => e.kind === "skill" && e.skill === "refine-profile"));
  assert.ok(finalizeEvents.some((e) => e.kind === "save_profile"));
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
