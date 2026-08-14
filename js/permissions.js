/* DCN V16.3 — droits fonctionnels Manager / Collaborateur.
 * Manager : lecture + écriture partout.
 * Collaborateur : lecture partout, écriture uniquement sur sa propre charge.
 * Le serveur Apps Script applique la même règle : ceci n'est qu'une protection UX supplémentaire.
 */
(function(){
  'use strict';

  const MUTATION_HANDLER = /(save|delete|remove|add|edit|reset|update|create|convert|archive|rebascul|open(?:Project|AO|Devis|Facture|Commercial).*Modal|toggle.*(?:active|charge)|importJSON)/i;

  function user(){ return window.DCN_CURRENT_USER || {}; }
  function level(){
    const u=user();
    const raw=String(u.accessLevel || u.niveauAcces || (u.isManager?'Manager':'') || (u.isAdmin?'Manager':'')).trim().toUpperCase();
    return (raw==='MANAGER'||raw==='ADMIN')?'Manager':'Collaborateur';
  }
  function isManager(){ return level()==='Manager'; }
  function memberId(){ return String(user().memberId||''); }
  function canEditCharge(mid){ return isManager() || (!!memberId() && String(mid||'')===memberId()); }

  function deny(message){
    if(typeof toast==='function')toast(message||'Cette action est réservée aux Managers.','err');
  }

  function lock(el,reason){
    if(!el || el.dataset.dcnPermissionLocked==='1')return;
    el.dataset.dcnPermissionLocked='1';
    el.classList.add('dcn-permission-locked');
    if('disabled' in el)el.disabled=true;
    el.setAttribute('aria-disabled','true');
    if(reason)el.title=reason;
  }
  function unlock(el){
    if(!el)return;
    if(el.dataset.dcnPermissionLocked==='1'){
      delete el.dataset.dcnPermissionLocked;
      el.classList.remove('dcn-permission-locked');
      if('disabled' in el)el.disabled=false;
      if(el.title==='Lecture seule pour les collaborateurs.' || el.title==='Vous ne pouvez modifier que votre propre charge.')el.removeAttribute('title');
      el.removeAttribute('aria-disabled');
    }
  }

  function handlerOf(el){
    return [el.getAttribute('onclick'),el.getAttribute('onchange'),el.getAttribute('oninput'),el.getAttribute('onsubmit')].filter(Boolean).join(' ');
  }

  function apply(){
    if(!window.DCN_CURRENT_USER)return;
    const manager=isManager();

    // Import JSON modifie la base : Manager uniquement. Les exports restent accessibles.
    const importInput=document.getElementById('jsonImportInput');
    const importBtn=importInput ? document.querySelector('[onclick*="jsonImportInput"]') : null;
    [importInput,importBtn].forEach(el=> manager ? unlock(el) : lock(el,'Lecture seule pour les collaborateurs.'));

    // Configuration : entièrement en lecture seule pour un collaborateur.
    document.querySelectorAll('#page-config input,#page-config select,#page-config textarea,#page-config button').forEach(el=>{
      if(manager)unlock(el); else lock(el,'Lecture seule pour les collaborateurs.');
    });

    // Plan de charge : le collaborateur ne peut saisir que sur sa ligne.
    document.querySelectorAll('#page-charge [data-mid]').forEach(el=>{
      if(canEditCharge(el.dataset.mid))unlock(el); else lock(el,'Vous ne pouvez modifier que votre propre charge.');
    });
    document.querySelectorAll('#page-charge input,#page-charge select,#page-charge textarea,#page-charge button').forEach(el=>{
      const h=handlerOf(el);
      if(!manager && /updateMonthParam/i.test(h))lock(el,'Lecture seule pour les collaborateurs.');
    });

    // Autres modules : on conserve filtres, navigation, exports et consultation.
    document.querySelectorAll('.page:not(#page-charge):not(#page-config) button,.page:not(#page-charge):not(#page-config) input,.page:not(#page-charge):not(#page-config) select,.page:not(#page-charge):not(#page-config) textarea').forEach(el=>{
      const h=handlerOf(el);
      if(manager){ unlock(el); return; }
      if(MUTATION_HANDLER.test(h))lock(el,'Lecture seule pour les collaborateurs.');
    });

    // Modales d'édition : si elles existent, verrouillage des commandes de mutation.
    document.querySelectorAll('.ov button,.ov input,.ov select,.ov textarea').forEach(el=>{
      if(manager){ unlock(el); return; }
      const h=handlerOf(el);
      if(MUTATION_HANDLER.test(h) && !/closeM|closeProjectSheet|printProjectSheet|downloadProjectSheet/i.test(h)){
        lock(el,'Lecture seule pour les collaborateurs.');
      }
    });
  }

  function validateOperations(ops){
    if(isManager())return {ok:true};
    const mid=memberId();
    for(const op of (ops||[])){
      const table=String(op.table||'').toUpperCase();
      if(table!=='CHARGES')return {ok:false,message:'Un collaborateur ne peut modifier que son Plan de charge.'};
      const mids=[];
      if(op.where&&op.where.membreId)mids.push(String(op.where.membreId));
      if(op.key&&op.key.membreId)mids.push(String(op.key.membreId));
      if(op.row&&op.row.membreId)mids.push(String(op.row.membreId));
      (op.rows||[]).forEach(r=>{if(r&&r.membreId)mids.push(String(r.membreId));});
      if(!mids.length || mids.some(x=>x!==mid))return {ok:false,message:'Vous ne pouvez modifier que votre propre charge.'};
    }
    return {ok:true};
  }

  // Protection événementielle en plus des contrôles désactivés.
  document.addEventListener('click',function(e){
    const locked=e.target&&e.target.closest?e.target.closest('.dcn-permission-locked'):null;
    if(!locked)return;
    e.preventDefault();e.stopImmediatePropagation();
    deny(locked.title||'Action non autorisée.');
  },true);

  // Réappliquer après chaque rendu dynamique.
  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(apply,25);});
  if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});

  ['renderPage','renderAll','renderChargePage','renderConfigPage'].forEach(name=>{
    const prev=window[name];
    if(typeof prev!=='function')return;
    window[name]=function(){
      const r=prev.apply(this,arguments);
      setTimeout(apply,0);
      return r;
    };
  });

  window.DCN_PERMISSIONS={user,level,isManager,memberId,canEditCharge,apply,validateOperations,deny};
})();
