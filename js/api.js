/* DCN V16.4 — API Google Sheets : chargement rapide + synchronisation bidirectionnelle. */
(function(){
  'use strict';
  const TABLES=[
    'UTILISATEURS','PROJETS','AO','DEVIS','MISSIONS','AFFECTATIONS','PREVISIONS','CHARGES',
    'FACTURES','ETABLISSEMENTS','PRESTATAIRES','CALENDRIER','PARAMETRES','PREFERENCES_UTILISATEURS'
  ];
  function bridge(){
    if(!window.DCN_BRIDGE)throw new Error('Pont Apps Script non initialisé');
    return window.DCN_BRIDGE;
  }
  async function loadTable(name){
    name=String(name||'').toUpperCase();
    if(!TABLES.includes(name))throw new Error('Table inconnue : '+name);
    const all=[];let offset=0;const limit=200;let safety=0;
    while(true){
      const res=await bridge().request('table',{name,offset,limit});
      const rows=Array.isArray(res&&res.rows)?res.rows:[];
      all.push(...rows);
      if(!res||!res.hasMore)break;
      const next=Number(res.nextOffset);
      if(!Number.isFinite(next)||next<=offset)throw new Error('Pagination API invalide pour '+name);
      offset=next;if(++safety>200)throw new Error('Trop de pages API pour '+name);
    }
    return all;
  }
  window.DCN_API={
    mode:'google-sheets-gis-bidirectional-v16.4',
    tables:TABLES.slice(),
    isConfigured(){return !!window.DCN_BRIDGE?.isConfigured();},
    health(){return bridge().request('health',{});},
    whoami(){return bridge().request('whoami',{});},
    loadFastBootstrap(){return bridge().request('bootstrap-fast',{});},
    loadChargeYear(year){return bridge().request('charges-year',{year:Number(year)||new Date().getFullYear()});},
    syncStatus(){return bridge().request('sync-status',{});},
    loadTables(names){
      const clean=[...new Set((names||[]).map(x=>String(x||'').toUpperCase()).filter(x=>TABLES.includes(x)&&x!=='CHARGES'))];
      if(!clean.length)return Promise.resolve({ok:true,tables:{},tableRevisions:{}});
      return bridge().request('tables-batch',{names:clean});
    },
    async loadBootstrap(onProgress){
      try{
        const fast=await this.loadFastBootstrap();
        if(onProgress)onProgress({done:1,total:1,name:'Données principales'});
        return fast;
      }catch(fastErr){
        console.warn('[DCN V16.4] bootstrap-fast indisponible, retour au chargement historique',fastErr);
        const meta=await bridge().request('bootstrap-lite',{});
        const tables={};let done=0;
        for(const name of TABLES){
          tables[name]=await loadTable(name);done++;
          if(onProgress)onProgress({done,total:TABLES.length,name});
        }
        return {ok:true,user:meta.user,tables,counts:meta.counts||{},syncState:meta.syncState||{},time:new Date().toISOString()};
      }
    },
    loadTable,
    syncBatch(operations){
      if(!operations||!operations.length)return Promise.resolve({ok:true,applied:0,changedTables:[]});
      return bridge().request('syncBatch',{operations});
    }
  };
})();
