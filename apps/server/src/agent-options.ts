import type { AgentOptions } from "@cursor/sdk";
import { MODEL_ID, PROFILE_PATH, WORKSPACE_DIR } from "./config.js";
import { MissingApiKeyError } from "./errors.js";
import { saveProfileMarkdown } from "./profile.js";

/**
 * Conseil uniquement : l'agent ne reçoit que des outils de lecture sur workspace/,
 * webFetch (doc / pages web en lecture), et save_profile (qui n'écrit que profil/pere.md).
 * Aucun shell, aucune édition libre.
 * Ces options ne sont pas persistées par le SDK : on les repasse aussi à Agent.resume.
 */
export function buildAgentOptions(): AgentOptions {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) throw new MissingApiKeyError();

  return {
    apiKey,
    model: { id: MODEL_ID },
    tools: ["read", "grep", "glob", "ls", "webFetch", "mcp"],
    local: {
      cwd: WORKSPACE_DIR,
      customTools: {
        save_profile: {
          description:
            "Enregistre le profil complet de l'utilisateur (écrase le profil existant). Renvoyer le profil entier au format markdown avec les sections « ## Titre » décrites dans les règles.",
          inputSchema: {
            type: "object",
            properties: {
              content: { type: "string", description: "Profil complet au format markdown." },
            },
            required: ["content"],
          },
          async execute({ content }) {
            try {
              saveProfileMarkdown(PROFILE_PATH, String(content));
              return "Profil enregistré.";
            } catch (err) {
              return { content: [{ type: "text", text: (err as Error).message }], isError: true };
            }
          },
        },
      },
    },
  };
}
