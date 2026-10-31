# Assistant Jeedom

Un « support Jeedom » personnel, en français, pour quelqu'un qui configure sa maison avec l'interface web de Jeedom (box **Atlas**). Il fonctionne dans le navigateur, sans terminal.

- Il **conseille uniquement** : il guide pas à pas dans l'interface de Jeedom, mais n'a aucun accès à la box ni aux équipements.
- Il s'appuie sur une base de connaissances résumée de la documentation officielle (`workspace/socle/`).
- Au premier lancement, il pose quelques questions pour établir un profil, qui s'affine ensuite (bouton **Mon profil** pour le consulter ou le corriger).
- On peut lui envoyer des captures d'écran (collées ou jointes).

Il est construit sur le [Cursor Agent SDK](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) : le SDK fournit le moteur d'agent, ce dépôt fournit l'interface, les règles et la base de connaissances.

## Installation (une seule fois, sur le PC Windows)

Prérequis : [Node.js](https://nodejs.org) 22.13 ou plus récent, et une connexion internet.

1. Copier ce dossier sur le PC.
2. Créer un fichier `.env` à la racine (copie de `.env.example`) contenant la clé API Cursor :

   ```
   CURSOR_API_KEY=cursor_...
   ```

   La clé se crée sur [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations). L'usage est facturé sur le compte Cursor de cette clé.
3. Double-cliquer sur `lancer-assistant.bat` (la première fois, il installe les dépendances).
4. Pour un accès rapide : clic droit sur `lancer-assistant.bat` → Envoyer vers → Bureau (créer un raccourci).

## Utilisation

Double-cliquer sur le raccourci : une fenêtre noire s'ouvre (la laisser ouverte) et le navigateur affiche l'assistant. Pour arrêter : bouton **Quitter** dans la page.

L'assistant n'écoute que sur cet ordinateur (`127.0.0.1:3737`) : il n'est pas accessible depuis le reste du réseau ni depuis internet. Le port se change avec la variable `PORT`.

## Développement

```bash
npm install
npm start          # lance le serveur et ouvre le navigateur (--no-open pour ne pas l'ouvrir)
npm run typecheck
npm test           # tests unitaires, sans clé API (faux agent)
```

Structure :

| Chemin | Rôle |
|---|---|
| `apps/server/src` | Serveur Node (sans framework) : routes, sessions agent, profil |
| `apps/web` | Interface de chat (HTML/JS/CSS, sans build) |
| `workspace/AGENTS.md` | Règles de l'agent (ton, conseil uniquement, onboarding) : envoyées avec le premier message de chaque conversation (avec le profil) |
| `workspace/socle/` | Fiches de connaissances Jeedom lues par l'agent |
| `workspace/profil/pere.md` | Profil de l'utilisateur (créé à l'usage, ignoré par git car personnel) |
| `workspace/exports/` | Exports de scénarios à analyser (un exemple fictif est fourni) |
| `data/` | Dernière conversation (créé à l'usage, ignoré par git) |

### Garde-fous (conseil uniquement)

L'agent est lancé en local avec `cwd = workspace/`, une liste d'outils restreinte (lecture, recherche, listage) et un seul outil personnalisé, `save_profile`, qui n'écrit que `workspace/profil/pere.md`. Aucun shell, aucune édition libre, aucun accès à Jeedom. Ces options sont repassées à chaque reprise de conversation (le SDK ne les persiste pas).

Les consignes ne passent pas par l'option `systemPrompt` du SDK, car elle n'est disponible que sur certains comptes Cursor : elles sont jointes au premier message de la conversation, et le profil à jour au premier message d'une conversation reprise.

### Enrichir les connaissances

Ajouter ou corriger des fiches dans `workspace/socle/` et les référencer dans `00-index.md`. La source recommandée est la documentation officielle : <https://github.com/jeedom/core/tree/master/docs/fr_FR>. Ne documenter que ce qui est vérifié, y compris les noms de menus.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Bandeau « la clé API Cursor est absente » | Fichier `.env` manquant ou `CURSOR_API_KEY` vide |
| « La clé API Cursor est refusée » | Clé erronée ou révoquée |
| « Le port 3737 est déjà utilisé » | L'assistant est déjà ouvert (chercher la fenêtre noire) ou changer `PORT` |
