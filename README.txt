DCN Suivi — V16.4.7 — Synchronisation incrémentale des charges

CAUSE RACINE
Jusqu'à V16.4.6, modifier UNE cellule de charge générait un replaceGroup sur tout le mois.
Pour Akli (m2), le miroir historique contient environ 19 à 24 lignes CHARGES par mois.
Le serveur supprimait puis recréait toutes ces lignes une par une, avec historique,
ce qui pouvait dépasser le délai du bridge navigateur (45 s).

CORRECTION
- Une cellule modifiée produit maintenant un seul upsert CHARGES.
- Les lignes existantes sont retrouvées par clé métier :
  membreId + periode + typeCharge (+ objetId pour un projet).
- L'ID historique d'une ligne existante est conservé.
- Une nouvelle ligne reçoit un ID généré côté Apps Script.
- Mettre une charge à 0 met à jour la ligne au lieu de remplacer le mois.
- Les droits restent inchangés :
  Manager = toutes les charges ; Collaborateur = uniquement sa propre charge.

DEPLOIEMENT
1. Apps Script : remplacer Code.gs par le fichier V16.4.7 puis redéployer le Web App.
2. GitHub : remplacer index.html et js/data-mapper.js.
3. Akli : Ctrl+F5 ou déconnexion/reconnexion.
4. Test : modifier UNE cellule, attendre l'indicateur "Synchronisé", puis vérifier depuis le compte Manager.

IMPORTANT
Ce correctif est valable pour tous les utilisateurs, pas uniquement Akli.
