import { Agent } from "@cursor/sdk";
import type { AgentOptions, SDKImage, SDKMessage, SDKUserMessage } from "@cursor/sdk";
import { BusyError, describeError } from "./errors.js";
import type { SessionStore, StoredMessage } from "./session-store.js";

/** Sous-ensemble de l'API du SDK utilisé ici ; permet de tester sans clé API. */
export interface RunLike {
  stream(): AsyncGenerator<SDKMessage, void>;
  wait(): Promise<{ status: string; result?: string; error?: { message: string } }>;
  cancel?(): Promise<void>;
}

export interface AgentLike {
  readonly agentId: string;
  send(message: SDKUserMessage): Promise<RunLike>;
  close(): void;
}

export interface AgentFactory {
  create(options: AgentOptions): Promise<AgentLike>;
  resume(agentId: string, options: AgentOptions): Promise<AgentLike>;
}

export const sdkAgentFactory: AgentFactory = {
  create: (options) => Agent.create(options),
  resume: (agentId, options) => Agent.resume(agentId, options),
};

export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "status"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatInput {
  text: string;
  images?: SDKImage[];
  hidden?: boolean;
}

export interface SessionSnapshot {
  active: boolean;
  canResume: boolean;
  messages: StoredMessage[];
}

/** Fallback si le serveur n'injecte pas le skill refine-profile (ex. tests unitaires). */
const DEFAULT_FINALIZE_PROMPT =
  "Fin de la conversation (message automatique, l'utilisateur ne le voit pas). " +
  "Si l'utilisateur a mentionné des faits durables sur sa configuration, ses objectifs ou ses préférences, " +
  "mets à jour le profil avec save_profile en respectant les règles (faits sensibles : seulement s'ils ont été confirmés pendant la conversation). " +
  "Sinon, ne fais rien. Réponds uniquement « OK ».";

const MIN_USER_MESSAGES_TO_FINALIZE = 2;

const STATUS_LABELS: Array<[RegExp, string]> = [
  [/save_profile/i, "Je mets à jour votre profil…"],
  [/read|grep|glob|ls/i, "Je consulte la documentation…"],
];

export type ContextKind = "new" | "resume";

export class ChatSessions {
  private agent: AgentLike | null = null;
  private messages: StoredMessage[] = [];
  private busy = false;
  /** Consignes et profil à joindre au prochain message (le SDK n'offre pas de prompt système sur tous les comptes). */
  private pendingContext: string | null = null;

  constructor(
    private readonly deps: {
      factory: AgentFactory;
      buildOptions: () => AgentOptions;
      buildContext: (kind: ContextKind) => string;
      store: SessionStore;
      /** Corps du message auto de fin (idéalement `loadFinalizePrompt()` = skill refine-profile). */
      finalizePrompt?: string;
    },
  ) {}

  snapshot(): SessionSnapshot {
    return {
      active: this.agent !== null,
      canResume: this.deps.store.load() !== null,
      messages: this.visibleMessages(),
    };
  }

  /** Ferme la conversation courante (en mettant à jour le profil) puis en ouvre une nouvelle. */
  async startNew(): Promise<void> {
    this.assertNotBusy();
    await this.closeCurrent();
    this.agent = await this.deps.factory.create(this.deps.buildOptions());
    this.messages = [];
    this.pendingContext = this.deps.buildContext("new");
    // Pas de persist() ici : tant que rien n'est échangé, « Reprendre la dernière » doit pointer sur la conversation précédente.
  }

  /** Reprend la dernière conversation enregistrée ; renvoie false s'il n'y en a pas. */
  async resumeLast(): Promise<boolean> {
    this.assertNotBusy();
    const stored = this.deps.store.load();
    if (!stored) return false;
    await this.closeCurrent();
    this.agent = await this.deps.factory.resume(stored.agentId, this.deps.buildOptions());
    this.messages = stored.messages;
    this.pendingContext = this.deps.buildContext("resume");
    return true;
  }

  async send(input: ChatInput, emit: (event: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
    this.assertNotBusy();
    this.busy = true;
    let consumedContext: string | null = null;
    try {
      if (!this.agent) {
        this.agent = await this.deps.factory.create(this.deps.buildOptions());
        this.messages = [];
        this.pendingContext = this.deps.buildContext("new");
      }
      this.messages.push({
        role: "user",
        text: input.text,
        hidden: input.hidden || undefined,
        images: input.images?.length || undefined,
      });

      const text = this.pendingContext
        ? `${this.pendingContext}\n\n---\nMessage de l'utilisateur :\n${input.text}`
        : input.text;
      const run = await this.agent.send({ text, images: input.images });
      consumedContext = this.pendingContext;
      this.pendingContext = null;
      const onAbort = () => void run.cancel?.().catch(() => undefined);
      signal?.addEventListener("abort", onAbort, { once: true });

      let reply = "";
      let afterTool = false;
      const announced = new Set<string>();
      const append = (text: string) => {
        const chunk = afterTool && reply ? `\n\n${text}` : text;
        afterTool = false;
        reply += chunk;
        emit({ type: "delta", text: chunk });
      };

      try {
        for await (const event of run.stream()) {
          if (event.type === "assistant") {
            for (const block of event.message.content) {
              if (block.type === "text") append(block.text);
            }
          } else if (event.type === "tool_call") {
            afterTool = true;
            const label = STATUS_LABELS.find(([pattern]) => pattern.test(event.name))?.[1];
            if (label && !announced.has(label)) {
              announced.add(label);
              emit({ type: "status", text: label });
            }
          }
        }
        const result = await run.wait();
        if (result.status === "error") {
          throw new Error(result.error?.message ?? "L'assistant n'a pas pu terminer sa réponse.");
        }
        if (!reply && result.result) append(result.result);
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }

      this.messages.push({ role: "assistant", text: reply });
      this.persist();
      emit({ type: "done" });
    } catch (err) {
      console.error("[assistant] échec de l'envoi :", err);
      // Si le run a échoué, l'agent n'a peut-être pas retenu les consignes : on les renverra au prochain message.
      this.pendingContext ??= consumedContext;
      this.persist();
      emit({ type: "error", message: describeError(err) });
    } finally {
      this.busy = false;
    }
  }

  /** Fin de programme : met à jour le profil puis libère l'agent. */
  async shutdown(): Promise<void> {
    await this.closeCurrent();
  }

  private async closeCurrent(): Promise<void> {
    const agent = this.agent;
    if (!agent) return;
    this.agent = null;
    try {
      if (this.countUserMessages() >= MIN_USER_MESSAGES_TO_FINALIZE) {
        const prompt = this.deps.finalizePrompt ?? DEFAULT_FINALIZE_PROMPT;
        const run = await agent.send({ text: prompt });
        await run.wait();
      }
    } catch (err) {
      console.error("[assistant] mise à jour du profil impossible :", err);
    } finally {
      agent.close();
    }
  }

  private countUserMessages(): number {
    return this.messages.filter((m) => m.role === "user" && !m.hidden).length;
  }

  private visibleMessages(): StoredMessage[] {
    return this.messages.filter((m) => !m.hidden);
  }

  private persist(): void {
    if (this.agent) this.deps.store.save({ agentId: this.agent.agentId, messages: this.messages });
  }

  private assertNotBusy(): void {
    if (this.busy) throw new BusyError();
  }
}
