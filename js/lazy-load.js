/* DCN V16.2 — chargement intelligent des données lourdes. */
(function(){
  'use strict';

  let chargeLoaded=false;
  let chargePromise=null;

  function status(msg){
    if(typeof showLastAction==='function')showLastAction(msg);
    else{
      const el=document.getElementById('lastActionIndicator');
      if(el)el.textContent=msg;
      else console.log(msg);
    }
  }

  function activePage(){
    const p=document.querySelector('.page.active');
    return p&&p.id?p.id.replace(/^page-/,''):'projets';
  }

  function mergeCharge(target,source){
    target=target||{};
    Object.keys(source||{}).forEach(mid=>{
      if(!target[mid])target[mid]={};
      Object.keys(source[mid]||{}).forEach(period=>{
        target[mid][period]=source[mid][period];
      });
    });
    return target;
  }

  async function ensureCharges(options){
    options=options||{};
    if(chargeLoaded)return true;
    if(chargePromise)return chargePromise;

    chargePromise=(async()=>{
      try{
        if(!options.silent)status('● Chargement du plan de charge…');
        const year=Number(window.DB?.cfg?.annee)||new Date().getFullYear();
        const res=await window.DCN_API.loadChargeYear(year);
        if(!res||!res.charge)throw new Error('Données de charge incomplètes');

        DB.charge=mergeCharge(DB.charge||{},res.charge);
        chargeLoaded=true;

        // Le chargement serveur n'est pas une modification utilisateur.
        window.DCN_SYNC?.adoptField?.(DB,'charge');

        const p=activePage();
        if(p==='charge' || p==='dashboard'){
          if(typeof renderPage==='function')renderPage(p);
        }
        if(typeof window.renderV12Cockpit==='function')setTimeout(window.renderV12Cockpit,0);

        status('● Synchronisé — données complètes');
        window.dispatchEvent(new CustomEvent('dcn-heavy-data-ready',{detail:{name:'CHARGES',year}}));
        return true;
      }catch(err){
        console.error('[DCN V16.2] chargement CHARGES',err);
        if(!options.silent){
          status('● Chargement du plan de charge impossible');
          if(typeof toast==='function')toast('Chargement du plan de charge impossible : '+err.message,'err');
        }
        throw err;
      }finally{
        chargePromise=null;
      }
    })();

    return chargePromise;
  }

  async function ensureForPage(id){
    id=String(id||'');
    if(id==='charge' || id==='dashboard')await ensureCharges({silent:false});
    return true;
  }

  // Interception finale : on ne rend pas une page dépendante des charges avant leur arrivée.
  const previousGoPage=window.goPage;
  if(typeof previousGoPage==='function'){
    window.goPage=function(id){
      const args=arguments;
      if((id==='charge'||id==='dashboard')&&!chargeLoaded){
        status('● Chargement des données nécessaires…');
        ensureForPage(id)
          .then(()=>previousGoPage.apply(window,args))
          .catch(()=>{});
        return;
      }
      return previousGoPage.apply(this,args);
    };
  }

  function prefetch(){
    const cb=()=>ensureCharges({silent:true}).catch(err=>console.warn('[DCN V16.2] préchargement différé',err));
    if('requestIdleCallback' in window)requestIdleCallback(cb,{timeout:2500});
    else setTimeout(cb,900);
  }

  window.addEventListener('dcn-core-ready',prefetch,{once:true});

  window.DCN_LAZY={
    ensureCharges,
    ensureForPage,
    isChargeLoaded(){return chargeLoaded;}
  };
})();
