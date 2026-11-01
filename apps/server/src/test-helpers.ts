import type { AgentOptions, SDKMessage, SDKUserMessage } from "@cursor/sdk";
import type { SessionStore, StoredSession } from "./session-store.js";
import type { AgentFactory, AgentLike, RunLike } from "./sessions.js";

export const assistantText = (text: string) =>
  ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } }) as unknown as SDKMessage;

export const toolCall = (
  name: string,
  opts: { call_id?: string; status?: "running" | "completed" | "error"; args?: unknown } = {},
) =>
  ({
    type: "tool_call",
    name,
    call_id: opts.call_id ?? name,
    status: opts.status ?? "running",
    args: opts.args,
  }) as unknown as SDKMessage;

export interface FakeRunSpec {
  events?: SDKMessage[];
  status?: string;
  error?: string;
  result?: string;
}

export class FakeAgent implements AgentLike {
  readonly sent: SDKUserMessage[] = [];
  closed = false;
  private readonly scripts: FakeRunSpec[];

  constructor(
    readonly agentId: string,
    ...scripts: FakeRunSpec[]
  ) {
    this.scripts = scripts;
  }

  async send(message: SDKUserMessage): Promise<RunLike> {
    this.sent.push(message);
    const spec = this.scripts.shift() ?? { events: [assistantText("OK")] };
    return {
      async *stream() {
        for (const event of spec.events ?? []) yield event;
      },
      wait: async () => ({ status: spec.status ?? "finished", result: spec.result, error: spec.error ? { message: spec.error } : undefined }),
    };
  }

  close(): void {
    this.closed = true;
  }
}

export class MemoryStore implements SessionStore {
  constructor(public session: StoredSession | null = null) {}
  load() {
    return this.session;
  }
  save(session: StoredSession) {
    this.session = session;
  }
}

export function fakeFactory(agents: FakeAgent[]): AgentFactory & { created: AgentOptions[]; resumed: string[] } {
  const created: AgentOptions[] = [];
  const resumed: string[] = [];
  const next = () => {
    const agent = agents.shift();
    if (!agent) throw new Error("plus d'agent factice");
    return agent;
  };
  return {
    created,
    resumed,
    async create(options) {
      created.push(options);
      return next();
    },
    async resume(agentId) {
      resumed.push(agentId);
      return next();
    },
  };
}

export const fakeOptions = () => ({ apiKey: "test", model: { id: "composer-2.5" }, local: { cwd: "." } }) as AgentOptions;
