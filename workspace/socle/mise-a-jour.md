# Mises à jour (Réglages → Système → Centre de mise à jour)

Le centre de mise à jour gère le **core** (logiciel de base de Jeedom) et les **plugins**.

## Principes

- Jeedom contrôle périodiquement le Market ; la date de dernière vérification est affichée en haut à gauche. À l'ouverture de la page, une vérification est refaite si la dernière date de plus de deux heures. Bouton **Vérifier les mises à jour** pour le faire à la main.
- Avant d'appliquer une mise à jour, recommander une sauvegarde manuelle (voir `sauvegarde-restauration.md`), même si Jeedom en fait une automatiquement par défaut.

## Lancer une mise à jour

1. Réglages → Système → Centre de mise à jour.
2. **Vérifier les mises à jour**.
3. Bouton **Mettre à jour** : une fenêtre propose des options (Sauvegarder avant, Mettre à jour les plugins, Mettre à jour le core…). Garder **Sauvegarder avant** coché.
4. Laisser la mise à jour se terminer ; à la fin, recharger la page si la fenêtre le propose.

## Options à connaître

- **Sauvegarder avant** : sauvegarde locale juste avant la mise à jour. En cas de problème lors d'une mise à jour **du core**, Jeedom restaure automatiquement cette sauvegarde (ce n'est pas le cas pour les plugins).
- **Mettre à jour les plugins / le core** : choisit ce qui est inclus.
- **Mode forcé** : continue malgré les erreurs, **désactive la sauvegarde** et ne restaure pas. À éviter sauf demande du support.
- **Pré-update** : généralement uniquement sur demande du support.
- **Mise à jour à réappliquer** : certaines mises à jour peuvent être réappliquées, pas toutes.

Le bouton **Sauvegarder** de la page sert à enregistrer le choix de ne pas mettre à jour certains plugins (options du tableau).

## Cas fréquent : la version attendue n'apparaît pas

Vérifier dans Réglages → Système → Configuration, onglet Mises à jour/Market, que la **source de mise à jour du core** est bien « stable » et non « stable (old) ».

## Remarque

Le support mentionne aussi une mise à jour en SSH, mais ce n'est pas adapté à un utilisateur non technicien : ne pas la proposer d'emblée.
