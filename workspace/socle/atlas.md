# Jeedom Atlas

## Ce que c'est

Box officielle « clé en main » : Jeedom est préinstallé sur un système optimisé, avec des plugins et un outil de **restauration système automatique**. Ce n'est pas un ordinateur à configurer soi-même : l'utilisateur passe par l'interface web de Jeedom.

Variantes officielles : Atlas sans protocole, Atlas EnOcean, Atlas EnOcean + clé Z-Wave ZOOZ, Atlas Pro rail DIN (sans protocole, EnOcean, KNX). Une variante sans protocole nécessite une clé USB compatible pour chaque protocole supplémentaire (Zigbee, Z-Wave, etc.).

## Accéder à l'interface

- Adresse par défaut : `http://jeedomatlas.local` (dans le navigateur d'un ordinateur du même réseau local).
- Si le nom ne fonctionne pas : chercher l'adresse IP de la box dans l'interface de la box internet / du routeur (liste des appareils connectés, appareil nommé « Jeedom »), ou utiliser l'outil de découverte du Market Jeedom. La box doit être démarrée depuis plusieurs minutes.

## Première connexion

- Identifiants par défaut : `admin` / `admin`. Jeedom invite à changer le mot de passe : le saisir deux fois.
- Le mot de passe de `admin` se change aussi dans Réglages → Système → Utilisateurs (bouton Mot de passe).
- `admin` / `admin` ne fonctionne plus à distance (depuis Jeedom 3.2) : uniquement en local, et seules les IP en 192.168.*.* ou 127.0.0.1 sont reconnues comme locales par défaut. Passer par le DNS Jeedom compte comme un accès distant, même chez soi. En cas de blocage, il existe une procédure de remise à zéro du mot de passe (orienter vers le support ou le forum).
- Au premier démarrage, la box se met à jour : laisser le processus se terminer.
- Matériel : visser l'antenne, brancher le câble réseau puis l'alimentation.

## Restauration système (Atlas/Smart)

Disponible depuis la version 4.4.20 du core. Menu : Réglages → Système → Restauration système.

- Durée : environ 20 minutes, pendant lesquelles la box est inaccessible. Il faut être patient.
- Avant toute restauration système : lancer et **télécharger une sauvegarde récente** (Réglages → Système → Sauvegardes), car le système est réinstallé.
- Deux modes : **automatique** (l'image système est téléchargée puis appliquée au prochain démarrage) et **USB** (clé USB formatée en FAT32).
- L'adresse IP de la box peut changer après la restauration.

## Protocoles

Les protocoles (Zigbee, Z-Wave, EnOcean…) sont gérés par des plugins dédiés (Plugins → Gestion des plugins). Le support officiel de Jeedom couvre l'instance Jeedom ; le support système complet ne concerne que les boxes officielles (hors modifications faites par l'utilisateur).
