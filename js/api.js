/* DCN V16.2 — API Google Sheets à démarrage rapide.
 * Démarrage : 1 seule requête bootstrap-fast.
 * CHARGES : chargées séparément sous forme agrégée, sans 866 lignes JSON détaillées.
 */
(function(){
  'use strict';

  const TABLES=[
    'UTILISATEURS','PROJETS','AO','DEVIS','MISSIONS','AFFECTATIONS','PREVISIONS','CHARGES',
    'FACTURES','ETABLISSEMENTS','CALENDRIER','PARAMETRES','PREFERENCES_UTILISATEURS'
  ];

  function bridge(){
    if(!window.DCN_BRIDGE)throw new Error('Pont Apps Script non initialisé');
    return window.DCN_BRIDGE;
  }

  // Conservé comme secours / diagnostic.
  async function loadTable(name){
    name=String(name||'').toUpperCase();
    if(!TABLES.includes(name))throw new Error('Table inconnue : '+name);
    const all=[];
    let offset=0;
    const limit=200;
    let safety=0;
    while(true){
      const res=await bridge().request('table',{name,offset,limit});
      const rows=Array.isArray(res&&res.rows)?res.rows:[];
      all.push(...rows);
      if(!res||!res.hasMore)break;
      const next=Number(res.nextOffset);
      if(!Number.isFinite(next)||next<=offset)throw new Error('Pagination API invalide pour '+name);
      offset=next;
      if(++safety>200)throw new Error('Trop de pages API pour '+name);
    }
    return all;
  }

  const api={
    mode:'google-sheets-gis-fast-bootstrap',
    tables:TABLES.slice(),

    isConfigured(){
      return !!window.DCN_BRIDGE?.isConfigured();
    },

    async health(){
      return bridge().request('health',{});
    },

    async whoami(){
      return bridge().request('whoami',{});
    },

    async loadFastBootstrap(){
      return bridge().request('bootstrap-fast',{});
    },

    async loadChargeYear(year){
      const y=Number(year)||new Date().getFullYear();
      return bridge().request('charges-year',{year:y});
    },

    // Ancienne méthode gardée pour compatibilité technique.
    async loadBootstrap(onProgress){
      try{
        const fast=await api.loadFastBootstrap();
        if(onProgress)onProgress({done:1,total:1,name:'Données principales'});
        return fast;
      }catch(fastErr){
        console.warn('[DCN V16.2] bootstrap-fast indisponible, retour au chargement historique',fastErr);
        const meta=await bridge().request('bootstrap-lite',{});
        const tables={};
        let done=0;
        for(const name of TABLES){
          tables[name]=await loadTable(name);
          done++;
          if(onProgress)onProgress({done,total:TABLES.length,name});
        }
        return {ok:true,user:meta.user,tables,counts:meta.counts||{},time:new Date().toISOString()};
      }
    },

    async loadTable(name){
      return loadTable(name);
    },

    async syncBatch(operations){
      if(!operations||!operations.length)return {ok:true,applied:0};
      return bridge().request('syncBatch',{operations});
    }
  };

  window.DCN_API=api;
})();
