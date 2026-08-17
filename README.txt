DCN V16.4.4 — Correction clic dans les tableaux horizontaux

CAUSE IDENTIFIÉE
navigation.js capturait le pointeur dès pointerdown avec setPointerCapture().
Le clic était alors retargeté vers le conteneur .tw au lieu de la ligne projet/AO.

CONSÉQUENCE
- Fiche projet : ne s'ouvrait pas dans la grande table Projets.
- Fiche AO : ne s'ouvrait pas dans Pipeline AO.
- AO sur page Projets pouvait fonctionner car cette petite table n'était pas forcément enrichie en grille glissable.

CORRECTION
Le pointeur n'est capturé qu'après un déplacement horizontal réel (> 7 px).
Un simple clic reste donc un vrai clic sur la ligne.

A DÉPLOYER SUR GITHUB
- index.html
- js/navigation.js

Aucun changement Apps Script / Google Sheets.
