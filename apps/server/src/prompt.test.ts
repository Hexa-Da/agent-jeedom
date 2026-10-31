import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { REFINE_PROFILE_SKILL_PATH } from "./config.js";
import { buildFinalizePrompt, stripSkillFrontmatter } from "./prompt.js";

test("stripSkillFrontmatter retire le YAML et garde le corps", () => {
  const raw = "---\nname: demo\n---\n\n# Titre\n\nCorps.";
  assert.equal(stripSkillFrontmatter(raw), "# Titre\n\nCorps.");
});

test("buildFinalizePrompt injecte le skill refine-profile du workspace", () => {
  const prompt = buildFinalizePrompt(fs.readFileSync(REFINE_PROFILE_SKILL_PATH, "utf8"));
  assert.match(prompt, /message automatique/i);
  assert.match(prompt, /save_profile/);
  assert.match(prompt, /faits \*\*sensibles\*\*/i);
  assert.match(prompt, /## Historique des sujets abordés/);
  assert.match(prompt, /Box : Atlas/);
  assert.doesNotMatch(prompt, /^---/);
});
