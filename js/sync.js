/* DCN V15 — moteur de synchronisation différentielle vers Google Sheets. */
(function(){
  'use strict';
  let baseline=null,timer=null,inFlight=false,pending=false,lastError=null;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  function status(text,type){
    const el=document.getElementById('lastActionIndicator');
    if(el){el.textContent=text;el.style.opacity='1';el.dataset.syncType=type||'';}
  }
  function init(db){baseline=clone(db);pending=false;lastError=null;if(window.DCN_STATE)window.DCN_STATE.persistCache(db);status('● Synchronisé','ok');}
  function schedule(db){
    pending=true;status('● Modification en attente','pending');
    clearTimeout(timer);timer=setTimeout(()=>flush(db),Number(window.DCN_RUNTIME_CONFIG?.SYNC_DEBOUNCE_MS)||650);
  }
  async function flush(db){
    clearTimeout(timer);timer=null;
    if(inFlight){pending=true;return {ok:false,busy:true};}
    if(!baseline){baseline=clone(db);return {ok:true,applied:0};}
    const operations=window.DCN_MAPPER.diff(baseline,db);
    if(!operations.length){pending=false;status('● Synchronisé','ok');if(window.DCN_STATE)window.DCN_STATE.persistCache(db);if(typeof markSaved==='function')markSaved();return {ok:true,applied:0};}
    inFlight=true;pending=false;status('● Synchronisation…','pending');
    try{
      const res=await window.DCN_API.syncBatch(operations);
      baseline=clone(db);lastError=null;if(window.DCN_STATE)window.DCN_STATE.persistCache(db);if(typeof markSaved==='function')markSaved();status('● Synchronisé','ok');
      return res;
    }catch(e){
      lastError=e;pending=true;status('● Non synchronisé','error');console.error('DCN sync',e);if(typeof toast==='function')toast('Synchronisation impossible : '+e.message,'err');throw e;
    }finally{
      inFlight=false;if(pending)timer=setTimeout(()=>flush(db),1200);
    }
  }

  function adoptField(db,field){
    if(!db||!field)return;
    if(!baseline)baseline=clone(db);
    else baseline[field]=clone(db[field]);
    if(window.DCN_STATE)window.DCN_STATE.persistCache(db);
  }
  function getState(){return {pending,inFlight,lastError:lastError?lastError.message:null};}
  window.DCN_SYNC={init,schedule,flush,getState,adoptField};
})();
