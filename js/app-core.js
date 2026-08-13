const MOIS=['Jan','Fev','Mar','Avr','Mai','Juin','Juil','Aou','Sep','Oct','Nov','Dec'];
const MOIS_L=['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
const MISSIONS=['BIM Management','BIM Coordination','Synthese Technique','Synthese Architecturale','Modelisation','Suivi AO'];
const NOW=new Date(); const MONTH_NOW=NOW.getMonth(); let ACTIVE_MONTH=MONTH_NOW; let DASH_CHARTS={}; let GANTT_MODE='collab';
let editProjectId=null, editAoId=null, editCommercialId=null, editFactureId=null;
const STATUTS_CHARGE_ACTIF=['En cours','A venir','A renseigner'];

/* V16.1.1 — helper global de navigation clavier des grilles.
   Cette fonction était auparavant locale à forecasts-import.js alors que
   le plan de charge et app-core l'utilisent également. */
function focusTableRow(el){
  const tr=el && el.closest ? el.closest('tr') : null;
  if(!tr) return;
  const parent=tr.parentElement;
  if(parent){
    parent.querySelectorAll('tr.row-focus').forEach(function(r){
      r.classList.remove('row-focus');
    });
  }
  tr.classList.add('row-focus');
}

function bindGridNavigation(scopeSelector){
  document.querySelectorAll(scopeSelector).forEach(function(input){
    if(input.dataset && input.dataset.dcnGridNavBound === '1') return;
    if(input.dataset) input.dataset.dcnGridNavBound='1';

    input.addEventListener('focus',function(){
      focusTableRow(input);
    });

    input.addEventListener('keydown',function(e){
      if(e.key!=='Enter') return;
      e.preventDefault();
      const row=input.closest('tr');
      if(!row) return;
      const col=Number(input.dataset.col||0);
      let next=row.nextElementSibling;
      while(next){
        const target=next.querySelector('[data-col="'+col+'"]');
        if(target){
          target.focus();
          if(typeof target.select==='function') target.select();
          return;
        }
        next=next.nextElementSibling;
      }
    });
  });
}
window.focusTableRow=focusTableRow;
window.bindGridNavigation=bindGridNavigation;


function defaultDB(){
  try{
    if(window.DCN_EMPTY_DB) return JSON.parse(JSON.stringify(window.DCN_EMPTY_DB));
  }catch(e){ console.error('Default DB read error',e); }
  return {cfg:{annee:2026,seuilChargeHaute:90,seuilChargeBasse:30,devise:'EUR'},membres:[],projets:[],pipelineAO:[],devis:[],previsionsFacturation:[],charge:{},factures:[],commercial:[],parametresMensuels:{}};
}

function readEmbeddedDB(){
  try{
    if(window.DCN_EMPTY_DB) return JSON.parse(JSON.stringify(window.DCN_EMPTY_DB));
    return null;
  }catch(e){
    console.error('Bootstrap DB read error', e);
    return null;
  }
}
function loadDB(){
  try{
    const embedded=readEmbeddedDB();
    if(embedded) return JSON.parse(JSON.stringify(embedded));
    return JSON.parse(JSON.stringify(defaultDB()));
  }catch(e){
    return defaultDB();
  }
}
let DB=loadDB();
let HAS_UNSAVED_CHANGES=false;
let USER_INTERACTED=false;
function markDirty(){ HAS_UNSAVED_CHANGES=true; }
function markSaved(){ HAS_UNSAVED_CHANGES=false; }
function saveDB(){ markDirty(); if(window.DCN_SYNC)window.DCN_SYNC.schedule(DB); return true; }
function activateUnloadGuard(){ USER_INTERACTED=true; }
['pointerdown','keydown','touchstart','mousedown'].forEach(function(evt){
  window.addEventListener(evt, activateUnloadGuard, {passive:true, capture:true});
});
function handleBeforeUnload(e){
  if(!HAS_UNSAVED_CHANGES || !USER_INTERACTED) return;
  e.preventDefault();
  e.returnValue='Modifications non sauvegardées';
  return 'Modifications non sauvegardées';
}
window.onbeforeunload = handleBeforeUnload;
window.addEventListener('beforeunload', handleBeforeUnload);
document.addEventListener('input', function(e){
  if(e.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName)) markDirty();
}, true);
document.addEventListener('change', function(e){
  if(e.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName)) markDirty();
}, true);
function uid(prefix='i'){return prefix+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);}
function fmt(n){if(n===null||n===undefined||isNaN(Number(n)))return '—'; return new Intl.NumberFormat('fr-FR',{style:'currency',currency:DB.cfg.devise||'EUR',maximumFractionDigits:0}).format(Number(n));}
function fmtD(d){if(!d)return '—'; try{return new Date(d).toLocaleDateString('fr-FR')}catch(e){return d}}
function monthKey(i){return `${DB.cfg.annee}-${String(i+1).padStart(2,'0')}`;}
function activeMonthKey(){return `${DB.cfg.annee}-${String(ACTIVE_MONTH+1).padStart(2,'0')}`;}
function monthLabel(i=ACTIVE_MONTH){return `${MOIS_L[i]} ${DB.cfg.annee}`;}
function initMonthSelector(){const sel=document.getElementById('monthSelect');if(!sel)return;sel.innerHTML=MOIS_L.map((m,i)=>`<option value="${i}">${m} ${DB.cfg.annee}</option>`).join('');sel.value=String(ACTIVE_MONTH);}
function refreshMonthUI(){const b=document.getElementById('monthBadge');if(b)b.textContent=`Vue : ${monthLabel()}`;const s=document.getElementById('monthSelect');if(s)s.value=String(ACTIVE_MONTH);}
function setActiveMonth(i){ACTIVE_MONTH=(i+12)%12;refreshMonthUI();renderAll();}
function changeMonth(delta){setActiveMonth(ACTIVE_MONTH+delta);}
let _mCb=null;
function confirmAction(msg,cb,title,btnLabel){
  document.getElementById('mConfirmTitle').textContent=title||'Confirmation';
  document.getElementById('mConfirmMsg').textContent=msg;
  document.getElementById('mConfirmYes').textContent=btnLabel||'Confirmer';
  _mCb=cb;
  document.getElementById('mConfirm').classList.add('open');
}
function _mConfirmOk(){closeM('mConfirm');if(typeof _mCb==='function'){_mCb();_mCb=null;}}
function toast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className='show '+(type==='ok'?'succ':type==='err'?'err':'');setTimeout(()=>t.className='',2600);}
function closeM(id){
  const el=document.getElementById(id);if(el)el.classList.remove('open');
  // Annulation propre d'une transformation en cours : aucune donnée source n'est modifiée tant que le formulaire cible n'est pas enregistré.
  if(id==='mProject' && !editProjectId){
    if(typeof aoEnTransformation!=='undefined') aoEnTransformation=null;
    if(typeof devisEnAttribution!=='undefined') devisEnAttribution=null;
  }
  if(id==='mAo' && !editAoId && typeof devisEnAttribution!=='undefined') devisEnAttribution=null;
}
// Les modales ne se ferment plus sur un clic accidentel dans l'arrière-plan.
// Fermeture volontaire uniquement via les boutons × / Annuler / actions prévues.
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)e.preventDefault();}));
function normalizePercent(v){if(v===null||v===undefined)return 0;let s=String(v).trim().replace('%','').replace(',','.');if(!s)return 0;let n=parseFloat(s);if(isNaN(n))return 0;if(n>0&&n<=1)n*=100;return Math.max(0,Math.min(200,n));}
function getMonthConfig(mk){if(!DB.parametresMensuels[mk])DB.parametresMensuels[mk]={joursOuvres:21,capaciteReference:100};return DB.parametresMensuels[mk];}
function getChargeEntry(mid,mk){if(!DB.charge[mid])DB.charge[mid]={};if(!DB.charge[mid][mk])DB.charge[mid][mk]={projets:{},divers:0,formation:0,conges:0,absences:0};var e=DB.charge[mid][mk];if(e.divers===undefined)e.divers=0;return e;}
/* ── V8 : moteur de calcul métier centralisé ───────────────────────────────
   Toutes les vues doivent passer par ces fonctions pour éviter qu'une même
   donnée soit calculée différemment selon l'écran.
────────────────────────────────────────────────────────────────────────── */
const DCNCalc={
  n(v){const n=Number(v);return Number.isFinite(n)?n:0;},
  round(v,dec=2){const p=10**dec;return Math.round((this.n(v)+Number.EPSILON)*p)/p;},
  sum(values){return (values||[]).reduce((s,v)=>s+this.n(v),0);},
  missions(item){
    const byMission={};let total=0,count=0;
    (item?.missions||[]).forEach(row=>{
      const amount=this.n(row?.montant);
      if(row?.mission)byMission[row.mission]=(byMission[row.mission]||0)+amount;
      total+=amount;if(amount!==0)count++;
    });
    return {byMission,total:this.round(total),count};
  },
  ca(item){
    const avant=this.n(item?.caAnneesPrecedentes),courant=this.n(item?.caAnneeEnCours),apres=this.n(item?.caAnneesSuivantes);
    const total=this.round(avant+courant+apres);
    const missionTotal=this.missions(item).total;
    return {avant,courant,apres,total,missionTotal,gap:this.round(total-missionTotal)};
  },
  facturation(project){
    const total=this.missions(project).total;
    const facture=this.n(project?.montantFacture);
    const known=!!project && (facture>0 || project.facturationRenseignee===true);
    return {known,facture,total,reste:this.round(total-facture)};
  },
  normalizeForecast(entry){
    const months=new Array(12).fill(0);
    (entry?.months||[]).slice(0,12).forEach((v,i)=>months[i]=this.n(v));
    const before=this.n(entry?.before),after=this.n(entry?.after),yearTotal=this.round(this.sum(months));
    return {before,months,after,yearTotal,grandTotal:this.round(before+yearTotal+after),source:entry?.source||''};
  },
  forecastProgress(entry,configuredYear,now=new Date()){
    const f=this.normalizeForecast(entry);
    const currentYear=now.getFullYear(),currentMonth=now.getMonth(),year=Number(configuredYear)||currentYear;
    let cumulative=0,cutoffLabel='';
    if(year===currentYear){
      cumulative=f.before+this.sum(f.months.slice(0,currentMonth+1));
      cutoffLabel=`fin ${MOIS_L[currentMonth]} ${year}`;
    }else if(year<currentYear){
      cumulative=f.before+f.yearTotal;
      cutoffLabel=`fin ${year}`;
    }else{
      cumulative=f.before;
      cutoffLabel=`avant ${year}`;
    }
    cumulative=Math.min(f.grandTotal,Math.max(0,this.round(cumulative)));
    const remaining=Math.max(0,this.round(f.grandTotal-cumulative));
    const pct=f.grandTotal?Math.round((cumulative/f.grandTotal)*1000)/10:null;
    return {...f,cumulative,remaining,pct,pctDisplay:pct===null?'—':String(pct).replace('.',',')+'%',pctRing:pct===null?0:Math.min(100,Math.max(0,pct)),cutoffLabel};
  }
};
function calcMontantTotal(item){return DCNCalc.missions(item).total;}
function calcResteFacturer(p){return DCNCalc.facturation(p).reste;}
function isProjectFacturationKnown(p){return DCNCalc.facturation(p).known;}
function projectFactureCellHTML(p){
  if(isProjectFacturationKnown(p)) return fmt(Number(p.montantFacture)||0);
  return `<button class="btn btn-outline btn-sm" style="min-width:28px;justify-content:center;font-weight:800;color:var(--orange);padding:2px 8px;" onclick="event.stopPropagation();openFactureModal('${p.id}')" title="Facturation non renseignée — cliquer pour ajouter une facture">?</button>`;
}
function adjustProjectFacturation(projectId,delta,markKnown=true){
  const p=DB.projets.find(x=>x.id===projectId);
  if(!p)return;
  p.montantFacture=Math.max(0,(Number(p.montantFacture)||0)+(Number(delta)||0));
  if(markKnown)p.facturationRenseignee=true;
}
function calcAOPondere(ao){return calcMontantTotal(ao)*(Number(ao.probabilite)||0)/100;}
function calcCAProjet(p){const ca=DCNCalc.ca(p);return {avant:ca.avant,courant:ca.courant,apres:ca.apres};}
function calcCAAnneeEnCours(){return DB.projets.reduce((s,p)=>s+calcCAProjet(p).courant,0);}
function calcCAGlobal(){return DB.projets.reduce((acc,p)=>{const ca=calcCAProjet(p);acc.avant+=ca.avant;acc.courant+=ca.courant;acc.apres+=ca.apres;return acc;},{avant:0,courant:0,apres:0});}
function projectActiveMonthsInYear(p,year=DB.cfg.annee){
  const start=p.dateDebut?new Date(p.dateDebut):null, end=p.dateFin?new Date(p.dateFin):null;
  if(!start||!end||isNaN(start)||isNaN(end)||end<start)return [...Array(12).keys()];
  const yStart=new Date(year,0,1), yEnd=new Date(year,11,31);
  const s=start<yStart?yStart:start, e=end>yEnd?yEnd:end;
  if(e<s)return [];
  const months=[];
  for(let m=s.getMonth(); m<=e.getMonth(); m++)months.push(m);
  return months;
}
function calcProjectMonthlyCA2026(p,year=DB.cfg.annee){
  const total=Number(p.caAnneeEnCours)||0;
  const arr=new Array(12).fill(0);
  if(!total)return arr;
  const months=projectActiveMonthsInYear(p,year);
  const target=(months&&months.length)?months:[...Array(12).keys()];
  const part=total/target.length;
  target.forEach(i=>arr[i]+=part);
  return arr;
}
function calcCAMonthly2026(year=DB.cfg.annee){
  const arr=new Array(12).fill(0);
  DB.projets.filter(p=>['En cours','A venir'].includes(p.statut)).forEach(p=>{
    const entry=(DB.previsionsFacturation||[]).find(x=>x.projectId===p.id);
    const pm=entry ? DCNCalc.normalizeForecast(entry).months : calcProjectMonthlyCA2026(p,year);
    pm.forEach((v,i)=>arr[i]+=DCNCalc.n(v));
  });
  return arr.map(v=>DCNCalc.round(v));
}
function calcCAJanToCurrentMonth(){return calcCAMonthly2026().slice(0,ACTIVE_MONTH+1).reduce((s,v)=>s+v,0);}
function normalizeAmount(v){return DCNCalc.n(v);}
function getCAInputIds(prefix){return {avant:prefix+'CaPrev',courant:prefix+'CaCurrent',apres:prefix+'CaNext',hint:prefix+'CaHint'};}
function getTotalAmountForPrefix(prefix){return calcMontantTotal({missions:prefix==='pr'?collectMissions('prm'):collectMissions('aom')});}
function getCAValuesFromForm(prefix){const ids=getCAInputIds(prefix);return {avant:normalizeAmount(document.getElementById(ids.avant)?.value),courant:normalizeAmount(document.getElementById(ids.courant)?.value),apres:normalizeAmount(document.getElementById(ids.apres)?.value)};}
function updateCAHint(prefix){
  const ids=getCAInputIds(prefix),hint=document.getElementById(ids.hint);
  if(!hint)return;
  const ca=getCAValuesFromForm(prefix),total=getTotalAmountForPrefix(prefix),sum=ca.avant+ca.courant+ca.apres,diff=sum-total;
  const coherent=Math.abs(diff)<=1;
  const pct=total>0?Math.round(ca.courant/total*100):0;
  hint.innerHTML=`<div>Total missions : <strong>${fmt(total)}</strong> &nbsp;|&nbsp; Répartition : <strong>${fmt(sum)}</strong>
    ${!coherent?`<br><span style="color:var(--red);font-weight:600">⚠ Écart : ${fmt(diff)}</span>`:'<br><span style="color:var(--green)">✓ Répartition cohérente</span>'}
    ${total>0?`<br>CA 2026 représente <strong>${pct}%</strong> du total`:''}
  </div>`;
}
function autoSplitCA(prefix){const ids=getCAInputIds(prefix),total=getTotalAmountForPrefix(prefix),current=Math.round(total*0.6),next=Math.max(0,total-current);document.getElementById(ids.avant).value=0;document.getElementById(ids.courant).value=current;document.getElementById(ids.apres).value=next;updateCAHint(prefix);}
function validateBusinessRules({mode,data,total}){const ca=calcCAProjet(data),sum=ca.avant+ca.courant+ca.apres;const msgs=[];if(Math.abs(sum-total)>1)msgs.push(`La somme des 3 CA (${fmt(sum)}) diffère du montant total (${fmt(total)}).`);if(data.dateDebut&&data.dateFin&&new Date(data.dateFin)<new Date(data.dateDebut))msgs.push('La date de fin est antérieure à la date de début.');if(data.statut==='En cours'&&!data.responsable)msgs.push('Un projet en cours doit avoir un responsable.');if(data.statut==='En cours'&&!ca.courant)msgs.push('Un projet en cours devrait avoir un CA année en cours.');if(mode==='ao'&&['Offre déposée','Négociation','Attribution'].includes(data.phase)&&(!data.probabilite||!data.actionAFaire))msgs.push('Une AO avancée devrait avoir une probabilité et une action à faire.');return msgs;}
function auditCalculationConsistency(){
  const issues=[];
  (DB.projets||[]).forEach(p=>{
    const missions=DCNCalc.missions(p),ca=DCNCalc.ca(p),fp=getProjectForecastProgress(p);
    if(Math.abs(ca.total-missions.total)>1)issues.push({type:'CA_MISSIONS',projectId:p.id,code:p.code||'',nom:p.nom||'',ecart:DCNCalc.round(ca.total-missions.total)});
    if(Math.abs(fp.forecastGrandTotal-ca.total)>1)issues.push({type:'PREVISIONS_CA',projectId:p.id,code:p.code||'',nom:p.nom||'',ecart:DCNCalc.round(fp.forecastGrandTotal-ca.total)});
  });
  return issues;
}
window.auditCalculationConsistency=auditCalculationConsistency;
function stampHistory(item,action){item.lastModifiedAt=new Date().toISOString();item.lastAction=action;}
function projectHasInvoices(projectId){return DB.factures.some(f=>f.projetId===projectId);}
function removeProjectFromCharge(projectId){activeMembers().forEach(m=>{Object.values(DB.charge[m.id]||{}).forEach(e=>delete e.projets[projectId]);});}
function ensureProjectInCharge(projectId){activeMembers().forEach(m=>{for(let i=0;i<12;i++)getChargeEntry(m.id,monthKey(i)).projets[projectId]=getChargeEntry(m.id,monthKey(i)).projets[projectId]||0;});}
function ensureAoInCharge(aoId,responsable='',defaultCharge=0){activeMembers().forEach(m=>{for(let i=0;i<12;i++){const e=getChargeEntry(m.id,monthKey(i));if((m.nom===responsable||!responsable) && !e.projets[aoId] && defaultCharge){e.projets[aoId]=defaultCharge;}else{e.projets[aoId]=e.projets[aoId]||0;}}});}
function removeAoFromCharge(aoId){activeMembers().forEach(m=>{Object.values(DB.charge[m.id]||{}).forEach(e=>delete e.projets[aoId]);});}
function activeMembers(){return DB.membres.filter(m=>m.statut==='Actif');}
function getProjectById(id){return DB.projets.find(p=>p.id===id);}
function getAoById(id){return DB.pipelineAO.find(a=>a.id===id);}
function projetsActifsCharge(){return DB.projets.filter(p=>{if(['En cours','A venir','A renseigner'].includes(p.statut))return true;// Soldé/Terminé mais toujours actif en charge
if(['Solde','Termine'].includes(p.statut)&&p.chargeActif===true)return true;return false;});}
function aosActifsCharge(){return DB.pipelineAO.filter(a=>!['Perdu','Attribution'].includes(a.phase));}
function calcChargeProductive(mid,mk){return Object.values(getChargeEntry(mid,mk).projets||{}).reduce((s,v)=>s+normalizePercent(v),0);}
function calcChargeNonProductive(mid,mk){const e=getChargeEntry(mid,mk);return normalizePercent(e.divers||0)+normalizePercent(e.formation)+normalizePercent(e.conges)+normalizePercent(e.absences);}
function calcChargeTotale(mid,mk){return calcChargeProductive(mid,mk)+calcChargeNonProductive(mid,mk);}
function calcDisponibilite(mid,mk){return(getMonthConfig(mk).capaciteReference||100)-calcChargeTotale(mid,mk);}
function getMissionAmounts(item){return DCNCalc.missions(item).byMission;}
function missionCols(item){const m=getMissionAmounts(item);return MISSIONS.map(ms=>m[ms]?`<td class="mc">${fmt(m[ms])}</td>`:`<td class="mc-zero">—</td>`).join('');}
function pillNature(n){return `<span class="pill ${n==='Mission directe'?'pill-direct':'pill-ao'}">${n||'—'}</span>`;}

