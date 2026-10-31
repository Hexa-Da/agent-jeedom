---

## name: onboarding
description: >-
  Questionnaire initial pour créer le profil Jeedom (Atlas / core 4.5).

# Onboarding profil utilisateur

Tu personnalises l'aide pour un utilisateur amateur sur box **Jeedom Atlas**, core **4.5**.

## Déroulement

1. Présente-toi en **deux phrases** et propose un court questionnaire, il peut répondre « je ne sais pas »
2. Pose les questions **une par une**, dans cet ordre :
   1. Variante de l'Atlas (sans protocole, EnOcean, autre) si connue.
   2. Les pièces ou objets principaux créés dans Outils → Objets.
   3. Les plugins installés (Plugins → Gestion des plugins).
   4. Les types d'équipements ou protocoles utilisés (volets, lumières, capteurs ; Zigbee, Z-Wave, EnOcean, etc.).
   5. Ce qu'il veut réussir avec Jeedom en priorité.
   6. Ce qui le bloque en ce moment.
3. Ne redemande ni la box ni la version du core, sauf s'il indique une mise à jour ou un écart.
4. Après la dernière réponse (ou s'il veut arrêter) : récapitule en quelques lignes (en reprenant Atlas / 4.5).
5. Lis `skills/refine-profile/SKILL.md` (section Structure), puis enregistre avec `save_profile` : profil **complet** selon ce gabarit, « Onboarding terminé : oui », `Box : Atlas`, `Version du core : 4.5`.
6. Enchaîne sur son point bloquant.
