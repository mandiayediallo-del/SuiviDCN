/* DCN V15 — le bouton de sauvegarde force maintenant la synchronisation Sheets. */
(function(){
  'use strict';
  window.DCN_SAVE_DATA=async function(){
    try{
      if(typeof activateUnloadGuard==='function')activateUnloadGuard();
      if(typeof DB==='undefined')throw new Error('Base de données non initialisée');
      if(!window.DCN_API?.isConfigured())throw new Error('URL Apps Script non configurée');
      const res=await window.DCN_SYNC.flush(DB);
      if(typeof toast==='function')toast('Google Sheets synchronisé','ok');
      if(typeof showLastAction==='function')showLastAction('● Synchronisé avec Google Sheets');
      return res;
    }catch(err){
      console.error(err);
      if(typeof toast==='function')toast('Erreur de synchronisation : '+err.message,'err');
      return {ok:false,error:err.message};
    }
  };
  window.saveHtmlFile=window.DCN_SAVE_DATA;
})();
