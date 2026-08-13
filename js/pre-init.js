/* DCN V15.2 — bootstrap asynchrone fractionné depuis Google Sheets. */
(async function(){
  'use strict';
  function status(msg){if(typeof showLastAction==='function')showLastAction(msg);else console.log(msg);}
  function start(db,user,source){
    DB=db;
    window.DCN_CURRENT_USER=user||null;
    if(window.DCN_STATE)window.DCN_STATE.persistCache(DB);
    if(window.DCN_SYNC)window.DCN_SYNC.init(DB);
    if(typeof normalizeWorkflowLinks==='function')normalizeWorkflowLinks();
    if(typeof initMonthSelector==='function')initMonthSelector();
    if(typeof refreshMonthUI==='function')refreshMonthUI();
    if(typeof renderAll==='function')renderAll();
    status(source==='sheets'?'● Google Sheets connecté':'⚠ Mode cache local');
  }
  try{
    status('● Connexion à Google Sheets…');
    const res=await window.DCN_API.loadBootstrap(p=>status('● Chargement Google Sheets '+p.done+'/'+p.total+' — '+p.name));
    if(!res||!res.tables)throw new Error('Chargement Google Sheets incomplet');
    const db=window.DCN_MAPPER.tablesToLegacy(res.tables);
    start(db,res.user,'sheets');
  }catch(err){
    console.error('Chargement Google Sheets',err);
    const cached=window.DCN_STATE&&window.DCN_STATE.getCache?window.DCN_STATE.getCache():null;
    if(cached){
      start(cached,null,'cache');
      if(typeof toast==='function')toast('Google Sheets indisponible — affichage du dernier cache local','err');
    }else{
      start(JSON.parse(JSON.stringify(window.DCN_EMPTY_DB)),null,'empty');
      if(typeof toast==='function')toast('Connexion Google Sheets requise : '+err.message,'err');
      status('● Google Sheets non connecté');
    }
  }
})();
