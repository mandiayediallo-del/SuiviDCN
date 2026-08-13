# DCN V15.3 — Pagination Google Sheets

## Pourquoi cette version
Les tests manuels ont validé :
- `whoami` : OK
- `table&name=PROJETS` : OK
- `table&name=CHARGES` : échec lorsque les 866 lignes sont renvoyées en une seule réponse.

La V15.3 renvoie donc les tables par pages de 200 lignes maximum. Le front agrège automatiquement toutes les pages.

## Mise à jour Apps Script
1. Remplacer tout `Code.gs` par `DCN_V15_3_CODE_GS_PAGINATION.gs`.
2. Enregistrer.
3. Déployer > Gérer les déploiements > Modifier.
4. Version > Nouvelle version.
5. Déployer.

## Test manuel
Tester :
`/exec?action=table&name=CHARGES&offset=0&limit=200`

La réponse doit contenir notamment :
- `ok: true`
- `table: "CHARGES"`
- `count: 200`
- `total: 866`
- `hasMore: true`
- `nextOffset: 200`

Puis tester la dernière page :
`/exec?action=table&name=CHARGES&offset=800&limit=200`

La réponse doit contenir environ 66 lignes et `hasMore: false`.
