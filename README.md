# DCN Suivi — V15CC GitHub + Google Sheets

## Objectif
Cette version sépare complètement le logiciel et les données :

- **GitHub Pages** : HTML / CSS / JavaScript uniquement.
- **Google Sheets** : source de vérité des données.
- **Google Apps Script** : API sécurisée de lecture / écriture.
- **Navigateur** : cache local uniquement pour tolérer une coupure temporaire.

Aucune donnée chantier n'est incluse dans le dépôt V15C.

## Structure
- `index.html` : interface.
- `css/` : styles.
- `js/` : logique applicative.
- `js/runtime-config.js` : URL du Web App Apps Script.
- `js/data-mapper.js` : conversion Google Sheets <-> modèle de l'application.
- `js/sync.js` : synchronisation différentielle.
- `apps-script/` : backend à copier dans Apps Script lié au Google Sheet.
- `data/empty-db.js` : structure vide, sans donnée métier.

## Synchronisation
`saveDB()` ne télécharge plus un nouvel HTML. Il programme une synchronisation différentielle.

- Projet modifié -> ligne PROJETS + missions + affectations.
- AO modifiée -> ligne AO + missions.
- Devis modifié -> ligne DEVIS + missions.
- Prévision modifiée -> groupe PREVISIONS du projet.
- Charge modifiée -> groupe CHARGES du collaborateur et du mois.
- Facture / commercial / paramètres -> ligne correspondante.

Le backend utilise `LockService` pour sérialiser les écritures et alimente `HISTORIQUE`.

## Droits V15C
- Administrateur : lecture/écriture de toutes les tables.
- Collaborateur : lecture de la base et écriture uniquement de **sa propre charge**.
- L'identité est obtenue par le compte Google connecté.

## Mise en route
1. Dans le Google Sheet miroir, ouvrir `Extensions > Apps Script`.
2. Copier les fichiers de `apps-script/` dans le projet Apps Script.
3. Exécuter une fois `setup()` et accepter les autorisations.
4. Dans l'onglet `UTILISATEURS`, renseigner les emails Google des collaborateurs.
5. Déployer comme **Application Web**, exécution = **Utilisateur accédant à l'application**, accès = **Tout utilisateur connecté** (ou domaine Workspace si disponible).
6. Copier l'URL terminant par `/exec`.
7. La coller dans `js/runtime-config.js` -> `API_URL`.
8. Publier les fichiers du dossier V15C dans le dépôt GitHub / GitHub Pages.

## Sécurité
Ne remettez jamais `initial-data.json` ou un export du Google Sheet dans le dépôt GitHub. Le dépôt ne doit contenir que le code.


## Backend configuré

URL Apps Script configurée dans `js/runtime-config.js`. Les données métier restent exclusivement dans Google Sheets.


## V15C — chargement fractionné

Le front ne demande plus tout le classeur via `?action=bootstrap`. Il appelle `bootstrap-lite`, puis charge les 13 tables par requêtes séparées `?action=table&name=...` avec une concurrence limitée à 3. Ceci évite qu’une grosse réponse JSON unique bloque le démarrage.

## V15.3 — Pagination
Les tables volumineuses sont chargées par pages de 200 lignes. `CHARGES` (866 lignes dans la base actuelle) est donc récupérée en plusieurs requêtes automatiquement.
