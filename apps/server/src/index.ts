import { spawn } from "node:child_process";
import { createApp } from "./app.js";
import { buildAgentOptions } from "./agent-options.js";
import path from "node:path";
import { HOST, PORT, PROFILE_PATH, ROOT_DIR, SESSION_PATH, WEB_DIR } from "./config.js";
import { loadContext } from "./prompt.js";
import { FileSessionStore } from "./session-store.js";
import { ChatSessions, sdkAgentFactory } from "./sessions.js";

try {
  process.loadEnvFile(path.join(ROOT_DIR, ".env"));
} catch {
  // Pas de fichier .env : CURSOR_API_KEY peut venir de l'environnement.
}

function openBrowser(url: string): void {
  const [command, args]: [string, string[]] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => undefined).unref();
}

const sessions = new ChatSessions({
  factory: sdkAgentFactory,
  buildOptions: buildAgentOptions,
  buildContext: loadContext,
  store: new FileSessionStore(SESSION_PATH),
});

const server = createApp({
  sessions,
  profilePath: PROFILE_PATH,
  webDir: WEB_DIR,
  getPort: () => PORT,
  hasApiKey: () => Boolean(process.env.CURSOR_API_KEY?.trim()),
  onQuit: () => {
    server.close();
    process.exit(0);
  },
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error(
    err.code === "EADDRINUSE"
      ? `Le port ${PORT} est déjà utilisé : l'assistant est peut-être déjà ouvert.`
      : `Impossible de démarrer l'assistant : ${err.message}`,
  );
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Assistant Jeedom prêt : ${url}`);
  console.log("Pour quitter, utilisez le bouton « Quitter » dans la page (ou fermez cette fenêtre).");
  if (!process.argv.includes("--no-open")) openBrowser(url);
});

process.on("SIGINT", () => process.exit(0));
