# Glossaire (mots simples)

- **Core** : le logiciel de base de Jeedom (hors plugins).
- **Plugin** : module qui ajoute une fonction à Jeedom (ex. gérer un protocole ou une marque d'appareils).
- **Objet** : une pièce ou un regroupement dans Jeedom.
- **Équipement** : un appareil ou module géré par un plugin.
- **Commande** : une information (info) ou un ordre (action) d'un équipement.
- **Dashboard** : la page qui affiche toutes les pièces et tous les équipements visibles, avec leurs commandes.
- **Scénario** : suite d'actions déclenchée par une heure ou un événement.
- **Déclencheur** : événement (changement d'une commande) qui lance un scénario.
- **Cron** : écriture technique d'un horaire répétitif, par exemple `0 5 * * *` = tous les jours à 5 h.
- **Tag** : valeur spéciale utilisable dans un scénario, par exemple `#time#` (heure courante) ou `#sunset#` (coucher du soleil).
- **Variable** : valeur mémorisée par Jeedom et partagée entre scénarios (Outils → Variables).
- **Market** : boutique et service en ligne de Jeedom (plugins, sauvegarde cloud, mises à jour).
- **Orpheline (commande)** : commande encore utilisée quelque part alors qu'elle n'existe plus.
- **Widget** : l'affichage graphique d'une commande sur une tuile.
- **Résumé** : valeur de synthèse d'un objet (température moyenne, présence de mouvement…).
- **Timeline** : historique chronologique des événements et exécutions suivis.
- **Démon** : programme de fond d'un plugin (par exemple pour un protocole). S'il est arrêté, les équipements de ce plugin ne répondent plus.
