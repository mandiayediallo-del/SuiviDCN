DCN Suivi — V16.4.5 — Identité Akli / doublons collaborateurs

OBJECTIF
- Akli conserve son identifiant historique m2.
- Son compte Google devient akli15285@gmail.com.
- Les charges et affectations existantes restent liées à m2.
- Si un doublon Akli a déjà été créé, son googleSub et ses éventuelles nouvelles références
  sont rapatriés vers m2 puis le doublon est archivé.
- Une adresse Google ne peut plus être utilisée par deux ressources actives.
- Lors de l'ajout d'un collaborateur, l'application propose de réutiliser un ancien ID
  actif sans email lorsqu'un seul candidat historique correspond.

DEPLOIEMENT
1. Apps Script : remplacer Code.gs par apps-script/Code.gs.
2. Enregistrer puis redéployer le Web App (nouvelle version).
3. Dans l'éditeur Apps Script, exécuter UNE FOIS la fonction repairAkliIdentity().
4. Vérifier dans le journal d'exécution que le résultat contient ok:true et targetId:"m2".
5. GitHub : remplacer index.html et js/config.js.
6. Akli : se déconnecter/reconnecter avec Akli15285@gmail.com puis Ctrl+F5 si nécessaire.

Aucun changement manuel à faire dans les 253 lignes historiques de charges.
