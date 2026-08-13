/* DCN V16 — démarrage authentifié depuis Google Sheets. */
(async function(){
  'use strict';
  function status(msg){if(typeof showLastAction==='function')showLastAction(msg);else console.log(msg);}
  function start(db,user){
    DB=db;window.DCN_CURRENT_USER=user||null;
    window.DCN_AUTH?.setServerUser?.(user||null);
    window.DCN_STATE?.persistCache?.(DB);window.DCN_SYNC?.init?.(DB);
    if(typeof normalizeWorkflowLinks==='function')normalizeWorkflowLinks();
    if(typeof initMonthSelector==='function')initMonthSelector();
    if(typeof refreshMonthUI==='function')refreshMonthUI();
    if(typeof renderAll==='function')renderAll();
    status('● Google Sheets connecté — '+((user&&user.name)||'Utilisateur'));
  }
  try{
    status('● Connexion Google requise…');
    await window.DCN_AUTH.ready();
    status('● Authentification validée — chargement Google Sheets…');
    const res=await window.DCN_API.loadBootstrap(p=>status('● Chargement Google Sheets '+p.done+'/'+p.total+' — '+p.name));
    if(!res||!res.tables)throw new Error('Chargement Google Sheets incomplet');
    const db=window.DCN_MAPPER.tablesToLegacy(res.tables);start(db,res.user);
  }catch(err){
    console.error('Démarrage SuiviDCN',err);status('● Connexion Google Sheets impossible');
    window.DCN_AUTH?.showError?.(err&&err.message?err.message:'Connexion impossible');
    if(typeof toast==='function')toast('Connexion impossible : '+(err&&err.message?err.message:err),'err');
  }
})();
