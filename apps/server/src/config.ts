import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, "../../..");
export const WORKSPACE_DIR = path.join(ROOT_DIR, "workspace");
export const PROFILE_PATH = path.join(WORKSPACE_DIR, "profil", "pere.md");
export const AGENTS_PATH = path.join(WORKSPACE_DIR, "AGENTS.md");
export const REFINE_PROFILE_SKILL_PATH = path.join(
  WORKSPACE_DIR,
  "skills",
  "refine-profile",
  "SKILL.md",
);
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const SESSION_PATH = path.join(DATA_DIR, "last-session.json");
export const TOOL_AUDIT_PATH = path.join(DATA_DIR, "tool-audit.jsonl");
export const WEB_DIR = path.join(ROOT_DIR, "apps", "web");

export const HOST = "127.0.0.1";
export const PORT = Number(process.env.PORT ?? 3737);
export const MODEL_ID = process.env.JEEDOM_MODEL ?? "composer-2.5";
