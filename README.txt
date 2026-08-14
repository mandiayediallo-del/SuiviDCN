DCN Suivi — V16.3 Droits + synchronisation bidirectionnelle

FONCTIONNEL
1. Paramètres > Collaborateurs
   - Nom
   - Email Google obligatoire
   - Fonction
   - Capacité
   - Niveau d'accès : Manager / Collaborateur
   - Statut : Actif / Inactif
   - Modification et désactivation sans suppression de l'historique

2. Droits
   - Manager : voit tout et peut tout modifier.
   - Collaborateur : voit tout et ne peut modifier que son propre Plan de charge.
   - Contrôle dans l'interface ET dans Apps Script.

3. Synchronisation
   - Bouton "↻ Synchroniser" remplace "Sauvegarder les données".
   - App -> Sheets : synchronisation automatique après modification.
   - Sheets -> App : détection par révision de table.
   - Vérification légère toutes les 25 secondes.
   - Vérification immédiate au retour sur l'onglet.
   - Le bouton force envoi + récupération.
   - Une modification manuelle dans Sheets déclenche onEdit et marque la table modifiée.

DEPLOIEMENT
A. Apps Script
   - Remplacer Code.gs par DCN_V16_3_CODE_GS_DROITS_SYNC.gs
   - Enregistrer
   - Gérer les déploiements > Modifier > Nouvelle version > Déployer
   - Garder "Exécuter en tant que : Moi" et "Qui a accès : Tout le monde"
   - Aucun changement appsscript.json / OAuth nécessaire.

B. GitHub
   Envoyer le contenu du ZIP patch :
   - index.html
   - js/runtime-config.js
   - js/api.js
   - js/sync.js
   - js/config.js
   - js/permissions.js (nouveau)
   - js/lazy-load.js
   - js/bidirectional-sync.js (nouveau)
   - js/save-adapter.js
   - js/pre-init.js

TESTS CONSEILLÉS
1. Manager : modifier un projet puis vérifier le Sheet.
2. Sheet : modifier un projet puis cliquer Synchroniser dans l'app.
3. Ajouter Akli avec son email dans Paramètres.
4. Se connecter avec Akli : toutes les pages visibles, seules ses cases du Plan de charge modifiables.
5. Modifier une charge d'Akli dans l'app puis vérifier CHARGES.
6. Modifier une charge dans CHARGES côté Sheet puis cliquer Synchroniser.
