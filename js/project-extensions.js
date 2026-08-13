/* ═══════════════════════════════════════════════════════════════════
   DCN SUIVI — Extension consolidée
   Alertes | Multi-acteurs | Divers CSS
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── Styles projet consolidés dans #dcn-project-extension-style ── */

/* ── Moteur alertes ──────────────────────────────────────────────── */
window.dcnGetAlertes=function(item,type){
  if(!item) return [];
  var res=[];
  try{
    var total=(item.missions||[]).reduce(function(s,x){return s+(Number(x.montant)||0);},0);
    if(type==='projet'){
      if(!total) res.push({niveau:'orange',msg:'Montant de mission absent ou nul',auto:true});
      if(item.statut==='En cours'&&!(Number(item.caAnneeEnCours)||0))
        res.push({niveau:'rouge',msg:'Projet en cours sans CA 2026',auto:true});
      if(item.devis&&typeof DB!=='undefined'&&
         DB.projets.filter(function(p){return p.devis&&p.devis===item.devis&&p.id!==item.id;}).length>0)
        res.push({niveau:'rouge',msg:'N\xb0 devis en doublon\u00a0: '+item.devis,auto:true});
      if((item.notes||'').indexOf('\u26a0')>=0)
        res.push({niveau:'orange',msg:'Note contenant un point d\u2019attention',auto:true});
      if(item.inclurePrevision===false&&item.statut==='En cours')
        res.push({niveau:'orange',msg:'Exclu manuellement des pr\u00e9visions',auto:true});
      if(Number(item.avancement)>=100&&['Solde','Termine'].indexOf(item.statut)<0)
        res.push({niveau:'bleu',msg:'Avancement 100\u202f%\u00a0\u2014 penser \u00e0 solder',auto:true});
      var caSum=(Number(item.caAnneesPrecedentes)||0)+(Number(item.caAnneeEnCours)||0)+(Number(item.caAnneesSuivantes)||0);
      if(total>0&&Math.abs(caSum-total)>1)
        res.push({niveau:'orange',msg:'R\u00e9partition CA incoh\u00e9rente',auto:true});
    }else{
      if(!total) res.push({niveau:'orange',msg:'Montant AO absent',auto:true});
      if((item.notes||'').indexOf('\u26a0')>=0)
        res.push({niveau:'orange',msg:'Note contenant un point d\u2019attention',auto:true});
      if(['Offre d\u00e9pos\u00e9e','N\u00e9gociation'].indexOf(item.phase)>=0&&!item.actionAFaire)
        res.push({niveau:'rouge',msg:'AO avanc\u00e9e sans action d\u00e9finie',auto:true});
    }
    (item.alertes||[]).filter(function(a){return a&&a.type==='manuel';}).forEach(function(a){
      res.push({niveau:a.niveau||'orange',msg:a.msg||'',auto:false,id:a.id});
    });
  }catch(e){}
  return res;
};

