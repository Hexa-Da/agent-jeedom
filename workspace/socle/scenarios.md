# Scénarios (Outils → Scénarios)

Un scénario est le « cerveau » de la domotique : il lance des actions (fermer un volet, allumer une lumière, envoyer un message) à une heure donnée ou quand un événement se produit.

## Créer un scénario (étapes)

1. Outils → Scénarios → bouton **Ajouter**, puis saisir le nom.
2. Onglet **Général** : cocher **Actif** (sans cela, le scénario ne s'exécute jamais), choisir un **Objet parent** si besoin, choisir le **Mode du scénario** (programmé, déclenché, ou les deux) et saisir le ou les déclencheurs / programmations.
3. Onglet **Scénario** : le scénario est vide à la création. Bouton **Ajouter un bloc**, choisir un type de bloc, puis ajouter des actions dans le bloc.
4. **Sauvegarder**, puis tester avec le bouton **Exécuter** (sauvegarder avant, sinon les modifications ne sont pas prises en compte). Ctrl + clic sur Exécuter : sauvegarde, exécute et affiche le log (si le niveau de log n'est pas « Aucun »).

## Onglet Général : les options importantes

- **Actif** : si décoché, le scénario n'est jamais exécuté, quel que soit le mode.
- **Mode** : *programmé* (horaire), *déclenché* (par un événement sur une commande), ou les deux. Maximum 15 déclencheurs ; maximum 28 déclencheurs/programmations au total.
- **Log** : niveau de log du scénario ; peut apparaître dans Analyse → Temps réel.
- **Timeline** : garde une trace dans la Timeline.
- **Multi lancement** : autorise plusieurs exécutions simultanées. À éviter de provoquer plusieurs lancements dans la même seconde.
- **Mode synchrone** : déconseillé pour les scénarios complexes ou avec des pauses : risque d'instabilité de Jeedom (non couvert par le support).
- **Timeout en secondes** (0 = illimité) : durée d'exécution maximale.

## Déclencheurs (mode déclenché)

- Un déclencheur est une commande de type info, écrite sous la forme `#[Objet][Équipement][Commande]#`.
- On peut y mettre une **condition** : `#[Garage][Open Garage][Ouverture]# == 1`. Dans ce cas le scénario ne se lance que si la condition est vraie. Sans condition, il se lance à chaque changement de la valeur.
- Jeedom affiche un avertissement si aucun déclencheur n'est configuré (versions récentes).

## Programmation (mode programmé)

- Syntaxe **Cron** : `*/20 * * * *` (toutes les 20 minutes), `0 5 * * *` (tous les jours à 5 h). Le bouton **?** à droite d'une programmation aide à la remplir sans connaître le Cron.
- On peut aussi saisir une heure sous la forme `Gi` (heure sans zéro initial + minutes) : `915` pour 9 h 15, `2340` pour 23 h 40.
- Cette heure peut être un calcul : `#sunset# + 10` = 10 minutes après le coucher du soleil. Pour 1 h 30 après : `#sunset# + 130` (le calcul se fait en format heure-minute, pas en minutes décimales). Avec ce type de syntaxe, Jeedom ne peut pas afficher les dates de lancement précédente/suivante.
- `#sunrise#` et `#sunset#` ne fonctionnent que si la **latitude et la longitude** sont renseignées dans la configuration de Jeedom (Réglages → Système → Configuration).

## Types de blocs

- **Si/Alors/Sinon** : actions sous condition.
- **Action** : actions simples sans condition.
- **Boucle** : répétition (durée maximale 1 heure dans les versions récentes).
- **Dans** : lance les actions dans X minutes, en arrière-plan (non bloquant).
- **À** : lance les actions à une heure donnée `hhmm` (ex. `0030` pour 0 h 30). Non bloquant.
- **Tant que** (depuis le core 4.6) : répète tant qu'une condition est vraie.
- **Code** : code PHP, puissant mais risqué : à réserver aux utilisateurs à l'aise.
- **Commentaire** : notes dans le scénario.

Les actions d'un bloc ont une case pour être activées, et une case **parallèle** pour se lancer en même temps que les autres.

## Conditions : points d'attention

- Ne **jamais** utiliser de crochets `[ ]` dans les conditions (seulement des parenthèses `( )`), hormis dans le nom des commandes `#[...][...][...]#`.
- Privilégier les guillemets simples (`'`) aux guillemets doubles (`"`).
- Boutons à droite d'un bloc Si : *Rechercher une commande / un scénario / un équipement*. Après le choix d'une commande, une fenêtre propose le test à faire ; **et** / **ou** permet d'enchaîner plusieurs tests.
- Les flèches circulaires à gauche de la condition gèrent la répétition des actions quand la condition donne le même résultat que la fois précédente.

## Tags utiles

- `#time#` : heure et minutes courantes (ex. 1715 pour 17 h 15).
- `#sunrise#`, `#sunset#` : lever / coucher du soleil.
- Fonction `time_op(#time#, -90)` : retire 1 h 30 à l'heure courante.

## Actions spécifiques courantes

Pause (`sleep`), variable, scénario (démarrer, arrêter, activer, désactiver), attendre (`wait`, maximum 2 h), ajouter un log, créer un message dans le centre de messages, alerte, pop-up. Attention : certaines actions ont un effet fort (par exemple « Arrêter Jeedom »).

## Outils d'aide

- **Outils → Variables** : variables partagées entre scénarios.
- **Outils → Testeur d'expression** : tester une expression avant de la mettre dans un scénario.
- Boutons du scénario : Log, Dupliquer, Liens, Édition texte, Exporter, Recherche, Supprimer.

## Brouillon type : fermer les volets au coucher du soleil

À recopier dans Jeedom en remplaçant les noms entre crochets par ceux de l'utilisateur :

1. Mode : **programmé**. Programmation : `#sunset#` (ou `#sunset# + 10` pour 10 minutes plus tard). Vérifier la latitude / longitude dans Réglages → Système → Configuration.
2. Bloc **Action**, ajouter l'action : commande « fermer » du volet, au format `#[Salon][Volet salon][Fermer]#` (le nom exact est dans Outils → Objets ou dans la tuile de l'équipement).
3. **Actif** coché, **Sauvegarder**, puis **Exécuter** pour tester (le volet va réellement bouger).

Variante avec condition (ne fermer que s'il est ouvert) : bloc **Si/Alors/Sinon** avec la condition sur la commande d'état du volet, et la commande « fermer » dans le **Alors**.
