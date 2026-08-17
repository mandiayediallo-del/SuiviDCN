/* DCN V14 — module extrait du noyau V13B. */
/* ── Fiche projet : popup + export Word ── */
let CURRENT_PROJECT_SHEET_ID=null;
function psEsc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function psTxt(v){return v===null||v===undefined||v===''?'—':psEsc(v);}
function psStatusClass(st){return st==='En cours'?'ok':(st==='Termine'||st==='Solde')?'done':(st==='A renseigner'||st==='Suspendu')?'watch':'';}
function getSheetEntity(id){
  const p=(DB.projets||[]).find(x=>x.id===id);
  if(p) return {...p,_sheetType:'project'};
  const a=(DB.pipelineAO||[]).find(x=>x.id===id);
  if(a) return {...a,statut:a.phase||'AO',_sheetType:'ao'};
  return null;
}
function getProjectForecast(p){
  const f=(DB.previsionsFacturation||[]).find(x=>x.projectId===p.id);
  if(f) return DCNCalc.normalizeForecast(f);
  // Sécurité : sans ligne de prévision dédiée, le CA 2026 du projet est réparti
  // sur ses mois actifs afin que le total reste cohérent avec la fiche projet.
  const ca=calcCAProjet(p);
  return DCNCalc.normalizeForecast({before:ca.avant,months:calcProjectMonthlyCA2026(p,DB.cfg.annee),after:ca.apres,source:'projet'});
}
function getProjectForecastProgress(p){
  const forecast=getProjectForecast(p);
  const fp=DCNCalc.forecastProgress(forecast,DB.cfg.annee);
  return {
    forecast,
    forecastBefore:fp.before,
    forecastAfter:fp.after,
    forecastMonths:fp.months,
    forecastYearTotal:fp.yearTotal,
    forecastGrandTotal:fp.grandTotal,
    forecastCumulative:fp.cumulative,
    forecastRemaining:fp.remaining,
    pct:fp.pct,
    pctDisplay:fp.pctDisplay,
    pctRing:fp.pctRing,
    forecastCutoffLabel:fp.cutoffLabel
  };
}
function getProjectTeamChargeRows(pid){
  const proj=DB.projets.find(x=>x.id===pid)||{};
  // Membres à afficher : acteurs du projet + tout membre ayant une charge saisie
  const acteursIds=new Set((proj.acteurs||[]).map(a=>a.membreId).filter(Boolean));
  const allMembers=activeMembers();
  const membersWithCharge=new Set(allMembers.filter(m=>{
    const vals=MOIS.map((_,i)=>Number(((DB.charge[m.id]||{})[monthKey(i)]||{projets:{}}).projets?.[pid])||0);
    return vals.some(v=>v>0);
  }).map(m=>m.id));
  const idsToShow=new Set([...acteursIds,...membersWithCharge]);
  return allMembers.filter(m=>idsToShow.has(m.id)).map(m=>{
    const vals=MOIS.map((_,i)=>Number(((DB.charge[m.id]||{})[monthKey(i)]||{projets:{}}).projets?.[pid])||0);
    const total=vals.reduce((a,b)=>a+b,0);
    const active=vals.map((v,i)=>v>0?MOIS[i]:null).filter(Boolean);
    // Rôle : depuis acteurs[] si dispo, sinon role du membre
    const actEntry=(proj.acteurs||[]).find(a=>a.membreId===m.id);
    const role=actEntry?actEntry.role:m.role||'';
    const tag=actEntry&&actEntry.principal?' ★':'';
    return {nom:m.nom+tag,role,total,periode:active.length?(active[0]+' → '+active[active.length-1]):'Non assigné'};
  });
}
function buildAOSheetHTML(p){
  const edition=new Date().toLocaleDateString('fr-FR');
  const total=calcMontantTotal(p);
  const proba=Number(p.probabilite)||0;
  const pondere=Math.round(total*proba/100);
  const missions=(p.missions||[]).filter(m=>Number(m.montant)||m.mission);
  const contact=[p.contactPrenom,p.contactNom].filter(Boolean).join(' ')||'—';
  const PHASES=['Identification','Qualification','Offre deposee','Negociation','Attribution'];
  const PHASES_LABELS=['Identification','Qualification','Offre déposée','Négociation','Attribution'];
  const currentPhaseIdx=Math.max(0,PHASES.indexOf(p.phase||'Identification'));
  const phaseTracks=PHASES.map((_,i)=>{const cls=i<currentPhaseIdx?'done':i===currentPhaseIdx?'active':'';return `<div class="ao-phase-seg ${cls}"></div>`;}).join('');
  const phaseLabels=PHASES_LABELS.map((l,i)=>{const cls=i<currentPhaseIdx?'lbl-done':i===currentPhaseIdx?'lbl-active':'';return `<span class="${cls}">${l}${i<currentPhaseIdx?' ✓':i===currentPhaseIdx?' ◀':''}</span>`;}).join('');
  const pct=Math.min(100,Math.max(0,proba));
  return `<div class="project-sheet">
    <div class="ps-head">
      <div class="ps-brand"><div class="ps-brand-main">Construction Numérique</div><div class="ps-brand-sub">Demathieu Bard</div></div>
      <div class="ps-title"><h1>FICHE APPEL D'OFFRE</h1><div>Édition du ${edition}</div></div>
    </div>
    <div class="ao-title-block">
      <div class="ao-title-label">Opportunité commerciale · ${psTxt(p.typeSuivi||'AO formelle')}</div>
      <div class="ao-title-main">${psTxt(p.nom)}</div>
      <div class="ao-title-line"></div>
      <div class="ao-phase-badge">◈ ${psTxt(PHASES_LABELS[currentPhaseIdx]||p.phase||'—')}</div>
    </div>
    <div class="ps-body">
      <div class="ao-grid-top">
        <div class="ps-section" style="margin-bottom:0">
          <div class="ps-section-title"><span>▣</span> 1. IDENTITÉ DE L'APPEL D'OFFRE</div>
          <table class="ps-table"><tbody>
            <tr><td>Responsable(s)</td><td>${dcnFicheActeurs(p)}</td></tr>
            <tr><td>Client / MOA</td><td>${psTxt(p.client)}</td></tr>
            <tr><td>Agence DB</td><td>${psTxt(p.agenceDB)}</td></tr>
            <tr><td>Nature</td><td>${psTxt(p.nature)}</td></tr>
            <tr><td>Type de suivi</td><td>${psTxt(p.typeSuivi||'AO formelle')}</td></tr>
            <tr><td>Date de réponse</td><td>${psTxt(fmtD&&fmtD(p.dateReponse)||p.dateReponse||'—')}</td></tr>
            <tr><td>Charge estimée</td><td>${Number(p.chargeEstimee)||0}%</td></tr>
          </tbody></table>
        </div>
        <div style="display:flex;flex-direction:column">
          <div class="ao-kpi">
            <div class="ao-kpi-label">Probabilité de gain</div>
            <div class="ao-ring" style="--pct:${pct}%"><span>${proba}%</span></div>
            <div class="ao-kpi-sub">${psTxt(PHASES_LABELS[currentPhaseIdx]||p.phase||'—')}</div>
          </div>
          <div class="ao-pondere-box">
            <div class="ao-pondere-label">Montant pondéré</div>
            <div class="ao-pondere-val">${fmt(pondere)}</div>
            <div class="ao-pondere-sub">sur ${fmt(total)} total</div>
          </div>
        </div>
      </div>
      <div class="ps-section">
        <div class="ps-section-title"><span>▰</span> 2. AVANCEMENT PIPELINE</div>
        <div class="ao-phase-track-wrap">
          <div class="ao-phase-track">${phaseTracks}</div>
          <div class="ao-phase-labels">${phaseLabels}</div>
        </div>
        ${p.actionAFaire?`<div class="ao-action-box"><div class="ao-action-text">"${psEsc(p.actionAFaire)}"</div>${p.dateProchaineAction?`<div class="ao-action-date">↳ Prochaine échéance : ${fmtD&&fmtD(p.dateProchaineAction)||p.dateProchaineAction}</div>`:''}</div>`:''}
      </div>
      <div class="ps-grid-2-even">
        <div class="ps-section" style="margin-bottom:0"><div class="ps-section-title"><span>▣</span> 3. MISSIONS PROPOSÉES</div>
          <table class="ps-table"><thead><tr><th>Mission</th><th style="text-align:right">Montant</th></tr></thead><tbody>
            ${missions.length?missions.map(m=>`<tr><td>${psTxt(m.mission)}</td><td class="amount">${fmt(Number(m.montant)||0)}</td></tr>`).join(''):`<tr><td colspan="2" class="ps-empty">Aucune mission renseignée</td></tr>`}
            <tr class="total-row"><td>TOTAL</td><td class="amount">${fmt(total)}</td></tr>
          </tbody></table>
        </div>
        <div class="ps-section" style="margin-bottom:0"><div class="ps-section-title"><span>●</span> 4. CONTACT CLIENT</div>
          <table class="ps-table"><tbody>
            <tr><td>Contact</td><td>${psTxt(contact)}</td></tr>
            <tr><td>Email</td><td>${psTxt(p.contactMail)}</td></tr>
            <tr><td>Téléphone</td><td>${psTxt(p.contactTel)}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="ps-section"><div class="ps-section-title"><span>⚠</span> 5. NOTES</div>
        <div style="padding:12px 14px">
          <div class="ps-note-box">${p.notes?psEsc(p.notes).replace(/\n/g,'<br>'):'<span class="ps-empty">Aucune note renseignée.</span>'}</div>
        </div>
      </div>
    </div>
    <div class="ps-foot"><span>Construction Numérique – Demathieu Bard</span><span>Document confidentiel · Appel d'Offre</span></div>
  </div>`;}

