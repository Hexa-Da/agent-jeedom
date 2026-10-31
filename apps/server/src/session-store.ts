import fs from "node:fs";
import path from "node:path";

export interface StoredMessage {
  role: "user" | "assistant";
  text: string;
  /** Message automatique (ex. lancement de l'onboarding) : non affiché dans le chat. */
  hidden?: boolean;
  /** Nombre d'images jointes (les images elles-mêmes ne sont pas conservées). */
  images?: number;
}

export interface StoredSession {
  agentId: string;
  messages: StoredMessage[];
}

export interface SessionStore {
  load(): StoredSession | null;
  save(session: StoredSession): void;
}

export class FileSessionStore implements SessionStore {
  constructor(private readonly filePath: string) {}

  load(): StoredSession | null {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as StoredSession;
      return typeof data.agentId === "string" && Array.isArray(data.messages) ? data : null;
    } catch {
      return null;
    }
  }

  save(session: StoredSession): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(session), "utf8");
  }
}
