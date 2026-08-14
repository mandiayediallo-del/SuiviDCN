/* DCN V16.4 — synchronisation Sheets -> App + polling léger. */
(function(){
  'use strict';

  const SERVER_FIELDS=[
    'cfg','membres','projets','pipelineAO','commercial','prestataires','factures','parametresMensuels',
    'previsionsFacturation','devis','devisDates','devisEmetteurs','lastChargeCpUpdate','devisNotes'
  ];
  let known={revision:0,tableRevisions:{}};
  let pulling=false,timer=null,started=false,lastSyncAt=null;

  const num=v=>Number(v)||0;
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function status(msg){if(typeof showLastAction==='function')showLastAction(msg);}
  function activePage(){const p=document.querySelector('.page.active');return p?.id?.replace(/^page-/,'')||'projets';}

  function normalizeState(s){
    return {
      revision:num(s?.revision),
      tableRevisions:{...(s?.tableRevisions||{})},
      lastChangeAt:s?.lastChangeAt||'',
      source:s?.source||''
    };
  }
  function init(syncState,user){
    if(user){
      window.DCN_CURRENT_USER=user;
      window.DCN_AUTH?.setServerUser?.(user);
    }
    known=normalizeState(syncState);
    lastSyncAt=new Date();
    window.DCN_PERMISSIONS?.apply?.();
  }
  function adoptServerState(syncState,opts){
    if(!syncState)return;
    const s=normalizeState(syncState),only=opts?.onlyTables||null;
    known.revision=Math.max(known.revision,s.revision);
    if(only){
      only.forEach(t=>{if(s.tableRevisions[t]!=null)known.tableRevisions[t]=num(s.tableRevisions[t]);});
    }else{
      Object.keys(s.tableRevisions).forEach(t=>known.tableRevisions[t]=num(s.tableRevisions[t]));
    }
  }
  function rowMatches(row,key){
    return Object.entries(key||{}).every(([k,v])=>String((row||{})[k]??'')===String(v??''));
  }
  function applyOperationsToTableCache(operations){
    window.DCN_TABLE_CACHE=window.DCN_TABLE_CACHE||{};
    (operations||[]).forEach(op=>{
      const table=String(op.table||'').toUpperCase();
      if(!table || table==='CHARGES')return; // CHARGES est géré par le modèle agrégé DB.charge.
      const rows=Array.isArray(window.DCN_TABLE_CACHE[table])?window.DCN_TABLE_CACHE[table]:[];
      if(op.op==='upsert'){
        const key=op.key||{},idx=rows.findIndex(r=>rowMatches(r,key));
        const row={...(idx>=0?rows[idx]:{}),...(op.row||{}),...key,deletedAt:''};
        if(idx>=0)rows[idx]=row;else rows.push(row);
      }else if(op.op==='softDelete'){
        const key=op.key||{};
        window.DCN_TABLE_CACHE[table]=rows.filter(r=>!rowMatches(r,key));
        return;
      }else if(op.op==='replaceGroup'){
        const where=op.where||{};
        const kept=rows.filter(r=>!rowMatches(r,where));
        const added=(op.rows||[]).map(r=>({...r,...where,deletedAt:''}));
        window.DCN_TABLE_CACHE[table]=kept.concat(added);
        return;
      }
      window.DCN_TABLE_CACHE[table]=rows;
    });
  }
  function markPushed(res,operations){
    if(!res)return;
    applyOperationsToTableCache(operations);
    const revs=res.changedTableRevisions||{};
    Object.keys(revs).forEach(t=>known.tableRevisions[t]=num(revs[t]));
    if(res.revision!=null)known.revision=Math.max(known.revision,num(res.revision));
    lastSyncAt=new Date();
  }
  function changedTables(serverState){
    const s=normalizeState(serverState),out=[];
    Object.keys(s.tableRevisions||{}).forEach(t=>{
      if(num(s.tableRevisions[t])>num(known.tableRevisions[t]))out.push(t);
    });
    return out;
  }
  function mergeServerDb(serverDb){
    const oldYear=Number(DB?.cfg?.annee);
    SERVER_FIELDS.forEach(f=>{if(Object.prototype.hasOwnProperty.call(serverDb,f))DB[f]=serverDb[f];});
    const newYear=Number(DB?.cfg?.annee);
    if(oldYear && newYear && oldYear!==newYear)window.DCN_LAZY?.invalidateCharges?.();
  }
  function renderCurrent(){
    const p=activePage();
    if(typeof renderPage==='function')renderPage(p);
    if(typeof updateServiceBadge==='function')updateServiceBadge();
    if(typeof renderV12Cockpit==='function')setTimeout(renderV12Cockpit,0);
    window.DCN_PERMISSIONS?.apply?.();
  }

  async function pull(options){
    options=options||{};
    if(pulling)return {ok:false,busy:true};
    const syncState=window.DCN_SYNC?.getState?.()||{};
    if(!options.userInitiated && (syncState.pending||syncState.inFlight))return {ok:true,skipped:'local-pending'};

    pulling=true;
    try{
      if(options.userInitiated)status('● Vérification Google Sheets…');
      const meta=await window.DCN_API.syncStatus();

      if(meta?.user){
        window.DCN_CURRENT_USER=meta.user;
        window.DCN_AUTH?.setServerUser?.(meta.user);
      }
      const serverState=meta?.syncState||{};
      let changed=changedTables(serverState);

      if(options.forceFull){
        changed=(window.DCN_API.tables||[]).filter(t=>t!=='CHARGES');
        if(window.DCN_LAZY?.isChargeLoaded?.())changed.push('CHARGES');
      }

      if(!changed.length){
        adoptServerState(serverState);
        lastSyncAt=new Date();
        window.DCN_PERMISSIONS?.apply?.();
        if(options.userInitiated){
          const t=lastSyncAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
          status('● Synchronisé à '+t);
          if(typeof toast==='function')toast('Données déjà à jour','ok');
        }
        return {ok:true,changed:[]};
      }

      const chargeChanged=changed.includes('CHARGES');
      const mainChanged=changed.filter(t=>t!=='CHARGES');
      const chargeWasLoaded=!!window.DCN_LAZY?.isChargeLoaded?.();

      if(mainChanged.length){
        const res=await window.DCN_API.loadTables(mainChanged);
        window.DCN_TABLE_CACHE=window.DCN_TABLE_CACHE||{};
        Object.keys(res.tables||{}).forEach(t=>window.DCN_TABLE_CACHE[t]=res.tables[t]);
        const serverDb=window.DCN_MAPPER.tablesToLegacy(window.DCN_TABLE_CACHE);
        mergeServerDb(serverDb);
        adoptServerState(res.syncState||serverState,{onlyTables:mainChanged});
      }

      if(chargeChanged){
        if(chargeWasLoaded || options.forceFull){
          const year=Number(DB?.cfg?.annee)||new Date().getFullYear();
          const res=await window.DCN_API.loadChargeYear(year);
          window.DCN_LAZY?.replaceCharges?.(res.charge||{},year);
          adoptServerState(res.syncState||serverState,{onlyTables:['CHARGES']});
        }else{
          // Pas encore chargée en mémoire : on mémorise la révision.
          // Le lazy loader récupérera la valeur actuelle au premier accès.
          adoptServerState(serverState,{onlyTables:['CHARGES']});
        }
      }

      // Les changements reçus deviennent la nouvelle référence : ils ne doivent pas repartir vers Sheets.
      window.DCN_SYNC?.resetBaseline?.(DB);
      renderCurrent();
      adoptServerState(serverState);
      lastSyncAt=new Date();

      const t=lastSyncAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      status('● Synchronisé à '+t);
      if(options.userInitiated && typeof toast==='function')toast('Synchronisation terminée','ok');
      window.dispatchEvent(new CustomEvent('dcn-server-changes-applied',{detail:{tables:changed}}));
      return {ok:true,changed};
    }catch(err){
      console.error('[DCN V16.4] synchronisation descendante',err);
      status('● Erreur de synchronisation');
      if(options.userInitiated && typeof toast==='function')toast('Synchronisation impossible : '+err.message,'err');
      throw err;
    }finally{pulling=false;}
  }

  async function syncNow(){
    const btn=document.getElementById('syncNowBtn');
    const old=btn?.innerHTML;
    if(btn){btn.disabled=true;btn.innerHTML='↻ Synchronisation…';}
    try{
      if(typeof DB==='undefined')throw new Error('Base de données non initialisée');
      await window.DCN_SYNC?.flush?.(DB);
      return await pull({userInitiated:true});
    }finally{
      if(btn){btn.disabled=false;btn.innerHTML=old||'↻ Synchroniser';}
      window.DCN_PERMISSIONS?.apply?.();
    }
  }

  function scheduleNext(){
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      if(document.visibilityState!=='hidden'){
        try{await pull({userInitiated:false});}catch(e){}
      }
      scheduleNext();
    },Number(window.DCN_RUNTIME_CONFIG?.SYNC_POLL_MS)||25000);
  }
  function start(){
    if(started)return;started=true;scheduleNext();
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')pull({userInitiated:false}).catch(()=>{});
    });
  }

  window.addEventListener('dcn-core-ready',start,{once:true});
  window.DCN_BISYNC={init,start,pull,syncNow,markPushed,adoptServerState,getKnownState:()=>clone(known)};
  window.synchronizeNow=syncNow;
})();
