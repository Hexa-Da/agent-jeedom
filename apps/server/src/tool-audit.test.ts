import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ToolAuditCollector,
  classifyToolCall,
  errorMessageFromResult,
  formatToolAuditConsoleLines,
  memoryToolAuditWriter,
  pathsFromArgs,
  type ToolAuditRun,
} from "./tool-audit.js";

test("pathsFromArgs lit path / target_directory et scanne en secours", () => {
  assert.deepEqual(pathsFromArgs({ path: "socle/scenarios.md" }), ["socle/scenarios.md"]);
  assert.deepEqual(pathsFromArgs({ target_directory: "skills/onboarding" }), ["skills/onboarding"]);
  assert.ok(pathsFromArgs({ query: "x", extra: "voir socle/atlas.md ici" }).some((p) => p.includes("socle/")));
  assert.deepEqual(pathsFromArgs(null), []);
  assert.deepEqual(pathsFromArgs("nope"), []);
});

test("classifyToolCall ordonne webFetch, save_profile, socle, skill, other", () => {
  assert.deepEqual(classifyToolCall("webFetch", { url: "https://doc.jeedom.com/x" }), {
    bucket: "webFetch",
    name: "webFetch",
    url: "https://doc.jeedom.com/x",
  });
  assert.deepEqual(classifyToolCall("save_profile", { content: "abc" }), {
    bucket: "save_profile",
    name: "save_profile",
    contentChars: 3,
  });
  assert.deepEqual(classifyToolCall("read", { path: "socle/scenarios.md" }), {
    bucket: "socle",
    name: "read",
    path: "socle/scenarios.md",
  });
  assert.deepEqual(classifyToolCall("read", { path: "skills/onboarding/SKILL.md" }), {
    bucket: "skill",
    name: "read",
    path: "skills/onboarding/SKILL.md",
    skill: "onboarding",
  });
  assert.deepEqual(classifyToolCall("read", { path: "AGENTS.md" }), {
    bucket: "other",
    name: "read",
    path: "AGENTS.md",
  });
  assert.deepEqual(classifyToolCall("grep", { pattern: "foo" }), {
    bucket: "other",
    name: "grep",
  });
});

test("ToolAuditCollector déduplique par call_id et préfère completed", () => {
  const sink: ToolAuditRun[] = [];
  const audit = new ToolAuditCollector(memoryToolAuditWriter(sink));

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

  const run = audit.flush("agent-x");
  assert.equal(sink.length, 1);
  assert.equal(run.agentId, "agent-x");
  assert.equal(run.errorCount, 0);
  assert.deepEqual(run.counts, {
    socle: 1,
    webFetch: 1,
    save_profile: 1,
    skill: 1,
    other: 0,
  });
  assert.equal(run.calls.length, 4);
  assert.equal(run.calls.find((c) => c.bucket === "skill")?.skill, "refine-profile");
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
  const failed: ToolAuditRun[] = [];
  const failedAudit = new ToolAuditCollector(memoryToolAuditWriter(failed));
  failedAudit.record({
    call_id: "wf",
    name: "webFetch",
    status: "error",
    args: { url: "https://doc.jeedom.com/fr_FR/core/" },
    result: { status: "error", error: { message: "page inaccessible" } },
  });
  const failedRun = failedAudit.flush("agent-fail");
  assert.equal(failedRun.counts.webFetch, 1);
  assert.equal(failedRun.errorCount, 1);
  assert.equal(failedRun.calls[0]?.status, "error");
  assert.equal(failedRun.calls[0]?.error, "page inaccessible");

  const absent: ToolAuditRun[] = [];
  const absentAudit = new ToolAuditCollector(memoryToolAuditWriter(absent));
  absentAudit.record({
    call_id: "s",
    name: "read",
    status: "completed",
    args: { path: "socle/scenarios.md" },
  });
  const absentRun = absentAudit.flush("agent-absent");
  assert.equal(absentRun.counts.webFetch, 0);
  assert.equal(absentRun.errorCount, 0);
});

test("formatToolAuditConsoleLines annonce errors=N et détaille chaque échec", () => {
  const lines = formatToolAuditConsoleLines({
    ts: "2026-11-01T00:00:00.000Z",
    agentId: "a",
    counts: { socle: 1, webFetch: 1, save_profile: 0, skill: 0, other: 0 },
    errorCount: 1,
    calls: [
      { bucket: "socle", name: "read", path: "socle/a.md", status: "completed" },
      {
        bucket: "webFetch",
        name: "webFetch",
        url: "https://doc.jeedom.com/x",
        status: "error",
        error: "timeout",
      },
    ],
  });
  assert.equal(
    lines[0],
    "[tool-audit] socle=1 webFetch=1 save_profile=0 skill=0 other=0 errors=1",
  );
  assert.equal(lines[1], "[tool-audit] error webFetch https://doc.jeedom.com/x — timeout");
});