function badgeStatus(s){
  const m={'En cours':'bg','A venir':'bb','Solde':'bsold','Termine':'bgr','En attente':'bo','A renseigner':'bo','Suspendu':'br',
    'Jamais contacte':'br','A contacter':'bo','Prospect en cours':'bb','Actif':'bg','Dormant':'bac','Sans suite':'bgr',
    'Identification':'bgr','Qualification':'bb','Offre deposee':'bac','Negociation':'bo','Attribution':'bg','Perdu':'br',
    'Haute':'br','Moyenne':'bo','Basse':'bg','Encaissee':'bg','En retard':'br','Emise':'bb'};
  return `<span class="badge ${m[s]||'bgr'}">${s||'—'}</span>`;
}

function calcDashboardKPIs(mk=activeMonthKey()){
  const actifs=DB.projets.filter(p=>['En cours','A venir'].includes(p.statut));
  const projetsAvecCA2026=DB.projets.filter(p=>calcCAProjet(p).courant>0);
  const actifsAvecCA2026=actifs.filter(p=>calcCAProjet(p).courant>0);
  const caProjetsActifsTotal=actifs.reduce((s,p)=>s+calcMontantTotal(p),0);
  const caProjetsActifs2026=actifs.reduce((s,p)=>s+calcCAProjet(p).courant,0);
  const caFacture=DB.projets.reduce((s,p)=>s+DCNCalc.facturation(p).facture,0);
  const resteAFacturer=DB.projets.reduce((s,p)=>s+calcResteFacturer(p),0);
  const caAnneeEnCours=calcCAAnneeEnCours();
  const caGlobal=calcCAGlobal();
  const caJanToCurrent=calcCAJanToCurrentMonth();
  const caRestant2026=Math.max(0,caAnneeEnCours-caJanToCurrent);
  const pipelineUtileAO=DB.pipelineAO.filter(ao=>(Number(ao.probabilite)||0)>=50);
  const pipelineUtile2026=pipelineUtileAO.reduce((s,ao)=>{
    const ca=calcCAProjet(ao);
    const base=ca.courant>0?ca.courant:calcMontantTotal(ao);
    return s+(base*(Number(ao.probabilite)||0)/100);
  },0);
  const topProjects2026=[...actifsAvecCA2026].sort((a,b)=>calcCAProjet(b).courant-calcCAProjet(a).courant).slice(0,5);
  const members=activeMembers();
  let totalCharge=0,totalFormation=0,totalConges=0,totalAbsences=0,surcharge=0,sousCharge=0;
  members.forEach(m=>{
    const e=getChargeEntry(m.id,mk),total=calcChargeTotale(m.id,mk);
    totalCharge+=total;totalFormation+=normalizePercent(e.formation);totalConges+=normalizePercent(e.conges);totalAbsences+=normalizePercent(e.absences);
    if(total>=DB.cfg.seuilChargeHaute)surcharge++;else if(total>0&&total<DB.cfg.seuilChargeBasse)sousCharge++;
  });
  const jamais=DB.commercial.filter(c=>c.statutRelation==='Jamais contacte'||c.jamaisContacte).length;
  const aoChaudes=DB.pipelineAO.filter(ao=>(Number(ao.probabilite)||0)>=50||['Offre deposee','Negociation'].includes(ao.phase)).length;
  const actionsReq=DB.commercial.filter(x=>x.actionFaire==='Appeler'||x.actionFaire==='Relancer').length;
  const alertes=[];
  members.forEach(m=>{
    const t=calcChargeTotale(m.id,mk);
    if(t>=DB.cfg.seuilChargeHaute)alertes.push({niveau:'danger',msg:`${m.nom} surchargé à ${Math.round(t)}%`,lien:'charge'});
    else if(t>0&&t<DB.cfg.seuilChargeBasse)alertes.push({niveau:'warning',msg:`${m.nom} sous-chargé à ${Math.round(t)}%`,lien:'charge'});
  });
  actifs.forEach(p=>{
    const ca=calcCAProjet(p),sum=ca.avant+ca.courant+ca.apres,total=calcMontantTotal(p);
    if(total<=0)alertes.push({niveau:'warning',msg:`${p.nom} sans montant`,lien:'projets'});
    if(Math.abs(sum-total)>1)alertes.push({niveau:'warning',msg:`${p.nom} : répartition CA à corriger`,lien:'projets'});
    if(p.statut==='En cours'&&ca.courant<=0)alertes.push({niveau:'danger',msg:`${p.nom} en cours sans CA 2026`,lien:'projets'});
  });
  DB.pipelineAO.filter(ao=>(Number(ao.probabilite)||0)>=50||['Offre deposee','Negociation'].includes(ao.phase)).forEach(ao=>{
    if(!ao.actionAFaire)alertes.push({niveau:'warning',msg:`${ao.nom} : action commerciale à définir`,lien:'pipeline'});
  });
  DB.commercial.filter(c=>c.jamaisContacte||c.statutRelation==='Jamais contacte').slice(0,2).forEach(c=>alertes.push({niveau:'danger',msg:`${c.agenceDB} jamais contactée`,lien:'commercial'}));
  return {
    financier:{
      caAnneeEnCours,caJanToCurrent,caRestant2026,caFacture,resteAFacturer,
      caAvant:caGlobal.avant,caApres:caGlobal.apres,
      caProjetsActifsTotal,caProjetsActifs2026,pipelineUtile2026
    },
    charge:{chargeMoyenne:members.length?totalCharge/members.length:0,surcharge,sousCharge,formationTotale:totalFormation,congesTotaux:totalConges,absencesTotales:totalAbsences},
    production:{
      nbProjetsEnCours:DB.projets.filter(p=>p.statut==='En cours').length,
      nbSoldes:DB.projets.filter(p=>p.statut==='Solde').length,
      nbProjetsActifs:actifs.length,
      nbProjetsAvecCA2026:projetsAvecCA2026.length,
      nbActifsAvecCA2026:actifsAvecCA2026.length
    },
    commercial:{nbAO:DB.pipelineAO.length,aoChaudes,actionsReq,jamais,nbAOUtiles:pipelineUtileAO.length,
      chargeAO:DB.pipelineAO.reduce((s,a)=>s+(Number(a.chargeEstimee)||0),0),
      chargeAOPonderee:DB.pipelineAO.reduce((s,a)=>s+((Number(a.chargeEstimee)||0)*(Number(a.probabilite)||0)/100),0),
      aoARelancer:DB.pipelineAO.filter(a=>a.dateProchaineAction && new Date(a.dateProchaineAction)<new Date()).length},
    topProjects2026,
    alertes:alertes.slice(0,10)
  };
}

function goPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  const titles={dashboard:"Dashboard",projets:"Projets",previsions:"Prévisions",charge:"Plan de charge",gantt:"Planning Gantt",pipeline:"Pipeline Appels d'offre",devis:"Suivi des devis",etablissement:"Suivi des établissements",commercial:"Suivi commercial",facturation:"Facturation",config:"Configuration"};
  document.getElementById('pgTitle').textContent=titles[id]||id;
  const activeNav=document.querySelector(`.ni[data-page="${id}"]`);
  if(activeNav) activeNav.classList.add('active');
  renderPage(id);
}
function renderPage(id){
  if(id==='dashboard')renderDashboard();
  else if(id==='projets')renderProjectsPage();
  else if(id==='charge')renderChargePage();
  else if(id==='gantt')renderGanttPage();
  else if(id==='pipeline')renderPipelinePage();
  else if(id==='devis')renderDevisPage();
  else if(id==='etablissement')renderEtablissementPage();
  else if(id==='commercial')renderCommercialPage();
  else if(id==='facturation')renderFacturationPage();
  else if(id==='config')renderConfigPage();
  else if(id==='previsions'){if(typeof renderPrevisionsPage==='function')renderPrevisionsPage();}
  initHorizontalDragScroll();
  if(typeof enhanceProjectSheetLinks==='function')setTimeout(enhanceProjectSheetLinks,0);
}

