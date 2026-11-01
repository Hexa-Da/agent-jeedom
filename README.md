# Assistant Jeedom

Un « support Jeedom » personnel, en français, pour quelqu'un qui configure sa maison avec l'interface web de Jeedom (box **Atlas**, core **4.6.1**). Il fonctionne via un chat dans le navigateur par default, pas dans un terminal.

- Il **conseille uniquement** : il ne fait que guider pas à pas l'utilisateur dans l'interface de Jeedom.
- Il s'appuie sur une base de connaissances résumée de la documentation officielle (`workspace/socle/`).
- Au premier lancement, il pose quelques questions pour établir un profil, qui s'affine ensuite.
- On peut lui envoyer des captures d'écran (collées ou jointes).

L'agent est construit avec le [Cursor Agent SDK](https://cursor.com/docs/sdk/typescript) : le SDK fournit le moteur, ce dépôt fournit lui l'UI, les règles, la base de connaissances et le workspace.

## Installation (une seule fois, PC Windows)

Prérequis : [Node.js](https://nodejs.org) 22.13 ou plus récent

1. Copier ce dossier sur le PC.
2. Créer le fichier `.env` à la racine
3. Double-cliquer sur `lancer-assistant.bat`.
4. Pour un accès rapide : clic droit sur `lancer-assistant.bat` → Envoyer vers → Bureau (créer un raccourci).

## Utilisation

Double-cliquer sur le raccourci : une fenêtre noire va s'ouvrir (laisser ce terminal ouvert) puis le navigateur par default va afficher l'assistant. Pour arrêter, il suffit de cliquer sur le bouton **Quitter** dans la page.

L'assistant n'écoute que sur cet ordinateur (`127.0.0.1:3737`) : il n'est pas accessible depuis le reste du réseau.

### Structure du repo

| Chemin                | Rôle                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/server/src`     | Serveur Node (sans framework)                                                                               |
| `apps/web`            | Interface de chat (HTML/JS/CSS, sans build)                                                                 |
| `workspace/AGENTS.md` | Règles de l'agent (ton, conseil uniquement) : jointes au premier message de chaque session (avec le profil) |
| `workspace/skills/`   | Procédures : `onboarding` (setup profil), `refine-profile` (injecté automatiquement en fin de conversation) |
| `workspace/socle/`    | Connaissances Jeedom lues par l'agent (base statique)                                                       |
| `workspace/profil/`   | Profil de l'utilisateur (créé et affiné à l'usage)                                                          |
| `workspace/exports/`  | Scénarios exporté depuis Jeedom à analyser                                                                  |
| `data/`               | Historique de la dernière conversation (`last-session.json`) et logs des outils (`tool-audit.jsonl`)        |

### Details à garder en tête

L'agent est lancé en local avec `cwd = workspace/`, une liste d'outils restreinte (lecture, recherche, listage, `webFetch`) et un seul outil personnalisé, `save_profile`, qui n'écrit que `workspace/profil/*.md`. Aucun shell, aucune édition libre, aucun accès à Jeedom. Ces options sont repassées à chaque reprise de conversation (le SDK ne les persiste pas).

Les consignes ne passent pas par l'option `systemPrompt` du SDK, car elle n'est disponible que sur certains comptes Cursor : elles sont jointes au premier message de la conversation.

À chaque réponse réussie (et à la finalisation de conversation), le serveur journalise chaque appel d'outil utile (socle, `webFetch`, `save_profile`, skill nommé) en une ligne NDJSON horodatée dans `data/tool-audit.jsonl`.

Fin de conversation substantielle (≥ 2 messages utilisateur) : le serveur envoie un message automatique qui contient le corps de `workspace/skills/refine-profile/SKILL.md` (le modèle n'a pas à « découvrir » le skill). Si l'onboarding n'est pas terminé, le premier message caché demande explicitement de suivre `skills/onboarding/SKILL.md`.

### Enrichir les connaissances

Ajouter ou corriger des fiches dans `workspace/socle/` et les référencer dans `00-index.md`. La source recommandée est la documentation officielle : <https://github.com/jeedom/core/tree/master/docs/fr_FR>.
