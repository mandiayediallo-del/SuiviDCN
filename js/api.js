/* DCN V15.4 — accès unique au backend Apps Script / Google Sheets.
 * Transport iframe/formulaire invisible : aucun fetch cross-origin.
 */
(function(){
  'use strict';
  const TABLES=['UTILISATEURS','PROJETS','AO','DEVIS','MISSIONS','AFFECTATIONS','PREVISIONS','CHARGES','FACTURES','ETABLISSEMENTS','CALENDRIER','PARAMETRES','PREFERENCES_UTILISATEURS'];
  function bridge(){
    if(!window.DCN_BRIDGE)throw new Error('Pont Apps Script non initialisé');
    return window.DCN_BRIDGE;
  }
  async function loadTable(name){
    name=String(name||'').toUpperCase();
    if(!TABLES.includes(name))throw new Error('Table inconnue : '+name);
    const all=[];let offset=0;const limit=100;let safety=0;
    while(true){
      const res=await bridge().request('table',{name,offset,limit});
      const rows=Array.isArray(res&&res.rows)?res.rows:[];
      all.push(...rows);
      if(!res || !res.hasMore)break;
      const next=Number(res.nextOffset);
      if(!Number.isFinite(next)||next<=offset)throw new Error('Pagination API invalide pour '+name);
      offset=next;
      if(++safety>200)throw new Error('Trop de pages API pour '+name);
    }
    return all;
  }
  async function mapLimit(items,limit,worker,onProgress){
    const results=new Array(items.length);let next=0,done=0;
    async function run(){
      while(true){
        const i=next++;if(i>=items.length)return;
        results[i]=await worker(items[i],i);
        done++;if(onProgress)onProgress({done,total:items.length,name:items[i]});
      }
    }
    await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
    return results;
  }
  const api={
    mode:'google-sheets-bridge',
    tables:TABLES.slice(),
    isConfigured(){return !!window.DCN_BRIDGE?.isConfigured();},
    async health(){return bridge().request('health',{});},
    async whoami(){return bridge().request('whoami',{});},
    async loadBootstrap(onProgress){
      const meta=await bridge().request('bootstrap-lite',{});
      const tables={};
      const rows=await mapLimit(TABLES,2,async name=>({name,rows:await loadTable(name)}),onProgress);
      rows.forEach(x=>{tables[x.name]=x.rows;});
      return {ok:true,user:meta.user,tables,counts:meta.counts||{},time:new Date().toISOString()};
    },
    async loadTable(name){return loadTable(name);},
    async syncBatch(operations){
      if(!operations||!operations.length)return {ok:true,applied:0};
      return bridge().request('syncBatch',{operations});
    }
  };
  window.DCN_API=api;
})();