function buildProjectSheetHTML(id, forWord=false){
  const p=getSheetEntity(id); if(!p) return '<div class="empty">Projet / AO introuvable</div>';
  if(p._sheetType==='ao') return buildAOSheetHTML(p);
  const total=calcMontantTotal(p), ca=calcCAProjet(p);

  // KPI projet = avancement PREVISIONNEL, jamais le montant facture.
  // Même calcul utilisé dans la liste de l'onglet Projets.
  const fp=getProjectForecastProgress(p);
  const forecast=fp.forecast;
  const forecastBefore=fp.forecastBefore;
  const forecastAfter=fp.forecastAfter;
  const forecastMonths=fp.forecastMonths;
  const forecastYearTotal=fp.forecastYearTotal;
  const forecastGrandTotal=fp.forecastGrandTotal;
  const forecastCumulative=fp.forecastCumulative;
  const forecastRemaining=fp.forecastRemaining;
  const pct=fp.pct;
  const pctDisplay=fp.pctDisplay;
  const pctRing=fp.pctRing;
  const forecastCutoffLabel=fp.forecastCutoffLabel;
  const missions=(p.missions||[]).filter(m=>Number(m.montant)||m.mission);
  const chargeRows=getProjectTeamChargeRows(p.id);
  const contact=[p.contactPrenom,p.contactNom].filter(Boolean).join(' ')||'—';
  const edition=new Date().toLocaleDateString('fr-FR');
  const forecastTotal=forecastYearTotal;
  const alertes=(typeof dcnGetAlertes==='function'?dcnGetAlertes(p,p._sheetType||'projet'):[]).map(function(a){return a.msg;});
    const titleStyle=forWord?'font-family:Segoe UI,Arial,sans-serif;':'';
  return `<div class="project-sheet" style="${titleStyle}">
    <div class="ps-head">
      <div class="ps-brand"><div class="ps-brand-main">Construction Numérique</div><div class="ps-brand-sub">Demathieu Bard</div></div>
      <div class="ps-title"><h1>${p._sheetType==='ao'?'FICHE AO':'FICHE PROJET'}</h1><div>Édition du ${edition}</div></div>
    </div>
    <div class="ps-body">
      <div style="text-align:center;padding:24px 20px 20px;background:linear-gradient(135deg,var(--navy) 0%,#2D5986 100%);border-radius:8px;margin-bottom:18px;">
        <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">${p._sheetType==='ao'?'FICHE APPEL D\'OFFRE':'FICHE PROJET'} &nbsp;·&nbsp; ${psTxt(p.code||'—')}</div>
        <div style="font-size:34px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;line-height:1.1;margin-bottom:14px;">${psTxt(p.nom)}</div>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
          <span style="background:rgba(255,255,255,.12);color:#fff;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;">${psTxt(p.client||'—')}</span>
          <span style="background:rgba(255,255,255,.12);color:#fff;padding:3px 12px;border-radius:20px;font-size:11px;">Resp. : ${psTxt(p.responsable||'—')}</span>
        </div>
      </div>
      <div class="ps-section">
        <div class="ps-section-title"><span>▣</span> 1. IDENTITÉ DU PROJET</div>
        <div class="ps-grid-identity">
          <table class="ps-table"><tbody>
            <tr><td>${p._sheetType==='ao'?'Code / ID AO':'Code projet'}</td><td>${psTxt(p.code||p.id)}</td></tr>
            <tr><td>${p._sheetType==='ao'?'Nom de l’AO':'Nom du projet'}</td><td>${psTxt(p.nom)}</td></tr>
            <tr><td>Client</td><td>${psTxt(p.client)}</td></tr>
            <tr><td>Agence DB</td><td>${psTxt(p.agenceDB)}</td></tr>
            <tr><td>Responsable</td><td>${psTxt(p.responsable)}</td></tr>
            <tr><td>${p._sheetType==='ao'?'Phase':'Statut'}</td><td><span class="ps-status ${psStatusClass(p.statut)}">${psTxt(p.statut)}</span></td></tr>
            <tr><td>Nature</td><td>${psTxt(p.nature)}</td></tr>
            ${p._sheetType==='ao'?`<tr><td>Probabilité</td><td>${Number(p.probabilite)||0}%</td></tr><tr><td>Action à faire</td><td>${psTxt(p.actionAFaire)}</td></tr>`:''}
          </tbody></table>
          <div class="ps-kpi"><div class="ps-kpi-label">KPI PROJET</div><div class="ps-ring" style="--pct:${pctRing}%;"><span>${pctDisplay}</span></div><div class="ps-kpi-sub">${pct===null?'Prévisions à renseigner':`Avancement prévisionnel · ${forecastCutoffLabel}`}</div></div>
          <div class="ps-info-list">
            <div class="ps-info-row"><b>Date de début</b><span>${psTxt(fmtD(p.dateDebut))}</span></div>
            <div class="ps-info-row"><b>Date de fin prévue</b><span>${psTxt(fmtD(p.dateFin))}</span></div>
            <div class="ps-info-row"><b>N° devis</b><span>${psTxt(p.devis)}</span></div>
            ${(()=>{const wt=workflowTrail(p);return wt.ao?`<div class="ps-info-row"><b>Origine AO</b><span>${psTxt(wt.ao.nom||wt.ao.id)}</span></div>`:'';})()}
            <div class="ps-info-row"><b>Priorité</b><span>${alertes.length?'À surveiller':'Normale'}</span></div>
            <div class="ps-info-row"><b>Dernière mise à jour</b><span>${psTxt(fmtD(p.lastModifiedAt))}</span></div>
          </div>
        </div>
      </div>
      <div class="ps-grid-2">
        <div class="ps-section" style="margin-bottom:0;"><div class="ps-section-title"><span>▰</span> 2. SYNTHÈSE FINANCIÈRE</div>
          <table class="ps-table"><thead><tr><th>Indicateur</th><th style="text-align:right;">Montant</th></tr></thead><tbody>
            <tr><td>Total devis</td><td class="amount">${fmt(total)}</td></tr>
            <tr><td>CA avant ${DB.cfg.annee}</td><td class="amount">${fmt(ca.avant)}</td></tr>
            <tr><td>CA ${DB.cfg.annee}</td><td class="amount">${fmt(ca.courant)}</td></tr>
            <tr><td>CA après ${DB.cfg.annee}</td><td class="amount">${fmt(ca.apres)}</td></tr>
            <tr><td>Prévision cumulée à ${forecastCutoffLabel}</td><td class="amount" style="color:var(--green);">${fmt(forecastCumulative)}</td></tr>
            <tr><td>Prévision restante</td><td class="amount" style="color:var(--orange);">${fmt(forecastRemaining)}</td></tr>
            <tr class="total-row"><td>Avancement prévisionnel</td><td class="amount">${pctDisplay}</td></tr>
          </tbody></table>
        </div>
        <div class="ps-section" style="margin-bottom:0;"><div class="ps-section-title"><span>▣</span> 3. MISSIONS DÉTAILLÉES</div>
          <table class="ps-table"><thead><tr><th>Mission</th><th style="text-align:right;">Jours</th><th style="text-align:right;">Montant</th><th style="text-align:right;">TJM</th></tr></thead><tbody>
            ${missions.length?missions.map(m=>`<tr><td>${psTxt(m.mission)}</td><td class="amount">${m.jours?String(m.jours).replace('.',','):'—'}</td><td class="amount">${fmt(m.montant||0)}</td><td class="amount">${m.jours?fmt((Number(m.montant)||0)/Number(m.jours)):'—'}</td></tr>`).join(''):`<tr><td colspan="4" class="ps-empty">Aucune mission renseignée</td></tr>`}
            <tr class="total-row"><td>TOTAL</td><td class="amount">${missions.reduce((s,m)=>s+(Number(m.jours)||0),0)||'—'}</td><td class="amount">${fmt(total)}</td><td class="amount">${missions.reduce((s,m)=>s+(Number(m.jours)||0),0)?fmt(total/missions.reduce((s,m)=>s+(Number(m.jours)||0),0)):'—'}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="ps-section"><div class="ps-section-title"><span>▥</span> 4. PRÉVISION DE FACTURATION ${DB.cfg.annee}</div>
        <table class="ps-table"><thead><tr>${MOIS.map(m=>`<th style="text-align:right;">${m}</th>`).join('')}<th style="text-align:right;">Total</th></tr></thead><tbody><tr>${forecastMonths.map(v=>`<td class="amount">${fmt(v)}</td>`).join('')}<td class="amount"><b>${fmt(forecastTotal)}</b></td></tr></tbody></table>
      </div>
      <div class="ps-grid-2-even">
        <div class="ps-section" style="margin-bottom:0;"><div class="ps-section-title"><span>▦</span> 5. CHARGE ÉQUIPE ASSOCIÉE</div>
          <table class="ps-table"><thead><tr><th>Collaborateur</th><th>Rôle</th><th style="text-align:right;">Charge</th><th>Période</th></tr></thead><tbody>
            ${chargeRows.length?chargeRows.map(r=>`<tr><td>${psTxt(r.nom)}</td><td>${psTxt(r.role)}</td><td class="amount">${r.total}%</td><td>${psTxt(r.periode)}</td></tr>`).join(''):`<tr><td colspan="4" class="ps-empty">Aucune charge renseignée</td></tr>`}
          </tbody></table>
        </div>
        <div class="ps-section" style="margin-bottom:0;"><div class="ps-section-title"><span>●</span> 6. CONTACT CLIENT</div>
          <table class="ps-table"><tbody>
            <tr><td>Nom</td><td>${psTxt(contact)}</td></tr>
            <tr><td>Fonction</td><td>${psTxt(p.contactFonction)}</td></tr>
            <tr><td>Email</td><td>${psTxt(p.contactMail)}</td></tr>
            <tr><td>Téléphone</td><td>${psTxt(p.contactTel)}</td></tr>
          </tbody></table>
        </div>
      </div>
      ${(()=>{const wt=workflowTrail(p);if(!wt.devis&&!wt.ao)return '';return `<div class="ps-section"><div class="ps-section-title"><span>↗</span> 7. PARCOURS DU DOSSIER</div><div style="padding:12px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;">${wt.devis?`<span class="badge bb">DEVIS · ${psTxt(wt.devis.numero)}</span>`:'<span class="badge bgr">DEVIS · non lié</span>'}<span>→</span>${wt.ao?`<span class="badge bac">AO · ${psTxt(wt.ao.nom||wt.ao.id)}</span><span>→</span>`:''}<span class="badge bg">PROJET · ${psTxt(p.code||p.nom)}</span></div></div>`;})()}
      <div class="ps-section" style="border-left:4px solid var(--red);padding-left:12px;"><div class="ps-section-title" style="color:var(--red);"><span>⚠</span> ${(()=>{const wt=workflowTrail(p);return (wt.devis||wt.ao)?'8':'7';})()}. NOTES & ALERTES</div>
        <div class="ps-notes"><div class="ps-note-box">${p.notes?psEsc(p.notes).replace(/\n/g,'<br>'):'<span class="ps-empty">Aucune note renseignée.</span>'}</div><div class="ps-alert-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><b>Alertes &amp; points d'attention</b><button onclick="dcnOpenAlertes('${p.id}','${p._sheetType==='ao'?'ao':'projet'}')" style="font-size:10px;padding:2px 10px;background:var(--red);color:#fff;border:none;border-radius:4px;cursor:pointer;">+ Gérer</button></div>${alertes.length?alertes.map(a=>'<div style="padding:4px 8px;background:#FEF4E5;border-left:3px solid var(--orange);border-radius:3px;margin-bottom:4px;font-size:11px;">⚠️ '+psEsc(a)+'</div>').join(''):'<div style="color:var(--green);font-size:11px;">✓ Aucun point bloquant détecté.</div>'}</div></div>
      </div>
    </div>
    <div class="ps-foot"><span>Construction Numérique – Demathieu Bard</span><span>Document confidentiel</span></div>
  </div>`;
}
function ensureProjectSheetDom(){
  let ov=document.getElementById('projectSheetOv');
  let preview=document.getElementById('projectSheetPreview');
  if(ov && preview)return {ov,preview};
  ov=document.createElement('div');
  ov.className='ov';
  ov.id='projectSheetOv';
  ov.innerHTML=`<div class="project-sheet-modal">
    <div class="mh"><div class="mt">Fiche projet</div><button class="mx" onclick="closeProjectSheet()">×</button></div>
    <div class="mb" style="padding:12px 16px;border-bottom:1px solid var(--border);">
      <div class="project-sheet-actions">
        <button class="btn btn-accent" onclick="editCurrentProjectSheet();" style="font-weight:700;">✎ Éditer</button>
        <button class="btn btn-primary" onclick="downloadProjectSheetWord()">Télécharger Word</button>
        <button class="btn btn-outline" onclick="printProjectSheet()">Imprimer / PDF</button>
        <button class="btn btn-outline" onclick="closeProjectSheet()">Fermer</button>
      </div>
    </div>
    <div class="project-sheet-preview" id="projectSheetPreview"></div>
  </div>`;
  document.body.appendChild(ov);
  preview=ov.querySelector('#projectSheetPreview');
  return {ov,preview};
}

