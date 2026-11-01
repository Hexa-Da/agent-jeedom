# Interface et menus (core 4.6, similaire en 4.4 / 4.5)

## Structure du menu principal

- **Accueil** : Synthèse, Dashboard, Vue, Design (Design 3D selon version).
- **Analyse** : Logs, Temps réel, Équipements, Résumé domotique, Timeline, Historique, Santé.
- **Outils** : Objets, Scénarios, Interactions, Widgets, Types d'équipement, Notes, Testeur d'expression, Variables, Recherche, Remplacer.
- **Plugins** : Gestion des plugins, puis la liste des plugins installés.
- **Réglages** : Système (Configuration, Sauvegardes, Centre de mise à jour, Utilisateurs, Moteur de tâches, Personnalisation avancée, Éditeur de fichiers, Redémarrer, Éteindre), Préférences, Thème alternatif, Version mobile, Demande de support, Se déconnecter. La version de Jeedom est affichée dans le menu Réglages.

## Raccourcis utiles de la barre de menu

- Le bouton **?** ouvre l'aide de la page en cours.
- Cliquer sur le nom du Jeedom ouvre Réglages → Système → Configuration.
- Cliquer sur l'horloge ouvre la Timeline.

## Dashboard (Accueil → Dashboard)

Compte-rendu auto-généré de toute la domotique : objets visibles et leurs équipements.

- Pour qu'un équipement apparaisse : il doit être **actif**, **visible**, et son **objet parent** doit être visible sur le Dashboard.
- Une commande de type **info** a un repère bleu ; un clic ouvre son historique si elle est historisée. Une commande **action** a un repère orange ; un clic **déclenche l'action** (prévenir l'utilisateur : cliquer sur un bouton d'action agit vraiment sur la maison).
- Mode **édition** (crayon en haut à droite de la barre de recherche) : déplacer ou redimensionner les tuiles.
- Champ de recherche : filtre par nom, catégorie, plugin, tag.
- Filtre par catégorie : icône à droite de la recherche.

## Synthèse (Accueil → Synthèse)

Vue visuelle des pièces (objets) avec image de fond et résumés (température, humidité, alerte, mouvement…). Pour qu'elle soit parlante : configurer les résumés et une image de fond sur chaque objet (Outils → Objets). Peut être définie comme page par défaut dans Réglages → Préférences.

## Analyse → Équipements

Vue centralisée : état des piles, modules en alerte, actions définies, alertes définies, commandes orphelines.

## Analyse → Logs / Temps réel / Santé

- **Logs** : fichiers journaux servant surtout à déboguer et à résoudre des problèmes avec le support. Liste des logs à gauche (avec recherche) ; boutons Rechercher, Pause/Reprendre, Télécharger, Vider, Supprimer. Le log `http.error` ne doit pas être supprimé.
- **Temps réel** : fenêtre qui affiche en direct tous les événements de la domotique (le log « Event » doit être au niveau info ou debug).
- **Santé** : aperçu rapide de l'état de Jeedom en deux colonnes (ce que Jeedom vérifie / statut). Ligne verte = tout va bien, rouge = un souci ; une info-bulle donne parfois un conseil de résolution. En dessous, la santé de chaque plugin (clic sur le nom pour le détail).
