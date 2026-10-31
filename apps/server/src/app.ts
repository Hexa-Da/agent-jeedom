import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { SDKImage } from "@cursor/sdk";
import { BusyError, describeError } from "./errors.js";
import { emptyProfile, readProfile, writeProfile, type ProfileSection } from "./profile.js";
import { isRequestAllowed } from "./security.js";
import type { ChatEvent, ChatSessions } from "./sessions.js";

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024;
const MAX_MESSAGE_CHARS = 8_000;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};

export interface AppDeps {
  sessions: ChatSessions;
  profilePath: string;
  webDir: string;
  getPort: () => number;
  hasApiKey: () => boolean;
  onQuit: () => void;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function parseImages(raw: unknown): SDKImage[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_IMAGES) {
    throw new HttpError(400, `Maximum ${MAX_IMAGES} images par message.`);
  }
  return raw.map((item) => {
    const image = item as { data?: unknown; mimeType?: unknown };
    if (
      typeof image.data !== "string" ||
      typeof image.mimeType !== "string" ||
      !ALLOWED_IMAGE_TYPES.includes(image.mimeType) ||
      image.data.length > MAX_IMAGE_BASE64_CHARS
    ) {
      throw new HttpError(400, "Image invalide (formats acceptés : PNG, JPEG, WebP, GIF ; 6 Mo maximum).");
    }
    return { data: image.data, mimeType: image.mimeType };
  });
}

export function parseSections(raw: unknown): ProfileSection[] {
  if (!Array.isArray(raw)) throw new HttpError(400, "Sections de profil invalides.");
  return raw
    .map((item) => {
      const section = item as { title?: unknown; body?: unknown };
      if (typeof section.title !== "string" || typeof section.body !== "string" || !section.title.trim()) {
        throw new HttpError(400, "Sections de profil invalides.");
      }
      return { title: section.title.replace(/\s+/g, " ").trim(), body: section.body };
    })
    .filter((section) => section.title !== "Statut");
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers["content-type"]?.startsWith("application/json")) {
    throw new HttpError(415, "Content-Type application/json requis.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Requête trop volumineuse.");
    chunks.push(chunk as Buffer);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "JSON invalide.");
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, onFlushed?: () => void): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body), onFlushed);
}

export function createApp(deps: AppDeps): http.Server {
  const { sessions, profilePath } = deps;

  const streamMessage = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const body = await readJson(req);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const images = parseImages(body.images);
    if (!text && images.length === 0) throw new HttpError(400, "Message vide.");
    if (text.length > MAX_MESSAGE_CHARS) throw new HttpError(400, "Message trop long.");

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    const emit = (event: ChatEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    await sessions.send(
      { text: text || "Voici une capture d'écran.", images, hidden: body.hidden === true },
      emit,
      abort.signal,
    );
    res.end();
  };

  const route = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const key = `${req.method} ${url.pathname}`;

    if (req.method === "GET" && STATIC_FILES[url.pathname]) {
      const { file, type } = STATIC_FILES[url.pathname];
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(fs.readFileSync(path.join(deps.webDir, file)));
      return;
    }

    switch (key) {
      case "GET /api/state": {
        sendJson(res, 200, {
          hasApiKey: deps.hasApiKey(),
          onboardingDone: readProfile(profilePath)?.onboardingDone ?? false,
          session: sessions.snapshot(),
        });
        return;
      }
      case "POST /api/chat/new": {
        await sessions.startNew();
        sendJson(res, 200, { session: sessions.snapshot() });
        return;
      }
      case "POST /api/chat/resume": {
        const resumed = await sessions.resumeLast();
        if (!resumed) throw new HttpError(404, "Aucune conversation à reprendre.");
        sendJson(res, 200, { session: sessions.snapshot() });
        return;
      }
      case "POST /api/message": {
        await streamMessage(req, res);
        return;
      }
      case "GET /api/profile": {
        const profile = readProfile(profilePath) ?? emptyProfile();
        sendJson(res, 200, { sections: profile.sections });
        return;
      }
      case "PUT /api/profile": {
        const body = await readJson(req);
        // Un profil rempli à la main depuis « Mon profil » vaut onboarding terminé.
        writeProfile(profilePath, { onboardingDone: true, sections: parseSections(body.sections) });
        sendJson(res, 200, { ok: true });
        return;
      }
      case "POST /api/quit": {
        await sessions.shutdown();
        sendJson(res, 200, { ok: true }, deps.onQuit);
        return;
      }
      default:
        throw new HttpError(404, "Introuvable.");
    }
  };

  return http.createServer((req, res) => {
    if (!isRequestAllowed(req.headers, deps.getPort())) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    route(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : err instanceof BusyError ? 409 : 500;
      if (status === 500) console.error("[assistant] erreur :", err);
      if (res.headersSent) {
        res.end();
        return;
      }
      sendJson(res, status, { error: err instanceof HttpError ? err.message : describeError(err) });
    });
  });
}
