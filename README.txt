DCN Suivi — V16.2 Chargement intelligent

OBJECTIF
- Une seule requête Apps Script au démarrage pour toutes les données principales.
- La page Projets s'affiche sans attendre le Plan de charge.
- CHARGES est chargé ensuite en arrière-plan, sous forme agrégée.
- renderAll() n'est plus appelé au démarrage : seule la page visible est rendue.

A DEPLOYER SUR GITHUB
- index.html
- js/api.js
- js/sync.js
- js/lazy-load.js
- js/pre-init.js

A DEPLOYER DANS APPS SCRIPT
- Remplacer Code.gs par DCN_V16_2_CODE_GS_CHARGEMENT_INTELLIGENT.gs
- Nouvelle version du déploiement Web App
- Garder : Exécuter en tant que Moi / accès Tout le monde

AUCUN CHANGEMENT
- Google Sheet
- OAuth Client ID
- appsscript.json
- Design / règles métier