window.dcnAlerteBadge=function(item,type){
  try{
    var list=dcnGetAlertes(item,type||'projet');
    if(!list.length) return '<span style="color:var(--gray-dk);font-size:11px;" title="Aucune alerte">\u2713</span>';
    var hasR=list.some(function(a){return a.niveau==='rouge';});
    var hasO=!hasR&&list.some(function(a){return a.niveau==='orange';});
    var icon=hasR?'\u26d4':hasO?'\u26a0\ufe0f':'\u2139\ufe0f';
    var col=hasR?'var(--red)':hasO?'var(--orange)':'var(--blue)';
    var tip=list.map(function(a){return a.msg;}).join('\n');
    return '<span style="cursor:pointer;font-size:13px;" title="'+tip.replace(/"/g,'&quot;')+'"'
      +' onclick="event.stopPropagation();dcnOpenAlertes(\''+item.id+'\',\''+(type||'projet')+'\')">'
      +icon+'<sup style="color:'+col+';font-size:9px;font-weight:700;margin-left:1px;">'+list.length+'</sup></span>';
  }catch(e){return '';}
};

window.dcnFicheAlertes=function(item){
  try{
    var type=item._sheetType||'projet';
    var list=dcnGetAlertes(item,type);
    if(!list.length) return '<div style="color:var(--green);font-size:11px;padding:4px 0;">\u2713 Aucun point bloquant d\u00e9tect\u00e9.</div>';
    return list.map(function(a){
      var col=a.niveau==='rouge'?'var(--red)':a.niveau==='orange'?'var(--orange)':'var(--blue)';
      var icon=a.niveau==='rouge'?'\u26d4':a.niveau==='orange'?'\u26a0\ufe0f':'\u2139\ufe0f';
      var tag=a.auto
        ?'<span style="font-size:9px;background:#E8F8EF;color:#1A7A42;padding:1px 5px;border-radius:8px;margin-left:4px;">Auto</span>'
        :'<span style="font-size:9px;background:#EDE9FE;color:#5B21B6;padding:1px 5px;border-radius:8px;margin-left:4px;">Manuel</span>';
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:#FAFBFC;border-left:3px solid '
        +col+';border-radius:3px;margin-bottom:4px;font-size:11px;line-height:1.4;">'
        +icon+' <span style="flex:1;">'+a.msg+tag+'</span>'
        +(!a.auto&&a.id?'<button onclick="dcnDeleteAlerte(\''+a.id+'\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:15px;line-height:1;" title="Supprimer">\u00d7</button>':'')
        +'</div>';
    }).join('');
  }catch(e){return '';}
};

/* ── Modal alertes ───────────────────────────────────────────────── */
(function injectModal(){
  if(document.getElementById('dcnAlertModal')) return;
  var d=document.createElement('div');
  d.className='ov';d.id='dcnAlertModal';d.style.zIndex='10001';
  d.innerHTML=(
    '<div class="modal" style="max-width:560px;">'
    +'<div class="mh"><span class="mt" id="dcnAlertTitle">Alertes</span>'
    +'<button class="mx" onclick="closeM(\'dcnAlertModal\')">\xd7</button></div>'
    +'<div class="mb" style="padding:14px 18px;">'
    +'<div id="dcnAlertBody" style="margin-bottom:14px;max-height:300px;overflow-y:auto;"></div>'
    +'<div style="background:#F4F6F8;border-radius:6px;padding:10px;border:1px solid var(--border);">'
    +'<div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:7px;">Ajouter une alerte manuelle</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;">'
    +'<select class="fs" id="dcnAlertNiveau" style="width:130px;">'
    +'<option value="rouge">\uD83D\uDD34 Bloquant</option>'
    +'<option value="orange" selected>\uD83D\uDFE0 Attention</option>'
    +'<option value="bleu">\uD83D\uDD35 Info</option>'
    +'</select>'
    +'<input class="fi" id="dcnAlertMsg" placeholder="D\xe9crire l\'alerte\u2026" style="flex:1;min-width:160px;">'
    +'<button class="btn btn-primary btn-sm" onclick="dcnAddManualAlerte()">Ajouter</button>'
    +'</div></div>'
    +'<input type="hidden" id="dcnAlertItemId">'
    +'<input type="hidden" id="dcnAlertItemType">'
    +'</div></div>'
  );
  document.body.appendChild(d);
  d.addEventListener('click',function(e){if(e.target===d) e.preventDefault();});
})();

window.dcnOpenAlertes=function(id,type){
  try{
    var item=(type==='ao')?(DB.pipelineAO||[]).find(function(a){return a.id===id;})
                          :(DB.projets||[]).find(function(p){return p.id===id;});
    if(!item) return;
    document.getElementById('dcnAlertTitle').textContent=item.nom||item.code||'Alertes';
    document.getElementById('dcnAlertItemId').value=id;
    document.getElementById('dcnAlertItemType').value=type;
    dcnRenderAlertBody(item,type);
    document.getElementById('dcnAlertModal').classList.add('open');
  }catch(e){console.error(e);}
};

function dcnRenderAlertBody(item,type){
  var list=dcnGetAlertes(item,type);
  document.getElementById('dcnAlertBody').innerHTML=list.length
    ?list.map(function(a){
      var col=a.niveau==='rouge'?'#FDEAEA;border-left:3px solid var(--red)':a.niveau==='orange'?'#FEF4E5;border-left:3px solid var(--orange)':'#EBF4FF;border-left:3px solid var(--blue)';
      var icon=a.niveau==='rouge'?'\u26d4':a.niveau==='orange'?'\u26a0\ufe0f':'\u2139\ufe0f';
      var tag=a.auto?'<span style="font-size:9px;background:#E8F8EF;color:#1A7A42;padding:1px 5px;border-radius:8px;margin-left:5px;">Auto</span>':'<span style="font-size:9px;background:#EDE9FE;color:#5B21B6;padding:1px 5px;border-radius:8px;margin-left:5px;">Manuel</span>';
      var del=!a.auto&&a.id?'<button onclick="dcnDeleteAlerte(\''+a.id+'\')" style="margin-left:auto;background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;line-height:1;">\u00d7</button>':'';
      return '<div style="display:flex;align-items:center;gap:8px;background:'+col+';padding:7px 10px;border-radius:4px;margin-bottom:5px;">'
        +'<span style="font-size:14px;flex-shrink:0;">'+icon+'</span>'
        +'<div style="flex:1;font-size:12px;line-height:1.4;">'+a.msg+tag+'</div>'+del+'</div>';
    }).join('')
    :'<div style="color:var(--gray-dk);font-size:12px;text-align:center;padding:16px;">\u2713 Aucune alerte active</div>';
}

window.dcnAddManualAlerte=function(){
  try{
    var id=document.getElementById('dcnAlertItemId').value;
    var type=document.getElementById('dcnAlertItemType').value;
    var msg=(document.getElementById('dcnAlertMsg').value||'').trim();
    var niv=document.getElementById('dcnAlertNiveau').value;
    if(!msg){if(typeof toast==='function')toast('Message obligatoire','err');return;}
    var item=(type==='ao')?(DB.pipelineAO||[]).find(function(a){return a.id===id;})
                          :(DB.projets||[]).find(function(p){return p.id===id;});
    if(!item) return;
    if(!item.alertes) item.alertes=[];
    item.alertes.push({id:'m_'+Date.now(),type:'manuel',niveau:niv,msg:msg,date:new Date().toISOString()});
    if(typeof stampHistory==='function') stampHistory(item,'Alerte ajout\u00e9e');
    if(typeof saveDB==='function') saveDB();
    document.getElementById('dcnAlertMsg').value='';
    dcnRenderAlertBody(item,type);
    if(typeof renderProjectsPage==='function') renderProjectsPage();
    if(typeof renderPrevisionsPage==='function') renderPrevisionsPage();
  }catch(e){console.error(e);}
};

window.dcnDeleteAlerte=function(alerteId){
  try{
    var id=document.getElementById('dcnAlertItemId').value;
    var type=document.getElementById('dcnAlertItemType').value;
    var item=(type==='ao')?(DB.pipelineAO||[]).find(function(a){return a.id===id;})
                          :(DB.projets||[]).find(function(p){return p.id===id;});
    if(!item) return;
    item.alertes=(item.alertes||[]).filter(function(a){return a.id!==alerteId;});
    if(typeof stampHistory==='function') stampHistory(item,'Alerte supprim\u00e9e');
    if(typeof saveDB==='function') saveDB();
    dcnRenderAlertBody(item,type);
    if(typeof renderProjectsPage==='function') renderProjectsPage();
    if(typeof renderPrevisionsPage==='function') renderPrevisionsPage();
  }catch(e){console.error(e);}
};

/* ── Multi-acteurs ───────────────────────────────────────────────── */
var _dcnActeurs=[];
/* Exposition contrôlée : le buffer acteurs reste utilisé en interne,
   mais devient visible par les fonctions globales et les scripts natifs. */
try{
  Object.defineProperty(window,'_dcnActeurs',{
    configurable:true,
    get:function(){return _dcnActeurs;},
    set:function(v){_dcnActeurs=Array.isArray(v)?v:[];}
  });
}catch(e){
  window._dcnActeurs=_dcnActeurs;
}

window.dcnActeursBadge=function(item){
  try{
    var acts=item.acteurs&&item.acteurs.length?item.acteurs:null;
    if(!acts||acts.length<2) return '';
    return '<span class="dcn-actor-tag">+' +(acts.length-1)+ '</span>';
  }catch(e){return '';}
};

window.dcnFicheActeurs=function(item){
  try{
    if(!item.acteurs||!item.acteurs.length)
      return '<span>'+(item.responsable||'\u2014')+'</span>';
    return item.acteurs.map(function(a){
      var m=(DB.membres||[]).find(function(x){return x.id===a.membreId;})||{};
      var nom=a.nom||m.nom||'?';
      var tag=a.principal?'<span style="font-size:9px;background:#EBF4FF;color:#1A4E8A;padding:1px 5px;border-radius:8px;margin-left:4px;">\u2605 Principal</span>':'';
      return '<span style="display:inline-block;margin:1px 3px;padding:2px 8px;background:#F4F6F8;border-radius:10px;font-size:11px;">'
        +'<b>'+nom+'</b><span style="color:var(--gray-dk);">\u00a0'+a.role+'</span>'+tag+'</span>';
    }).join('');
  }catch(e){return item.responsable||'\u2014';}
};

function dcnFillMemberSelect(){
  var sel=document.getElementById('dcnActeurMembre');
  if(!sel) return;
  var mbs=(DB.membres||[]).filter(function(m){return m.statut==='Actif';});
  sel.innerHTML=mbs.map(function(m){
    return '<option value="'+m.id+'">'+m.nom+' \u2014 '+(m.role||'')+' </option>';
  }).join('');
}

function dcnRenderActeursList(){
  var el=document.getElementById('dcnActeursList');
  if(!el) return;
  if(!_dcnActeurs.length){
    el.innerHTML='<div style="font-size:11px;color:var(--gray-dk);font-style:italic;padding:4px 0;">Aucun acteur ajout\u00e9 \u2014 le responsable principal sera celui s\u00e9lectionn\u00e9 ci-dessus.</div>';
    return;
  }
  el.innerHTML=_dcnActeurs.map(function(a,i){
    var m=(DB.membres||[]).find(function(x){return x.id===a.membreId;})||{};
    var nom=a.nom||m.nom||'?';
    var tag=a.principal?'<span class="dcn-actor-tag">\u2605 Principal</span>':'';
    return '<div class="dar">'
      +'<span class="dn">'+nom+tag+'</span>'
      +'<span class="dr">'+a.role+'</span>'
      +'<button onclick="dcnRemoveActeur('+i+')" title="Retirer">\u00d7</button>'
      +'</div>';
  }).join('');
}

window.dcnAddActeur=function(){
  try{
    var membreId=(document.getElementById('dcnActeurMembre')||{}).value;
    var role=(document.getElementById('dcnActeurRole')||{}).value||'Contributeur';
    if(!membreId){if(typeof toast==='function')toast('Choisir un membre','err');return;}
    if(_dcnActeurs.some(function(a){return a.membreId===membreId;})){
      if(typeof toast==='function')toast('D\u00e9j\u00e0 ajout\u00e9','err');return;
    }
    var m=(DB.membres||[]).find(function(x){return x.id===membreId;})||{};
    _dcnActeurs.push({membreId:membreId,nom:m.nom||'',role:role,principal:_dcnActeurs.length===0});
    dcnRenderActeursList();
  }catch(e){console.error(e);}
};

window.dcnRemoveActeur=function(idx){
  _dcnActeurs.splice(idx,1);
  if(_dcnActeurs.length&&!_dcnActeurs.some(function(a){return a.principal;}))
    _dcnActeurs[0].principal=true;
  dcnRenderActeursList();
};

/* Patch openProjectModal */
var _origOpen=window.openProjectModal;
window.openProjectModal=function(){
  _dcnActeurs=[];
  _origOpen&&_origOpen.apply(this,arguments);
  setTimeout(function(){dcnFillMemberSelect();dcnRenderActeursList();},80);
};

/* Patch editProject — charger acteurs existants */
var _origEdit=window.editProject;
window.editProject=function(id){
  _origEdit&&_origEdit.apply(this,arguments);
  var p=(DB.projets||[]).find(function(x){return x.id===id;});
  _dcnActeurs=(p&&p.acteurs&&p.acteurs.length)?JSON.parse(JSON.stringify(p.acteurs)):[];
  setTimeout(function(){dcnFillMemberSelect();dcnRenderActeursList();},120);
};

/* ── Synchronise _dcnActeurs → DB juste AVANT le save natif ──────── */
/* On ne monkey-patche PAS saveProject : on accroche le bouton Enregistrer
   pour mettre à jour la propriété acteurs sur le projet en cours AVANT
   que saveProject() soit appelé, via un attribut onclick supplémentaire. */
document.addEventListener('click',function(e){
  var btn=e.target;
  // Détecter le clic sur le bouton Enregistrer de la modale projet
  if(btn&&btn.textContent==='Enregistrer'&&btn.closest('#mProject')){
    // Récupérer l'id en cours d'édition
    var eid=(typeof editProjectId!=='undefined')?editProjectId:null;
    // Stocker le buffer acteurs dans le projet AVANT le save natif
    // (le save natif est appelé via onclick après nous, ordre DOM)
    // On utilise un flag temporaire sur window
    window._dcnPendingActeurs={id:eid,acteurs:JSON.parse(JSON.stringify(_dcnActeurs))};
  }
},true); // capture phase → avant l'onclick inline

/* Patch saveProject pour consommer _dcnPendingActeurs */
var _origSaveProj=window.saveProject;
window.saveProject=function(){
  var pending=window._dcnPendingActeurs||null;
  window._dcnPendingActeurs=null;
  _origSaveProj&&_origSaveProj.apply(this,arguments);
  // Après le save natif, appliquer les acteurs
  if(pending&&pending.acteurs&&pending.acteurs.length){
    var targetId=pending.id||((DB.projets||[]).slice(-1)[0]||{}).id;
    if(targetId){
      var p=(DB.projets||[]).find(function(x){return x.id===targetId;});
      if(p){
        p.acteurs=pending.acteurs;
        var princ=pending.acteurs.find(function(a){return a.principal;})||pending.acteurs[0];
        var m=(DB.membres||[]).find(function(x){return x.id===princ.membreId;})||{};
        if(m.nom) p.responsable=m.nom;
        if(typeof saveDB==='function') saveDB();
        if(typeof renderAll==='function') renderAll();
      }
    }
  }
};


/* ── Refonte visuelle de la modale projet ───────────────────────── */
function dcnUpdateProjectEditHero(){
  try{
    var title=document.getElementById('projectEditHeroTitle');
    var sub=document.getElementById('projectEditHeroSub');
    var name=(document.getElementById('prName')||{}).value||'';
    var code=(document.getElementById('prCode')||{}).value||'';
    var status=(document.getElementById('prStatus')||{}).value||'';
    var client=(document.getElementById('prClient')||{}).value||'';
    if(title) title.textContent=(name.trim()||'Nouveau projet');
    if(sub) sub.textContent=[code,status,client].filter(Boolean).join(' · ')||'Compléter les informations du projet';
  }catch(e){}
}

function dcnEnhanceProjectModalUI(){
  try{
    var modal=document.querySelector('#mProject .modal');
    var body=document.querySelector('#mProject .mb');
    var grid=document.querySelector('#mProject .fg');
    if(!modal||!body||!grid) return;
    modal.classList.add('project-edit-modal');
    if(!document.getElementById('projectEditHero')){
      var hero=document.createElement('div');
      hero.id='projectEditHero';
      hero.className='project-edit-hero';
      hero.innerHTML='<div class="project-edit-hero-label">Projet en édition</div><div class="project-edit-hero-title" id="projectEditHeroTitle">Nouveau projet</div><div class="project-edit-hero-sub" id="projectEditHeroSub">Compléter les informations du projet</div>';
      grid.insertBefore(hero,grid.firstChild);
    }
    Array.prototype.forEach.call(grid.querySelectorAll('.sdiv'),function(el){
      var t=(el.textContent||'').toLowerCase();
      el.classList.add('psec-title');
      if(t.indexOf('information')>-1){el.classList.add('identity');el.textContent='🔵 Identité du projet';}
      else if(t.indexOf('mission')>-1 || t.indexOf('prévision')>-1 || t.indexOf('prevision')>-1){el.classList.add('finance');el.textContent='💚 Finances, missions & facturation';}
      else if(t.indexOf('acteur')>-1){el.classList.add('actors');el.textContent='🟣 Acteurs du projet';}
      else if(t.indexOf('contact')>-1){el.classList.add('contact');el.textContent='🟠 Contact client';}
    });
    var notes=document.getElementById('prNotes');
    if(notes){
      var grp=notes.closest('.fgrp');
      if(grp && !(grp.previousElementSibling && grp.previousElementSibling.classList && grp.previousElementSibling.classList.contains('notes'))){
        var div=document.createElement('div');
        div.className='sdiv psec-title notes ff';
        div.textContent='🔴 Notes & alertes';
        grp.parentNode.insertBefore(div,grp);
        grp.classList.add('project-note-card');
      }
    }
    ['prName','prCode','prStatus','prClient'].forEach(function(id){
      var el=document.getElementById(id);
      if(el&&!el.dataset.heroBound){
        el.addEventListener('input',dcnUpdateProjectEditHero);
        el.addEventListener('change',dcnUpdateProjectEditHero);
        el.dataset.heroBound='1';
      }
    });
    dcnUpdateProjectEditHero();
  }catch(e){console.error(e);}
}

/* Renforce les wrappers natifs pour actualiser le titre visuel */
var _dcnUiOrigOpen=window.openProjectModal;
window.openProjectModal=function(){
  _dcnUiOrigOpen&&_dcnUiOrigOpen.apply(this,arguments);
  setTimeout(dcnEnhanceProjectModalUI,90);
};
var _dcnUiOrigEdit=window.editProject;
window.editProject=function(id){
  _dcnUiOrigEdit&&_dcnUiOrigEdit.apply(this,arguments);
  setTimeout(dcnEnhanceProjectModalUI,120);
};

document.addEventListener('DOMContentLoaded',dcnEnhanceProjectModalUI);

console.log('[DCN] extensions charg\u00e9es \u2713');
})();