function openProjectSheet(id){
  id=String(id||'').trim();
  if(!id)return;
  const entity=getSheetEntity(id);
  if(!entity){
    console.warn('[DCN V16.4.1] fiche introuvable',id);
    if(typeof toast==='function')toast('Projet introuvable','err');
    return;
  }
  CURRENT_PROJECT_SHEET_ID=id;
  const shell=ensureProjectSheetDom();
  shell.ov.classList.add('open');
  try{
    shell.preview.innerHTML=buildProjectSheetHTML(id);
  }catch(err){
    console.error('[DCN V16.4.1] ouverture fiche projet',id,err);
    shell.preview.innerHTML=`<div class="project-sheet" style="padding:24px;">
      <div style="font-size:18px;font-weight:800;color:var(--navy);margin-bottom:10px;">${psEsc(entity.code||'')} — ${psEsc(entity.nom||'Projet')}</div>
      <div style="font-size:12px;color:var(--gray-dk);margin-bottom:16px;">La fiche complète n'a pas pu être construite.</div>
      <div class="note-box" style="font-size:11px;">${psEsc(err&&err.message?err.message:String(err))}</div>
    </div>`;
    if(typeof toast==='function')toast('La fiche projet s’est ouverte avec une erreur de détail','err');
  }
  if(typeof enhanceSheetQuickNav==='function')setTimeout(enhanceSheetQuickNav,0);
}

