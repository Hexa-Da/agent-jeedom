import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  DEFAULT_SECTION_TITLES,
  emptyProfile,
  parseProfile,
  readProfile,
  saveProfileMarkdown,
  serializeProfile,
} from "./profile.js";

const tmpProfilePath = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jeedom-profile-")), "profil", "pere.md");

test("un profil vide n'a pas terminé l'onboarding et contient les sections par défaut", () => {
  const profile = emptyProfile();
  assert.equal(profile.onboardingDone, false);
  assert.deepEqual(
    profile.sections.map((s) => s.title),
    DEFAULT_SECTION_TITLES,
  );
});

test("serialize puis parse conserve le contenu et le statut", () => {
  const profile = emptyProfile();
  profile.onboardingDone = true;
  profile.sections[0].body = "- Box : Atlas\n- Version du core : 4.4";
  const parsed = parseProfile(serializeProfile(profile));
  assert.equal(parsed.onboardingDone, true);
  assert.equal(parsed.sections[0].body, "- Box : Atlas\n- Version du core : 4.4");
});

test("le statut est reconnu quelle que soit la casse", () => {
  assert.equal(parseProfile("## Statut\n- Onboarding terminé : Oui").onboardingDone, true);
  assert.equal(parseProfile("## Statut\n- Onboarding terminé : non").onboardingDone, false);
});

test("les sections inconnues sont conservées après les sections par défaut", () => {
  const parsed = parseProfile("## Statut\n- Onboarding terminé : oui\n\n## Cave\n- Compteur d'eau");
  assert.equal(parsed.sections.at(-1)?.title, "Cave");
  assert.equal(parsed.sections.at(-1)?.body, "- Compteur d'eau");
});

test("saveProfileMarkdown écrit le format canonique et crée le dossier", () => {
  const file = tmpProfilePath();
  saveProfileMarkdown(file, "## Statut\n- Onboarding terminé : oui\n\n## Objectifs\n- Volets automatiques");
  const saved = readProfile(file);
  assert.equal(saved?.onboardingDone, true);
  assert.equal(saved?.sections.find((s) => s.title === "Objectifs")?.body, "- Volets automatiques");
  assert.ok(fs.readFileSync(file, "utf8").startsWith("# Profil de l'utilisateur"));
});

test("saveProfileMarkdown refuse un contenu sans sections ou trop long", () => {
  const file = tmpProfilePath();
  assert.throws(() => saveProfileMarkdown(file, "du texte libre"), /sections/);
  assert.throws(() => saveProfileMarkdown(file, "## A\n" + "x".repeat(25_000)), /trop long/);
  assert.equal(fs.existsSync(file), false);
});

test("readProfile renvoie null si le fichier n'existe pas", () => {
  assert.equal(readProfile(tmpProfilePath()), null);
});
