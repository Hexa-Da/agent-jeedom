import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TOOL_AUDIT_PATH } from "./config.js";

export { TOOL_AUDIT_PATH };

/** Kinds retenus dans le journal (pas de `other`). */
export type ToolAuditKind = "socle" | "webFetch" | "save_profile" | "skill";

export type ToolAuditStatus = "running" | "completed" | "error";

/** Classification d'un appel avant flush (sans métadonnées de run). */
export interface ClassifiedToolCall {
  kind: ToolAuditKind;
  name: string;
  path?: string;
  url?: string;
  skill?: string;
  contentChars?: number;
  status?: ToolAuditStatus;
  error?: string;
}

/** Une ligne NDJSON = un appel utile d'un run. */
export interface ToolAuditEvent {
  ts: string;
  runId: string;
  agentId: string;
  kind: ToolAuditKind;
  name: string;
  path?: string;
  url?: string;
  skill?: string;
  contentChars?: number;
  status?: ToolAuditStatus;
  error?: string;
}

export type ToolAuditWriter = (event: ToolAuditEvent) => void;

const FILE_TOOLS = /^(read|grep|glob|ls)$/i;

/** Extrait des chemins plausibles depuis args SDK (schéma non stable). */
export function pathsFromArgs(args: unknown): string[] {
  const found = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return;
    found.add(value.replace(/\\/g, "/"));
  };

  if (!args || typeof args !== "object") return [];
  const obj = args as Record<string, unknown>;
  for (const key of ["path", "target_directory", "file_path", "filePath", "targetDirectory"]) {
    add(obj[key]);
  }
  if (Array.isArray(obj.paths)) {
    for (const p of obj.paths) add(p);
  }

  if (found.size === 0) {
    try {
      const raw = JSON.stringify(args);
      for (const match of raw.matchAll(/socle\/[^"'\s]+|skills\/[^"'\s]+|AGENTS\.md|profil\/[^"'\s]+/gi)) {
        add(match[0]);
      }
    } catch {
      // ignore
    }
  }
  return [...found];
}

function firstMatchingPath(paths: string[], segment: string): string | undefined {
  const needle = segment.replace(/\\/g, "/").toLowerCase();
  return paths.find((p) => {
    const n = p.toLowerCase();
    return n.includes(`/${needle}/`) || n.includes(`${needle}/`) || n.startsWith(`${needle}/`) || n.endsWith(`/${needle}`) || n === needle;
  });
}

function skillSlugFromPath(filePath: string): string | undefined {
  const match = filePath.replace(/\\/g, "/").match(/(?:^|\/)skills\/([^/]+)/i);
  return match?.[1];
}

function stringField(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function contentChars(args: unknown): number | undefined {
  const content = stringField(args, "content");
  return content === undefined ? undefined : content.length;
}

const ERROR_MSG_MAX = 200;

function truncateError(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= ERROR_MSG_MAX) return trimmed;
  return `${trimmed.slice(0, ERROR_MSG_MAX - 1)}…`;
}

/**
 * Extrait un message d'échec depuis `result` SDK (schéma non stable).
 * Formes courantes : `{ status: "error", error: { message } | string }` ou `{ message }`.
 */
export function errorMessageFromResult(result: unknown): string | undefined {
  if (result == null) return undefined;
  if (typeof result === "string" && result.trim()) return truncateError(result);
  if (typeof result !== "object") return undefined;

  const obj = result as Record<string, unknown>;
  const fromErrorField = (value: unknown): string | undefined => {
    if (typeof value === "string" && value.trim()) return truncateError(value);
    if (value && typeof value === "object") {
      const msg = (value as Record<string, unknown>).message;
      if (typeof msg === "string" && msg.trim()) return truncateError(msg);
    }
    return undefined;
  };

  if (obj.status === "error") {
    const nested = fromErrorField(obj.error);
    if (nested) return nested;
  }
  const direct = fromErrorField(obj.error);
  if (direct) return direct;
  if (typeof obj.message === "string" && obj.message.trim()) return truncateError(obj.message);
  return undefined;
}

function normalizeStatus(status: unknown): ToolAuditStatus | undefined {
  if (status === "running" || status === "completed" || status === "error") return status;
  return undefined;
}

/**
 * Classe un appel outil (ordre : webFetch → save_profile → socle → skill).
 * Renvoie `null` pour les appels hors périmètre (`other` : non journalisés).
 */
export function classifyToolCall(name: string, args?: unknown): ClassifiedToolCall | null {
  if (/webfetch/i.test(name)) {
    return { kind: "webFetch", name, url: stringField(args, "url") };
  }
  if (/save_profile/i.test(name)) {
    const chars = contentChars(args);
    return chars === undefined
      ? { kind: "save_profile", name }
      : { kind: "save_profile", name, contentChars: chars };
  }

  const paths = pathsFromArgs(args);
  if (FILE_TOOLS.test(name)) {
    const soclePath = firstMatchingPath(paths, "socle");
    if (soclePath) return { kind: "socle", name, path: soclePath };

    const skillPath = firstMatchingPath(paths, "skills");
    if (skillPath) {
      const skill = skillSlugFromPath(skillPath);
      return skill
        ? { kind: "skill", name, path: skillPath, skill }
        : { kind: "skill", name, path: skillPath };
    }
  }

  return null;
}