function closeProjectSheet(){
  const ov=document.getElementById('projectSheetOv');
  if(ov)ov.classList.remove('open');
}

(function bindProjectSheetClicks(){
  if(window.__DCN_PROJECT_SHEET_CLICK_FIX_1641__)return;
  window.__DCN_PROJECT_SHEET_CLICK_FIX_1641__=true;
  document.addEventListener('click',function(e){
    if(!e.target || !e.target.closest)return;
    if(e.target.closest('button,a,input,select,textarea,label'))return;
    const link=e.target.closest('.project-sheet-link[data-project-id], .dcn-project-row[data-project-id]');
    if(!link)return;
    const id=link.dataset.projectId;
    if(!id)return;
    e.preventDefault();
    e.stopPropagation();
    window.openProjectSheet(id);
  },true);
})();
function editCurrentProjectSheet(){
  const id=CURRENT_PROJECT_SHEET_ID;
  if(!id){toast('Aucune fiche ouverte','err');return;}
  closeProjectSheet();
  if((DB.projets||[]).some(x=>x.id===id)){editProject(id);return;}
  if((DB.pipelineAO||[]).some(x=>x.id===id)){editAo(id);return;}
  toast('Élément introuvable','err');
}
function projectSheetFilename(p,ext){const base=((p.code||'Projet')+'_'+(p.nom||'fiche')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,90);return ((p._sheetType==='ao')?'Fiche_AO_':'Fiche_projet_')+base+'.'+ext;}
function downloadProjectSheetWord(){
  const p=getSheetEntity(CURRENT_PROJECT_SHEET_ID); if(!p)return;
  const styles=[...document.querySelectorAll('style')].map(x=>x.innerHTML).join('\n');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fiche projet</title><style>${styles} body{background:#fff;margin:0;font-family:'Segoe UI',Arial,sans-serif}.project-sheet{box-shadow:none;border:none}.ps-body{padding:16px}.ps-section{page-break-inside:avoid}.ps-head{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>

<!-- DCN FIX V3 : modale projet scrollable, acteurs/notes accessibles -->
<style id="dcn-modal-scroll-fix-v3">
#mProject .project-edit-modal{
  display:flex !important;
  flex-direction:column !important;
  max-height:92vh !important;
  overflow:hidden !important;
}
#mProject .project-edit-modal .mh,
#mProject .project-edit-modal .mf{
  flex:0 0 auto !important;
}
#mProject .project-edit-modal .mb{
  flex:1 1 auto !important;
  min-height:0 !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  padding-bottom:26px !important;
}
#mProject .project-edit-modal .fg{
  padding-bottom:10px !important;
}
#mProject .project-edit-modal .mf{
  background:#fff !important;
  border-top:1px solid var(--border) !important;
  position:relative !important;
  z-index:5 !important;
}
#mProject #dcnActeursWrap,
#mProject #prNotes{
  scroll-margin-top:18px;
}
</style>

