DCN Suivi — V16.4 Ressources internes/externes + Prestataires externes

1. RESSOURCES / COLLABORATEURS
Champs :
- Nom
- Prénom
- Type de ressource : Interne / Externe
- Société / prestataire : obligatoire pour un Externe
- Email Google : obligatoire pour un Interne, facultatif pour un Externe
- Fonction
- Capacité (%)
- Niveau d'accès : Manager / Collaborateur / Aucun accès
- Actif : Oui / Non

Règles :
- Interne + Manager : voit tout et peut tout modifier.
- Interne + Collaborateur : voit tout et ne modifie que sa propre charge.
- Externe : Aucun accès forcé côté interface ET côté Apps Script. La ressource reste suivie dans le Plan de charge et les projets.
- Une ressource inactive ne peut pas se connecter et n'apparaît plus dans les ressources actives, mais son historique est conservé.
- Les IDs historiques ne sont jamais modifiés.

2. CAPACITÉ
La capacité a désormais un effet métier réel.
Exemple : capacité 80 %, charge 80 % => occupation de capacité = 100 %, disponibilité = 0 %.
Les alertes de surcharge / sous-charge utilisent ce taux d'occupation relatif à la capacité.

3. PRESTATAIRES EXTERNES
Nouvel onglet après Suivi commercial.
Fiche :
- Raison sociale, nom commercial, SIRET/identifiant, pays, adresse
- Contact principal
- Spécialités
- TJM moyen
- Zone d'intervention
- Évaluation /5
- Ressources externes liées (calculées automatiquement)
- Projets liés (calculés automatiquement)
- Échéance assurance
- Documents / liens
- Statut
- Notes

Statuts prestataire :
- À tester : prestataire identifié mais pas encore évalué/référencé.
- Référencé : prestataire validé, consultable pour de nouvelles missions.
- Actif : collaboration actuellement en cours.
- Suspendu : ne pas solliciter temporairement.
- Ne plus consulter : prestataire à ne plus solliciter, historique conservé.

4. GOOGLE SHEETS
La V16.4 crée automatiquement au premier appel :
- la feuille PRESTATAIRES si elle n'existe pas ;
- les nouvelles colonnes de UTILISATEURS : prenom, typeRessource, prestataireId, societe, version (et toute colonne technique manquante).
Aucune modification manuelle du Google Sheet n'est requise.
Les modifications App <-> Sheets restent bidirectionnelles.

5. DÉPLOIEMENT
Apps Script : remplacer Code.gs par DCN_V16_4_CODE_GS_RESSOURCES_PRESTATAIRES.gs, enregistrer, puis Gérer les déploiements > Modifier > Nouvelle version > Déployer.
GitHub : envoyer le contenu du ZIP patch en conservant les dossiers.
Aucun changement Google Cloud / OAuth / appsscript.json.
