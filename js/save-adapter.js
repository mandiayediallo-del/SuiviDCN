/* DCN V16.3 — le bouton historique de sauvegarde devient une synchronisation bidirectionnelle. */
(function(){
  'use strict';
  window.DCN_SAVE_DATA=async function(){
    if(window.DCN_BISYNC?.syncNow)return window.DCN_BISYNC.syncNow();
    try{
      const res=await window.DCN_SYNC.flush(DB);
      if(typeof toast==='function')toast('Google Sheets synchronisé','ok');
      return res;
    }catch(err){
      console.error(err);
      if(typeof toast==='function')toast('Erreur de synchronisation : '+err.message,'err');
      return {ok:false,error:err.message};
    }
  };
  window.synchronizeNow=window.DCN_SAVE_DATA;
  window.saveHtmlFile=window.DCN_SAVE_DATA;
})();