export interface ToolCallLike {
  call_id?: string;
  name: string;
  status?: string;
  args?: unknown;
  result?: unknown;
}

function withOutcome(call: ClassifiedToolCall, event: ToolCallLike): ClassifiedToolCall {
  const status = normalizeStatus(event.status);
  const error =
    errorMessageFromResult(event.result) ??
    (status === "error" ? "échec outil (sans détail)" : undefined);
  return {
    ...call,
    ...(status ? { status } : {}),
    ...(error ? { error } : {}),
  };
}

export interface ToolAuditFlushSummary {
  runId: string;
  agentId: string;
  events: ToolAuditEvent[];
  socle: number;
  webFetch: number;
  save_profile: number;
  skills: string[];
  errorCount: number;
}

/** Résumé console : counts utiles + skills nommés (pas de other). */
export function formatToolAuditConsoleLines(summary: ToolAuditFlushSummary): string[] {
  const skillsPart = summary.skills.length > 0 ? ` skills=${summary.skills.join(",")}` : "";
  const lines = [
    `[tool-audit] run=${summary.runId.slice(0, 8)} socle=${summary.socle} webFetch=${summary.webFetch} save_profile=${summary.save_profile}${skillsPart}` +
      (summary.errorCount > 0 ? ` errors=${summary.errorCount}` : ""),
  ];
  for (const event of summary.events) {
    if (event.status !== "error") continue;
    const target = event.url ?? event.path ?? event.skill ?? event.name;
    lines.push(`[tool-audit] error ${event.kind} ${target}${event.error ? ` — ${event.error}` : ""}`);
  }
  return lines;
}

/**
 * Collecteur par run : déduplique par call_id (préfère completed),
 * ignore `other`, flush = une ligne NDJSON par appel retenu.
 */
export class ToolAuditCollector {
  readonly runId: string;
  private readonly byId = new Map<string, { call: ClassifiedToolCall; status?: string; ts: string }>();
  private anon = 0;

  constructor(
    private readonly writer: ToolAuditWriter = appendToolAuditEvent,
    runId?: string,
  ) {
    this.runId = runId ?? randomUUID();
  }

  /** Skill injecté côté serveur (ex. refine-profile au finalize), sans `read` SDK. */
  recordInjectedSkill(skill: string, callId = `injected-${skill}`): void {
    this.byId.set(callId, {
      call: {
        kind: "skill",
        name: "read",
        path: `skills/${skill}/SKILL.md`,
        skill,
        status: "completed",
      },
      status: "completed",
      ts: new Date().toISOString(),
    });
  }

  record(event: ToolCallLike): void {
    const classified = classifyToolCall(event.name, event.args);
    if (!classified) return;
    const call = withOutcome(classified, event);
    const id = event.call_id?.trim() || `anon-${++this.anon}`;
    const prev = this.byId.get(id);
    if (!prev || event.status === "completed" || (event.status === "error" && prev.status !== "completed")) {
      this.byId.set(id, { call, status: event.status, ts: new Date().toISOString() });
    }
  }

  snapshot(): ToolAuditFlushSummary {
    const events: ToolAuditEvent[] = [];
    let socle = 0;
    let webFetch = 0;
    let save_profile = 0;
    let errorCount = 0;
    const skills: string[] = [];
    const seenSkills = new Set<string>();

    for (const entry of this.byId.values()) {
      const { call, ts } = entry;
      if (call.kind === "socle") socle += 1;
      else if (call.kind === "webFetch") webFetch += 1;
      else if (call.kind === "save_profile") save_profile += 1;
      else if (call.kind === "skill" && call.skill && !seenSkills.has(call.skill)) {
        seenSkills.add(call.skill);
        skills.push(call.skill);
      }
      if (call.status === "error") errorCount += 1;
      events.push({
        ts,
        runId: this.runId,
        agentId: "",
        kind: call.kind,
        name: call.name,
        ...(call.path ? { path: call.path } : {}),
        ...(call.url ? { url: call.url } : {}),
        ...(call.skill ? { skill: call.skill } : {}),
        ...(call.contentChars !== undefined ? { contentChars: call.contentChars } : {}),
        ...(call.status ? { status: call.status } : {}),
        ...(call.error ? { error: call.error } : {}),
      });
    }

    return { runId: this.runId, agentId: "", events, socle, webFetch, save_profile, skills, errorCount };
  }

  flush(agentId: string): ToolAuditFlushSummary {
    const summary = this.snapshot();
    summary.agentId = agentId;
    for (const event of summary.events) {
      event.agentId = agentId;
      try {
        this.writer(event);
      } catch (err) {
        console.error("[tool-audit] écriture impossible :", err);
      }
    }
    if (summary.events.length > 0) {
      for (const line of formatToolAuditConsoleLines(summary)) {
        console.log(line);
      }
    }
    return summary;
  }
}

export function appendToolAuditEvent(event: ToolAuditEvent, filePath = TOOL_AUDIT_PATH): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

/** Writer mémoire pour les tests. */
export function memoryToolAuditWriter(sink: ToolAuditEvent[]): ToolAuditWriter {
  return (event) => {
    sink.push(event);
  };
}
