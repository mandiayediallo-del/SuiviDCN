(function(){
  'use strict';
  let COCKPIT_ACTIONS=[];
  let COCKPIT_FILTER='all';

  function h(v){
    if(typeof esc==='function') return esc(v);
    return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
  }
  function parseDateLocal(v){
    if(!v)return null;
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
    const d=new Date(s);return isNaN(d)?null:d;
  }
  function todayLocal(){const d=new Date();d.setHours(0,0,0,0);return d;}
  function daysFromToday(v){const d=parseDateLocal(v);if(!d)return null;d.setHours(0,0,0,0);return Math.round((d-todayLocal())/86400000);}
  function projectMonthCharge(projectId,mk){
    return (typeof activeMembers==='function'?activeMembers():[]).reduce((sum,m)=>{
      const e=(DB.charge?.[m.id]?.[mk])||{};
      return sum+(typeof normalizePercent==='function'?normalizePercent((e.projets||{})[projectId]||0):(Number((e.projets||{})[projectId])||0));
    },0);
  }
  function pushAction(arr,a){
    arr.push({level:'warning',category:'Général',score:50,link:'dashboard',...a});
  }
  function formatDays(days){
    if(days===0)return "aujourd’hui";
    if(days===1)return 'demain';
    if(days>1)return `dans ${days} jours`;
    if(days===-1)return 'depuis 1 jour';
    return `depuis ${Math.abs(days)} jours`;
  }

  function buildCockpitActions(mk){
    const actions=[];
    const activeProjects=(DB.projets||[]).filter(p=>['En cours','A venir'].includes(p.statut));
    const runningProjects=activeProjects.filter(p=>p.statut==='En cours');

    /* Charge équipe */
    (typeof activeMembers==='function'?activeMembers():[]).forEach(m=>{
      const t=typeof calcChargeTotale==='function'?calcChargeTotale(m.id,mk):0;
      const cap=typeof getMemberCapacity==='function'?getMemberCapacity(m.id,mk):100;
      const occ=typeof calcOccupationRate==='function'?calcOccupationRate(m.id,mk):(cap>0?t/cap*100:0);
      const name=typeof resourceDisplayName==='function'?resourceDisplayName(m):m.nom;
      const high=Number(DB.cfg?.seuilChargeHaute)||90, low=Number(DB.cfg?.seuilChargeBasse)||30;
      if(occ>=high){
        pushAction(actions,{level:'danger',category:'Charge',score:116+Math.min(20,(occ-high)/5),title:`${name} en surcharge`,detail:`Charge ${Math.round(t)} % / capacité ${Math.round(cap)} % (${Math.round(occ)} %) sur ${typeof monthLabel==='function'?monthLabel():mk}. Rééquilibrage à examiner.`,link:'charge'});
      }else if(t>0&&occ<low){
        pushAction(actions,{level:'info',category:'Charge',score:35,title:`${name} en sous-charge`,detail:`Charge ${Math.round(t)} % / capacité ${Math.round(cap)} % (${Math.round(occ)} %) sur ${typeof monthLabel==='function'?monthLabel():mk}.`,link:'charge'});
      }
    });

    /* Prévisions : utilise exactement le moteur de la V10 */
    const forecastScope=(DB.projets||[]).filter(p=>typeof isForecastProject==='function'?isForecastProject(p):p.statut==='En cours');
    forecastScope.forEach(p=>{
      const e=typeof getForecastEntry==='function'?getForecastEntry(p.id):null;
      if(typeof smartForecastState!=='function')return;
      const s=smartForecastState(p,e);
      const label=p.code?`${p.code} — ${p.nom}`:p.nom;
      if(s.kind==='gap'){
        const ratio=s.projectTotal?Math.abs(s.gap)/s.projectTotal:1;
        const severe=ratio>=.10||Math.abs(s.gap)>=10000;
        pushAction(actions,{level:severe?'danger':'warning',category:'Prévisions',score:severe?108:92,title:`${label} : prévision incohérente`,detail:`${s.label}. Montant projet ${fmt(s.projectTotal)} / prévision ${fmt(s.forecastTotal)}.`,link:'previsions',projectId:p.id});
      }else if(s.kind==='missing'||s.kind==='detail'){
        pushAction(actions,{level:'warning',category:'Prévisions',score:90,title:`${label} : prévision à compléter`,detail:s.label,link:'previsions',projectId:p.id});
      }else if(s.kind==='amount'){
        pushAction(actions,{level:'warning',category:'Données',score:88,title:`${label} : montant projet à renseigner`,detail:`Une prévision existe mais le montant de référence du projet est absent.`,link:'projets',projectId:p.id});
      }
    });

    /* Planning projet */
    let missingCalendar=0;
    activeProjects.forEach(p=>{
      if(!p.dateDebut||!p.dateFin)missingCalendar++;
      if(p.statut!=='En cours'||!p.dateFin)return;
      const days=daysFromToday(p.dateFin);if(days===null)return;
      const label=p.code?`${p.code} — ${p.nom}`:p.nom;
      if(days<0){
        pushAction(actions,{level:'danger',category:'Planning',score:125+Math.min(15,Math.abs(days)/7),title:`${label} : échéance dépassée`,detail:`Date de fin prévue dépassée ${formatDays(days)}. Statut toujours « En cours ».`,link:'projets',projectId:p.id});
      }else if(days<=30){
        pushAction(actions,{level:'warning',category:'Planning',score:98-days/3,title:`${label} : fin de mission proche`,detail:`Échéance ${formatDays(days)} (${p.dateFin}).`,link:'projets',projectId:p.id});
      }
    });
    if(missingCalendar){
      pushAction(actions,{level:'info',category:'Planning',score:28,title:`${missingCalendar} projet(s) actif(s) sans calendrier complet`,detail:`Dates de début et/ou de fin à renseigner pour fiabiliser les prévisions et les alertes d’échéance.`,link:'projets'});
    }

    /* Projet en production mais aucune charge au mois courant */
    runningProjects.forEach(p=>{
      if(p.chargeActif===false)return;
      const c=projectMonthCharge(p.id,mk);
      if(c<=.01){
        const label=p.code?`${p.code} — ${p.nom}`:p.nom;
        pushAction(actions,{level:'warning',category:'Charge',score:82,title:`${label} : aucune charge affectée`,detail:`Projet en cours sans charge productive sur ${typeof monthLabel==='function'?monthLabel():mk}.`,link:'charge',projectId:p.id});
      }
    });

    /* Pipeline AO */
    const liveAOs=(DB.pipelineAO||[]).filter(a=>!['Perdu','Attribution'].includes(a.phase));
    let hotNoNextDate=0;
    liveAOs.forEach(ao=>{
      const nextDays=daysFromToday(ao.dateProchaineAction);
      const responseDays=daysFromToday(ao.dateReponse);
      const hot=(Number(ao.probabilite)||0)>=50||['Offre deposee','Offre déposée','Negociation','Négociation'].includes(ao.phase);
      if(nextDays!==null){
        if(nextDays<0)pushAction(actions,{level:'danger',category:'AO',score:120,title:`${ao.nom} : action commerciale en retard`,detail:`${ao.actionAFaire||'Action à réaliser'} — échéance dépassée ${formatDays(nextDays)}.`,link:'pipeline',aoId:ao.id});
        else if(nextDays<=7)pushAction(actions,{level:'warning',category:'AO',score:101-nextDays,title:`${ao.nom} : action commerciale proche`,detail:`${ao.actionAFaire||'Action à réaliser'} ${formatDays(nextDays)}.`,link:'pipeline',aoId:ao.id});
      }else if(hot){hotNoNextDate++;}
      if(responseDays!==null){
        if(responseDays<0)pushAction(actions,{level:'danger',category:'AO',score:114,title:`${ao.nom} : date de réponse dépassée`,detail:`Date de réponse attendue dépassée ${formatDays(responseDays)}.`,link:'pipeline',aoId:ao.id});
        else if(responseDays<=14)pushAction(actions,{level:'warning',category:'AO',score:94-responseDays/2,title:`${ao.nom} : réponse attendue prochainement`,detail:`Échéance de réponse ${formatDays(responseDays)}.`,link:'pipeline',aoId:ao.id});
      }
      if(hot&&!ao.actionAFaire){
        pushAction(actions,{level:'warning',category:'AO',score:86,title:`${ao.nom} : action à définir`,detail:`AO à ${Number(ao.probabilite)||0} % sans prochaine action définie.`,link:'pipeline',aoId:ao.id});
      }
    });
    if(hotNoNextDate){
      pushAction(actions,{level:'warning',category:'AO',score:78,title:`${hotNoNextDate} AO chaude(s) sans date de prochaine action`,detail:`Planifier une échéance de suivi pour sécuriser le pipeline commercial.`,link:'pipeline'});
    }

    /* Suivi commercial */
    let neverContacted=0;
    (DB.commercial||[]).forEach(c=>{
      const never=c.jamaisContacte||c.statutRelation==='Jamais contacte';
      if(never){neverContacted++;return;}
      const needsAction=['Appeler','Relancer'].includes(c.actionFaire);
      if(!needsAction)return;
      const days=daysFromToday(c.dateProchaineAction);
      if(days!==null&&days<0){
        pushAction(actions,{level:'danger',category:'Commercial',score:112,title:`${c.agenceDB} : ${String(c.actionFaire).toLowerCase()} en retard`,detail:`Échéance dépassée ${formatDays(days)}${c.contactPrenom||c.contactNom?' — '+[c.contactPrenom,c.contactNom].filter(Boolean).join(' '):''}.`,link:'commercial',commercialId:c.id});
      }else if(days!==null&&days<=7){
        pushAction(actions,{level:'warning',category:'Commercial',score:91-days,title:`${c.agenceDB} : ${String(c.actionFaire).toLowerCase()} prochainement`,detail:`Action prévue ${formatDays(days)}.`,link:'commercial',commercialId:c.id});
      }else if(days===null){
        pushAction(actions,{level:'warning',category:'Commercial',score:68,title:`${c.agenceDB} : date d’action à planifier`,detail:`Action « ${c.actionFaire} » définie sans date de prochaine action.`,link:'commercial',commercialId:c.id});
      }
    });
    if(neverContacted){
      pushAction(actions,{level:'info',category:'Commercial',score:43,title:`${neverContacted} établissement(s) jamais contacté(s)`,detail:`Réservoir commercial à qualifier dans le suivi des établissements.`,link:'commercial'});
    }

    /* Facturation inconnue : une seule action agrégée pour ne pas saturer le cockpit */
    const unknownBilling=activeProjects.filter(p=>typeof isProjectFacturationKnown==='function'?!isProjectFacturationKnown(p):!(Number(p.montantFacture)>0||p.facturationRenseignee===true));
    if(unknownBilling.length){
      pushAction(actions,{level:'info',category:'Facturation',score:38,title:`${unknownBilling.length} projet(s) actif(s) avec facturation inconnue`,detail:`La colonne Facturé reste disponible : cliquer sur « ? » dans Projets lorsque les factures seront connues.`,link:'projets'});
    }

    /* Cohérence métier résiduelle hors prévisions */
    if(typeof auditCalculationConsistency==='function'){
      const issues=auditCalculationConsistency().filter(x=>x.type==='CA_MISSIONS');
      issues.forEach(i=>{
        const p=(DB.projets||[]).find(x=>x.id===i.projectId);if(!p)return;
        if(actions.some(a=>a.projectId===i.projectId&&a.category==='Données'))return;
        pushAction(actions,{level:'warning',category:'Données',score:84,title:`${i.code||i.nom} : CA et missions incohérents`,detail:`Écart de ${fmt(i.ecart)} entre la répartition CA et le montant des missions.`,link:'projets',projectId:i.projectId});
      });
    }

    const levelOrder={danger:3,warning:2,info:1};
    actions.sort((a,b)=>(b.score-a.score)||(levelOrder[b.level]-levelOrder[a.level])||String(a.title).localeCompare(String(b.title),'fr'));
    actions.forEach((a,i)=>a.id='dcn_action_'+(i+1));
    return actions;
  }

  function ensureCockpitDOM(){
    const page=document.getElementById('page-dashboard');if(!page)return null;
    let host=document.getElementById('dcnActionCockpit');
    if(!host){
      host=document.createElement('div');
      host.id='dcnActionCockpit';host.className='card dcn-action-cockpit';
      host.innerHTML=`<div class="ch"><div class="dcn-cockpit-head"><div class="dcn-cockpit-title-wrap"><div class="dcn-cockpit-title-icon">!</div><div><div class="ct">Cockpit d’actions</div><div class="dcn-cockpit-sub" id="dcnCockpitSubtitle">Priorités calculées automatiquement à partir des données de l’application</div></div></div><div class="dcn-cockpit-filters" id="dcnCockpitFilters"></div></div></div><div class="cb"><div class="dcn-action-summary" id="dcnActionSummary"></div><div class="dcn-action-list" id="dcnActionList"></div><div class="dcn-action-foot"><span id="dcnActionFootCount"></span><span>Cliquer sur une action pour aller directement au module concerné.</span></div></div>`;
      const ca=document.getElementById('dashboardCAFocus');
      if(ca&&ca.parentNode)ca.insertAdjacentElement('afterend',host); else page.insertBefore(host,page.firstChild);
    }
    return host;
  }

  function levelName(level){return level==='danger'?'Urgent':level==='warning'?'À traiter':'À surveiller';}
  function levelIcon(level){return level==='danger'?'!':level==='warning'?'◆':'•';}
  function renderCockpitActions(mk){
    const host=ensureCockpitDOM();if(!host)return;
    COCKPIT_ACTIONS=buildCockpitActions(mk||activeMonthKey());
    const counts={danger:0,warning:0,info:0};COCKPIT_ACTIONS.forEach(a=>counts[a.level]++);
    const filters=document.getElementById('dcnCockpitFilters');
    if(filters)filters.innerHTML=[['all','Toutes',COCKPIT_ACTIONS.length],['danger','Urgentes',counts.danger],['warning','À traiter',counts.warning],['info','À surveiller',counts.info]].map(x=>`<button class="dcn-cockpit-filter ${COCKPIT_FILTER===x[0]?'active':''}" onclick="setCockpitFilter('${x[0]}')">${x[1]} · ${x[2]}</button>`).join('');
    const summary=document.getElementById('dcnActionSummary');
    if(summary)summary.innerHTML=`<div class="dcn-action-stat danger" onclick="setCockpitFilter('danger')"><div class="n">${counts.danger}</div><div class="l">Urgentes</div></div><div class="dcn-action-stat warning" onclick="setCockpitFilter('warning')"><div class="n">${counts.warning}</div><div class="l">À traiter</div></div><div class="dcn-action-stat info" onclick="setCockpitFilter('info')"><div class="n">${counts.info}</div><div class="l">À surveiller</div></div><div class="dcn-action-stat total" onclick="setCockpitFilter('all')"><div class="n">${COCKPIT_ACTIONS.length}</div><div class="l">Total actions</div></div>`;
    const visible=COCKPIT_FILTER==='all'?COCKPIT_ACTIONS:COCKPIT_ACTIONS.filter(a=>a.level===COCKPIT_FILTER);
    const list=document.getElementById('dcnActionList');
    if(list)list.innerHTML=visible.length?visible.map(a=>`<div class="dcn-action-item ${a.level}" onclick="openCockpitAction('${a.id}')" title="Ouvrir le module concerné"><div class="dcn-action-level">${levelIcon(a.level)} ${levelName(a.level)}</div><div class="dcn-action-main"><div class="dcn-action-title">${h(a.title)}</div><div class="dcn-action-detail">${h(a.detail||'')}</div></div><div class="dcn-action-category">${h(a.category)}</div></div>`).join(''):`<div class="dcn-action-empty">✓ Aucun sujet dans cette catégorie.</div>`;
    const sub=document.getElementById('dcnCockpitSubtitle');if(sub)sub.textContent=COCKPIT_ACTIONS.length?`${counts.danger} urgente(s) · ${counts.warning} à traiter · ${counts.info} à surveiller`:'Aucune action détectée';
    const foot=document.getElementById('dcnActionFootCount');if(foot)foot.textContent=`${visible.length} action(s) affichée(s) sur ${COCKPIT_ACTIONS.length}`;

    /* Le panneau historique devient un résumé des priorités du même moteur */
    const ap=document.getElementById('alertsPanel');
    if(ap){
      const top=COCKPIT_ACTIONS.filter(a=>a.level!=='info').slice(0,6);
      ap.innerHTML=top.length?top.map(a=>`<div class="dcn-top-priority ${a.level}" onclick="openCockpitAction('${a.id}')"><div class="tp-icon">${levelIcon(a.level)}</div><div class="tp-txt"><b>${h(a.title)}</b>${h(a.detail||'')}</div></div>`).join(''):'<div class="empty">Aucune priorité active</div>';
      const title=ap.closest('.card')?.querySelector('.ct');if(title)title.textContent='Top priorités';
    }
  }

  window.setCockpitFilter=function(filter){COCKPIT_FILTER=filter||'all';renderCockpitActions(activeMonthKey());};
  window.openCockpitAction=function(id){
    const a=COCKPIT_ACTIONS.find(x=>x.id===id);if(!a)return;
    if(typeof goPage==='function')goPage(a.link||'dashboard');
    setTimeout(()=>{
      try{
        if(a.link==='projets'&&a.projectId&&typeof openProjectSheet==='function')openProjectSheet(a.projectId);
        else if(a.link==='pipeline'&&a.aoId&&typeof editAo==='function')editAo(a.aoId);
        else if(a.link==='commercial'&&a.commercialId&&typeof editCommercial==='function')editCommercial(a.commercialId);
        else if(a.link==='previsions'&&a.projectId){
          const el=document.querySelector(`#page-previsions [data-project-id="${CSS.escape(a.projectId)}"]`);
          if(el){el.scrollIntoView({behavior:'smooth',block:'center'});const row=el.closest('tr');if(row){row.classList.add('row-focus');setTimeout(()=>row.classList.remove('row-focus'),2200);}}
        }
      }catch(e){console.warn('[Cockpit action]',e);}
    },120);
  };
  window.buildCockpitActions=buildCockpitActions;
  window.renderCockpitActions=renderCockpitActions;

  const previousRenderDashboard=window.renderDashboard;
  if(typeof previousRenderDashboard==='function'){
    window.renderDashboard=function(){const r=previousRenderDashboard.apply(this,arguments);renderCockpitActions(activeMonthKey());return r;};
  }
  function initCockpit(){ensureCockpitDOM();renderCockpitActions(typeof activeMonthKey==='function'?activeMonthKey():'');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initCockpit,180));else setTimeout(initCockpit,180);
  console.log('[DCN V11] Cockpit d\'actions chargé ✓');
})();
