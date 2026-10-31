# Dépannage de base

Méthode générale : une question à la fois, une vérification à la fois. Toujours demander ce que l'utilisateur voit exactement (message d'erreur, capture d'écran).

## Un scénario ne se lance pas

1. Outils → Scénarios → ouvrir le scénario : la case **Actif** est-elle cochée ? (les scénarios désactivés sont grisés dans la liste).
2. Onglet Général : y a-t-il au moins un **déclencheur** ou une **programmation** ? (Jeedom affiche un avertissement sinon.)
3. Le déclencheur contient-il une **condition** (`== 1`) qui n'est jamais vraie ?
4. Avec `#sunset#` / `#sunrise#` : latitude et longitude renseignées dans Réglages → Système → Configuration ?
5. Tester à la main : bouton **Exécuter** (sauvegarder avant) puis regarder le **Log** du scénario (niveau de log pas sur « Aucun »). Ctrl + clic sur Exécuter fait les trois d'un coup.
6. Y a-t-il un message d'erreur dans le Log ? Le demander (ou une capture).
7. Si un bouton « Désactiver scénarios » (global) a été utilisé dans Outils → Scénarios, plus aucun scénario ne s'exécute : vérifier.

## Un scénario se lance deux fois, ou trop souvent

- Un déclencheur sans condition se lance à chaque changement de valeur ; ajouter une condition (ex. `== 1`).
- Plusieurs déclencheurs sur le même événement.
- Multi lancement coché.

## Un équipement n'apparaît pas sur le Dashboard

Voir `objets-equipements-commandes.md` : actif, visible, objet parent visible, pas de filtre actif.

## Un équipement ne répond plus / n'est plus à jour

- Regarder Analyse → Équipements : onglets **Batteries** (pile faible) et **Modules en alerte** (timeout, batterie, commande en alerte).
- Regarder la page du plugin concerné (équipement actif ? démon du plugin démarré ?) : demander une capture si le statut n'est pas clair.
- Consulter Analyse → Logs, en choisissant le journal du plugin concerné.

## « Commande introuvable » dans un scénario

Probablement une commande orpheline : Analyse → Équipements, onglet **Commandes orphelines**.

## Un clic sur le Dashboard a déclenché quelque chose

Une commande **action** (repère orange) agit immédiatement quand on clique. Rappel à l'utilisateur pour éviter les clics de curiosité.

## Quand ne pas insister

Panne matérielle, box inaccessible après restauration, plantage répété du core : orienter vers Réglages → Demande de support (si la box est accessible) ou le forum community.jeedom.com, et rappeler de télécharger une sauvegarde avant toute manipulation lourde.
