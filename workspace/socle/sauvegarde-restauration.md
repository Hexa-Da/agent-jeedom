# Sauvegardes (Réglages → Système → Sauvegardes)

À conseiller **avant tout changement important** : mise à jour du core, gros changement de scénarios ou de plugins, restauration système.

## Lancer une sauvegarde

1. Réglages → Système → Sauvegardes.
2. Bouton **Lancer une sauvegarde** (une variante lance la sauvegarde sans l'envoyer sur le cloud, plus rapide).
3. À la fin de l'opération, **Télécharger la sauvegarde** pour en garder une copie sur l'ordinateur.

Le statut de l'action en cours (sauvegarde ou restauration) s'affiche à droite de la page.

Durée : elle varie selon le système et le volume de données ; plus de 5 minutes est normal. Ne pas interrompre.

## Paramètres

- **Emplacement des sauvegardes** : dossier où Jeedom stocke les sauvegardes. Recommandé : ne pas le changer.
- **Nombre de jours de mémorisation** : au-delà, les anciennes sauvegardes sont supprimées. Ne pas mettre un nombre trop élevé (risque de saturer l'espace disque).
- **Taille totale maximale des sauvegardes (Mo)** : si dépassée, les plus anciennes sont supprimées (au moins une est conservée).

## Sauvegardes locales

- **Restaurer la sauvegarde** : remet Jeedom dans l'état de la sauvegarde sélectionnée (les changements faits depuis seront perdus). Action lourde : prévenir l'utilisateur.
- **Supprimer la sauvegarde** : supprime l'archive sélectionnée du dossier local.
- **Envoyer une sauvegarde** : dépose sur la box une archive qui se trouve sur l'ordinateur (utile pour restaurer sur une nouvelle installation).
- **Télécharger la sauvegarde** : copie l'archive sur l'ordinateur.

## Sauvegardes cloud (Market)

- Nécessite un **abonnement** (page profil sur le Market → onglet « mes backups » ; durées de 1, 3, 6 ou 12 mois).
- Le Market conserve les **6 dernières** sauvegardes.
- Le mot de passe de sauvegarde cloud n'est connu que de l'utilisateur : en cas d'oubli, Jeedom ne peut ni le récupérer ni accéder aux sauvegardes cloud. Après une mise à jour vers 4.2 ou plus, il faut confirmer ce mot de passe dans Réglages → Système → Configuration, onglet Mise à jour/Market.

## Restauration système de l'Atlas

Différente d'une restauration de sauvegarde Jeedom : elle réinstalle le système de la box (voir `atlas.md`). Toujours télécharger une sauvegarde récente avant.
