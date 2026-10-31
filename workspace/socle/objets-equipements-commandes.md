# Objets, équipements, commandes, plugins

## Hiérarchie

- **Objet** : une pièce ou un regroupement (Salon, Chambre, Maison). Gestion : Outils → Objets. Un objet peut avoir un parent (Maison → Salon), une image de fond, des résumés.
- **Équipement** : un appareil ou un module (volet, prise, capteur de température). Il est créé par un **plugin** (Plugins → menu du plugin → Ajouter) et rattaché à un objet parent.
- **Commande** : ce qu'on peut lire ou faire sur un équipement.
  - **Info** : une valeur lue (température, état ouvert/fermé, niveau de batterie).
  - **Action** : un ordre (ouvrir, fermer, allumer, éteindre).

Nom complet d'une commande, utilisé dans les scénarios : `#[Objet][Équipement][Commande]#`.

## Plugins

- Plugins → **Gestion des plugins** : installer, activer, configurer les plugins. Après installation, un plugin est **inactif** : il faut l'activer avant de pouvoir le configurer. Les plugins désactivés sont grisés ; un point orange devant un nom signale une version non stable (beta).
- Installer depuis le **Market** (bouton Market, Jeedom connecté à internet) : choisir **Installer stable**. Éviter les plugins obsolètes et ne pas installer de beta sur un Jeedom non beta. Les plugins payants se paient sur leur fiche ; attendre une dizaine de minutes avant de pouvoir les installer.
- Les identifiants du compte Market se saisissent dans Réglages → Système → Configuration, onglet Mises à jour/Market (utile pour retrouver ses plugins achetés).
- Chaque plugin a sa page (menu Plugins) avec la liste de ses équipements, un bouton pour **ajouter** un équipement et un bouton de configuration.
- Les protocoles (Zigbee, Z-Wave, EnOcean…) fonctionnent avec un plugin dédié et le matériel adapté (clé USB ou antenne de la box).

## Configurer un équipement (page d'un équipement)

Points habituels : **nom**, **objet parent**, **catégorie**, cases **Activer** et **Visible**, et la liste de ses commandes (on peut y régler l'affichage et l'historisation de chaque commande).

## Pourquoi un équipement n'apparaît pas sur le Dashboard

Il doit être **actif**, **visible**, et son **objet parent** doit être visible sur le Dashboard. Sinon, il est absent. Vérifier aussi qu'un filtre (catégorie, recherche) n'est pas actif sur le Dashboard.

Cause fréquente (FAQ officielle) : l'équipement est rattaché à un objet qui n'est ni le premier objet sélectionné à gauche dans l'arbre, ni l'un de ses enfants. Cet objet de départ se règle dans le profil de l'utilisateur.

## Résumés d'un objet

Dans Outils → Objets, onglet Résumé : choisir les commandes qui alimentent les résumés (température, humidité, mouvement, alerte…) affichés sur la Synthèse et en haut du Dashboard.

## Commande orpheline

Une commande utilisée quelque part (scénario, interaction…) qui n'existe plus. Elle se repère dans Analyse → Équipements, onglet **Commandes orphelines**. Cause fréquente : équipement supprimé ou recréé.
