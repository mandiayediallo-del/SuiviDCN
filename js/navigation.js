(function(){
'use strict';
const UX_KEY='dcn_v12_nav_state';
let UX_STATE={};
try{UX_STATE=JSON.parse(sessionStorage.getItem(UX_KEY)||'{}')||{};}catch(e){UX_STATE={};}
let V12_COCKPIT_FILTER='all';
function uxEsc(v){if(typeof esc==='function')return esc(v);return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));}
function persistUx(){try{sessionStorage.setItem(UX_KEY,JSON.stringify(UX_STATE));}catch(e){}}
function pageIdFrom(el){const p=el?.closest?.('.page');return p?p.id.replace(/^page-/,''):'';}
function activePageId(){const p=document.querySelector('.page.active');return p?p.id.replace(/^page-/,''):'';}
function normalizeTxt(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function gridKey(el,index){const page=pageIdFrom(el)||'global';if(el.id)return page+':'+el.id;return page+':grid'+index;}
function filterSnapshot(page){
  const root=document.getElementById('page-'+page);if(!root)return {};
  const vals={};root.querySelectorAll('input[id^="srch"],select[id^="filt"]').forEach(el=>vals[el.id]=el.value);
  const active=root.querySelector('#statFilterBar .stat-pill.active');if(active)vals.__projectStat=active.dataset.stat||'';
  return vals;
}
function savePageState(page){
  if(!page)return;UX_STATE[page]=UX_STATE[page]||{};UX_STATE[page].filters=filterSnapshot(page);
  const root=document.getElementById('page-'+page);if(root){UX_STATE[page].grids={};root.querySelectorAll('[data-dcn-ux-key]').forEach(g=>{UX_STATE[page].grids[g.dataset.dcnUxKey]={left:g.scrollLeft||0,top:g.scrollTop||0};});}
  UX_STATE[page].windowY=window.scrollY||0;persistUx();
}
function applySavedFilters(page){
  const root=document.getElementById('page-'+page),st=UX_STATE[page];if(!root||!st?.filters)return;
  Object.entries(st.filters).forEach(([id,val])=>{if(id==='__projectStat')return;const el=document.getElementById(id);if(el)el.value=val;});
  if(st.filters.__projectStat){root.querySelectorAll('#statFilterBar .stat-pill').forEach(x=>x.classList.toggle('active',x.dataset.stat===st.filters.__projectStat));}
}
function restorePageState(page){
  const root=document.getElementById('page-'+page),st=UX_STATE[page];if(!root||!st)return;
  (st.grids?Object.entries(st.grids):[]).forEach(([key,pos])=>{const g=[...root.querySelectorAll('[data-dcn-ux-key]')].find(x=>x.dataset.dcnUxKey===key);if(g){g.scrollLeft=Number(pos.left)||0;g.scrollTop=Number(pos.top)||0;const top=g.previousElementSibling;if(top?.classList.contains('dcn-ux-topscroll'))top.scrollLeft=g.scrollLeft;}});
  if(Number.isFinite(st.windowY))window.scrollTo(0,st.windowY);
}
function legacyCleanup(){
  document.querySelectorAll('.dcn-ts').forEach(ts=>{const prev=ts.previousElementSibling;if(prev&&prev.querySelector('.dcn-nav-btn'))prev.remove();ts.remove();});
  /* V13 : on retire réellement les anciennes barres statiques afin qu'un seul moteur de navigation existe. */
  ['chargeNavBar','chargeTopScroll','ganttNavBar','ganttTopScroll'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});
}
const DCN_MONTH_LABELS=['jan','fev','mar','avr','mai','juin','juil','aou','sep','oct','nov','dec'];
function getMonthHeaders(g){
  const table=g?.querySelector?.('table');if(!table)return [];
  return [...table.querySelectorAll('thead tr:first-child th')].filter(th=>{
    const t=normalizeTxt(th.textContent).replace(/\./g,'');
    return DCN_MONTH_LABELS.some(m=>t===m||t.startsWith(m+' ')||t.startsWith(m+'-'));
  });
}
function stickyWidth(g){const first=g?.querySelector?.('thead tr:first-child th:first-child');return first?Math.max(0,first.offsetWidth||0):0;}
function centeredScrollLeft(g,target){
  if(!g||!target)return 0;
  const sticky=stickyWidth(g);
  const usable=Math.max(1,(g.clientWidth||0)-sticky);
  const targetCenter=(target.offsetLeft||0)+(target.offsetWidth||0)/2;
  const desired=targetCenter-sticky-usable/2;
  return Math.max(0,Math.min(desired,Math.max(0,g.scrollWidth-g.clientWidth)));
}
function centerHeader(g,target,behavior='smooth'){if(!g||!target)return;g.scrollTo({left:centeredScrollLeft(g,target),behavior});}
function nearestMonthIndex(g,headers){
  if(!headers?.length)return -1;
  const sticky=stickyWidth(g),usable=Math.max(1,(g.clientWidth||0)-sticky);
  const viewportCenter=(g.scrollLeft||0)+sticky+usable/2;
  let best=0,bestDist=Infinity;
  headers.forEach((th,i)=>{const c=(th.offsetLeft||0)+(th.offsetWidth||0)/2,d=Math.abs(c-viewportCenter);if(d<bestDist){best=i;bestDist=d;}});
  return best;
}
function scrollStep(g,dir){
  const page=pageIdFrom(g),headers=getMonthHeaders(g);
  if(['previsions','charge','gantt'].includes(page)&&headers.length){
    const current=nearestMonthIndex(g,headers);
    const targetIndex=Math.max(0,Math.min(headers.length-1,(current<0?0:current)+dir));
    centerHeader(g,headers[targetIndex]);
    return;
  }
  const step=Math.max(320,Math.round((g.clientWidth||800)*.90));
  g.scrollBy({left:dir*step,behavior:'smooth'});
}
function goCurrentMonth(g){
  const headers=getMonthHeaders(g);if(!headers.length)return;
  const now=new Date();
  let idx=(typeof DB!=='undefined'&&Number(DB.cfg?.annee)===now.getFullYear())?now.getMonth():(typeof ACTIVE_MONTH==='number'?ACTIVE_MONTH:now.getMonth());
  idx=Math.max(0,Math.min(headers.length-1,idx));
  /* V13 : le mois courant est placé au centre de la zone visible, hors colonne figée. */
  centerHeader(g,headers[idx]);
}
function makeNav(g,key,isTime){
  let top=g.previousElementSibling;if(top?.classList.contains('dcn-ux-topscroll')){const bar=top.previousElementSibling;if(bar?.classList.contains('dcn-ux-nav'))return {bar,top};}
  const bar=document.createElement('div');bar.className='dcn-ux-nav dcn-runtime-ui';bar.dataset.for=key;
  const prev=document.createElement('button');prev.className='dcn-ux-btn';prev.type='button';prev.innerHTML='◀ Préc.';prev.onclick=()=>scrollStep(g,-1);
  const next=document.createElement('button');next.className='dcn-ux-btn';next.type='button';next.innerHTML='Suiv. ▶';next.onclick=()=>scrollStep(g,1);
  bar.append(prev);
  if(isTime){const now=document.createElement('button');now.className='dcn-ux-btn now';now.type='button';now.innerHTML='📍 Mois actuel';now.title='Centrer le mois actuel';now.onclick=()=>goCurrentMonth(g);bar.append(now);}
  bar.append(next);
  const hint=document.createElement('span');hint.className='dcn-ux-hint';hint.textContent='Glisser, molette ⇧ ou barre horizontale';bar.append(hint);
  const topScroll=document.createElement('div');topScroll.className='dcn-ux-topscroll dcn-runtime-ui';topScroll.dataset.for=key;const inner=document.createElement('div');inner.style.height='1px';inner.style.width='1000px';topScroll.append(inner);
  g.parentNode.insertBefore(bar,g);g.parentNode.insertBefore(topScroll,g);
  return {bar,top:topScroll,inner};
}
function bindDrag(g){
  if(g.dataset.dcnUxDrag==='1')return;
  g.dataset.dcnUxDrag='1';

  let down=false,startX=0,startLeft=0,moved=false,captured=false,pointerId=null;
  const DRAG_THRESHOLD=7;

  g.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('input,button,select,textarea,a'))return;
    down=true;
    moved=false;
    captured=false;
    pointerId=e.pointerId;
    startX=e.clientX;
    startLeft=g.scrollLeft;

    // IMPORTANT V16.4.4 :
    // ne PAS capturer le pointeur ici.
    // Un clic simple doit rester ciblé sur la ligne/cellule cliquée.
  });

  g.addEventListener('pointermove',e=>{
    if(!down)return;
    const dx=e.clientX-startX;

    if(!moved && Math.abs(dx)>DRAG_THRESHOLD){
      moved=true;
      captured=true;
      try{g.setPointerCapture?.(pointerId);}catch(_){}
      g.classList.add('dragging');
    }

    if(moved){
      g.scrollLeft=startLeft-dx;
      e.preventDefault();
    }
  });

  const end=e=>{
    if(!down)return;
    down=false;
    g.classList.remove('dragging');

    if(captured){
      try{g.releasePointerCapture?.(pointerId);}catch(_){}
    }
    captured=false;
    pointerId=null;
  };

  g.addEventListener('pointerup',end);
  g.addEventListener('pointercancel',end);

  // Uniquement après un VRAI glissement, neutraliser le clic résiduel.
  // Un clic simple passe normalement vers <tr onclick=...> ou project-sheet-link.
  g.addEventListener('click',e=>{
    if(!moved)return;
    e.preventDefault();
    e.stopPropagation();
    moved=false;
  },true);

  g.addEventListener('wheel',e=>{
    if(e.shiftKey&&Math.abs(e.deltaY)>Math.abs(e.deltaX)){
      e.preventDefault();
      g.scrollLeft+=e.deltaY;
    }
  },{passive:false});
}
function enhanceGrid(g,index){
  if(!g)return;const key=gridKey(g,index);g.dataset.dcnUxKey=key;g.dataset.dcnNav='v13';g.classList.add('dcn-ux-grid');
  const page=pageIdFrom(g);const isTime=['previsions','charge','gantt'].includes(page);
  const ui=makeNav(g,key,isTime);const top=ui.top,inner=ui.inner||top.firstElementChild;
  function refresh(){if(inner)inner.style.width=Math.max(g.scrollWidth,600)+'px';}
  refresh();if(!g.dataset.dcnUxSync){g.dataset.dcnUxSync='1';let lock=false;top.addEventListener('scroll',()=>{if(lock)return;lock=true;g.scrollLeft=top.scrollLeft;lock=false;});g.addEventListener('scroll',()=>{if(lock)return;lock=true;top.scrollLeft=g.scrollLeft;lock=false;refresh();clearTimeout(g._dcnUxSave);g._dcnUxSave=setTimeout(()=>savePageState(page),120);});if(typeof ResizeObserver!=='undefined')new ResizeObserver(refresh).observe(g);}
  bindDrag(g);setTimeout(refresh,80);
}
function enhanceAll(){
  legacyCleanup();const seen=new Set();let idx=0;
  document.querySelectorAll('.tw,.charge-wrap,.gantt-wrap').forEach(g=>{
    if(seen.has(g))return;seen.add(g);
    const pg=g.closest('.page'),page=pageIdFrom(g),isTime=['previsions','charge','gantt'].includes(page);
    if(pg&&!pg.classList.contains('active')&&g.clientWidth===0)return;
    /* V13 : les écrans temporels gardent toujours leur barre, même si le tableau tient ponctuellement dans la largeur. */
    if(!isTime&&g.clientWidth>0&&g.scrollWidth<=g.clientWidth+8)return;
    enhanceGrid(g,idx++);
  });
  addTruncationTitles();enhanceSheetQuickNav();
}
function addTruncationTitles(){document.querySelectorAll('.dcn-ux-grid td,.dcn-ux-grid th').forEach(el=>{if(el.querySelector('input,button,select,textarea'))return;if(el.scrollWidth>el.clientWidth+4&&!el.title)el.title=(el.textContent||'').trim();});}
function focusProjectInPage(page,projectId){
  setTimeout(()=>{const root=document.getElementById('page-'+page);if(!root)return;const el=root.querySelector(`[data-project-id="${CSS.escape(projectId)}"]`);if(!el){if(typeof toast==='function')toast('Projet non visible avec les filtres actuels');return;}const row=el.closest('tr')||el;row.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});row.classList.add('dcn-ux-focus');setTimeout(()=>row.classList.remove('dcn-ux-focus'),1800);},140);
}
window.dcnGoProjectView=function(page,projectId){if(typeof closeProjectSheet==='function')closeProjectSheet();if(typeof goPage==='function')goPage(page);focusProjectInPage(page,projectId);};
window.dcnOpenLinkedDevis=function(projectId){
  const p=(DB.projets||[]).find(x=>x.id===projectId);if(!p)return;if(typeof closeProjectSheet==='function')closeProjectSheet();
  if(typeof goPage==='function')goPage('devis');setTimeout(()=>{const q=document.getElementById('srchDevis');if(q){q.value=p.devis||'';q.dispatchEvent(new Event('input',{bubbles:true}));}if(typeof renderDevisPage==='function')renderDevisPage();const d=(DB.devis||[]).find(x=>x.id===p.devisId||String(x.numero||'')===String(p.devis||''));if(d&&typeof editDevisEntry==='function')editDevisEntry(d.id);},100);
};
window.dcnOpenLinkedAo=function(projectId){
  const p=(DB.projets||[]).find(x=>x.id===projectId);if(!p)return;let ao=null;try{const t=typeof workflowTrail==='function'?workflowTrail(p):null;ao=t?.ao||null;}catch(e){}
  if(typeof closeProjectSheet==='function')closeProjectSheet();if(ao&&(DB.pipelineAO||[]).some(x=>x.id===ao.id)){if(typeof goPage==='function')goPage('pipeline');setTimeout(()=>{if(typeof editAo==='function')editAo(ao.id);},100);}else if(typeof toast==='function')toast('AO d’origine archivée : son historique reste visible dans le parcours du dossier.');
};
function enhanceSheetQuickNav(){
  const actions=document.querySelector('#projectSheetOv .project-sheet-actions');
  const currentId=(typeof CURRENT_PROJECT_SHEET_ID!=='undefined'?CURRENT_PROJECT_SHEET_ID:null);
  if(!actions||!currentId)return;actions.querySelector('.dcn-sheet-quicknav')?.remove();
  const id=currentId;const p=(DB.projets||[]).find(x=>x.id===id);if(!p)return;const box=document.createElement('span');box.className='dcn-sheet-quicknav dcn-runtime-ui';
  box.innerHTML=`<button class="btn btn-outline" onclick="dcnGoProjectView('previsions','${id}')">Prévisions</button><button class="btn btn-outline" onclick="dcnGoProjectView('charge','${id}')">Plan de charge</button>${p.devis?`<button class="btn btn-outline" onclick="dcnOpenLinkedDevis('${id}')">Devis ${uxEsc(p.devis)}</button>`:''}${(p.aoOrigineId||p.sourceMode==='AO')?`<button class="btn btn-outline" onclick="dcnOpenLinkedAo('${id}')">AO d’origine</button>`:''}`;actions.append(box);
}
/* ── Alertes masquables ─────────────────────────────────────────────── */
function maskedStore(){DB.uiState=DB.uiState||{};DB.uiState.maskedCockpitActions=Array.isArray(DB.uiState.maskedCockpitActions)?DB.uiState.maskedCockpitActions:[];return DB.uiState.maskedCockpitActions;}
function actionKey(a){return [a.category||'',a.projectId||'',a.aoId||'',a.commercialId||'',a.link||'',String(a.title||'').trim()].join('|');}
function currentAllActions(){try{return typeof window.buildCockpitActions==='function'?window.buildCockpitActions(typeof activeMonthKey==='function'?activeMonthKey():''):[];}catch(e){console.warn('[V12 cockpit]',e);return [];}}
function pruneMasked(all){const keys=new Set(all.map(actionKey));const st=maskedStore();const next=st.filter(x=>keys.has(x.key));if(next.length!==st.length){DB.uiState.maskedCockpitActions=next;}return next;}
function ensureMaskedModal(){let ov=document.getElementById('dcnMaskedAlertsOv');if(ov)return ov;ov=document.createElement('div');ov.id='dcnMaskedAlertsOv';ov.className='ov dcn-runtime-ui';ov.innerHTML=`<div class="modal" style="width:760px"><div class="mh"><span class="mt">Alertes masquées</span><button class="mx" onclick="document.getElementById('dcnMaskedAlertsOv').classList.remove('open')">×</button></div><div class="mb"><div id="dcnMaskedAlertsList" class="dcn-masked-list"></div></div><div class="mf"><button class="btn btn-outline" onclick="dcnRestoreAllMasked()">Tout restaurer</button><button class="btn btn-primary" onclick="document.getElementById('dcnMaskedAlertsOv').classList.remove('open')">Fermer</button></div></div>`;document.body.append(ov);return ov;}
window.dcnShowMaskedAlerts=function(){const all=currentAllActions();const masked=pruneMasked(all);const ov=ensureMaskedModal();const list=ov.querySelector('#dcnMaskedAlertsList');list.innerHTML=masked.length?masked.map((m,i)=>`<div class="dcn-masked-row"><div><div class="dcn-masked-title">${uxEsc(m.title)}</div><div class="dcn-masked-meta">${uxEsc(m.category||'')} · masquée ${m.maskedAt?new Date(m.maskedAt).toLocaleDateString('fr-FR'):''}</div></div><button class="btn btn-outline btn-sm" onclick="dcnRestoreMasked(${i})">Restaurer</button></div>`).join(''):'<div class="empty">Aucune alerte masquée</div>';ov.classList.add('open');};
window.dcnRestoreMasked=function(index){const st=maskedStore();st.splice(index,1);if(typeof saveDB==='function')saveDB();dcnShowMaskedAlerts();renderV12Cockpit();};
window.dcnRestoreAllMasked=function(){DB.uiState=DB.uiState||{};DB.uiState.maskedCockpitActions=[];if(typeof saveDB==='function')saveDB();const ov=document.getElementById('dcnMaskedAlertsOv');if(ov)ov.classList.remove('open');renderV12Cockpit();};
window.dcnMaskAction=function(id){const all=currentAllActions();const a=all.find(x=>x.id===id);if(!a)return;const key=actionKey(a),st=maskedStore();if(!st.some(x=>x.key===key))st.push({key,title:a.title,category:a.category,maskedAt:new Date().toISOString()});if(typeof saveDB==='function')saveDB();renderV12Cockpit();if(typeof toast==='function')toast('Alerte masquée','ok');};
window.dcnOpenV12Action=function(id){const a=currentAllActions().find(x=>x.id===id);if(!a)return;if(typeof goPage==='function')goPage(a.link||'dashboard');setTimeout(()=>{try{if(a.link==='projets'&&a.projectId&&typeof openProjectSheet==='function')openProjectSheet(a.projectId);else if(a.link==='pipeline'&&a.aoId&&typeof editAo==='function')editAo(a.aoId);else if(a.link==='commercial'&&a.commercialId&&typeof editCommercial==='function')editCommercial(a.commercialId);else if(['previsions','charge'].includes(a.link)&&a.projectId)focusProjectInPage(a.link,a.projectId);}catch(e){console.warn('[V12 action]',e);}},130);};
function levelName12(l){return l==='danger'?'Urgent':l==='warning'?'À traiter':'À surveiller';}function levelIcon12(l){return l==='danger'?'!':l==='warning'?'◆':'•';}
function renderV12Cockpit(){
  const host=document.getElementById('dcnActionCockpit');if(!host||typeof window.buildCockpitActions!=='function')return;const all=currentAllActions();const masked=pruneMasked(all);const maskKeys=new Set(masked.map(x=>x.key));const actions=all.filter(a=>!maskKeys.has(actionKey(a)));const counts={danger:0,warning:0,info:0};actions.forEach(a=>counts[a.level]++);
  const filters=document.getElementById('dcnCockpitFilters');if(filters)filters.innerHTML=[['all','Toutes',actions.length],['danger','Urgentes',counts.danger],['warning','À traiter',counts.warning],['info','À surveiller',counts.info]].map(x=>`<button class="dcn-cockpit-filter ${V12_COCKPIT_FILTER===x[0]?'active':''}" onclick="setCockpitFilter('${x[0]}')">${x[1]} · ${x[2]}</button>`).join('')+`<button class="dcn-masked-link" onclick="dcnShowMaskedAlerts()">Masquées · ${masked.length}</button>`;
  const sum=document.getElementById('dcnActionSummary');if(sum)sum.innerHTML=`<div class="dcn-action-stat danger" onclick="setCockpitFilter('danger')"><div class="n">${counts.danger}</div><div class="l">Urgentes</div></div><div class="dcn-action-stat warning" onclick="setCockpitFilter('warning')"><div class="n">${counts.warning}</div><div class="l">À traiter</div></div><div class="dcn-action-stat info" onclick="setCockpitFilter('info')"><div class="n">${counts.info}</div><div class="l">À surveiller</div></div><div class="dcn-action-stat total" onclick="setCockpitFilter('all')"><div class="n">${actions.length}</div><div class="l">Total actions</div></div>`;
  const visible=V12_COCKPIT_FILTER==='all'?actions:actions.filter(a=>a.level===V12_COCKPIT_FILTER),list=document.getElementById('dcnActionList');if(list)list.innerHTML=visible.length?visible.map(a=>`<div class="dcn-action-item ${a.level}" onclick="dcnOpenV12Action('${a.id}')"><div class="dcn-action-level">${levelIcon12(a.level)} ${levelName12(a.level)}</div><div class="dcn-action-main"><div class="dcn-action-title">${uxEsc(a.title)}</div><div class="dcn-action-detail">${uxEsc(a.detail||'')}</div></div><div class="dcn-action-category">${uxEsc(a.category)}</div><button class="dcn-action-hide" title="Masquer cette alerte" onclick="event.stopPropagation();dcnMaskAction('${a.id}')">×</button></div>`).join(''):'<div class="dcn-action-empty">✓ Aucun sujet dans cette catégorie.</div>';
  const sub=document.getElementById('dcnCockpitSubtitle');if(sub)sub.textContent=actions.length?`${counts.danger} urgente(s) · ${counts.warning} à traiter · ${counts.info} à surveiller · ${masked.length} masquée(s)`:'Aucune action active';const foot=document.getElementById('dcnActionFootCount');if(foot)foot.textContent=`${visible.length} action(s) affichée(s) sur ${actions.length}`;
  const ap=document.getElementById('alertsPanel');if(ap){const top=actions.filter(a=>a.level!=='info').slice(0,6);ap.innerHTML=top.length?top.map(a=>`<div class="dcn-top-priority ${a.level}" onclick="dcnOpenV12Action('${a.id}')"><div class="tp-icon">${levelIcon12(a.level)}</div><div class="tp-txt"><b>${uxEsc(a.title)}</b>${uxEsc(a.detail||'')}</div></div>`).join(''):'<div class="empty">Aucune priorité active</div>';const title=ap.closest('.card')?.querySelector('.ct');if(title)title.textContent='Top priorités';}
}
window.setCockpitFilter=function(f){V12_COCKPIT_FILTER=f||'all';renderV12Cockpit();};window.renderV12Cockpit=renderV12Cockpit;
/* Hooks de rendu/navigation : mémorisation de la position et réapplication des améliorations */
const previousGoPage=window.goPage;if(typeof previousGoPage==='function')window.goPage=function(id){const cur=activePageId();if(cur)savePageState(cur);applySavedFilters(id);const r=previousGoPage.apply(this,arguments);setTimeout(()=>{enhanceAll();restorePageState(id);renderV12Cockpit();},80);setTimeout(()=>{enhanceAll();restorePageState(id);},520);return r;};
const previousRenderAll=window.renderAll;if(typeof previousRenderAll==='function')window.renderAll=function(){const cur=activePageId();if(cur)savePageState(cur);const r=previousRenderAll.apply(this,arguments);setTimeout(()=>{enhanceAll();if(cur)restorePageState(cur);renderV12Cockpit();},90);return r;};
const previousDashboard=window.renderDashboard;if(typeof previousDashboard==='function')window.renderDashboard=function(){const r=previousDashboard.apply(this,arguments);setTimeout(renderV12Cockpit,0);return r;};
const previousOpenSheet=window.openProjectSheet;if(typeof previousOpenSheet==='function')window.openProjectSheet=function(){const r=previousOpenSheet.apply(this,arguments);setTimeout(enhanceSheetQuickNav,0);return r;};
/* Filtres conservés temporairement */
document.addEventListener('input',e=>{if(e.target?.id&&/^(srch|filt)/.test(e.target.id))savePageState(pageIdFrom(e.target));},true);document.addEventListener('change',e=>{if(e.target?.id&&/^(srch|filt)/.test(e.target.id))savePageState(pageIdFrom(e.target));},true);document.addEventListener('click',e=>{if(e.target.closest('#statFilterBar .stat-pill'))setTimeout(()=>savePageState('projets'),20);},true);
/* Échap ferme volontairement la fenêtre au premier plan */
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const sheet=document.getElementById('projectSheetOv');if(sheet?.classList.contains('open')&&typeof closeProjectSheet==='function'){closeProjectSheet();return;}const masked=document.getElementById('dcnMaskedAlertsOv');if(masked?.classList.contains('open')){masked.classList.remove('open');return;}const opens=[...document.querySelectorAll('.ov.open')];const top=opens[opens.length-1];if(top&&typeof closeM==='function')closeM(top.id);});
/* Sauvegarde HTML V12 : n'embarque pas les composants de navigation générés à l'exécution. */
window.saveHtmlFile=function(){ if(window.DCN_SAVE_DATA) return window.DCN_SAVE_DATA(); if(typeof toast==='function') toast('Module de sauvegarde non disponible','err'); };
function init(){applySavedFilters(activePageId());enhanceAll();restorePageState(activePageId());renderV12Cockpit();setTimeout(()=>{renderV12Cockpit();enhanceAll();restorePageState(activePageId());},320);setTimeout(()=>{renderV12Cockpit();enhanceAll();restorePageState(activePageId());},700);console.log('[DCN V13] Navigation temporelle centrée chargée ✓');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120));else setTimeout(init,120);
})();
