---
name: refine-profile
description: >-
  Met à jour le profil utilisateur avec les faits durables de la conversation.
---

# Refine profil

L'outil `save_profile` **écrase** tout le fichier : renvoie toujours le profil **complet**, en reprenant le profil actuel et en respectant exactement la structure ci-dessous (titres `##` inchangés).

## Structure du profil

```
# Profil de l'utilisateur

## Statut
- Onboarding terminé : oui|non

## Jeedom
- Box : Atlas
- Version du core : 4.6.1
- Pièces / objets : 

## Plugins et protocoles
- 

## Équipements notables
- 

## Objectifs
- 

## Point bloquant actuel
- 

## Historique des sujets abordés
- 

## Préférences
- 
```

## Quand enregistrer

- Faits **sensibles** (variante Atlas, plugins installés, contraintes importantes) : seulement s'ils ont été **confirmés** pendant la conversation (« Je note que vous utilisez le plugin X, c'est bien cela ? » → oui). Sinon, ne les ajoute pas.
- Faits simples déjà établis dans l'échange (sujets abordés, objectif du moment, point bloquant) : enregistre-les.
- Ne change pas `Box : Atlas` ni `Version du core : 4.6.1` sauf confirmation explicite d'un écart.
- N'enregistre jamais de mot de passe, de clé API, d'adresse IP ni d'URL d'accès.

## Fin de conversation

Si aucun fait durable nouveau n'est apparu : n'appelle pas `save_profile`.
