import fs from "node:fs";
import path from "node:path";

export interface ProfileSection {
  title: string;
  body: string;
}

export interface Profile {
  onboardingDone: boolean;
  sections: ProfileSection[];
}

const STATUS_TITLE = "Statut";
const DONE_PATTERN = /onboarding termin[ée]\s*:\s*oui/i;

export const DEFAULT_SECTION_TITLES = [
  "Jeedom",
  "Plugins et protocoles",
  "Équipements notables",
  "Objectifs",
  "Point bloquant actuel",
  "Historique des sujets abordés",
  "Préférences",
];

export const MAX_PROFILE_CHARS = 20_000;

export function emptyProfile(): Profile {
  return {
    onboardingDone: false,
    sections: DEFAULT_SECTION_TITLES.map((title) => ({ title, body: "" })),
  };
}

/** Parse le markdown du profil en sections ; les sections connues viennent en premier, dans l'ordre par défaut. */
export function parseProfile(markdown: string): Profile {
  const found = new Map<string, string>();
  let onboardingDone = false;
  let currentTitle: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentTitle === null) return;
    const body = buffer.join("\n").trim();
    if (currentTitle === STATUS_TITLE) onboardingDone = DONE_PATTERN.test(body);
    else found.set(currentTitle, body);
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      currentTitle = heading[1];
      buffer = [];
    } else if (currentTitle !== null) {
      buffer.push(line);
    }
  }
  flush();

  const known = DEFAULT_SECTION_TITLES.map((title) => ({ title, body: found.get(title) ?? "" }));
  const extra = [...found.entries()]
    .filter(([title]) => !DEFAULT_SECTION_TITLES.includes(title))
    .map(([title, body]) => ({ title, body }));
  return { onboardingDone, sections: [...known, ...extra] };
}

export function serializeProfile(profile: Profile): string {
  const parts = [
    "# Profil de l'utilisateur",
    `## ${STATUS_TITLE}\n- Onboarding terminé : ${profile.onboardingDone ? "oui" : "non"}`,
    ...profile.sections.map((s) => `## ${s.title}\n${s.body.trim()}`.trimEnd()),
  ];
  return parts.join("\n\n") + "\n";
}

export function readProfile(profilePath: string): Profile | null {
  try {
    return parseProfile(fs.readFileSync(profilePath, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export function writeProfile(profilePath: string, profile: Profile): void {
  const markdown = serializeProfile(profile);
  if (markdown.length > MAX_PROFILE_CHARS) {
    throw new Error(`Profil trop long (maximum ${MAX_PROFILE_CHARS} caractères).`);
  }
  fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  fs.writeFileSync(profilePath, markdown, "utf8");
}

/** Enregistre un profil markdown proposé par l'agent, en le normalisant au format canonique. */
export function saveProfileMarkdown(profilePath: string, markdown: string): Profile {
  if (markdown.length > MAX_PROFILE_CHARS) {
    throw new Error(`Profil trop long (maximum ${MAX_PROFILE_CHARS} caractères).`);
  }
  if (!/^##\s+/m.test(markdown)) {
    throw new Error("Profil invalide : il doit contenir des sections « ## Titre » (voir la structure du profil).");
  }
  const profile = parseProfile(markdown);
  writeProfile(profilePath, profile);
  return profile;
}
