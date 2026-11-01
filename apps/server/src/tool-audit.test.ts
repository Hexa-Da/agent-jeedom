import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ToolAuditCollector,
  classifyToolCall,
  errorMessageFromResult,
  formatToolAuditConsoleLines,
  memoryToolAuditWriter,
  pathsFromArgs,
  type ToolAuditEvent,
  type ToolAuditFlushSummary,
} from "./tool-audit.js";

test("pathsFromArgs lit path / target_directory et scanne en secours", () => {
  assert.deepEqual(pathsFromArgs({ path: "socle/scenarios.md" }), ["socle/scenarios.md"]);
  assert.deepEqual(pathsFromArgs({ target_directory: "skills/onboarding" }), ["skills/onboarding"]);
  assert.ok(pathsFromArgs({ query: "x", extra: "voir socle/atlas.md ici" }).some((p) => p.includes("socle/")));
  assert.deepEqual(pathsFromArgs(null), []);
  assert.deepEqual(pathsFromArgs("nope"), []);
});

test("classifyToolCall ordonne webFetch, save_profile, socle, skill ; other → null", () => {
  assert.deepEqual(classifyToolCall("webFetch", { url: "https://doc.jeedom.com/x" }), {
    kind: "webFetch",
    name: "webFetch",
    url: "https://doc.jeedom.com/x",
  });
  assert.deepEqual(classifyToolCall("save_profile", { content: "abc" }), {
    kind: "save_profile",
    name: "save_profile",
    contentChars: 3,
  });
  assert.deepEqual(classifyToolCall("read", { path: "socle/scenarios.md" }), {
    kind: "socle",
    name: "read",
    path: "socle/scenarios.md",
  });
  assert.deepEqual(classifyToolCall("read", { path: "skills/onboarding/SKILL.md" }), {
    kind: "skill",
    name: "read",
    path: "skills/onboarding/SKILL.md",
    skill: "onboarding",
  });
  assert.equal(classifyToolCall("read", { path: "AGENTS.md" }), null);
  assert.equal(classifyToolCall("grep", { pattern: "foo" }), null);
});

test("ToolAuditCollector écrit une ligne par appel avec runId commun et ignore other", () => {
  const sink: ToolAuditEvent[] = [];
  const audit = new ToolAuditCollector(memoryToolAuditWriter(sink), "run-fixed");

  audit.record({
    call_id: "1",
    name: "read",
    status: "running",
    args: { path: "socle/a.md" },
  });
  audit.record({
    call_id: "1",
    name: "read",
    status: "completed",
    args: { path: "socle/a.md" },
  });
  audit.record({
    call_id: "2",
    name: "webFetch",
    status: "completed",
    args: { url: "https://doc.jeedom.com" },
  });
  audit.record({
    call_id: "3",
    name: "save_profile",
    status: "completed",
    args: { content: "profil" },
  });
  audit.record({
    call_id: "4",
    name: "read",
    status: "completed",
    args: { path: "skills/refine-profile/SKILL.md" },
  });
  audit.record({
    call_id: "5",
    name: "grep",
    status: "completed",
    args: { path: "README.md", pattern: "x" },
  });

  const summary = audit.flush("agent-x");
  assert.equal(summary.runId, "run-fixed");
  assert.equal(sink.length, 4);
  assert.ok(sink.every((e) => e.runId === "run-fixed" && e.agentId === "agent-x"));
  assert.equal(summary.socle, 1);
  assert.equal(summary.webFetch, 1);
  assert.equal(summary.save_profile, 1);
  assert.deepEqual(summary.skills, ["refine-profile"]);
  assert.equal(summary.errorCount, 0);
  assert.ok(sink.every((e) => typeof e.ts === "string" && e.ts.length > 0));
  assert.equal(sink.find((e) => e.kind === "skill")?.skill, "refine-profile");
});

