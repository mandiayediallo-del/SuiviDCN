/* DCN V16.3 — chargement intelligent des charges. */
(function(){
  'use strict';
  let chargeLoaded=false,chargePromise=null,loadedYear=null;

  function status(msg){
    if(typeof showLastAction==='function')showLastAction(msg);
    else{const el=document.getElementById('lastActionIndicator');if(el)el.textContent=msg;else console.log(msg);}
  }
  function activePage(){
    const p=document.querySelector('.page.active');return p&&p.id?p.id.replace(/^page-/,''):'projets';
  }
  function blankEntry(){return {projets:{},divers:0,formation:0,conges:0,absences:0};}
  function replaceCharges(source,year){
    year=Number(year)||Number(window.DB?.cfg?.annee)||new Date().getFullYear();
    const prefix=String(year)+'-';
    const next={};
    // Conserver d'éventuelles autres années.
    Object.keys(DB.charge||{}).forEach(mid=>{
      next[mid]={};
      Object.keys((DB.charge||{})[mid]||{}).forEach(period=>{
        if(!String(period).startsWith(prefix))next[mid][period]=(DB.charge||{})[mid][period];
      });
    });
    (DB.membres||[]).forEach(m=>{
      if(!next[m.id])next[m.id]={};
      for(let i=1;i<=12;i++)next[m.id][prefix+String(i).padStart(2,'0')]=blankEntry();
    });
    Object.keys(source||{}).forEach(mid=>{
      if(!next[mid])next[mid]={};
      Object.keys(source[mid]||{}).forEach(period=>{
        if(String(period).startsWith(prefix))next[mid][period]=source[mid][period];
      });
    });
    DB.charge=next;chargeLoaded=true;loadedYear=year;
    window.DCN_SYNC?.adoptField?.(DB,'charge');
    window.DCN_PERMISSIONS?.apply?.();
  }
  function invalidateCharges(){
    chargeLoaded=false;loadedYear=null;
  }
  async function ensureCharges(options){
    options=options||{};
    const year=Number(window.DB?.cfg?.annee)||new Date().getFullYear();
    if(chargeLoaded && loadedYear===year)return true;
    if(chargePromise)return chargePromise;
    chargePromise=(async()=>{
      try{
        if(!options.silent)status('● Chargement du plan de charge…');
        const res=await window.DCN_API.loadChargeYear(year);
        if(!res||!res.charge)throw new Error('Données de charge incomplètes');
        replaceCharges(res.charge,year);
        window.DCN_BISYNC?.adoptServerState?.(res.syncState,{onlyTables:['CHARGES']});
        const p=activePage();
        if(p==='charge'||p==='dashboard'){if(typeof renderPage==='function')renderPage(p);}
        if(typeof window.renderV12Cockpit==='function')setTimeout(window.renderV12Cockpit,0);
        status('● Synchronisé — données complètes');
        window.dispatchEvent(new CustomEvent('dcn-heavy-data-ready',{detail:{name:'CHARGES',year}}));
        return true;
      }catch(err){
        console.error('[DCN V16.3] chargement CHARGES',err);
        if(!options.silent){status('● Chargement du plan de charge impossible');if(typeof toast==='function')toast('Chargement du plan de charge impossible : '+err.message,'err');}
        throw err;
      }finally{chargePromise=null;}
    })();
    return chargePromise;
  }
  async function ensureForPage(id){
    id=String(id||'');if(id==='charge'||id==='dashboard')await ensureCharges({silent:false});return true;
  }
  const previousGoPage=window.goPage;
  if(typeof previousGoPage==='function'){
    window.goPage=function(id){
      const args=arguments;
      if((id==='charge'||id==='dashboard')&&(!chargeLoaded||loadedYear!==(Number(DB?.cfg?.annee)||new Date().getFullYear()))){
        status('● Chargement des données nécessaires…');
        ensureForPage(id).then(()=>previousGoPage.apply(window,args)).catch(()=>{});
        return;
      }
      return previousGoPage.apply(this,args);
    };
  }
  function prefetch(){
    const cb=()=>ensureCharges({silent:true}).catch(err=>console.warn('[DCN V16.3] préchargement différé',err));
    if('requestIdleCallback' in window)requestIdleCallback(cb,{timeout:2500});else setTimeout(cb,900);
  }
  window.addEventListener('dcn-core-ready',prefetch,{once:true});
  window.DCN_LAZY={
    ensureCharges,ensureForPage,replaceCharges,invalidateCharges,
    isChargeLoaded(){return chargeLoaded;},
    loadedYear(){return loadedYear;}
  };
})();
