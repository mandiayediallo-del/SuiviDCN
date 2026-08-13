/* DCN V15.3 — accès unique au backend Apps Script / Google Sheets.
 * Chargement initial fractionné table par table pour éviter un gros bootstrap JSON.
 */
(function(){
  'use strict';
  const cfg=()=>window.DCN_RUNTIME_CONFIG||{};
  const TABLES=['UTILISATEURS','PROJETS','AO','DEVIS','MISSIONS','AFFECTATIONS','PREVISIONS','CHARGES','FACTURES','ETABLISSEMENTS','CALENDRIER','PARAMETRES','PREFERENCES_UTILISATEURS'];
  function url(){return String(cfg().API_URL||'').trim();}
  function timeoutMs(){return Number(cfg().REQUEST_TIMEOUT_MS)||30000;}
  async function request(target,options){
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),timeoutMs());
    try{
      const r=await fetch(target,{redirect:'follow',credentials:'include',cache:'no-store',signal:ctl.signal,...options});
      const text=await r.text();
      let data;
      try{data=JSON.parse(text);}catch(e){throw new Error('Réponse API non JSON ('+r.status+')');}
      if(!r.ok || data.ok===false) throw new Error(data.error||('HTTP '+r.status));
      return data;
    }catch(err){
      if(err&&err.name==='AbortError') throw new Error('Délai API dépassé');
      throw err;
    }finally{clearTimeout(timer);}
  }
  async function loadTable(name){
    if(!TABLES.includes(name))throw new Error('Table inconnue : '+name);
    const all=[];
    let offset=0;
    const limit=200;
    let safety=0;
    while(true){
      const target=url()+'?action=table&name='+encodeURIComponent(name)+'&offset='+offset+'&limit='+limit+'&_t='+Date.now();
      const res=await request(target,{method:'GET'});
      const rows=Array.isArray(res.rows)?res.rows:[];
      all.push(...rows);
      if(!res.hasMore) break;
      const next=Number(res.nextOffset);
      if(!Number.isFinite(next) || next<=offset) throw new Error('Pagination API invalide pour '+name);
      offset=next;
      if(++safety>100) throw new Error('Trop de pages API pour '+name);
    }
    return all;
  }
  async function mapLimit(items,limit,worker,onProgress){
    const results=new Array(items.length);let next=0,done=0;
    async function run(){
      while(true){
        const i=next++; if(i>=items.length)return;
        results[i]=await worker(items[i],i);
        done++; if(onProgress)onProgress({done,total:items.length,name:items[i]});
      }
    }
    await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
    return results;
  }
  const api={
    mode:'google-sheets',
    tables:TABLES.slice(),
    isConfigured(){return !!url();},
    async health(){
      if(!url()) return {ok:false,configured:false,error:'API_URL non configurée'};
      return request(url()+'?action=health&_t='+Date.now(),{method:'GET'});
    },
    async whoami(){
      if(!url()) throw new Error('Backend Google Sheets non configuré');
      return request(url()+'?action=whoami&_t='+Date.now(),{method:'GET'});
    },
    async loadBootstrap(onProgress){
      if(!url()) throw new Error('Backend Google Sheets non configuré');
      const meta=await request(url()+'?action=bootstrap-lite&_t='+Date.now(),{method:'GET'});
      const tables={};
      // Limite volontairement la concurrence : Apps Script reste un backend léger.
      const rows=await mapLimit(TABLES,3,async name=>({name,rows:await loadTable(name)}),onProgress);
      rows.forEach(x=>{tables[x.name]=x.rows;});
      return {ok:true,user:meta.user,tables,counts:meta.counts||{},time:new Date().toISOString()};
    },
    async loadTable(name){
      if(!url()) throw new Error('Backend Google Sheets non configuré');
      return loadTable(String(name||'').toUpperCase());
    },
    async syncBatch(operations){
      if(!operations||!operations.length)return {ok:true,applied:0};
      if(!url()) throw new Error('Backend Google Sheets non configuré');
      return request(url(),{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify({action:'syncBatch',operations})
      });
    }
  };
  window.DCN_API=api;
})();