test("recordInjectedSkill journalise refine-profile sans read SDK", () => {
  const sink: ToolAuditEvent[] = [];
  const audit = new ToolAuditCollector(memoryToolAuditWriter(sink), "run-fin");
  audit.recordInjectedSkill("refine-profile");
  const summary = audit.flush("agent-f");
  assert.equal(sink.length, 1);
  assert.equal(sink[0].kind, "skill");
  assert.equal(sink[0].skill, "refine-profile");
  assert.equal(sink[0].status, "completed");
  assert.equal(summary.skills[0], "refine-profile");
});

test("flush d'un run vide n'écrit rien", () => {
  const sink: ToolAuditEvent[] = [];
  const audit = new ToolAuditCollector(memoryToolAuditWriter(sink));
  audit.record({ call_id: "x", name: "mcp", status: "completed" });
  const summary = audit.flush("agent-empty");
  assert.equal(sink.length, 0);
  assert.equal(summary.events.length, 0);
});

test("errorMessageFromResult lit les formes SDK courantes", () => {
  assert.equal(errorMessageFromResult({ status: "error", error: { message: "timeout" } }), "timeout");
  assert.equal(errorMessageFromResult({ status: "error", error: "refus" }), "refus");
  assert.equal(errorMessageFromResult({ message: "boom" }), "boom");
  assert.equal(errorMessageFromResult("plain"), "plain");
  assert.equal(errorMessageFromResult({ status: "success", value: {} }), undefined);
  assert.equal(errorMessageFromResult(null), undefined);
});

test("ToolAuditCollector distingue webFetch échoué de webFetch absent", () => {
  const failed: ToolAuditEvent[] = [];
  const failedAudit = new ToolAuditCollector(memoryToolAuditWriter(failed));
  failedAudit.record({
    call_id: "wf",
    name: "webFetch",
    status: "error",
    args: { url: "https://doc.jeedom.com/fr_FR/core/" },
    result: { status: "error", error: { message: "page inaccessible" } },
  });
  const failedSummary = failedAudit.flush("agent-fail");
  assert.equal(failedSummary.webFetch, 1);
  assert.equal(failedSummary.errorCount, 1);
  assert.equal(failed[0]?.status, "error");
  assert.equal(failed[0]?.error, "page inaccessible");

  const absent: ToolAuditEvent[] = [];
  const absentAudit = new ToolAuditCollector(memoryToolAuditWriter(absent));
  absentAudit.record({
    call_id: "s",
    name: "read",
    status: "completed",
    args: { path: "socle/scenarios.md" },
  });
  const absentSummary = absentAudit.flush("agent-absent");
  assert.equal(absentSummary.webFetch, 0);
  assert.equal(absentSummary.errorCount, 0);
});

test("formatToolAuditConsoleLines annonce errors=N et détaille chaque échec", () => {
  const summary: ToolAuditFlushSummary = {
    runId: "abcdefgh-ijkl",
    agentId: "a",
    socle: 1,
    webFetch: 1,
    save_profile: 0,
    skills: [],
    errorCount: 1,
    events: [
      {
        ts: "2026-11-01T00:00:00.000Z",
        runId: "abcdefgh-ijkl",
        agentId: "a",
        kind: "socle",
        name: "read",
        path: "socle/a.md",
        status: "completed",
      },
      {
        ts: "2026-11-01T00:00:01.000Z",
        runId: "abcdefgh-ijkl",
        agentId: "a",
        kind: "webFetch",
        name: "webFetch",
        url: "https://doc.jeedom.com/x",
        status: "error",
        error: "timeout",
      },
    ],
  };
  const lines = formatToolAuditConsoleLines(summary);
  assert.equal(lines[0], "[tool-audit] run=abcdefgh socle=1 webFetch=1 save_profile=0 errors=1");
  assert.equal(lines[1], "[tool-audit] error webFetch https://doc.jeedom.com/x — timeout");
});