</head><body>${buildProjectSheetHTML(p.id,true)}</body></html>`;
  const blob=new Blob(['\ufeff',html],{type:'application/msword;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=projectSheetFilename(p,'doc');document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);toast('Fiche Word générée','ok');
}
function printProjectSheet(){
  if(!CURRENT_PROJECT_SHEET_ID)return;
  const w=window.open('','_blank');
  const styles=[...document.querySelectorAll('style')].map(x=>x.innerHTML).join('\n');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fiche projet</title><style>${styles} body{background:#fff;margin:0;font-family:'Segoe UI',Arial,sans-serif}.project-sheet{box-shadow:none;border:none}.ps-body{padding:16px}</style>

<!-- DCN FIX V3 : modale projet scrollable, acteurs/notes accessibles -->
<style id="dcn-modal-scroll-fix-v3">
#mProject .project-edit-modal{
  display:flex !important;
  flex-direction:column !important;
  max-height:92vh !important;
  overflow:hidden !important;
}
#mProject .project-edit-modal .mh,
#mProject .project-edit-modal .mf{
  flex:0 0 auto !important;
}
#mProject .project-edit-modal .mb{
  flex:1 1 auto !important;
  min-height:0 !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  padding-bottom:26px !important;
}
#mProject .project-edit-modal .fg{
  padding-bottom:10px !important;
}
#mProject .project-edit-modal .mf{
  background:#fff !important;
  border-top:1px solid var(--border) !important;
  position:relative !important;
  z-index:5 !important;
}
#mProject #dcnActeursWrap,
#mProject #prNotes{
  scroll-margin-top:18px;
}
</style>

</head><body>${buildProjectSheetHTML(CURRENT_PROJECT_SHEET_ID,true)}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),300);
}


function findProjectFromText(txt){
  const s=String(txt||'').toLowerCase();
  if(!s.trim()) return null;
  const p=(DB.projets||[]).find(p=>{
    const code=String(p.code||'').toLowerCase();
    const nom=String(p.nom||'').toLowerCase();
    return (code && s.includes(code)) || (nom && s.includes(nom));
  });
  if(p) return {...p,_linkType:'project'};
  const a=(DB.pipelineAO||[]).find(a=>{
    const code=String(a.code||a.devis||'').toLowerCase();
    const nom=String(a.nom||'').toLowerCase();
    return (code && s.includes(code)) || (nom && s.includes(nom));
  });
  return a?{...a,_linkType:'ao'}:null;
}
function enhanceProjectSheetLinks(){
  const scope=document.getElementById('main');
  if(!scope) return;
  scope.querySelectorAll('td, .kcard-name, .forecast-project-name').forEach(el=>{
    if(el.dataset && el.dataset.projectId) return;
    if(el.closest('#page-commercial')) return;
    if(el.closest('button, input, select, textarea, a')) return;
    const p=findProjectFromText(el.textContent||'');
    if(!p) return;
    el.classList.add('project-sheet-link');
    el.dataset.projectId=p.id;
    el.title='Cliquer pour ouvrir la fiche '+(p._linkType==='ao'?'AO':'projet');
  });
}
document.addEventListener('click',function(e){
  if(e.target.closest('button, input, select, textarea, a')) return;
  const el=e.target.closest('[data-project-id].project-sheet-link');
  if(!el) return;
  const id=el.dataset.projectId;
  if(id && ((DB.projets||[]).some(p=>p.id===id) || (DB.pipelineAO||[]).some(a=>a.id===id))){
    e.preventDefault();
    e.stopPropagation();
    openProjectSheet(id);
  }
});
