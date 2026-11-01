import fs from "node:fs";
import path from "node:path";
import { TOOL_AUDIT_PATH } from "./config.js";

export { TOOL_AUDIT_PATH };

export type ToolAuditBucket = "socle" | "webFetch" | "save_profile" | "skill" | "other";

export type ToolAuditStatus = "running" | "completed" | "error";

export interface ToolAuditCall {
  bucket: ToolAuditBucket;
  name: string;
  path?: string;
  url?: string;
  skill?: string;
  contentChars?: number;
  /** Dernier status SDK connu (`running` | `completed` | `error`). */
  status?: ToolAuditStatus;
  /** Message d'échec si status=error (extrait défensif de `result`). */
  error?: string;
}

export type ToolAuditCounts = Record<ToolAuditBucket, number>;

export interface ToolAuditRun {
  ts: string;
  agentId: string;
  counts: ToolAuditCounts;
  /** Nombre d'appels dont le dernier status est `error` (≠ non appelé). */
  errorCount: number;
  calls: ToolAuditCall[];
}

export type ToolAuditWriter = (run: ToolAuditRun) => void;

const FILE_TOOLS = /^(read|grep|glob|ls)$/i;
const EMPTY_COUNTS = (): ToolAuditCounts => ({
  socle: 0,
  webFetch: 0,
  save_profile: 0,
  skill: 0,
  other: 0,
});

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

/** Classe un appel outil (ordre : webFetch → save_profile → socle → skill → other). */
export function classifyToolCall(name: string, args?: unknown): ToolAuditCall {
  if (/webfetch/i.test(name)) {
    return { bucket: "webFetch", name, url: stringField(args, "url") };
  }
  if (/save_profile/i.test(name)) {
    const chars = contentChars(args);
    return chars === undefined
      ? { bucket: "save_profile", name }
      : { bucket: "save_profile", name, contentChars: chars };
  }

  const paths = pathsFromArgs(args);
  if (FILE_TOOLS.test(name)) {
    const soclePath = firstMatchingPath(paths, "socle");
    if (soclePath) return { bucket: "socle", name, path: soclePath };

    const skillPath = firstMatchingPath(paths, "skills");
    if (skillPath) {
      const skill = skillSlugFromPath(skillPath);
      return skill
        ? { bucket: "skill", name, path: skillPath, skill }
        : { bucket: "skill", name, path: skillPath };
    }
  }

  const pathHint = paths[0];
  return pathHint ? { bucket: "other", name, path: pathHint } : { bucket: "other", name };
}

export interface ToolCallLike {
  call_id?: string;
  name: string;
  status?: string;
  args?: unknown;
  result?: unknown;
}

function withOutcome(call: ToolAuditCall, event: ToolCallLike): ToolAuditCall {
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

/** Résumé console : counts + distinction erreurs (appelé mais échoué ≠ absent). */
export function formatToolAuditConsoleLines(run: ToolAuditRun): string[] {
  const { counts, errorCount, calls } = run;
  const lines = [
    `[tool-audit] socle=${counts.socle} webFetch=${counts.webFetch} save_profile=${counts.save_profile} skill=${counts.skill} other=${counts.other}` +
      (errorCount > 0 ? ` errors=${errorCount}` : ""),
  ];
  for (const call of calls) {
    if (call.status !== "error") continue;
    const target = call.url ?? call.path ?? call.skill ?? call.name;
    lines.push(`[tool-audit] error ${call.bucket} ${target}${call.error ? ` — ${call.error}` : ""}`);
  }
  return lines;
}

/**
 * Collecteur par run : déduplique par call_id (préfère completed),
 * produit counts + calls, puis flush via writer + log console.
 */
export class ToolAuditCollector {
  private readonly byId = new Map<string, { call: ToolAuditCall; status?: string }>();
  private anon = 0;

  constructor(private readonly writer: ToolAuditWriter = appendToolAuditFile) {}

  record(event: ToolCallLike): void {
    const call = withOutcome(classifyToolCall(event.name, event.args), event);
    const id = event.call_id?.trim() || `anon-${++this.anon}`;
    const prev = this.byId.get(id);
    if (!prev || event.status === "completed" || (event.status === "error" && prev.status !== "completed")) {
      this.byId.set(id, { call, status: event.status });
    }
  }

  snapshot(): { counts: ToolAuditCounts; calls: ToolAuditCall[]; errorCount: number } {
    const calls = [...this.byId.values()].map((entry) => entry.call);
    const counts = EMPTY_COUNTS();
    let errorCount = 0;
    for (const call of calls) {
      counts[call.bucket] += 1;
      if (call.status === "error") errorCount += 1;
    }
    return { counts, calls, errorCount };
  }

  flush(agentId: string): ToolAuditRun {
    const { counts, calls, errorCount } = this.snapshot();
    const run: ToolAuditRun = {
      ts: new Date().toISOString(),
      agentId,
      counts,
      errorCount,
      calls,
    };
    try {
      this.writer(run);
    } catch (err) {
      console.error("[tool-audit] écriture impossible :", err);
    }
    for (const line of formatToolAuditConsoleLines(run)) {
      console.log(line);
    }
    return run;
  }
}

export function appendToolAuditFile(run: ToolAuditRun, filePath = TOOL_AUDIT_PATH): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(run)}\n`, "utf8");
}

/** Writer mémoire pour les tests. */
export function memoryToolAuditWriter(sink: ToolAuditRun[]): ToolAuditWriter {
  return (run) => {
    sink.push(run);
  };
}
