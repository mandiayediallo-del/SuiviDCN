DCN Suivi — V16.4.6 — Synchronisation charges Collaborateur

CAUSE RACINE
L'ouverture du Plan de charge appelait getMonthConfig() pour les 12 mois.
Lorsqu'un mois CALENDRIER était absent, cette simple lecture ajoutait
silencieusement le mois dans DB.parametresMensuels.

Pour un Collaborateur :
- modification CHARGES = autorisée
- modification CALENDRIER = interdite

Le diff envoyait les deux dans le même lot, donc tout le lot était refusé.
La charge restait locale puis disparaissait à la reconnexion.

CORRECTION
- getMonthConfig() devient une lecture pure : aucun changement DB lors du rendu.
- updateMonthParam() crée le mois uniquement lors d'une vraie édition Manager.
- Aucun changement Apps Script / Google Sheets.

A DEPLOYER SUR GITHUB
- index.html
- js/app-core.js

APRES DEPLOIEMENT
Akli doit faire Ctrl+F5 (ou se déconnecter/reconnecter) avant de ressaisir une charge.
