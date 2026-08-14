/* DCN V16.3 — démarrage rapide + initialisation droits/synchronisation bidirectionnelle. */
(async function(){
  'use strict';
  function status(msg){if(typeof showLastAction==='function')showLastAction(msg);else console.log(msg);}
  function currentPageId(){const p=document.querySelector('.page.active');return p&&p.id?p.id.replace(/^page-/,''):'projets';}
  function start(db,user,tables,syncState){
    DB=db;
    window.DCN_CURRENT_USER=user||null;
    window.DCN_TABLE_CACHE=tables||{};
    window.DCN_AUTH?.setServerUser?.(user||null);
    window.DCN_STATE?.persistCache?.(DB);
    window.DCN_SYNC?.init?.(DB);
    window.DCN_BISYNC?.init?.(syncState||{},user||null);

    if(typeof normalizeWorkflowLinks==='function')normalizeWorkflowLinks();
    if(typeof initMonthSelector==='function')initMonthSelector();
    if(typeof refreshMonthUI==='function')refreshMonthUI();

    const page=currentPageId();
    if(typeof renderPage==='function')renderPage(page);
    else if(typeof renderProjectsPage==='function')renderProjectsPage();

    if(typeof updateServiceBadge==='function')updateServiceBadge();
    if(typeof enhanceProjectSheetLinks==='function')setTimeout(enhanceProjectSheetLinks,0);
    window.DCN_PERMISSIONS?.apply?.();

    status('● Synchronisé — données principales');
    window.dispatchEvent(new CustomEvent('dcn-core-ready',{detail:{user:user||null,page}}));
  }

  try{
    status('● Connexion Google requise…');
    await window.DCN_AUTH.ready();
    status('● Authentification validée — chargement des données principales…');
    const started=performance.now();
    const res=await window.DCN_API.loadFastBootstrap();
    if(!res||!res.tables)throw new Error('Chargement Google Sheets incomplet');
    const db=window.DCN_MAPPER.tablesToLegacy(res.tables);
    start(db,res.user,res.tables,res.syncState||{});
    console.log('[DCN V16.3] données principales prêtes en '+Math.round(performance.now()-started)+' ms');
  }catch(err){
    console.error('Démarrage SuiviDCN',err);
    status('● Connexion Google Sheets impossible');
    window.DCN_AUTH?.showError?.(err&&err.message?err.message:'Connexion impossible');
    if(typeof toast==='function')toast('Connexion impossible : '+(err&&err.message?err.message:err),'err');
  }
})();
