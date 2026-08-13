/* DCN V16.2 — démarrage rapide authentifié depuis Google Sheets. */
(async function(){
  'use strict';

  function status(msg){
    if(typeof showLastAction==='function')showLastAction(msg);
    else console.log(msg);
  }

  function currentPageId(){
    const p=document.querySelector('.page.active');
    return p&&p.id?p.id.replace(/^page-/,''):'projets';
  }

  function start(db,user,tables){
    DB=db;
    window.DCN_CURRENT_USER=user||null;
    window.DCN_TABLE_CACHE=tables||{};
    window.DCN_AUTH?.setServerUser?.(user||null);

    window.DCN_STATE?.persistCache?.(DB);
    window.DCN_SYNC?.init?.(DB);

    if(typeof normalizeWorkflowLinks==='function')normalizeWorkflowLinks();
    if(typeof initMonthSelector==='function')initMonthSelector();
    if(typeof refreshMonthUI==='function')refreshMonthUI();

    // Point clé V16.2 : on ne rend plus toutes les pages au démarrage.
    // On rend seulement la page visible (Projets par défaut).
    const page=currentPageId();
    if(typeof renderPage==='function')renderPage(page);
    else if(typeof renderProjectsPage==='function')renderProjectsPage();

    if(typeof updateServiceBadge==='function')updateServiceBadge();
    if(typeof enhanceProjectSheetLinks==='function')setTimeout(enhanceProjectSheetLinks,0);

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
    start(db,res.user,res.tables);

    const elapsed=Math.round(performance.now()-started);
    console.log('[DCN V16.2] données principales prêtes en '+elapsed+' ms');
  }catch(err){
    console.error('Démarrage SuiviDCN',err);
    status('● Connexion Google Sheets impossible');
    window.DCN_AUTH?.showError?.(err&&err.message?err.message:'Connexion impossible');
    if(typeof toast==='function')toast('Connexion impossible : '+(err&&err.message?err.message:err),'err');
  }
})();