function renderDashboard(){
  const mk=activeMonthKey(),k=calcDashboardKPIs(mk);
  document.getElementById('dashChargeTitle').textContent='Charge & disponibilité — '+monthLabel();
  document.getElementById('chartChargeTitle').textContent='Charge équipe — '+monthLabel();
  document.getElementById('kpiGrid').innerHTML=`
    <div class="kcard ka"><div class="klbl">CA prévisionnel 2026</div><div class="kval">${fmt(k.financier.caAnneeEnCours)}</div><div class="ksub">${k.production.nbProjetsAvecCA2026} projet(s) contributifs</div></div>
    <div class="kcard kg"><div class="klbl">CA Jan → mois en cours</div><div class="kval">${fmt(k.financier.caJanToCurrent)}</div><div class="ksub">Cumul projeté jusqu’à aujourd’hui</div></div>
    <div class="kcard kb"><div class="klbl">CA restant 2026</div><div class="kval">${fmt(k.financier.caRestant2026)}</div><div class="ksub">Solde à produire sur l’année</div></div>
    <div class="kcard kb"><div class="klbl">Projets actifs</div><div class="kval">${k.production.nbProjetsActifs}</div><div class="ksub">En cours + à venir</div></div>
    <div class="kcard kr"><div class="klbl">Pipeline utile 2026</div><div class="kval">${fmt(k.financier.pipelineUtile2026)}</div><div class="ksub">${k.commercial.nbAOUtiles} AO ≥ 50%</div></div>
    <div class="kcard kr"><div class="klbl">Charge équipe</div><div class="kval">${Math.round(k.charge.chargeMoyenne)}%</div><div class="ksub">${k.charge.surcharge} surcharge(s) · ${k.charge.sousCharge} sous-charge(s)</div></div>`;
  document.getElementById('dashboardCAFocus').innerHTML=`
    <div class="kcard"><div class="klbl">CA années précédentes</div><div class="kval">${fmt(k.financier.caAvant)}</div><div class="ksub">Avant 2026</div></div>
    <div class="kcard ka"><div class="klbl">CA année en cours</div><div class="kval">${fmt(k.financier.caAnneeEnCours)}</div><div class="ksub">Prévision totale 2026</div></div>
    <div class="kcard kg"><div class="klbl">CA Jan → mois courant</div><div class="kval">${fmt(k.financier.caJanToCurrent)}</div><div class="ksub">Projection cumulée</div></div>
    <div class="kcard kb"><div class="klbl">CA années suivantes</div><div class="kval">${fmt(k.financier.caApres)}</div><div class="ksub">Après 2026</div></div>`;
  document.getElementById('dashChargeWidget').innerHTML=activeMembers().map(m=>{
    const t=calcChargeTotale(m.id,mk),d=calcDisponibilite(m.id,mk),col=t>=DB.cfg.seuilChargeHaute?'var(--red)':t>0&&t<DB.cfg.seuilChargeBasse?'var(--orange)':'var(--green)';
    return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-size:12px;font-weight:500;">${m.nom}</span><span style="font-size:12px;font-weight:600;color:${col};">${Math.round(t)}% / dispo ${Math.round(d)}%</span></div><div class="pbar"><div class="pfill" style="width:${Math.min(t,100)}%;background:${col};"></div></div></div>`;
  }).join('')+`<div style="margin-top:10px;font-size:11px;color:var(--gray-dk);">Formation ${Math.round(k.charge.formationTotale)}% · Congés ${Math.round(k.charge.congesTotaux)}% · Absences ${Math.round(k.charge.absencesTotales)}%</div>`;
  const ap=document.getElementById('alertsPanel');
  ap.innerHTML=k.alertes.length?k.alertes.map(a=>`<div class="al ${a.niveau==='danger'?'al-r':'al-o'}" onclick="goPage('${a.lien}')" style="cursor:pointer;"><div class="al-dot ${a.niveau==='danger'?'dot-r':'dot-o'}"></div><div class="al-txt"><span class="al-p">${a.msg}</span></div></div>`).join(''):'<div class="empty">Aucune alerte active</div>';
  document.getElementById('topProjectsPanel').innerHTML=`<table><thead><tr><th>Projet</th><th>Statut</th><th>CA 2026</th><th>Resp.</th></tr></thead><tbody>${k.topProjects2026.map(p=>`<tr><td>${p.code||'—'}<br><span style="font-size:11px;color:var(--gray-dk)">${p.nom}</span></td><td>${badgeStatus(p.statut)}</td><td class="amount">${fmt(calcCAProjet(p).courant)}</td><td>${p.responsable||'—'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucun projet contributeur</td></tr>'}</tbody></table>`;
  document.getElementById('dashCommercialWidget').innerHTML=`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">
    <div class="note-box"><div style="font-size:10px;color:var(--gray-dk);text-transform:uppercase;">CA projets actifs</div><div style="font-size:20px;font-weight:700;">${fmt(k.financier.caProjetsActifsTotal)}</div><div style="font-size:11px;color:var(--gray-dk);">${k.production.nbProjetsActifs} actifs</div></div>
    <div class="note-box"><div style="font-size:10px;color:var(--gray-dk);text-transform:uppercase;">CA actifs porté en 2026</div><div style="font-size:20px;font-weight:700;">${fmt(k.financier.caProjetsActifs2026)}</div><div style="font-size:11px;color:var(--gray-dk);">${k.production.nbActifsAvecCA2026} projets</div></div>
    <div class="note-box"><div style="font-size:10px;color:var(--gray-dk);text-transform:uppercase;">AO chaudes / actions urgentes</div><div style="font-size:20px;font-weight:700;">${k.commercial.aoChaudes} / ${k.commercial.actionsReq}</div></div>
    <div class="note-box"><div style="font-size:10px;color:var(--gray-dk);text-transform:uppercase;">Montant facturé / reste</div><div style="font-size:20px;font-weight:700;">${fmt(k.financier.caFacture)}</div><div style="font-size:11px;color:var(--gray-dk);">Reste ${fmt(k.financier.resteAFacturer)}</div></div>
  </div><div style="font-size:11px;color:var(--gray-dk);line-height:1.7;">
  <div>Pipeline utile 2026 pondéré : <strong>${fmt(k.financier.pipelineUtile2026)}</strong></div>
  <div>AO à relancer : <strong>${k.commercial.aoARelancer}</strong> · Charge AO : <strong>${Math.round(k.commercial.chargeAO)}%</strong> · Pondérée : <strong>${Math.round(k.commercial.chargeAOPonderee)}%</strong></div>
  <div>Agences jamais contactées : <strong>${k.commercial.jamais}</strong></div></div>`;
  document.getElementById('chartCASummary').innerHTML=`
    <div class="chart-metric"><div class="lbl">CA 2026</div><div class="val">${fmt(k.financier.caAnneeEnCours)}</div></div>
    <div class="chart-metric"><div class="lbl">Jan → mois courant</div><div class="val">${fmt(k.financier.caJanToCurrent)}</div></div>
    <div class="chart-metric"><div class="lbl">Reste 2026</div><div class="val">${fmt(k.financier.caRestant2026)}</div></div>
    <div class="chart-metric"><div class="lbl">Projets contributeurs</div><div class="val">${k.production.nbProjetsAvecCA2026}</div></div>`;
  document.getElementById('chartChargeSummary').innerHTML=`
    <div class="chart-metric"><div class="lbl">Charge moyenne</div><div class="val">${Math.round(k.charge.chargeMoyenne)}%</div></div>
    <div class="chart-metric"><div class="lbl">Surcharge / sous-charge</div><div class="val">${k.charge.surcharge} / ${k.charge.sousCharge}</div></div>
    <div class="chart-metric"><div class="lbl">Formation</div><div class="val">${Math.round(k.charge.formationTotale)}%</div></div>
    <div class="chart-metric"><div class="lbl">Congés + abs.</div><div class="val">${Math.round(k.charge.congesTotaux+k.charge.absencesTotales)}%</div></div>`;
  const phases=['Identification','Qualification','Offre deposee','Negociation','Attribution','Perdu'];
  document.getElementById('chartPipelineSummary').innerHTML=phases.map(ph=>`<div class="chart-metric"><div class="lbl">${ph}</div><div class="val">${DB.pipelineAO.filter(a=>a.phase===ph).length}</div></div>`).join('');
  const commercialStatuses=['Jamais contacte','Dormant','Prospect en cours','Actif'];
  document.getElementById('chartCommercialSummary').innerHTML=commercialStatuses.map(st=>`<div class="chart-metric"><div class="lbl">${st}</div><div class="val">${DB.commercial.filter(c=>c.statutRelation===st).length}</div></div>`).join('');
  renderDashboardCharts(k,mk);
}

function destroyChart(k){if(DASH_CHARTS[k]){DASH_CHARTS[k].destroy();DASH_CHARTS[k]=null;}}
function formatK(n){if(n===null||n===undefined||isNaN(Number(n)))return '—';const v=Number(n);if(Math.abs(v)>=1000000)return (v/1000000).toLocaleString('fr-FR',{maximumFractionDigits:1})+' M€';if(Math.abs(v)>=1000)return (v/1000).toLocaleString('fr-FR',{maximumFractionDigits:0})+' k€';return v.toLocaleString('fr-FR')+' €';}
function upsertChart(key,canvasId,config){const c=document.getElementById(canvasId);if(!c||typeof Chart==='undefined')return;destroyChart(key);DASH_CHARTS[key]=new Chart(c.getContext('2d'),config);}
function renderDashboardCharts(k,mk){
  const ml=activeMembers().map(m=>m.nom),mc=activeMembers().map(m=>Math.round(calcChargeTotale(m.id,mk)));
  upsertChart('charge','chartCharge',{type:'bar',data:{labels:ml,datasets:[{label:'Charge %',data:mc,backgroundColor:mc.map(v=>v>=DB.cfg.seuilChargeHaute?'rgba(231,76,60,.75)':v>0&&v<DB.cfg.seuilChargeBasse?'rgba(243,156,18,.75)':'rgba(39,174,96,.75)'),borderWidth:0,maxBarThickness:22}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,max:120}}}});
  const phases=['Identification','Qualification','Offre deposee','Negociation','Attribution','Perdu'];
  upsertChart('pipeline','chartPipeline',{type:'bar',data:{labels:phases,datasets:[{label:'AO',data:phases.map(ph=>DB.pipelineAO.filter(a=>a.phase===ph).length),backgroundColor:'rgba(74,123,175,.8)',borderWidth:0,maxBarThickness:48}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,stepSize:1}}}}});
  const caData=calcCAMonthly2026();
  upsertChart('ca','chartCA',{type:'bar',data:{labels:MOIS,datasets:[{label:'CA mensuel projeté',data:caData,backgroundColor:MOIS.map((_,i)=>i===ACTIVE_MONTH?'rgba(232,160,32,.85)':'rgba(45,89,134,.75)'),borderWidth:0,maxBarThickness:36}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>formatK(ctx.parsed.y)}}},scales:{y:{beginAtZero:true,ticks:{callback:(value)=>formatK(value)}},x:{ticks:{maxRotation:0,minRotation:0}}}}});
  const statuses=['Jamais contacte','Dormant','Prospect en cours','Actif','Sans suite'];
  upsertChart('commercial','chartCommercial',{type:'doughnut',data:{labels:statuses,datasets:[{data:statuses.map(st=>DB.commercial.filter(c=>c.statutRelation===st).length),backgroundColor:['#E74C3C','#F39C12','#4A7BAF','#27AE60','#BDC3C7'],borderWidth:0,radius:'78%'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
}


function buildProjectsMissionDashboard(projs,pipe){
  const host=document.getElementById('projectsMissionDashboard');
  if(!host)return;
  const labels={
    'BIM Management':'BIM Manager',
    'BIM Coordination':'BIM Coordination',
    'Synthese Technique':'Synth. Tech.',
    'Synthese Architecturale':'Synth. Archi.',
    'Modelisation':'Modélisation',
    'Suivi AO':'Suivi AO'
  };
  const icons={
    'BIM Management':'BM',
    'BIM Coordination':'BC',
    'Synthese Technique':'ST',
    'Synthese Architecturale':'SA',
    'Modelisation':'3D',
    'Suivi AO':'AO'
  };
  const classMap={
    'BIM Management':'mc-bim-management',
    'BIM Coordination':'mc-bim-coordination',
    'Synthese Technique':'mc-synthese-technique',
    'Synthese Architecturale':'mc-synthese-architecturale',
    'Modelisation':'mc-modelisation',
    'Suivi AO':'mc-suivi-ao'
  };
  const missionStats=MISSIONS.map(ms=>{
    let nbProjets=0, nbMissions=0, montant=0;
    projs.forEach(p=>{
      const rows=(p.missions||[]).filter(x=>x.mission===ms && Number(x.montant||0)!==0);
      if(rows.length){
        nbProjets++;
        nbMissions+=rows.length;
        montant+=rows.reduce((s,x)=>s+(Number(x.montant)||0),0);
      }
    });
    return {mission:ms,label:labels[ms]||ms,nbProjets,nbMissions,montant};
  });
  const totalMontant=projs.reduce((s,p)=>s+calcMontantTotal(p),0);
  const totalMissionRows=projs.reduce((s,p)=>s+((p.missions||[]).filter(x=>Number(x.montant||0)!==0).length),0);
  const nonZero=missionStats.filter(x=>x.montant>0);
  const top=nonZero.length?[...nonZero].sort((a,b)=>b.montant-a.montant)[0]:null;
  const aoSource=Array.isArray(pipe)?pipe:(DB.pipelineAO||[]);
  const aoPotentiel=aoSource.reduce((s,a)=>s+calcMontantTotal(a),0);
  const aoPondere=aoSource.reduce((s,a)=>s+calcAOPondere(a),0);
  const aoActifs=aoSource.filter(a=>!['Perdu','Attribution'].includes(a.phase)).length;
  const aoDeposes=aoSource.filter(a=>['Offre deposee','Negociation','Attribution','Perdu'].includes(a.phase)).length;
  const aoGagnes=aoSource.filter(a=>a.phase==='Attribution').length;
  const tauxTransfo=aoDeposes>0?Math.round(aoGagnes/aoDeposes*100):0;
  const pctPipeline=aoPotentiel>0?Math.round(aoPondere/aoPotentiel*100):0;
  const cards=missionStats.map(stat=>{
    if(stat.mission==='Suivi AO'){
      return `<div class="kcard mission-card mc-suivi-ao">
        <div class="mission-icon">AO</div>
        <div class="klbl">Suivi commercial</div>
        <div class="kval">${aoSource.length}</div>
        <div class="mission-sub">AO concernés · ${aoActifs} en cours</div>
        <div class="mission-share" style="margin-top:6px;font-weight:800;color:#A16207;">${aoDeposes} déposé(s) · ${aoGagnes} gagné(s)</div>
        <div style="height:1px;background:rgba(202,138,4,.22);margin:8px 0;"></div>
        <div class="mission-amount">${fmt(aoPondere)}</div>
        <div class="mission-share" style="font-weight:800;text-transform:uppercase;letter-spacing:.7px;">CA pondéré</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin:8px -18px 0;border-top:1px solid rgba(202,138,4,.2);border-bottom:1px solid rgba(202,138,4,.2);">
          <div style="padding:8px 18px;border-right:1px solid rgba(202,138,4,.2);"><div style="font-weight:800;font-size:15px;color:var(--navy);">${fmt(aoPotentiel)}</div><div class="mission-share" style="font-weight:800;text-transform:uppercase;">CA potentiel</div></div>
          <div style="padding:8px 18px;"><div style="font-weight:800;font-size:15px;color:var(--navy);">${tauxTransfo}%</div><div class="mission-share" style="font-weight:800;text-transform:uppercase;">Transfo.</div></div>
        </div>
        <div class="mission-meta"><span class="mission-share">${pctPipeline}% du pipeline sécurisé</span><span class="mission-pill">Actif</span></div>
      </div>`;
    }
    const pct=totalMontant>0?Math.round(stat.montant/totalMontant*100):0;
    return `<div class="kcard mission-card ${classMap[stat.mission]||'kb'}">
      <div class="mission-icon">${icons[stat.mission]||'•'}</div>
      <div class="klbl">${stat.label}</div>
      <div class="kval">${stat.nbProjets}</div>
      <div class="mission-sub">${stat.nbProjets<=1?'projet concerné':'projets concernés'} · ${stat.nbMissions} ligne(s)</div>
      <div class="mission-amount">${fmt(stat.montant)}</div>
      <div class="mission-meta"><span class="mission-share">${pct}% du portefeuille affiché</span><span class="mission-pill">${stat.montant>0?'Actif':'0 €'}</span></div>
    </div>`;
  }).join('');
  const summary=`<div class="kcard mission-card mc-summary">
    <div class="mission-icon">Σ</div>
    <div class="klbl">Synthèse missions</div>
    <div class="kval">${totalMissionRows}</div>
    <div class="mission-sub">lignes de mission sur ${projs.length} projet(s) affiché(s)</div>
    <div class="mission-amount">${fmt(totalMontant)}</div>
    <div class="mission-meta"><span class="mission-share">${top?`Mission dominante : <strong>${top.label}</strong>`:'Aucune mission chiffrée'}</span><span class="mission-pill">${top?fmt(top.montant):'—'}</span></div>
  </div>`;
  host.innerHTML=cards+summary;
}

function getProjectStatusDefs(projs){
  return [
    {key:'En cours',label:'En cours',cls:'psc-actifs',items:projs.filter(p=>p.statut==='En cours'),hint:'Projets actifs en production'},
    {key:'A venir',label:'À venir',cls:'psc-avenir',items:projs.filter(p=>p.statut==='A venir'),hint:'Démarrage à venir'},
    {key:'Solde',label:'Soldé',cls:'psc-solde',items:projs.filter(p=>p.statut==='Solde'),hint:'Facturation soldée'},
    {key:'Termine',label:'Terminé',cls:'psc-termine',items:projs.filter(p=>p.statut==='Termine'),hint:'Projets clôturés'},
    {key:'En attente',label:'En attente',cls:'psc-attente',items:projs.filter(p=>p.statut==='En attente'),hint:'Décision ou reprise attendue'},
    {key:'A renseigner',label:'À renseigner',cls:'psc-renseigner',items:projs.filter(p=>p.statut==='A renseigner'),hint:'Informations à compléter'},
    {key:'Suspendu',label:'Suspendu',cls:'psc-suspendu',items:projs.filter(p=>p.statut==='Suspendu'),hint:'Projet suspendu'},
    {key:'tous',label:'Tous les projets',cls:'psc-tous',items:projs,hint:'Portefeuille complet'}
  ];
}

function buildProjectStatusDashboard(projs){
  const host=document.getElementById('projectStatusDashboard');
  if(!host)return;
  const activePill=document.querySelector('#statFilterBar .stat-pill.active');
  const active=activePill?activePill.dataset.stat:'En cours';
  host.innerHTML=getProjectStatusDefs(projs).map(d=>{
    const total=d.items.reduce((sum,p)=>sum+calcMontantTotal(p),0);
    const ca2026=d.items.reduce((sum,p)=>sum+calcCAProjet(p).courant,0);
    const activeCls=d.key===active?' active':'';
    return '<div class="kcard project-status-card '+d.cls+activeCls+'" onclick="setProjectStatusFromSelect(\''+d.key+'\')" title="Filtrer : '+d.label+'">'
      +'<div class="klbl">'+d.label+'</div>'
      +'<div class="kval">'+d.items.length+'</div>'
      +'<div class="ksub">'+(d.items.length<=1?'projet':'projets')+' · '+d.hint+'</div>'
      +'<div class="mission-amount">'+fmt(total)+'</div>'
      +'<div class="status-mini">CA 2026 : '+fmt(ca2026)+'</div>'
      +'</div>';
  }).join('');
}

function renderProjectsPage(){
  // Detect active stat filter
  const activePill=document.querySelector('#statFilterBar .stat-pill.active');
  const statFilter=activePill?activePill.dataset.stat:'En cours';

  const search=(document.getElementById('srchProj').value||'').toLowerCase();
  const statSel=document.getElementById('filtStatutProj');
  if(statSel && statSel.value!==statFilter) statSel.value=statFilter;
  const resp=document.getElementById('filtRespProj').value;
  const agency=document.getElementById('filtAgenceProj').value;
  const rSel=document.getElementById('filtRespProj'),rc=rSel.value;
  rSel.innerHTML='<option value="">Tous responsables</option>'+DB.membres.map(m=>`<option ${m.nom===rc?'selected':''}>${m.nom}</option>`).join('');
  const agSel=document.getElementById('filtAgenceProj'),ac=agSel.value;
  const ags=[...new Set([...DB.projets,...DB.pipelineAO].map(x=>x.agenceDB).filter(Boolean))];
  agSel.innerHTML='<option value="">Toutes agences</option>'+ags.map(a=>`<option ${a===ac?'selected':''}>${a}</option>`).join('');

  let projs=DB.projets;
  let pipe=DB.pipelineAO;

  if(search){
    projs=projs.filter(p=>[p.nom,p.code||'',p.client||'',p.agenceDB||'',p.devis||''].join(' ').toLowerCase().includes(search));
    pipe=pipe.filter(a=>[a.nom,a.client||'',a.agenceDB||'',a.devis||''].join(' ').toLowerCase().includes(search));
  }
  if(resp){projs=projs.filter(p=>p.responsable===resp);pipe=pipe.filter(a=>a.responsable===resp);}
  if(agency){projs=projs.filter(p=>p.agenceDB===agency);pipe=pipe.filter(a=>a.agenceDB===agency);}

  const projsForStatusCards=projs.slice();
  if(statFilter==='tous') projs=projs;
  else projs=projs.filter(p=>p.statut===statFilter);

  const statusCounts=getProjectStatusDefs(DB.projets).reduce((acc,d)=>{acc[d.key]=d.items.length;return acc;},{});
  document.getElementById('projectCount').textContent=`${projs.length} affichés — ${statusCounts['En cours']||0} en cours · ${statusCounts['A venir']||0} à venir · ${statusCounts['Solde']||0} soldé(s) · ${statusCounts['Termine']||0} terminé(s) · ${statusCounts['En attente']||0} en attente · ${statusCounts['A renseigner']||0} à renseigner · ${statusCounts['Suspendu']||0} suspendu(s)`;
  buildProjectStatusDashboard(projsForStatusCards);
  buildProjectsMissionDashboard(projs,pipe);
  document.getElementById('tbProjects').innerHTML=projs.length?projs.map(p=>{
    const ma=getMissionAmounts(p),tot=calcMontantTotal(p),ca=calcCAProjet(p),fp=getProjectForecastProgress(p),pct=fp.pct;
    const pctDisplay=fp.pctDisplay;
    const pctBar=pct===null?0:Math.min(100,Math.max(0,pct));
    const contact=[p.contactPrenom,p.contactNom].filter(Boolean).join(' ')||'—';
    const statBg={Solde:'#EDE9FE','Termine':'#F0F3F5'}[p.statut]||'';
    return `<tr style="${statBg?'background:'+statBg+';opacity:.85;':''}cursor:pointer;" onclick="openProjectSheet('${p.id}')" title="Cliquer pour ouvrir la fiche">
      <td><div style="font-weight:600;font-size:12px;">${p.code||'—'}</div><div style="font-size:11px;color:var(--gray-dk);max-width:155px;">${p.nom}</div></td>
      <td style="font-size:11px;font-family:monospace;color:var(--blue);white-space:nowrap;">${p.devis||'—'}</td>
      <td>${pillNature(p.nature)}</td><td style="font-size:11px;">${p.client||'—'}</td><td style="font-size:11px;max-width:160px;">${p.agenceDB||'—'}</td>
      ${MISSIONS.map(ms=>ma[ms]?`<td class="mc">${fmt(ma[ms])}</td>`:`<td class="mc-zero">—</td>`).join('')}
      <td class="mc-total">${fmt(tot)}</td>
      <td class="amount" style="font-size:11px;color:var(--gray-dk);">${fmt(ca.avant)}</td>
      <td class="amount" style="font-size:11px;font-weight:600;">${fmt(ca.courant)}</td>
      <td class="amount" style="font-size:11px;color:var(--gray-dk);">${fmt(ca.apres)}</td>
      <td class="amount" style="font-size:11px;">${projectFactureCellHTML(p)}</td>
      <td style="text-align:right;font-size:11px;" title="${pct===null?'Prévisions à renseigner':'Cumul prévisionnel à '+fp.forecastCutoffLabel+' / prévisions totales'}">${pctDisplay}<div class="pbar" style="width:48px;margin-top:2px;"><div class="pfill" style="width:${pctBar}%;"></div></div></td>
      <td>${p.responsable||'—'}${dcnActeursBadge(p)}</td><td>${badgeStatus(p.statut)}</td>
      <td style="font-size:11px;color:var(--gray-dk);">${contact}</td>
      <td style="text-align:center;">${dcnAlerteBadge(p,'projet')}</td>
      <td><div style="display:flex;gap:4px;"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editProject('${p.id}')">Édit.</button><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteProject('${p.id}')">×</button></div></td>
    </tr>`;
  }).join(''):'<tr><td colspan="20" class="empty">Aucun projet</td></tr>';
  document.getElementById('tbProjectsPipeline').innerHTML=pipe.length?pipe.map(a=>`<tr><td>${a.nom}</td><td style="font-size:11px;font-family:monospace;color:var(--blue);white-space:nowrap;">${a.devis||'—'}</td><td>${pillNature(a.nature)}</td><td>${a.client||'—'}</td><td>${a.agenceDB||'—'}</td><td>${badgeStatus(a.phase)}</td><td>${Number(a.probabilite)||0}%</td><td class="amount">${fmt(calcMontantTotal(a))}</td><td class="amount">${fmt(calcAOPondere(a))}</td><td>${a.actionAFaire||'—'}</td><td>${a.responsable||'—'}</td></tr>`).join(''):'<tr><td colspan="11" class="empty">Aucune AO</td></tr>';
  document.getElementById('pipelineInlineCount').textContent=pipe.length+' AO';
}

function toggleStatFilter(el){
  document.querySelectorAll('#statFilterBar .stat-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  const statSel=document.getElementById('filtStatutProj');
  if(statSel) statSel.value=el.dataset.stat;
  renderProjectsPage();
}
function setProjectStatusFromSelect(value){
  const pills=document.querySelectorAll('#statFilterBar .stat-pill');
  const exists=[...pills].some(p=>p.dataset.stat===value);
  const finalValue=exists?value:'En cours';
  pills.forEach(p=>p.classList.toggle('active',p.dataset.stat===finalValue));
  const statSel=document.getElementById('filtStatutProj');
  if(statSel) statSel.value=finalValue;
  renderProjectsPage();
}


function renderMonthParams(){
  let html='<table><thead><tr><th>Mois</th><th>Jours ouvrés</th><th>Capacité ref.</th></tr></thead><tbody>';
  for(let i=0;i<12;i++){const mk=monthKey(i),c=getMonthConfig(mk);html+=`<tr><td>${MOIS_L[i]}</td><td><input class="input-mini" type="number" value="${c.joursOuvres}" onchange="updateMonthParam('${mk}','joursOuvres',this.value)"></td><td><input class="input-mini" type="number" value="${c.capaciteReference}" onchange="updateMonthParam('${mk}','capaciteReference',this.value)"></td></tr>`;}
  html+='</tbody></table>';document.getElementById('monthParamsWrap').innerHTML=html;
}
function updateMonthParam(mk,key,val){getMonthConfig(mk)[key]=Number(val)||0;saveDB();renderChargePage();}
function inputClass(v){return v>=DB.cfg.seuilChargeHaute?'high':v>=DB.cfg.seuilChargeBasse&&v>0?'ok':v>0?'low':'';}

function getChargeInputClass(v){
  const n=Number(v)||0;
  if(!n) return 'charge-zero';
  if(n>=70) return 'charge-high';
  if(n>=35) return 'charge-medium';
  return 'charge-low';
}
let CHARGE_VIEW='standard';
function setChargeView(v){
  CHARGE_VIEW=v;
  const btnS=document.getElementById('btnViewStd'),btnC=document.getElementById('btnViewCpt');
  if(btnS){btnS.style.background=v==='standard'?'var(--blue)':'transparent';btnS.style.color=v==='standard'?'#fff':'#6D28D9';}
  if(btnC){btnC.style.background=v==='compact'?'#6D28D9':'transparent';btnC.style.color=v==='compact'?'#fff':'#6D28D9';}
  renderChargePage();
}
function renderChargePage(){
  renderMonthParams();
  if(CHARGE_VIEW==='compact'){renderChargePageCompact();return;}
  const actifs=projetsActifsCharge(); const aos=aosActifsCharge();
  let html=`<table class="ct-table"><thead><tr><th class="col-name">Projet / ligne</th>${MOIS.map((m,i)=>`<th class="${i===ACTIVE_MONTH?'col-now':''}">${m}</th>`).join('')}</tr></thead><tbody>`;
  activeMembers().forEach(m=>{
    html+=`<tr class="section-row"><td colspan="13">${m.nom.toUpperCase()} <span class="member-role">${m.role||'Collaborateur'}</span></td></tr>`;
    actifs.forEach(p=>{
      const hasAny=Object.values(DB.charge[m.id]||{}).some(e=>(e.projets||{})[p.id]>0);
      if(!hasAny&&p.statut==='A renseigner')return;
      const isSolde=['Solde','Termine'].includes(p.statut)&&p.chargeActif===true;
      const rowStyle=isSolde?'background:#F5F3FF;':'';
      const soldeBadge=isSolde?`<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;font-size:9px;font-weight:700;background:#EDE9FE;color:#5B21B6;vertical-align:middle;">FACT. TERMIN\u00C9E</span>`:'';
      html+=`<tr class="data-row" style="${rowStyle}"><td class="col-name line-indent project-sheet-link" data-project-id="${p.id}" onclick="openProjectSheet('${p.id}')" title="Cliquer pour ouvrir la fiche" style="${rowStyle}">${p.code?`<span style="color:var(--gray-dk);font-size:10px;">${p.code}</span> — `:''}${p.nom.length>38?p.nom.slice(0,36)+'\u2026':p.nom}${soldeBadge}</td>`;
      for(let i=0;i<12;i++){
        const mk=monthKey(i),e=getChargeEntry(m.id,mk),v=Number(e.projets[p.id])||0;
        html+=`<td class="${i===ACTIVE_MONTH?'col-now':''}" style="${isSolde&&i!==ACTIVE_MONTH?'background:#F5F3FF;':''}"><input class="input-mini ${getChargeInputClass(v)}" value="${v||''}" data-col="${i}" data-mid="${m.id}" data-mk="${mk}" data-pid="${p.id}" oninput="setChargeProjet(this)"></td>`;
      }
      html+='</tr>';
    });
    // AO : la vue standard doit afficher le même périmètre que la vue compacte.
    // On affiche donc tous les AO actifs pour chaque collaborateur, sans filtrage par responsable
    // ni par charge déjà saisie, afin de pouvoir saisir la charge directement dans la grille standard.
    const aoResp=aos;
    if(aoResp.length){
      html+=`<tr><td class="col-name" style="font-weight:700;color:var(--accent-dark);padding-left:10px;background:#FFFBEB;">Appels d'offres</td>${MOIS.map(()=>'<td style="background:#FFFBEB;"></td>').join('')}</tr>`;
      aoResp.forEach(a=>{
        html+=`<tr class="data-row" style="background:#FFFBEB;"><td class="col-name line-indent project-sheet-link" data-project-id="${a.id}" onclick="openProjectSheet('${a.id}')" title="Cliquer pour ouvrir la fiche AO" style="background:#FFFBEB;color:var(--accent-dark);font-style:italic;cursor:pointer;">[AO] ${a.nom.length>38?a.nom.slice(0,36)+'\u2026':a.nom}</td>`;
        for(let i=0;i<12;i++){
          const mk=monthKey(i),e=getChargeEntry(m.id,mk),v=Number(e.projets[a.id])||0;
          html+=`<td class="${i===ACTIVE_MONTH?'col-now':''}" style="background:${i===ACTIVE_MONTH?'var(--month-now)':'#FFFBEB'};"><input class="input-mini ${getChargeInputClass(v)}" value="${v||''}" data-col="${i}" data-mid="${m.id}" data-mk="${mk}" data-pid="${a.id}" oninput="setChargeProjet(this)"></td>`;
        }
        html+='</tr>';
      });
    }
    ['divers','formation','conges','absences'].forEach(key=>{
      const lbl={divers:'Divers',formation:'Formation',conges:'Cong\u00E9s',absences:'Absences'}[key];
      html+=`<tr class="meta-row ${key} data-row"><td class="col-name line-indent">${lbl}</td>`;
      for(let i=0;i<12;i++){
        const mk=monthKey(i),v=Number(getChargeEntry(m.id,mk)[key])||0;
        html+=`<td class="${i===ACTIVE_MONTH?'col-now':''}"><input class="input-mini ${getChargeInputClass(v)}" value="${v||''}" data-col="${i}" data-mid="${m.id}" data-mk="${mk}" data-meta="${key}" oninput="setChargeMeta(this)"></td>`;
      }
      html+='</tr>';
    });
    html+=`<tr class="total-row calc-row"><td class="col-name line-indent">Total occup\u00E9</td>`;
    for(let i=0;i<12;i++){
      const mk=monthKey(i),t=Math.round(calcChargeTotale(m.id,mk));
      html+=`<td id="ct-${m.id}-${mk}" class="${i===ACTIVE_MONTH?'col-now':''} ${t>100?'calc-over':''}">${t}%</td>`;
    }
    html+='</tr><tr class="total-row calc-row"><td class="col-name line-indent">Disponible</td>';
    for(let i=0;i<12;i++){
      const mk=monthKey(i),d=Math.round(calcDisponibilite(m.id,mk));
      html+=`<td id="cd-${m.id}-${mk}" class="${i===ACTIVE_MONTH?'col-now':''} ${d<0?'calc-over':'calc-under'}">${d}%</td>`;
    }
    html+='</tr>';
  });
  html+='</tbody></table>';
  document.getElementById('chargeWrap').innerHTML=html;
  bindGridNavigation('#chargeWrap input');
  if(typeof enhanceProjectSheetLinks==='function')enhanceProjectSheetLinks();
}

function renderChargePageCompact(){
  const members=activeMembers();
  const actifs=projetsActifsCharge();
  const aos=aosActifsCharge();
  const allItems=[...actifs.map(p=>({type:'projet',...p})),...aos.map(a=>({type:'ao',...a}))];
  const monthBorders=['#BFDBFE','#BBF7D0','#FED7AA','#DDD6FE','#FECDD3','#CCFBF1','#FEF08A','#BFDBFE','#BBF7D0','#FED7AA','#DDD6FE','#FECDD3'];
  let thMonths=`<th class="col-name" rowspan="2" style="position:sticky;left:0;z-index:4;background:var(--navy);min-width:220px;text-align:left;">Projet</th>`;
  MOIS.forEach((m,i)=>{thMonths+=`<th colspan="${members.length}" style="text-align:center;border-left:2px solid rgba(255,255,255,.15);background:${i===ACTIVE_MONTH?'var(--blue)':'var(--navy)'};">${m}</th>`;});
  let thMembers='';
  MOIS.forEach((m,i)=>{members.forEach((mbr,mi)=>{thMembers+=`<th style="font-size:9px;text-align:center;padding:4px 3px;${mi===0?'border-left:2px solid rgba(255,255,255,.15);':''}background:${i===ACTIVE_MONTH?'rgba(45,89,134,.9)':'rgba(26,46,68,.85)'};">${mbr.nom.split(' ')[0].slice(0,6)}</th>`;});});
  let html=`<table class="ct-table"><thead><tr>${thMonths}</tr><tr>${thMembers}</tr></thead><tbody>`;
  allItems.forEach(item=>{
    const isAo=item.type==='ao';
    const isSolde=!isAo&&['Solde','Termine'].includes(item.statut)&&item.chargeActif===true;
    const rowBg=isSolde?'#F5F3FF':isAo?'#FFFBEB':'';
    const nameStyle=isSolde?'color:#5B21B6;':isAo?'color:var(--accent-dark);font-style:italic;':'';
    const soldeBadge=isSolde?`<span style="margin-left:4px;padding:1px 4px;border-radius:6px;font-size:8px;font-weight:700;background:#EDE9FE;color:#5B21B6;">FACT. TERMIN\u00C9E</span>`:'';
    const prefix=isAo?'[AO] ':'';
    const label=`${item.code?`<span style="font-size:9px;color:var(--gray-dk);">${item.code}</span> `:''}${prefix}${item.nom.length>32?item.nom.slice(0,30)+'\u2026':item.nom}${soldeBadge}`;
    html+=`<tr style="${rowBg?'background:'+rowBg+';':''}"><td class="col-name project-sheet-link" data-project-id="${item.id}" onclick="openProjectSheet('${item.id}')" style="position:sticky;left:0;z-index:2;box-shadow:1px 0 0 #EAEEF2;${rowBg?'background:'+rowBg+';':'background:#FAFBFC;'}${nameStyle}font-size:11px;padding:3px 8px;cursor:pointer;" title="Cliquer pour ouvrir la fiche ${isAo?'AO':'projet'}">${label}</td>`;
    for(let i=0;i<12;i++){
      const mk=monthKey(i);
      members.forEach((mbr,mi)=>{
        const e=getChargeEntry(mbr.id,mk);
        const v=Number((e.projets||{})[item.id])||0;
        const cellBg=i===ACTIVE_MONTH?'var(--month-now)':isSolde?'#F5F3FF':isAo?'#FFFBEB':'';
        const borderL=mi===0?'border-left:2px solid '+(i===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[i])+';':'';
        html+=`<td style="padding:2px;${cellBg?'background:'+cellBg+';':''}${borderL}"><input class="input-mini ${getChargeInputClass(v)}" value="${v||''}" data-col="${i}" data-mid="${mbr.id}" data-mk="${mk}" data-pid="${item.id}" oninput="setChargeProjet(this)" style="width:44px;font-size:10px;"></td>`;
      });
    }
    html+='</tr>';
  });
  html+=`<tr><td class="col-name" colspan="${1+members.length*12}" style="background:var(--navy);color:#fff;font-size:10px;font-weight:700;padding:6px 10px;text-transform:uppercase;letter-spacing:.5px;">Charges non productives & totaux</td></tr>`;
  ['divers','formation','conges','absences'].forEach(key=>{
    const lbl={divers:'Divers',formation:'Formation',conges:'Cong\u00E9s',absences:'Absences'}[key];
    const lblColor={divers:'#7C3AED',formation:'var(--blue)',conges:'var(--orange)',absences:'var(--red)'}[key];
    html+=`<tr><td class="col-name" style="position:sticky;left:0;z-index:2;background:#FAFBFC;box-shadow:1px 0 0 #EAEEF2;font-weight:600;color:${lblColor};font-size:11px;padding:3px 8px;">${lbl}</td>`;
    for(let i=0;i<12;i++){
      const mk=monthKey(i);
      members.forEach((mbr,mi)=>{
        const v=Number(getChargeEntry(mbr.id,mk)[key])||0;
        const cellBg=i===ACTIVE_MONTH?'var(--month-now)':'';
        const borderL=mi===0?'border-left:2px solid '+(i===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[i])+';':'';
        html+=`<td style="padding:2px;${cellBg?'background:'+cellBg+';':''}${borderL}"><input class="input-mini ${getChargeInputClass(v)}" value="${v||''}" data-col="${i}" data-mid="${mbr.id}" data-mk="${mk}" data-meta="${key}" oninput="setChargeMeta(this)" style="width:44px;font-size:10px;"></td>`;
      });
    }
    html+='</tr>';
  });
  html+=`<tr style="background:#E8EEF5;"><td class="col-name" style="position:sticky;left:0;z-index:2;background:#E8EEF5;box-shadow:1px 0 0 #EAEEF2;font-weight:700;font-size:11px;padding:4px 8px;">TOTAL OCCUP\u00C9</td>`;
  for(let i=0;i<12;i++){
    const mk=monthKey(i);
    members.forEach((mbr,mi)=>{
      const t=Math.round(calcChargeTotale(mbr.id,mk));
      const borderL=mi===0?'border-left:2px solid '+(i===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[i])+';':'';
      html+=`<td id="ct-${mbr.id}-${mk}-cpt" style="text-align:center;font-weight:700;font-size:11px;padding:4px 2px;${i===ACTIVE_MONTH?'background:var(--month-now);':'background:#E8EEF5;'}${borderL}${t>100?'color:var(--red);':'color:var(--green);'}">${t}%</td>`;
    });
  }
  html+=`</tr><tr style="background:#F0F3F6;"><td class="col-name" style="position:sticky;left:0;z-index:2;background:#F0F3F6;box-shadow:1px 0 0 #EAEEF2;font-weight:700;font-size:11px;padding:4px 8px;">DISPONIBLE</td>`;
  for(let i=0;i<12;i++){
    const mk=monthKey(i);
    members.forEach((mbr,mi)=>{
      const d=Math.round(calcDisponibilite(mbr.id,mk));
      const borderL=mi===0?'border-left:2px solid '+(i===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[i])+';':'';
      html+=`<td id="cd-${mbr.id}-${mk}-cpt" style="text-align:center;font-weight:700;font-size:11px;padding:4px 2px;${i===ACTIVE_MONTH?'background:var(--month-now);':'background:#F0F3F6;'}${borderL}${d<0?'color:var(--red);':'color:#1A7A42;'}">${d}%</td>`;
    });
  }
  html+='</tr></tbody></table>';
  document.getElementById('chargeWrap').innerHTML=html;
  bindGridNavigation('#chargeWrap input');
}


function refreshCalcCells(mid){
  for(let i=0;i<12;i++){
    const mk=monthKey(i),t=Math.round(calcChargeTotale(mid,mk)),d=Math.round(calcDisponibilite(mid,mk));
    // Standard view
    const tc=document.getElementById(`ct-${mid}-${mk}`),dc=document.getElementById(`cd-${mid}-${mk}`);
    if(tc){tc.textContent=t+'%';tc.classList.toggle('calc-over',t>100);}
    if(dc){dc.textContent=d+'%';dc.classList.toggle('calc-over',d<0);dc.classList.toggle('calc-under',d>=0);}
    // Compact view
    const tcc=document.getElementById(`ct-${mid}-${mk}-cpt`),dcc=document.getElementById(`cd-${mid}-${mk}-cpt`);
    if(tcc){tcc.textContent=t+'%';tcc.style.color=t>100?'var(--red)':'var(--green)';}
    if(dcc){dcc.textContent=d+'%';dcc.style.color=d<0?'var(--red)':'#1A7A42';}
  }
}
function setChargeProjet(el){const mid=el.dataset.mid,mk=el.dataset.mk,pid=el.dataset.pid,v=normalizePercent(el.value);getChargeEntry(mid,mk).projets[pid]=v;el.className='input-mini '+getChargeInputClass(v);saveDB();refreshCalcCells(mid);}
function setChargeMeta(el){const mid=el.dataset.mid,mk=el.dataset.mk,key=el.dataset.meta,v=normalizePercent(el.value);getChargeEntry(mid,mk)[key]=v;el.className='input-mini '+getChargeInputClass(v);saveDB();refreshCalcCells(mid);}

function setGanttMode(mode,el){
  GANTT_MODE=mode;
  const collabTab=document.getElementById('ganttTabCollab');
  const projectTab=document.getElementById('ganttTabProject');
  if(collabTab) collabTab.classList.toggle('active',mode==='collab');
  if(projectTab) projectTab.classList.toggle('active',mode==='project');
  renderGanttPage();
}


function ganttSoftPalette(index){
  const palette=[
    {dark:'#1A3A5C',mid:'#2D5986',fill:'#E8F0F8',text:'#0A1E30'},
    {dark:'#1A5C35',mid:'#27AE60',fill:'#E3F5EC',text:'#0A2E1A'},
    {dark:'#4A1A6C',mid:'#8E44AD',fill:'#F0E8F8',text:'#2A0A3C'},
    {dark:'#7A3A0A',mid:'#D4720A',fill:'#FAF0E0',text:'#4A2000'},
    {dark:'#2A5C4A',mid:'#1D8A6A',fill:'#E0F5EE',text:'#0A2E20'},
    {dark:'#5C1A1A',mid:'#C0392B',fill:'#FAE8E8',text:'#3A0A0A'},
    {dark:'#1A4A5C',mid:'#2980B9',fill:'#E0EEF8',text:'#0A2030'},
    {dark:'#3A3A1A',mid:'#7D6608',fill:'#F5F0D8',text:'#201E00'},
    {dark:'#5C2A1A',mid:'#D35400',fill:'#FAF0E8',text:'#3A1400'},
    {dark:'#1A1A5C',mid:'#8E44AD',fill:'#EEE8F8',text:'#0A0A2E'},
    {dark:'#2A4A1A',mid:'#1ABC9C',fill:'#E0F8F0',text:'#0A2A10'},
    {dark:'#4A3A1A',mid:'#B7950B',fill:'#F8F0D8',text:'#2A2000'},
  ];
  return palette[index % palette.length];
}

function renderGanttCollaborateur(){
  // Palette par position — s'adapte automatiquement à tout nouveau collaborateur
  const PALETTE=[
    {dark:'#1A3A5C',mid:'#2D5986',light:'#E8F0F8',text:'#0A1E30'},
    {dark:'#1A5C35',mid:'#27AE60',light:'#E3F5EC',text:'#0A2E1A'},
    {dark:'#4A1A6C',mid:'#8E44AD',light:'#F0E8F8',text:'#2A0A3C'},
    {dark:'#7A3A0A',mid:'#D4720A',light:'#FAF0E0',text:'#4A2000'},
    {dark:'#2A5C4A',mid:'#1D8A6A',light:'#E0F5EE',text:'#0A2E20'},
    {dark:'#5C1A1A',mid:'#C0392B',light:'#FAE8E8',text:'#3A0A0A'},
    {dark:'#1A4A5C',mid:'#2980B9',light:'#E0EEF8',text:'#0A2030'},
    {dark:'#3A3A1A',mid:'#7D6608',light:'#F5F0D8',text:'#201E00'},
  ];
  const members=activeMembers();
  let html=`<table class="ct-table"><thead><tr><th class="col-name">Projet</th>${MOIS.map((m,i)=>`<th class="${i===ACTIVE_MONTH?'col-now':''}">${m}</th>`).join('')}</tr></thead><tbody>`;
  members.forEach((m,mi)=>{
    const pal=PALETTE[mi%PALETTE.length];
    // Bandeau collaborateur avec sa couleur
    html+=`<tr><td colspan="13" style="background:${pal.dark};color:#fff;font-weight:700;font-size:12px;letter-spacing:.7px;padding:8px 14px;border-top:3px solid #fff;">${m.nom.toUpperCase()} <span style="color:rgba(255,255,255,.7);font-weight:500;font-size:11px;margin-left:6px;">${m.role||'Collaborateur'}</span></td></tr>`;
    const pM=DB.projets.filter(p=>p.responsable===m.nom&&(!['Solde','Termine'].includes(p.statut)||p.chargeActif===true));
    const aM=DB.pipelineAO.filter(a=>a.responsable===m.nom&&!['Perdu','Attribution'].includes(a.phase));
    if(!pM.length&&!aM.length){
      html+=`<tr><td class="col-name" style="color:var(--gray-mid);font-style:italic;padding-left:24px;background:${pal.light};">Aucun projet actif</td>${MOIS.map(()=>`<td style="background:${pal.light};"></td>`).join('')}</tr>`;
      return;
    }
    // Projets
    pM.forEach(p=>{
      html+=`<tr class="gantt-row"><td class="col-name line-indent project-sheet-link" data-project-id="${p.id}" onclick="openProjectSheet('${p.id}')" title="Cliquer pour ouvrir la fiche" style="background:${pal.light};border-left:3px solid ${pal.mid};color:${pal.dark};font-weight:500;cursor:pointer;">${p.code?`<span style="font-size:10px;color:${pal.dark};opacity:.7;">${p.code}</span> `:''}${p.nom.length>36?p.nom.slice(0,34)+'…':p.nom}</td>`;
      for(let i=0;i<12;i++){
        const mk=monthKey(i),v=Number(getChargeEntry(m.id,mk).projets[p.id])||0,isNow=i===ACTIVE_MONTH;
        const cellBg=isNow?'#EBF4FF':pal.light;
        if(v>0){
          const r=parseInt(pal.mid.slice(1,3),16),g=parseInt(pal.mid.slice(3,5),16),b=parseInt(pal.mid.slice(5,7),16);
          const alpha=Math.min(0.25+v/100*0.45,0.70);
          html+=`<td style="padding:3px 4px;background:${cellBg};"><div class="gantt-bar" style="background:rgba(${r},${g},${b},${alpha});box-shadow:none;"><span style="color:${pal.text};font-weight:700;">${v}%</span></div></td>`;
        } else {
          html+=`<td style="background:${cellBg};"></td>`;
        }
      }
      html+='</tr>';
    });
    // AO — teinte légèrement plus chaude mais dans la même logique de couleur
    aM.forEach(a=>{
      html+=`<tr class="gantt-row"><td class="col-name line-indent project-sheet-link" data-project-id="${a.id}" onclick="openProjectSheet('${a.id}')" title="Cliquer pour ouvrir la fiche AO" style="background:${pal.light};border-left:3px dashed ${pal.mid};color:${pal.dark};font-style:italic;font-weight:500;cursor:pointer;">[AO] ${a.nom.length>34?a.nom.slice(0,32)+'…':a.nom}</td>`;
      for(let i=0;i<12;i++){
        const mk=monthKey(i),v=Number(getChargeEntry(m.id,mk).projets[a.id])||0,isNow=i===ACTIVE_MONTH;
        const cellBg=isNow?'#EBF4FF':pal.light;
        if(v>0){
          const r=parseInt(pal.mid.slice(1,3),16),g=parseInt(pal.mid.slice(3,5),16),b=parseInt(pal.mid.slice(5,7),16);
          const alpha=Math.min(0.18+v/100*0.35,0.55);
          html+=`<td style="padding:3px 4px;background:${cellBg};"><div class="gantt-bar" style="background:rgba(${r},${g},${b},${alpha});box-shadow:none;border:1px dashed ${pal.mid};"><span style="color:${pal.text};font-weight:700;">${v}%</span></div></td>`;
        } else {
          html+=`<td style="background:${cellBg};"></td>`;
        }
      }
      html+='</tr>';
    });
  });
  document.getElementById('ganttTitle').textContent='Planning Gantt 2026 — par collaborateur';
  document.getElementById('ganttWrap').innerHTML=html+'</tbody></table>';
}

function renderGanttProjet(){
  const forecastMap={};
  (DB.previsionsFacturation||[]).forEach(pf=>{forecastMap[pf.projectId]=pf;});
  const visibleProjects=DB.projets
    .filter(p=>!['Solde','Termine'].includes(p.statut)||p.chargeActif===true)
    .map(p=>{
      const pf=forecastMap[p.id];
      const months=(pf&&Array.isArray(pf.months)?pf.months:[]).map(v=>Number(v)||0);
      let start=-1,end=-1;
      months.forEach((v,i)=>{if(v>0){if(start===-1) start=i; end=i;}});
      return {project:p, forecast:pf, months, start, end};
    })
    .sort((a,b)=>{
      const av=a.start===-1?99:a.start, bv=b.start===-1?99:b.start;
      if(av!==bv) return av-bv;
      const as=(a.project.statut||''), bs=(b.project.statut||'');
      if(as!==bs) return as.localeCompare(bs,'fr');
      return (a.project.nom||'').localeCompare(b.project.nom||'','fr');
    });

  let html=`<table class="ct-table"><thead><tr><th class="col-name">Projet</th>${MOIS.map((m,i)=>`<th class="${i===ACTIVE_MONTH?'col-now':''}">${m}</th>`).join('')}</tr></thead><tbody>`;
  if(!visibleProjects.length){
    html+=`<tr><td class="col-name" style="color:var(--gray-mid);font-style:italic;padding-left:20px;">Aucun projet à afficher</td>${MOIS.map(()=>'<td></td>').join('')}</tr>`;
  } else {
    visibleProjects.forEach(({project,months,start,end},idx)=>{
      const soft=ganttSoftPalette(idx);
      const isFuture=project.statut==='A venir';
      const isUnclear=project.statut==='A renseigner';
      const barColor=isUnclear?'#CBD5E1':soft.mid;
      const rowFill=isUnclear?'#F8FAFC':soft.fill;
      const borderColor=isUnclear?'#94A3B8':soft.dark;
      const textColor=isUnclear?'#64748B':soft.text;
      const rowLabel=`${project.code?`<span style="font-size:10px;color:${soft.dark};opacity:.75;">${project.code}</span> `:''}${project.nom.length>42?project.nom.slice(0,40)+'…':project.nom}`;
      html+=`<tr class="gantt-row"><td class="col-name line-indent project-sheet-link" data-project-id="${project.id}" onclick="openProjectSheet('${project.id}')" title="Cliquer pour ouvrir la fiche" style="background:${rowFill};border-left:3px solid ${borderColor};color:${soft.dark};font-weight:500;cursor:pointer;">${rowLabel}</td>`;
      for(let i=0;i<12;i++){
        const isNow=i===ACTIVE_MONTH;
        if(start!==-1 && i>=start && i<=end){
          const v=months[i]||0;
          const r=parseInt(barColor.slice(1,3),16),g=parseInt(barColor.slice(3,5),16),b=parseInt(barColor.slice(5,7),16);
          const alpha=v>0?Math.min(0.25+v/12000*8,0.70):0.22;
          const label=v>0?fmt(v).replace(/\s?€$/,''):'';
          const cellBg=isNow?'#EBF4FF':rowFill;
          html+=`<td style="padding:3px 4px;background:${cellBg};"><div class="gantt-bar" style="background:rgba(${r},${g},${b},${alpha});box-shadow:none;"><span style="color:${textColor};font-weight:700;">${label}</span></div></td>`;
        } else if(start===-1){
          html+=`<td style="background:${isNow?'#EBF4FF':rowFill};"></td>`;
        } else {
          html+=`<td style="background:${isNow?'#EBF4FF':rowFill};"></td>`;
        }
      }
      html+='</tr>';
    });
  }
  document.getElementById('ganttTitle').textContent='Planning Gantt 2026 — par projet (selon facturation prévue)';
  document.getElementById('ganttWrap').innerHTML=html+'</tbody></table>';
}

function renderGanttPage(){
  if(GANTT_MODE==='project') renderGanttProjet();
  else renderGanttCollaborateur();
}

function switchTab(page,tab,el){
  document.querySelectorAll(`#page-${page} .tab`).forEach(t=>t.classList.remove('active'));
  document.querySelectorAll(`#page-${page} .tpanel`).forEach(p=>p.classList.remove('active'));
  el.classList.add('active');document.getElementById('tpanel-'+tab).classList.add('active');
  if(page==='pipeline'){
    if(tab==='dashboard-ao')renderAODashboard();
    else renderPipelinePage();
  }
}

function renderAODashboard(){
  const list=DB.pipelineAO;
  if(!list.length){document.getElementById('ao-dashboard-content').innerHTML='<div class="empty">Aucun appel d&#39;offre</div>';return;}

  const total=list.length;
  const pond=list.reduce((s,a)=>s+calcAOPondere(a),0);
  const tot=list.reduce((s,a)=>s+calcMontantTotal(a),0);
  const directes=list.filter(a=>a.nature==='Mission directe').length;
  const aideao=list.filter(a=>a.nature!=='Mission directe').length;
  const actionsReq=list.filter(a=>a.actionAFaire&&a.dateProchaineAction).length;
  const chauds=list.filter(a=>a.probabilite>=60).length;

  // Répartition par phase
  const phases=['Identification','Qualification',"Offre déposée",'Négociation','Attribution','Perdu'];
  const phaseCounts=phases.map(ph=>list.filter(a=>a.phase===ph).length);
  const phaseColors=['#BDC3C7','#4A7BAF','#E8A020','#F39C12','#27AE60','#E74C3C'];

  // Répartition par responsable
  const byResp={};
  list.forEach(a=>{const r=a.responsable||'N/A';if(!byResp[r])byResp[r]={count:0,pond:0,tot:0};byResp[r].count++;byResp[r].pond+=calcAOPondere(a);byResp[r].tot+=calcMontantTotal(a);});
  const respPalette=['#2D5986','#27AE60','#8E44AD','#E8A020','#1ABC9C','#C0392B','#7F8C8D'];
  const respColor=(name)=>{let h=0;for(const ch of String(name||''))h=(h*31+ch.charCodeAt(0))>>>0;return respPalette[h%respPalette.length];};

  // Top AO par montant pondéré
  const top5=[...list].filter(a=>calcMontantTotal(a)>0).sort((a,b)=>calcAOPondere(b)-calcAOPondere(a)).slice(0,5);

  // Actions urgentes (date proche)
  const today=new Date();
  const urgents=list.filter(a=>a.dateProchaineAction&&new Date(a.dateProchaineAction)<=new Date(today.getTime()+14*86400000)).sort((a,b)=>new Date(a.dateProchaineAction)-new Date(b.dateProchaineAction)).slice(0,6);

  const PHASE_BG={"Offre déposée":'#FEF4E5',"Négociation":'#FEF4E5','Attribution':'#E8F8EF','Qualification':'#EBF2FA','Identification':'#F0F3F5','Perdu':'#FDEAEA'};
  const PHASE_FG={"Offre déposée":'#995B0A',"Négociation":'#854F0B','Attribution':'#1A7A42','Qualification':'#1A4E8A','Identification':'#5A6770','Perdu':'#9A1B1B'};

  let html=`<div style="padding:16px;">`;

  // KPIs row
  html+=`<div class="kgrid" style="grid-template-columns:repeat(6,1fr);margin-bottom:16px;">
    <div class="kcard kb"><div class="klbl">Total AO</div><div class="kval">${total}</div></div>
    <div class="kcard ka"><div class="klbl">Montant total</div><div class="kval" style="font-size:16px;">${formatK(tot)}</div></div>
    <div class="kcard kg"><div class="klbl">CA pondéré</div><div class="kval" style="font-size:16px;">${formatK(pond)}</div><div class="ksub">Proba × montant</div></div>
    <div class="kcard" style="border-left:3px solid #8E44AD;"><div class="klbl">AO chaudes (≥60%)</div><div class="kval">${chauds}</div></div>
    <div class="kcard" style="border-left:3px solid #2D5986;"><div class="klbl">Mission directe</div><div class="kval">${directes}</div></div>
    <div class="kcard" style="border-left:3px solid #E8A020;"><div class="klbl">Aide à l'AO</div><div class="kval">${aideao}</div></div>
  </div>`;

  html+=`<div class="g2" style="margin-bottom:16px;">`;

  // Phase funnel
  html+=`<div class="card"><div class="ch"><span class="ct">Entonnoir par phase</span><span style="font-size:11px;color:var(--gray-dk);">${total} AO · ${formatK(pond)} pondéré</span></div><div class="cb">`;
  phases.forEach((ph,i)=>{
    const cnt=phaseCounts[i];if(!cnt)return;
    const pct=Math.round(cnt/total*100);
    const pAO=list.filter(a=>a.phase===ph);
    const pPond=pAO.reduce((s,a)=>s+calcAOPondere(a),0);
    html+=`<div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
        <span style="font-size:12px;font-weight:500;color:${phaseColors[i]};">${ph}</span>
        <span style="font-size:11px;color:var(--gray-dk);">${cnt} AO · ${formatK(pPond)}</span>
      </div>
      <div style="height:20px;background:#F0F3F6;border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${phaseColors[i]};border-radius:4px;display:flex;align-items:center;padding-left:6px;">
          <span style="font-size:10px;color:#fff;font-weight:600;">${pct}%</span>
        </div>
      </div>
    </div>`;
  });
  html+=`</div></div>`;

  // Par responsable
  html+=`<div class="card"><div class="ch"><span class="ct">Répartition par responsable</span></div><div class="cb">`;
  Object.entries(byResp).sort((a,b)=>b[1].pond-a[1].pond).forEach(([resp,d])=>{
    const col=respColor(resp);
    html+=`<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;color:${col};">${resp}</span>
        <span style="font-size:11px;color:var(--gray-dk);">${d.count} AO · pondéré: <strong>${formatK(d.pond)}</strong></span>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;background:#F0F3F6;border-radius:4px;height:8px;overflow:hidden;margin-top:6px;">
          <div style="height:100%;background:${col};width:${tot>0?Math.round(d.tot/tot*100):0}%;border-radius:4px;"></div>
        </div>
        <span style="font-size:10px;color:var(--gray-dk);white-space:nowrap;">${tot>0?Math.round(d.tot/tot*100):0}% du total</span>
      </div>
    </div>`;
  });
  html+=`</div></div></div>`;

  html+=`<div class="g2">`;

  // Top 5 AO
  html+=`<div class="card"><div class="ch"><span class="ct">Top 5 AO — CA pondéré</span></div><div class="cb" style="padding:0;">
    <table><thead><tr><th>Opportunité</th><th>Phase</th><th>Proba</th><th>Total</th><th>Pondéré</th><th>Resp.</th></tr></thead><tbody>
    ${top5.map(a=>`<tr>
      <td style="font-weight:500;max-width:180px;font-size:11px;">${a.nom}</td>
      <td><span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500;background:${PHASE_BG[a.phase]||'#F0F3F5'};color:${PHASE_FG[a.phase]||'#5A6770'};">${a.phase}</span></td>
      <td style="text-align:center;font-weight:600;color:${a.probabilite>=70?'var(--green)':a.probabilite>=50?'var(--orange)':'var(--gray-dk)'};">${a.probabilite}%</td>
      <td class="amount" style="font-size:11px;">${fmt(calcMontantTotal(a))}</td>
      <td class="amount" style="font-weight:700;color:var(--accent-dark);">${fmt(calcAOPondere(a))}</td>
      <td style="font-size:11px;">${a.responsable||'—'}</td>
    </tr>`).join('')}
    </tbody></table>
  </div></div>`;

  // Actions urgentes
  html+=`<div class="card"><div class="ch"><span class="ct">Actions à faire — 14 prochains jours</span><span style="font-size:11px;color:var(--gray-dk);">${urgents.length} actions</span></div><div class="cb" style="padding:0;">`;
  if(urgents.length){
    html+=`<table><thead><tr><th>Opportunité</th><th>Action</th><th>Date</th><th>Resp.</th></tr></thead><tbody>`;
    urgents.forEach(a=>{
      const d=new Date(a.dateProchaineAction);
      const diff=Math.round((d-today)/86400000);
      const urgent=diff<=3;
      html+=`<tr>
        <td style="font-size:11px;font-weight:500;max-width:160px;">${a.nom}</td>
        <td style="font-size:11px;">${a.actionAFaire||'—'}</td>
        <td style="text-align:center;"><span style="font-size:11px;font-weight:600;color:${urgent?'var(--red)':'var(--orange)'};">${fmtD(a.dateProchaineAction)}</span><br><span style="font-size:9px;color:var(--gray-dk);">${diff<=0?'En retard':diff+'j'}</span></td>
        <td style="font-size:11px;">${a.responsable||'—'}</td>
      </tr>`;
    });
    html+='</tbody></table>';
  }else{
    html+='<div class="empty">Aucune action urgente</div>';
  }
  html+=`</div></div></div></div>`;

  document.getElementById('ao-dashboard-content').innerHTML=html;
}

function renderPipelinePage(){
  // Also refresh dashboard tab if visible
  const dashPanel=document.getElementById('tpanel-dashboard-ao');
  if(dashPanel&&dashPanel.classList.contains('active'))renderAODashboard();
  const search=(document.getElementById('srchAo').value||'').toLowerCase();
  const phase=document.getElementById('filtAoPhase').value;
  const nature=document.getElementById('filtAoNature').value;
  let list=DB.pipelineAO;
  if(search)list=list.filter(a=>[a.nom,a.client||'',a.agenceDB||''].join(' ').toLowerCase().includes(search));
  if(phase)list=list.filter(a=>a.phase===phase);
  if(nature)list=list.filter(a=>a.nature===nature);
  const phases=['Identification','Qualification','Offre deposee','Negociation','Attribution'];
  document.getElementById('kanban').innerHTML=phases.map(ph=>{
    const items=list.filter(a=>a.phase===ph);
    return `<div class="kcol"><div class="kcolh">${ph}<span class="kcount">${items.length}</span></div>
      ${items.map(a=>`<div class="kcard2 project-sheet-link" onclick="openProjectSheet('${a.id}')" title="Cliquer pour ouvrir la fiche AO">
        <div class="kcard-name">${a.nom}</div>
        <div class="kcard-client">${a.client||'—'} · ${a.agenceDB||'—'}</div>
        <div style="margin-top:5px;">${pillNature(a.nature)}</div>
        <div class="kcard-amount">${fmt(calcMontantTotal(a))} · ${a.probabilite||0}%</div>
        <div style="margin-top:3px;font-size:10px;color:var(--gray-dk);">CA 2026 pot. ${fmt(Number(a.caAnneeEnCours)||0)} · Charge ${Number(a.chargeEstimee)||0}%</div>
        <div style="margin-top:3px;font-size:10px;color:var(--gray-dk);">${a.actionAFaire||''}${a.dateProchaineAction?` · ${fmtD(a.dateProchaineAction)}`:''}</div>
        <div style="margin-top:6px;display:flex;gap:4px;">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openProjectSheet('${a.id}')">Fiche</button>
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editAo('${a.id}')">Edit.</button>
        </div>
      </div>`).join('')||'<div class="empty" style="padding:12px 0;">—</div>'}
    </div>`;
  }).join('');
  document.getElementById('tbAO').innerHTML=list.length?list.map(a=>`<tr style="cursor:pointer;" onclick="openProjectSheet('${a.id}')" title="Cliquer pour ouvrir la fiche AO">
    <td style="font-weight:500;max-width:160px;">${a.nom}</td><td style="font-size:11px;font-family:monospace;color:var(--blue);white-space:nowrap;">${a.devis||'—'}</td><td>${pillNature(a.nature)}</td>
    <td>${a.client||'—'}</td><td>${a.agenceDB||'—'}</td>
    ${missionCols(a)}
    <td class="amount">${fmt(calcMontantTotal(a))}</td><td style="text-align:center;">${a.probabilite||0}%</td>
    <td class="amount">${fmt(calcAOPondere(a))}</td><td class="amount">${fmt(Number(a.caAnneeEnCours)||0)}</td>
    <td style="text-align:center;">${Number(a.chargeEstimee)||0}%</td><td>${badgeStatus(a.phase)}</td>
    <td style="font-size:11px;">${a.actionAFaire||'—'}</td><td>${fmtD(a.dateProchaineAction)}</td>
    <td><div style="display:flex;gap:4px;">
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openProjectSheet('${a.id}')">Fiche</button>
      <button class="btn btn-accent btn-sm" onclick="event.stopPropagation();transformAo('${a.id}')">Projet</button>
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editAo('${a.id}')">Edit.</button>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteAo('${a.id}')">x</button>
    </div></td>
  </tr>`).join(''):'<tr><td colspan="15" class="empty">Aucune AO</td></tr>';
}

function esc(s){return String(s??'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c;});}
function escAttr(s){return esc(s).replace(/'/g,'&#39;');}

// ─────────────────────────────────────────────────────────────
// Suivi Établissement
// ─────────────────────────────────────────────────────────────
function etabKey(v){return String(v||'Non renseigné').trim()||'Non renseigné';}
function etabMissionTotal(x){return calcMontantTotal(x);}
function etabExtractYear(x){
  const raw=String(x.dateDevis||x.dateDebut||x.lastModifiedAt||'');
  const m=raw.match(/(20\d{2})/);
  if(m)return Number(m[1]);
  const d=String(x.devis||x.code||'').match(/20(2[4-6])|202(4|5|6)/);
  if(d){const y=(d[0].length===4)?Number(d[0]):Number('20'+d[1]); if(y)return y;}
  return 2026;
}
function etabEmptyMetric(name){return {name,ca2024:0,ca2025:0,ca2026:0,projects2024:0,projects2025:0,projects2026:0,ao:0,aoPotential:0,responsables:{},commercial:null,statut:'Jamais travaillé'};}
function etabAddResp(m,r){if(r)m.responsables[r]=(m.responsables[r]||0)+1;}
function calcEtablissementMetrics(){
  const map={};
  (DB.commercial||[]).forEach(c=>{const k=etabKey(c.agenceDB); if(!map[k])map[k]=etabEmptyMetric(k); map[k].commercial=c;});
  (DB.projets||[]).forEach(p=>{
    const k=etabKey(p.agenceDB); if(!map[k])map[k]=etabEmptyMetric(k); const m=map[k];
    const y=etabExtractYear(p); const ca=calcCAProjet(p),caPrev=ca.avant,ca2026=ca.courant;
    if(y<=2024){m.ca2024+=caPrev; if(caPrev>0)m.projects2024++;}
    else if(y===2025){m.ca2025+=caPrev; if(caPrev>0)m.projects2025++;}
    else { if(caPrev>0){m.ca2025+=caPrev;m.projects2025++;} }
    m.ca2026+=ca2026; if(ca2026>0 || ['En cours','A venir','A renseigner','En attente'].includes(p.statut))m.projects2026++;
    etabAddResp(m,p.responsable);
  });
  (DB.pipelineAO||[]).forEach(a=>{
    const k=etabKey(a.agenceDB); if(!map[k])map[k]=etabEmptyMetric(k); const m=map[k];
    m.ao+=1; m.aoPotential+=etabMissionTotal(a)*(Number(a.probabilite)||0)/100; etabAddResp(m,a.responsable);
  });
  return Object.values(map).map(m=>{
    const totalProjects=m.projects2024+m.projects2025+m.projects2026;
    const caTotal=m.ca2024+m.ca2025+m.ca2026;
    const resp=Object.entries(m.responsables).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
    let statut='Jamais travaillé';
    if(m.projects2026>0||m.ca2026>0)statut='Actif';
    else if((m.projects2024+m.projects2025)>0||m.ca2024+m.ca2025>0)statut='À relancer';
    else if(m.ao>0)statut='Prospect';
    if(m.commercial){
      const sr=m.commercial.statutRelation;
      if(sr==='Dormant')statut='Dormant';
      if(sr==='Jamais contacte' && totalProjects===0 && m.ao===0)statut='Jamais travaillé';
      if(sr==='Prospect en cours' && totalProjects===0)statut='Prospect';
      if(sr==='Actif' && (totalProjects>0||m.ao>0))statut='Actif';
    }
    return {...m,totalProjects,caTotal,resp,statut,ev:(m.ca2025?((m.ca2026-m.ca2025)/m.ca2025*100):null)};
  });
}
function selectedEtabAmount(m,year){if(year==='2024')return m.ca2024;if(year==='2025')return m.ca2025;if(year==='2026')return m.ca2026;return m.caTotal;}
function selectedEtabProjects(m,year){if(year==='2024')return m.projects2024;if(year==='2025')return m.projects2025;if(year==='2026')return m.projects2026;return m.totalProjects;}
function etabStatusClass(st){return st==='Actif'?'active':st==='À relancer'?'relance':st==='Dormant'?'dormant':st==='Prospect'?'prospect':'never';}
function initEtablissementFilters(metrics){
  const respSel=document.getElementById('etabResp');
  if(respSel && !respSel.dataset.ready){
    const reps=[...new Set(metrics.map(m=>m.resp).filter(r=>r&&r!=='—'))].sort();
    respSel.innerHTML='<option value="">Tous</option>'+reps.map(r=>`<option>${r}</option>`).join('');
    respSel.dataset.ready='1';
  }
  const agSel=document.getElementById('etabAgence');
  if(agSel && !agSel.dataset.ready){
    const ags=[...new Set(metrics.map(m=>m.name).filter(Boolean))].sort();
    agSel.innerHTML='<option value="">Toutes</option>'+ags.map(a=>`<option>${esc(a)}</option>`).join('');
    agSel.dataset.ready='1';
  }
}
function renderEtablissementPage(){
  let metrics=calcEtablissementMetrics(); initEtablissementFilters(metrics);
  const year=document.getElementById('etabYear')?.value||'2026';
  const resp=document.getElementById('etabResp')?.value||'';
  const agence=document.getElementById('etabAgence')?.value||'';
  const stat=document.getElementById('etabStatus')?.value||'';
  let filtered=metrics.filter(m=>(!resp||m.resp===resp)&&(!agence||m.name===agence)&&(!stat||m.statut===stat));
  const totalCA=filtered.reduce((s,m)=>s+selectedEtabAmount(m,year),0);
  const active=filtered.filter(m=>selectedEtabProjects(m,year)>0 || selectedEtabAmount(m,year)>0).length;
  const noProject=filtered.filter(m=>m.totalProjects===0).length;
  const top=[...filtered].sort((a,b)=>selectedEtabAmount(b,year)-selectedEtabAmount(a,year))[0];
  const prev=filtered.reduce((s,m)=>s+(year==='2026'?m.ca2025:year==='2025'?m.ca2024:0),0);
  const evol=(year==='2026'||year==='2025')&&prev?((totalCA-prev)/prev*100):null;
  document.getElementById('etabKpis').innerHTML=`
    <div class="kcard kb etab-kpi-card"><div class="etab-kpi-icon">🏢</div><div class="etab-kpi-content"><div class="klbl">Établissements actifs ${year==='all'?'':year}</div><div class="kval">${active}</div><div class="ksub">Sur ${filtered.length} établissements suivis</div></div></div>
    <div class="kcard ka etab-kpi-card"><div class="etab-kpi-icon">💶</div><div class="etab-kpi-content"><div class="klbl">CA total ${year==='all'?'global':year}</div><div class="kval">${fmt(totalCA)}</div><div class="ksub">Projets rattachés aux établissements</div></div></div>
    <div class="kcard kb etab-kpi-card"><div class="etab-kpi-icon">📊</div><div class="etab-kpi-content"><div class="klbl">CA total 2025</div><div class="kval">${fmt(filtered.reduce((s,m)=>s+m.ca2025,0))}</div><div class="ksub">Tous établissements affichés</div></div></div>
    <div class="kcard kg etab-kpi-card"><div class="etab-kpi-icon">📈</div><div class="etab-kpi-content"><div class="klbl">Évolution 2025 → 2026</div><div class="kval" style="color:${evol!==null&&evol<0?'var(--red)':'var(--navy)'}">${evol===null?'—':(evol>0?'+ ':'')+evol.toFixed(1).replace('.',',')+' %'}</div><div class="ksub">Comparaison avec l’année précédente</div></div></div>
    <div class="kcard kr etab-kpi-card"><div class="etab-kpi-icon">🚫</div><div class="etab-kpi-content"><div class="klbl">Établissements sans projet</div><div class="kval">${noProject}</div><div class="ksub">Aucun projet historique</div></div></div>`;
  const topAmount=top?selectedEtabAmount(top,year):0;
  const topProjects=top?selectedEtabProjects(top,year):0;
  const topPrev=top?(year==='2026'?top.ca2025:year==='2025'?top.ca2024:0):0;
  const topEvol=(top && (year==='2026'||year==='2025') && topPrev)?((topAmount-topPrev)/topPrev*100):null;
  const topShare=totalCA?topAmount/totalCA*100:0;
  const topCard=document.getElementById('etabTopCard');
  if(topCard){
    topCard.innerHTML=top?`
      <div class="etab-top-premium">
        <div class="etab-top-left">
          <div class="etab-top-trophy">🏆</div>
          <div>
            <div class="etab-top-label">Top établissement</div>
            <div class="etab-top-name">${esc(top.name)}</div>
            <div class="etab-top-badge">💎 Meilleure performance ${year==='all'?'globale':year}</div>
          </div>
        </div>
        <div class="etab-top-right">
          <div class="etab-top-main"><div class="lbl">💰 Chiffre d'affaires</div><div class="val">${fmt(topAmount)}</div><div class="sub">${topShare.toFixed(1).replace('.',',')} % du CA affiché</div></div>
          <div class="etab-top-mini"><div class="lbl">📁 Projets</div><div class="val">${topProjects}</div><div class="sub">Projet(s) rattaché(s)</div></div>
          <div class="etab-top-mini ${topEvol!==null?(topEvol>=0?'positive':'negative'):''}"><div class="lbl">📈 Évolution</div><div class="val">${topEvol===null?'—':(topEvol>0?'+':'')+topEvol.toFixed(1).replace('.',',')+' %'}</div><div class="sub">vs année précédente</div></div>
        </div>
      </div>`:'<div class="etab-top-premium"><div class="etab-top-left"><div class="etab-top-trophy">🏆</div><div><div class="etab-top-label">Top établissement</div><div class="etab-top-name">Aucun établissement trouvé</div></div></div></div>';
  }
  document.getElementById('etabBarTitle').textContent='CA par établissement ('+(year==='all'?'toutes années':year)+')';
  const topBar=[...filtered].sort((a,b)=>selectedEtabAmount(b,year)-selectedEtabAmount(a,year)).slice(0,8);
  const topLineBase=[...filtered].filter(m=>m.ca2024||m.ca2025||m.ca2026).sort((a,b)=>b.ca2026-a.ca2026).slice(0,6);
  const noProjectAgg={name:'Établissements sans projet',ca2024:0,ca2025:0,ca2026:0};
  const topLine=[...topLineBase,noProjectAgg];
  const statusLabels=['Actif','À relancer','Dormant','Prospect','Jamais travaillé'];
  upsertChart('etabCA','chartEtabCA',{type:'bar',data:{labels:topBar.map(m=>m.name),datasets:[{label:'CA',data:topBar.map(m=>selectedEtabAmount(m,year)),backgroundColor:'rgba(45,89,134,.82)',borderWidth:0,maxBarThickness:22}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>formatK(ctx.parsed.x)}}},scales:{x:{beginAtZero:true,ticks:{callback:(v)=>formatK(v)}}}}});
  upsertChart('etabEvolution','chartEtabEvolution',{type:'line',data:{labels:topLine.map(m=>m.name),datasets:[{label:'2024',data:topLine.map(m=>m.ca2024),borderColor:'#94A3B8',backgroundColor:'#94A3B8',tension:.25,pointRadius:4},{label:'2025',data:topLine.map(m=>m.ca2025),borderColor:'#2D5986',backgroundColor:'#2D5986',tension:.25,pointRadius:4},{label:'2026',data:topLine.map(m=>m.ca2026),borderColor:'#F39C12',backgroundColor:'#F39C12',tension:.25,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'},tooltip:{callbacks:{label:(ctx)=>ctx.dataset.label+' : '+formatK(ctx.parsed.y)}}},scales:{y:{beginAtZero:true,ticks:{callback:(v)=>formatK(v)}}}}});
  const projTop=[...filtered].sort((a,b)=>selectedEtabProjects(b,year)-selectedEtabProjects(a,year)).slice(0,6);
  upsertChart('etabProjects','chartEtabProjects',{type:'doughnut',data:{labels:projTop.map(m=>m.name),datasets:[{data:projTop.map(m=>selectedEtabProjects(m,year)),backgroundColor:['#2D5986','#4A7BAF','#27AE60','#F39C12','#E74C3C','#BDC3C7'],borderWidth:0,radius:'78%'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right'}}}});
  upsertChart('etabStatus','chartEtabStatus',{type:'doughnut',data:{labels:statusLabels,datasets:[{data:statusLabels.map(st=>filtered.filter(m=>m.statut===st).reduce((s,m)=>s+selectedEtabAmount(m,year),0)),backgroundColor:['#27AE60','#F39C12','#7F8C8D','#4A7BAF','#E74C3C'],borderWidth:0,radius:'78%'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right'},tooltip:{callbacks:{label:(ctx)=>ctx.label+' : '+formatK(ctx.parsed)}}}}});
  const global=[2024,2025,2026].map(y=>filtered.reduce((s,m)=>s+m['ca'+y],0));
  upsertChart('etabGlobal','chartEtabGlobal',{type:'bar',data:{labels:['2024','2025','2026'],datasets:[{label:'CA',data:global,backgroundColor:['#BDC3C7','#4A7BAF','#F39C12'],borderWidth:0,maxBarThickness:54}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>formatK(ctx.parsed.y)}}},scales:{y:{beginAtZero:true,ticks:{callback:(v)=>formatK(v)}}}}});
  const rows=[...filtered].sort((a,b)=>selectedEtabAmount(b,year)-selectedEtabAmount(a,year));
  document.getElementById('etabCount').textContent=`${rows.length} établissement(s) affiché(s) · ${noProject} sans projet`;
  document.getElementById('tbEtablissements').innerHTML=rows.map(m=>`<tr class="${m.totalProjects===0?'etab-zero-row':''}">
    <td style="font-weight:700;max-width:280px;">${esc(m.name)}</td><td style="text-align:center;">${m.projects2024}</td><td class="amount">${fmt(m.ca2024)}</td><td style="text-align:center;">${m.projects2025}</td><td class="amount">${fmt(m.ca2025)}</td><td style="text-align:center;">${m.projects2026}</td><td class="amount">${fmt(m.ca2026)}</td><td style="text-align:right;font-weight:700;color:${m.ev===null?'var(--gray-dk)':m.ev>=0?'var(--green)':'var(--red)'};">${m.ev===null?'—':(m.ev>0?'+ ':'')+m.ev.toFixed(1).replace('.',',')+' %'}</td><td style="text-align:center;">${m.ao}</td><td>${esc(m.resp)}</td><td><span class="etab-status ${etabStatusClass(m.statut)}">${m.statut}</span></td></tr>`).join('')||'<tr><td colspan="11" class="empty">Aucun établissement trouvé</td></tr>';
  initHorizontalDragScroll();
}
function exportEtablissementCSV(){
  const rows=calcEtablissementMetrics().map(m=>[m.name,m.projects2024,m.ca2024,m.projects2025,m.ca2025,m.projects2026,m.ca2026,m.ao,m.resp,m.statut]);
  const csv=[['Etablissement','Nb projets 2024','CA 2024','Nb projets 2025','CA 2025','Nb projets 2026','CA 2026','AO en cours','Responsable principal','Statut'],...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='suivi_des_etablissements.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function renderCommercialPage(){
  const target=document.getElementById('tbCommercial');
  if(!target) return;
  const search=(document.getElementById('srchCom')?.value||'').toLowerCase().trim();
  const status=document.getElementById('filtComStatus')?.value||'';
  const priority=document.getElementById('filtComPriority')?.value||'';
  const onlyNever=!!document.getElementById('onlyNever')?.checked;
  let list=[...(DB.commercial||[])];

  if(search){
    list=list.filter(c=>[c.agenceDB,c.region,c.contactNom,c.contactPrenom,c.contactFonction,c.contactMail,c.contactTel,c.commentaire,c.statutRelation,c.priorite,c.actionFaire].filter(Boolean).join(' ').toLowerCase().includes(search));
  }
  if(status) list=list.filter(c=>normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus(status));
  if(priority) list=list.filter(c=>String(c.priorite||'')===priority);
  if(onlyNever) list=list.filter(c=>c.jamaisContacte||normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus('Jamais contacte'));

  const never=(DB.commercial||[]).filter(c=>c.jamaisContacte||normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus('Jamais contacte')).length;
  const dormant=(DB.commercial||[]).filter(c=>normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus('Dormant')).length;
  const actif=(DB.commercial||[]).filter(c=>normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus('Actif')).length;
  const actions=(DB.commercial||[]).filter(c=>['Appeler','Relancer'].includes(c.actionFaire)).length;
  const kpi=document.getElementById('commercialKpis');
  if(kpi){
    kpi.innerHTML=`
      <div class="kcard kg"><div class="klbl">Actifs</div><div class="kval">${actif}</div></div>
      <div class="kcard kr"><div class="klbl">Jamais contactés</div><div class="kval">${never}</div><div class="ksub">À aller voir !</div></div>
      <div class="kcard ka"><div class="klbl">Dormants</div><div class="kval">${dormant}</div><div class="ksub">À relancer</div></div>
      <div class="kcard kb"><div class="klbl">Actions requises</div><div class="kval">${actions}</div></div>`;
  }

  const ORDER={'Jamais contacte':0,'A contacter':1,'Dormant':2,'Prospect en cours':3,'Actif':4,'Sans suite':5};
  list.sort((a,b)=>(ORDER[a.statutRelation]??9)-(ORDER[b.statutRelation]??9));
  const PRIO_COL={Haute:'var(--red)',Moyenne:'var(--orange)',Basse:'var(--green)'};
  const SCLASS={Actif:'cs-actif',Dormant:'cs-dormant','Jamais contacte':'cs-jamais','A contacter':'cs-jamais','Prospect en cours':'cs-prospect','Sans suite':'cs-dormant'};
  const ACLASS={Appeler:'act-appeler','RDV a planifier':'act-rdv',Relancer:'act-relancer','Envoyer presentation':'act-envoyer','En attente retour':'act-attente',Rien:'act-rien'};
  const ACTION_LBL={Appeler:'📞 Appeler','RDV a planifier':'📅 RDV','Envoyer presentation':'📧 Envoyer',Relancer:'🔔 Relancer','En attente retour':'⏳ Attente',Rien:'✓ Rien'};
  const groups=[
    {label:'Jamais contactés — priorité absolue',cls:'csh-jamais',items:list.filter(c=>c.jamaisContacte||normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus('Jamais contacte'))},
    {label:'Dormants — à relancer',cls:'csh-dormant',items:list.filter(c=>normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus('Dormant'))},
    {label:'Prospects en cours',cls:'csh-prospect',items:list.filter(c=>['Prospect en cours','A contacter'].some(s=>normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus(s)))},
    {label:'Clients actifs',cls:'csh-actif',items:list.filter(c=>normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus('Actif'))},
    {label:'Autres',cls:'csh-dormant',items:list.filter(c=>!['Jamais contacte','Dormant','Prospect en cours','A contacter','Actif'].some(s=>normalizeCommercialStatus(c.statutRelation)===normalizeCommercialStatus(s))&&!c.jamaisContacte)},
  ];
  let html='';
  groups.forEach(g=>{
    if(!g.items.length) return;
    html+=`<div class="comm-section-hdr ${g.cls}">${g.label} (${g.items.length})</div><div class="comm-grid" style="margin-bottom:10px;">`;
    g.items.forEach(c=>{
      const ac=c.actionFaire||'Rien';
      const contact=[c.contactPrenom,c.contactNom].filter(Boolean).join(' ')+(c.contactFonction?' — '+c.contactFonction:'');
      html+=`<div class="comm-card ${SCLASS[c.statutRelation]||'cs-dormant'}" onclick="editCommercial('${c.id}')">
        <div>
          <div style="font-size:10px;color:var(--gray-dk);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">${esc(c.region||'—')} · Prio <span style="color:${PRIO_COL[c.priorite]||'var(--gray-dk)'};">${esc(c.priorite||'—')}</span></div>
          <div class="cn">${esc(c.agenceDB||'—')}</div>
          ${contact?`<div style="font-size:11px;color:var(--blue);margin-top:3px;">👤 ${esc(contact)}</div>`:''}
          ${c.contactMail?`<div style="font-size:10.5px;color:var(--gray-dk);">✉ ${esc(c.contactMail)}${c.contactTel?' · '+esc(c.contactTel):''}</div>`:''}
          ${c.commentaire?`<div class="cnote">${esc(c.commentaire).slice(0,100)}${c.commentaire.length>100?'...':''}</div>`:''}
        </div>
        <div class="cc">
          ${badgeStatus(c.statutRelation)}
          <span class="act-pill ${ACLASS[ac]||'act-rien'}">${ACTION_LBL[ac]||esc(ac)}</span>
          ${c.dateProchaineAction?`<span style="font-size:10px;color:var(--blue);">📅 ${fmtD(c.dateProchaineAction)}</span>`:''}
          <div style="display:flex;gap:4px;margin-top:4px;">
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editCommercial('${c.id}')">Edit.</button>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteCommercial('${c.id}')">x</button>
          </div>
        </div>
      </div>`;
    });
    html+='</div>';
  });
  target.innerHTML=html||'<div class="empty">Aucun établissement trouvé</div>';
}
function factureStatus(f){if(f.dateEncaissement)return 'Encaissee';if(f.dateEcheance&&new Date(f.dateEcheance)<new Date())return 'En retard';return 'Emise';}
function renderFacturationPage(){
  const tot=DB.factures.reduce((s,f)=>s+(Number(f.montantHT)||0),0);
  const enc=DB.factures.filter(f=>f.dateEncaissement).reduce((s,f)=>s+(Number(f.montantHT)||0),0);
  const ret=DB.factures.filter(f=>factureStatus(f)==='En retard').length;
  const ouv=DB.factures.filter(f=>!f.dateEncaissement).length;
  document.getElementById('factKpis').innerHTML=`
    <div class="kcard kb"><div class="klbl">Montant facture</div><div class="kval">${fmt(tot)}</div></div>
    <div class="kcard kg"><div class="klbl">Encaisse</div><div class="kval">${fmt(enc)}</div></div>
    <div class="kcard kr"><div class="klbl">En retard</div><div class="kval">${ret}</div></div>
    <div class="kcard ka"><div class="klbl">Ouvertes</div><div class="kval">${ouv}</div></div>`;
  document.getElementById('tbF').innerHTML=DB.factures.length?DB.factures.map(f=>{
    const p=getProjectById(f.projetId),st=factureStatus(f);
    return `<tr><td ${p?`class="project-sheet-link" data-project-id="${p.id}" onclick="openProjectSheet('${p.id}')" title="Cliquer pour ouvrir la fiche"`:''}>${p?p.code+' — '+p.nom:'—'}</td><td>${f.numero}</td><td>${fmtD(f.dateEmission)}</td><td class="amount">${fmt(f.montantHT)}</td><td>${fmtD(f.dateEcheance)}</td><td>${fmtD(f.dateEncaissement)}</td><td>${badgeStatus(st)}</td><td>${st==='En retard'?'⚠️':'—'}</td>
    <td><div style="display:flex;gap:4px;"><button class="btn btn-outline btn-sm" onclick="editFacture('${f.id}')">Edit.</button><button class="btn btn-danger btn-sm" onclick="deleteFacture('${f.id}')">x</button></div></td></tr>`;
  }).join(''):'<tr><td colspan="9" class="empty">Aucune facture</td></tr>';
}

function renderConfigPage(){
  document.getElementById('tbMembers').innerHTML=DB.membres.map(m=>`<tr><td>${m.nom}</td><td>${m.role||'—'}</td><td>${m.capaciteBase||100}%</td><td>${badgeStatus(m.statut)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}')">x</button></td></tr>`).join('');
  document.getElementById('cfgYear').value=DB.cfg.annee;document.getElementById('cfgHigh').value=DB.cfg.seuilChargeHaute;document.getElementById('cfgLow').value=DB.cfg.seuilChargeBasse;document.getElementById('cfgCurrency').value=DB.cfg.devise;
  const sn=document.getElementById('cfgServiceName');if(sn)sn.value=DB.cfg.serviceName||'';
}

function defaultMemberName(){const m=(DB.membres||[]).find(x=>x.statut==='Actif')||(DB.membres||[])[0];return m?.nom||'';}
function fillMemberSelect(id,selected=''){document.getElementById(id).innerHTML=DB.membres.map(m=>`<option ${m.nom===selected?'selected':''}>${m.nom}</option>`).join('');}
function missionGridHtml(prefix,item){const map={};(item?.missions||[]).forEach(x=>map[x.mission]=x.montant);return MISSIONS.map(m=>`<div class="mission-row"><label>${m}</label><input class="input-money" type="number" id="${prefix}_${m.replace(/[^a-z0-9]/gi,'_')}" value="${map[m]||''}"></div>`).join('');}
function collectMissions(prefix){return MISSIONS.map(m=>({mission:m,montant:Number(document.getElementById(prefix+'_'+m.replace(/[^a-z0-9]/gi,'_'))?.value)||0})).filter(x=>x.montant>0);}


/* V14: projects-crud.js externalisé. */

/* V14: ao.js externalisé. */

/* V14: commercial.js externalisé. */

/* V14: factures.js externalisé. */

/* V14: config.js externalisé. */

/* V14: exports.js externalisé. */

/* V14: forms.js externalisé. */

/* V14: project-sheet.js externalisé. */

/* V14: devis.js externalisé. */
function renderAll(){
  renderDashboard();renderProjectsPage();renderChargePage();renderGanttPage();
  renderPipelinePage();renderAODashboard();renderDevisPage();renderCommercialPage();renderFacturationPage();renderConfigPage();
  if(typeof renderPrevisionsPage==='function')renderPrevisionsPage();
  if(typeof enhanceProjectSheetLinks==='function')enhanceProjectSheetLinks();
  if(typeof updateServiceBadge==='function')updateServiceBadge();
}
