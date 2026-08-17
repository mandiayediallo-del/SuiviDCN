DCN Suivi — V16.4.3 — Correctif propre ouverture fiche projet

CAUSES TRAITÉES
- Suppression du correctif V16.4.2 basé sur window.DB.
- Une seule logique d'ouverture de fiche.
- Les lignes Projets portent data-project-id.
- project-sheet.js utilise directement la vraie variable DB.
- La modale est ouverte avant la construction détaillée de la fiche.
- Si le contenu détaillé échoue, une fiche minimale s'affiche avec l'erreur.

A DEPLOYER SUR GITHUB
- index.html
- js/app-core.js
- js/project-sheet.js

IMPORTANT
- Ne pas conserver de référence à js/project-sheet-fix.js dans index.html.
- Le fichier project-sheet-fix.js peut rester physiquement dans le dépôt : il ne sera plus chargé.
- Aucun changement Apps Script / Google Sheets.
