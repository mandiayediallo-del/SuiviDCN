/* DCN V14 — module extrait du noyau V13B. */
// ── SUIVI DES DEVIS ──
let editDevisId=null;
let devisEnAttribution=null;
let aoEnTransformation=null;

/* ── V9 : chaîne métier Devis -> AO -> Projet -> Prévisions -> Charge ── */
function workflowClone(value){try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));}catch(e){return JSON.parse(JSON.stringify(value));}}
function ensureWorkflowStore(){
  DB.workflowArchives=DB.workflowArchives||{};
  DB.workflowArchives.ao=DB.workflowArchives.ao||{};
  DB.workflowArchives.forecast=DB.workflowArchives.forecast||{};
}
function findWorkflowDevis(id,numero){
  const list=DB.devis||[];
  const num=String(numero||'').trim();
  // Si le numéro a été modifié dans un formulaire AO/Projet, il prime sur l'ancien devisId.
  if(num){
    const byNum=list.find(d=>String(d.numero||'').trim()===num);
    if(byNum)return byNum;
    return null;
  }
  if(id){const byId=list.find(d=>d.id===id);if(byId)return byId;}
  return null;
}
function detachWorkflowDevisLink(kind,itemId,keepDevisId){
  (DB.devis||[]).forEach(d=>{
    if(d.id===keepDevisId)return;
    if(kind==='ao'&&d.aoId===itemId)d.aoId=null;
    if(kind==='project'&&d.projectId===itemId)d.projectId=null;
  });
}
function syncWorkflowDevisToAO(ao,preferredDevis=null){
  if(!ao)return null;
  const d=preferredDevis||findWorkflowDevis(ao.devisId,ao.devis);
  detachWorkflowDevisLink('ao',ao.id,d?.id||null);
  if(!d){ao.devisId=null;return null;}
  ao.devisId=d.id;ao.devis=d.numero||ao.devis;
  if(!ao.dateDevisEmission)ao.dateDevisEmission=d.dateEmission||((DB.devisDates||{})[d.numero]||'');
  d.aoId=ao.id;
  if(!d.projectId && !['Refusé','Expiré'].includes(d.statut))d.statut='Envoyé';
  stampHistory(d,'Devis lié à une AO');
  return d;
}
function syncWorkflowDevisToProject(project,preferredDevis=null,sourceAo=null){
  if(!project)return null;
  const d=preferredDevis||findWorkflowDevis(project.devisId||sourceAo?.devisId,project.devis||sourceAo?.devis);
  detachWorkflowDevisLink('project',project.id,d?.id||null);
  if(!d){project.devisId=null;return null;}
  project.devisId=d.id;project.devis=d.numero||project.devis;
  if(!project.dateDevisEmission)project.dateDevisEmission=d.dateEmission||((DB.devisDates||{})[d.numero]||'');
  d.projectId=project.id;
  if(sourceAo)d.aoId=sourceAo.id;
  d.statut='Accepté';
  stampHistory(d,'Devis lié à un projet');
  return d;
}
function archiveWorkflowAO(ao){ensureWorkflowStore();if(ao?.id)DB.workflowArchives.ao[ao.id]=workflowClone(ao);}
function archiveWorkflowForecast(projectId){
  ensureWorkflowStore();
  const e=(DB.previsionsFacturation||[]).find(x=>x.projectId===projectId);
  if(e)DB.workflowArchives.forecast[projectId]=workflowClone(e);
}
function restoreWorkflowForecast(projectId){
  ensureWorkflowStore();
  const e=DB.workflowArchives.forecast[projectId];if(!e)return null;
  DB.previsionsFacturation=DB.previsionsFacturation||[];
  const i=DB.previsionsFacturation.findIndex(x=>x.projectId===projectId);
  const copy=workflowClone(e);copy.projectId=projectId;copy.source='workflow-restored';
  if(i>=0)DB.previsionsFacturation[i]=copy;else DB.previsionsFacturation.push(copy);
  return copy;
}
function normalizeWorkflowLinks(){
  ensureWorkflowStore();
  // Migration douce des anciens fichiers : on complète seulement les identifiants manquants,
  // sans modifier les dates d'historique ni forcer une nouvelle sauvegarde à l'ouverture.
  (DB.pipelineAO||[]).forEach(a=>{
    a.workflowStage=a.workflowStage||'AO';
    const d=findWorkflowDevis(a.devisId,a.devis);
    if(d){a.devisId=a.devisId||d.id;if(!d.aoId)d.aoId=a.id;}
  });
  (DB.projets||[]).forEach(p=>{
    p.workflowStage=p.workflowStage||'PROJET';
    const d=findWorkflowDevis(p.devisId,p.devis);
    if(d){p.devisId=p.devisId||d.id;d.projectId=p.id;}
  });
}
function workflowTrail(item){
  ensureWorkflowStore();
  const d=findWorkflowDevis(item?.devisId,item?.devis);
  const aoId=item?.aoOrigineId||((d&&d.projectId===item?.id)?d.aoId:null);
  const ao=aoId?(DB.workflowArchives.ao[aoId]||(DB.pipelineAO||[]).find(a=>a.id===aoId)):null;
  return {devis:d,ao,aoId};
}

function dvBadge(s){
  const map={'Brouillon':['#64748B','#F1F5F9'],'Envoyé':['#2D5986','#EBF2FA'],'Accepté':['#27AE60','#E3F5EC'],'En négociation':['#E8A020','#FEF4E5'],'Refusé':['#E74C3C','#FDEAEA'],'Expiré':['#94A3B8','#F8FAFC']};
  const [color,bg]=map[s]||['#888','#eee'];
  return `<span class="badge" style="background:${bg};color:${color};border:1px solid ${color}33;font-weight:600;">${s}</span>`;
}

function _dvYear(r){
  if(r.dateEmission){const m=r.dateEmission.match(/^(\d{4})/);if(m) return m[1];}
  if(r.numero){const m=r.numero.match(/DCN-(\d{4})-/);if(m) return m[1];}
  return '—';
}

function renderDevisPage(){
  DB.devis=DB.devis||[];
  DB.devisDates=DB.devisDates||{};
  DB.devisEmetteurs=DB.devisEmetteurs||{};
  const dateFor=num=>(DB.devisDates[num]||'');
  const emFor=num=>(DB.devisEmetteurs[num]||'');

  // ── Build combined rows ──
  const rows=[];
  const usedNums=new Set();

  (DB.projets||[]).forEach(p=>{
    if(!p.devis||!p.devis.trim()) return;
    const num=p.devis.trim(); usedNums.add(num);
    const montant=(p.missions||[]).reduce((s,m)=>s+(Number(m.montant)||0),0);
    let statut='Accepté';
    if(['En attente','Suspendu'].includes(p.statut)) statut='En négociation';
    else if(p.statut==='A renseigner') statut='Envoyé';
    rows.push({id:'proj_'+p.id,numero:num,dateEmission:dateFor(num),dateReponseAttendue:'',statut,
      objet:p.nom,client:p.client||'',agenceDB:p.agenceDB||'',
      emetteur:emFor(num),responsable:p.responsable||'',montant,source:'projet',sourceId:p.id});
  });

  (DB.pipelineAO||[]).forEach(a=>{
    if(!a.devis||!a.devis.trim()) return;
    const num=a.devis.trim();if(usedNums.has(num)) return; usedNums.add(num);
    const montant=(a.missions||[]).reduce((s,m)=>s+(Number(m.montant)||0),0);
    let statut='Envoyé';
    if(a.phase==='Perdu') statut='Refusé';
    else if(a.phase==='Attribution') statut='Accepté';
    else if(a.phase==='Négociation') statut='En négociation';
    rows.push({id:'ao_'+a.id,numero:num,dateEmission:dateFor(num),dateReponseAttendue:a.dateReponse||'',statut,
      objet:a.nom,client:a.client||'',agenceDB:a.agenceDB||'',
      emetteur:emFor(num),responsable:a.responsable||'',montant,source:'ao',sourceId:a.id});
  });

  (DB.devis||[]).forEach(d=>{
    if(d.numero&&usedNums.has(d.numero)) return;
    rows.push({...d,source:'manuel',sourceId:d.id,
      dateEmission:d.dateEmission||dateFor(d.numero),
      emetteur:d.responsable||emFor(d.numero),responsable:''});
  });

  // ── Populate responsible filter from Google Sheets users ──
  const respEl=document.getElementById('filtDevisResp');
  if(respEl){
    const curResp=respEl.value||'';
    const names=[...new Set((DB.membres||[]).map(m=>m.nom).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    respEl.innerHTML='<option value="">Tous</option>'+names.map(n=>`<option ${n===curResp?'selected':''}>${esc(n)}</option>`).join('');
  }

  // ── Populate year filter ──
  const years=[...new Set(rows.map(r=>_dvYear(r)).filter(y=>y!=='—'))].sort((a,b)=>b-a);
  const anneeEl=document.getElementById('filtDevisAnnee');
  if(anneeEl){
    const curVal=anneeEl.value;
    anneeEl.innerHTML='<option value="">Toutes</option>'+years.map(y=>`<option${y===curVal?' selected':''}>${y}</option>`).join('');
  }

  // ── Sorting ──
  const sortVal=(document.getElementById('filtDevisSort')||{}).value||'numero-desc';
  const[sortField,sortDir]=sortVal.split('-');
  rows.sort((a,b)=>{
    let cmp;
    if(sortField==='date') cmp=(a.dateEmission||'0000').localeCompare(b.dateEmission||'0000');
    else{const np=s=>{const m=(s||'').match(/(\d+)$/);return m?Number(m[1]):0;};cmp=np(a.numero)-np(b.numero);}
    return sortDir==='desc'?-cmp:cmp;
  });

  // ── Filters ──
  const filtAnnee=(document.getElementById('filtDevisAnnee')||{}).value||'';
  const filtStatut=(document.getElementById('filtDevisStatut')||{}).value||'';
  const filtResp=(document.getElementById('filtDevisResp')||{}).value||'';
  const srch=((document.getElementById('srchDevis')||{}).value||'').toLowerCase();
  const filtered=rows.filter(r=>{
    if(filtAnnee&&_dvYear(r)!==filtAnnee) return false;
    if(filtStatut&&r.statut!==filtStatut) return false;
    if(filtResp&&r.emetteur!==filtResp&&r.responsable!==filtResp) return false;
    if(srch&&!r.numero.toLowerCase().includes(srch)&&!r.objet.toLowerCase().includes(srch)&&!(r.client||'').toLowerCase().includes(srch)) return false;
    return true;
  });

  // ── Référence contrôlée : taux de transformation = devis acceptés / devis émis
  // Les volumes 2021-2025 viennent du contrôle Excel + ZIP. 2026 a été contrôlé sur le ZIP.
  // Ces données corrigent uniquement les KPI et graphiques, sans réintégrer tous les anciens devis dans le suivi opérationnel.
  // Les historiques éventuels doivent venir de PARAMETRES dans Google Sheets, jamais du code GitHub.
  const HIST_DEVIS_KPI=(DB.cfg&&DB.cfg.devisKpiHistory&&typeof DB.cfg.devisKpiHistory==='object')?DB.cfg.devisKpiHistory:{};
  const histFor=yr=>HIST_DEVIS_KPI[String(yr)]||null;
  const pctFmt=v=>Number.isFinite(v)?(Math.round(v*10)/10).toLocaleString('fr-FR',{maximumFractionDigits:1})+'%':'—';
  const tauxCompte=(acceptes,emis)=>Number(emis)>0?(Number(acceptes)||0)/Number(emis)*100:0;
  const yearCountStats=yr=>{
    const h=histFor(yr);
    if(h){
      const sansSuite=Number(h.sansSuite)||0;
      const enCours=Math.max((Number(h.emis)||0)-(Number(h.acceptes)||0)-sansSuite,0);
      return {emis:Number(h.emis)||0,acceptes:Number(h.acceptes)||0,enCours,sansSuite,taux:tauxCompte(h.acceptes,h.emis),source:h.source};
    }
    const yrRows=rows.filter(r=>_dvYear(r)===String(yr));
    const emis=yrRows.length;
    const acceptes=yrRows.filter(r=>r.statut==='Accepté').length;
    const sansSuite=yrRows.filter(r=>['Refusé','Expiré'].includes(r.statut)).length;
    const enCours=Math.max(emis-acceptes-sansSuite,0);
    return {emis,acceptes,enCours,sansSuite,taux:tauxCompte(acceptes,emis),source:'Application'};
  };
  const controlledYears=[...new Set([...Object.keys(HIST_DEVIS_KPI),...rows.map(r=>_dvYear(r)).filter(y=>y!=='—')])].sort((a,b)=>b-a);
  const controlledYearsAsc=[...controlledYears].sort((a,b)=>a-b);

  // ── KPIs globaux corrigés : basés sur les volumes contrôlés, pas uniquement sur les projets déjà intégrés ──
  const globalStats=controlledYears.reduce((acc,yr)=>{
    const st=yearCountStats(yr);
    acc.emis+=st.emis;acc.acceptes+=st.acceptes;acc.enCours+=st.enCours;acc.sansSuite+=st.sansSuite;
    return acc;
  },{emis:0,acceptes:0,enCours:0,sansSuite:0});
  const total=globalStats.emis;
  const acceptes=globalStats.acceptes;
  const enAttente=globalStats.enCours;
  const sansS=globalStats.sansSuite;
  const mtTotal=rows.reduce((s,r)=>s+(Number(r.montant)||0),0);
  const mtAcceptes=rows.filter(r=>r.statut==='Accepté').reduce((s,r)=>s+(Number(r.montant)||0),0);
  const tauxConv=tauxCompte(acceptes,total);
  const kpiEl=document.getElementById('devisKPIs');
  if(kpiEl) kpiEl.innerHTML=`
    <div class="kcard kb"><div class="klbl">Total devis émis</div><div class="kval">${total}</div><div class="ksub">${fmt(mtTotal)}</div></div>
    <div class="kcard kg"><div class="klbl">Acceptés</div><div class="kval">${acceptes}</div><div class="ksub">${fmt(mtAcceptes)} · ${pctFmt(tauxConv)} des devis émis</div></div>
    <div class="kcard ka"><div class="klbl">Non validés / en cours</div><div class="kval">${enAttente}</div><div class="ksub">Devis émis non transformés</div></div>
    <div class="kcard kr"><div class="klbl">Sans suite</div><div class="kval">${sansS}</div><div class="ksub">Refusés ou expirés</div></div>`;

  // ── Tableau par année ──
  const yearTableEl=document.getElementById('devisYearTable');
  if(yearTableEl){
    const allYears=controlledYears;
    let ytHtml=`<table class="ct-table" style="font-size:11px;"><thead><tr>
      <th style="text-align:left;padding-left:10px;">Année</th>
      <th>Devis émis</th>
      <th>Acceptés</th>
      <th>En cours</th>
      <th>Taux transfo.</th>
      <th style="text-align:left;padding-left:8px;">Répartition</th>
    </tr></thead><tbody>`;
    allYears.forEach(yr=>{
      const yrRows=rows.filter(r=>_dvYear(r)===yr);
      const yrStats=yearCountStats(yr);
      const yrEmis=yrStats.emis;
      const yrAcceptedCount=yrStats.acceptes;
      const yrWaitCount=yrStats.enCours;
      const yrBadCount=yrStats.sansSuite;
      const yrTaux=yrStats.taux;
      const isSel=filtAnnee===yr;
      const rowStyle=isSel?'background:var(--month-now);cursor:pointer;':'cursor:pointer;';
      ytHtml+=`<tr class="data-row" style="${rowStyle}" onclick="document.getElementById('filtDevisAnnee').value='${isSel?'':yr}';renderDevisPage()">
        <td style="text-align:left;padding-left:10px;font-weight:${isSel?'700':'500'};color:var(--navy);">${yr}${isSel?' ✓':''}</td>
        <td style="text-align:center;">${yrEmis}</td>
        <td style="text-align:center;color:var(--green);font-weight:600;">${yrAcceptedCount}</td>
        <td style="text-align:center;color:var(--accent);font-weight:600;">${yrWaitCount}</td>
        <td style="text-align:center;font-weight:600;color:${yrTaux>=35?'var(--green)':yrTaux>=20?'var(--accent)':'var(--red)'};" title="Calcul au nombre : devis acceptés / devis émis${yrStats.source==='Excel'?' — source Excel':''}">${pctFmt(yrTaux)}</td>
        <td style="text-align:left;padding-left:8px;">
          ${yrAcceptedCount?`<span class="badge" style="background:#E3F5EC;color:#27AE60;border:1px solid #27AE6033;font-size:9px;margin-right:3px;">${yrAcceptedCount} accepté${yrAcceptedCount>1?'s':''}</span>`:''}
          ${yrWaitCount?`<span class="badge" style="background:#FEF4E5;color:#E8A020;border:1px solid #E8A02033;font-size:9px;margin-right:3px;">${yrWaitCount} non validé${yrWaitCount>1?'s':''}</span>`:''}
          ${yrBadCount?`<span class="badge" style="background:#FDEAEA;color:#E74C3C;border:1px solid #E74C3C33;font-size:9px;">${yrBadCount} sans suite</span>`:''}
        </td>
      </tr>`;
    });
    ytHtml+='</tbody></table>';
    yearTableEl.innerHTML=ytHtml;
  }

  // ── Graphiques ──
  const chartsEl=document.getElementById('devisCharts');
  if(chartsEl){
    const chartYear=filtAnnee||'';
    const chartStats=chartYear?yearCountStats(chartYear):globalStats;
    const allYears2=controlledYears;

    // Bar chart : volumes de devis par année, sur les données contrôlées.
    const barData=allYears2.map(yr=>{
      const st=yearCountStats(yr);
      return {yr,acc:st.acceptes,wait:st.enCours,bad:st.sansSuite,source:st.source,total:st.emis,taux:st.taux};
    });
    const barMax=Math.max(...barData.map(d=>d.total),1);
    const fmtK=v=>String(v)+' devis';

    let barHtml=`<div style="background:var(--bg-card,#fff);border:1px solid var(--border-color,#E5EAF0);border-radius:8px;padding:14px;">
      <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:12px;">Devis par année — volumes contrôlés</div>
      <div style="display:flex;flex-direction:column;gap:8px;">`;
    barData.forEach(d=>{
      const pAcc=Math.round(d.acc/barMax*100);
      const pWait=Math.round(d.wait/barMax*100);
      const pBad=Math.round(d.bad/barMax*100);
      const isSel=filtAnnee===d.yr;
      barHtml+=`<div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="document.getElementById('filtDevisAnnee').value='${isSel?'':d.yr}';renderDevisPage()">
        <div style="font-size:11px;color:var(--gray-dk);width:32px;flex-shrink:0;font-weight:${isSel?700:400};">${d.yr}</div>
        <div style="flex:1;height:18px;border-radius:3px;background:#F1F5F9;overflow:hidden;display:flex;border:${isSel?'1.5px solid var(--accent)':'none'};">
          ${pAcc?`<div style="height:100%;background:#27AE60;width:${pAcc}%;"></div>`:''}
          ${pWait?`<div style="height:100%;background:#E8A020;width:${pWait}%;"></div>`:''}
          ${pBad?`<div style="height:100%;background:#E74C3C;width:${pBad}%;"></div>`:''}
        </div>
        <div style="font-size:10px;color:var(--gray-dk);width:90px;text-align:right;flex-shrink:0;">${fmtK(d.total)} · ${pctFmt(d.taux)}</div>
      </div>`;
    });
    barHtml+=`</div>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--gray-dk);"><div style="width:8px;height:8px;border-radius:2px;background:#27AE60;"></div>Accepté</div>
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--gray-dk);"><div style="width:8px;height:8px;border-radius:2px;background:#E8A020;"></div>Non validé / en cours</div>
        <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--gray-dk);"><div style="width:8px;height:8px;border-radius:2px;background:#E74C3C;"></div>Sans suite</div>
      </div>
    </div>`;

    // Courbe : analyse des taux de transformation par année.
    const lineYears=controlledYearsAsc;
    const lineVals=lineYears.map(yr=>yearCountStats(yr).taux);
    const W=320,H=170,padL=34,padR=14,padT=16,padB=28;
    const maxY=Math.max(50,Math.ceil(Math.max(...lineVals,1)/10)*10);
    const xFor=i=>padL+(lineYears.length<=1?0:i*(W-padL-padR)/(lineYears.length-1));
    const yFor=v=>padT+(maxY-v)*(H-padT-padB)/maxY;
    const pts=lineVals.map((v,i)=>`${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
    let markers='';
    lineVals.forEach((v,i)=>{
      const x=xFor(i),y=yFor(v),yr=lineYears[i];
      markers+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#2D5986" stroke="#fff" stroke-width="1.2"></circle>
        <text x="${x.toFixed(1)}" y="${(y-7).toFixed(1)}" text-anchor="middle" font-size="8" fill="#1A2E44" font-weight="700">${pctFmt(v)}</text>
        <text x="${x.toFixed(1)}" y="${(H-8).toFixed(1)}" text-anchor="middle" font-size="8" fill="#7F8C8D">${yr}</text>`;
    });
    let grid='';
    [0,10,20,30,40,50].filter(v=>v<=maxY).forEach(v=>{
      const y=yFor(v);
      grid+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#E8EEF4" stroke-width="1"></line>
        <text x="${padL-6}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#94A3B8">${v}%</text>`;
    });
    const lineHtml=`<div style="background:var(--bg-card,#fff);border:1px solid var(--border-color,#E5EAF0);border-radius:8px;padding:14px;">
      <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:8px;">Courbe — taux de transformation par année</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="190" role="img" aria-label="Taux de transformation des devis par année">
        ${grid}
        <polyline points="${pts}" fill="none" stroke="#2D5986" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${markers}
      </svg>
      <div style="font-size:10px;color:var(--gray-dk);line-height:1.4;">Analyse au nombre : devis acceptés / devis émis. 2025 = 7 / 32, soit 21,9 %. 2026 = 5 / 19, soit 26,3 %.</div>
    </div>`;

    // Donut de répartition, aligné sur la même classification que les KPI.
    const donutTitle=chartYear?`Répartition — ${chartYear}`:'Répartition — toutes années contrôlées';
    const donutTotal=Math.max(chartStats.emis,1);
    const donutSegs=[
      {lbl:'Validé',color:'#27AE60',v:chartStats.acceptes},
      {lbl:'Non validé / en cours',color:'#E8A020',v:chartStats.enCours},
      {lbl:'Sans suite',color:'#E74C3C',v:chartStats.sansSuite}
    ].filter(s=>s.v>0);
    const R=15.9,CX=18,CY=18,CIRC=2*Math.PI*R;
    let donutOffset=25,donutSvg='',donutLegend='';
    donutSegs.forEach(seg=>{
      const pct=seg.v/donutTotal;
      const dash=pct*CIRC;
      donutSvg+=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${seg.color}" stroke-width="3.2" stroke-dasharray="${dash.toFixed(2)} ${(CIRC-dash).toFixed(2)}" stroke-dashoffset="${(-CIRC+donutOffset).toFixed(2)}"/>`;
      donutOffset+=dash;
      donutLegend+=`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;">
        <div style="display:flex;align-items:center;gap:6px;color:var(--gray-dk);"><div style="width:10px;height:10px;border-radius:50%;background:${seg.color};flex-shrink:0;"></div>${seg.lbl}</div>
        <div style="font-weight:600;color:var(--navy);">${seg.v} <span style="color:var(--gray-mid);font-weight:400;">${pctFmt(seg.v/donutTotal*100)}</span></div>
      </div>`;
    });
    const pieHtml=`<div style="background:var(--bg-card,#fff);border:1px solid var(--border-color,#E5EAF0);border-radius:8px;padding:14px;">
      <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:12px;">${donutTitle}</div>
      <div style="display:flex;align-items:center;gap:16px;">
        <svg width="110" height="110" viewBox="0 0 36 36" style="flex-shrink:0;">
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#F1F5F9" stroke-width="3.2"/>
          ${donutSvg}
          <text x="${CX}" y="${CY+2}" text-anchor="middle" font-size="6" font-weight="700" fill="var(--navy)">${pctFmt(tauxCompte(chartStats.acceptes,chartStats.emis))}</text>
          <text x="${CX}" y="${CY+7}" text-anchor="middle" font-size="3.3" fill="#888">transfo.</text>
        </svg>
        <div style="display:flex;flex-direction:column;gap:7px;flex:1;">${donutLegend}
          <div style="font-size:10px;color:var(--gray-dk);margin-top:4px;">Base : ${chartStats.emis} devis émis — calcul au nombre.</div>
        </div>
      </div>
    </div>`;

    // Camembert année en cours : mêmes catégories, focalisé sur l’année paramétrée.
    const currentYear=String((DB.cfg&&DB.cfg.annee)||new Date().getFullYear());
    const cyStats=yearCountStats(currentYear);
    const cyTotal=Math.max(cyStats.emis,1);
    const cySegs=[
      {lbl:'Validé',color:'#27AE60',v:cyStats.acceptes},
      {lbl:'En cours',color:'#E8A020',v:cyStats.enCours},
      {lbl:'Sans suite',color:'#E74C3C',v:cyStats.sansSuite}
    ].filter(s=>s.v>0);
    let cyOffset=25,cySvg='',cyLegend='';
    cySegs.forEach(seg=>{
      const pct=seg.v/cyTotal;
      const dash=pct*CIRC;
      cySvg+=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${seg.color}" stroke-width="3.2" stroke-dasharray="${dash.toFixed(2)} ${(CIRC-dash).toFixed(2)}" stroke-dashoffset="${(-CIRC+cyOffset).toFixed(2)}"/>`;
      cyOffset+=dash;
      cyLegend+=`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;">
        <div style="display:flex;align-items:center;gap:6px;color:var(--gray-dk);"><div style="width:10px;height:10px;border-radius:50%;background:${seg.color};flex-shrink:0;"></div>${seg.lbl}</div>
        <div style="font-weight:600;color:var(--navy);">${seg.v} devis <span style="color:var(--gray-mid);font-weight:400;">${pctFmt(seg.v/cyTotal*100)}</span></div>
      </div>`;
    });
    if(!cyStats.emis) cyLegend='<div style="font-size:11px;color:var(--gray-dk);">Aucune donnée pour l’année en cours.</div>';
    const currentPieHtml=`<div style="background:var(--bg-card,#fff);border:1px solid var(--border-color,#E5EAF0);border-radius:8px;padding:14px;">
      <div style="font-size:11px;font-weight:600;color:var(--navy);margin-bottom:12px;">Camembert année en cours — ${currentYear}</div>
      <div style="display:flex;align-items:center;gap:16px;">
        <svg width="110" height="110" viewBox="0 0 36 36" style="flex-shrink:0;">
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#F1F5F9" stroke-width="3.2"/>
          ${cySvg}
          <text x="${CX}" y="${CY+2}" text-anchor="middle" font-size="6" font-weight="700" fill="var(--navy)">${pctFmt(tauxCompte(cyStats.acceptes,cyStats.emis))}</text>
          <text x="${CX}" y="${CY+7}" text-anchor="middle" font-size="3.3" fill="#888">transfo.</text>
        </svg>
        <div style="display:flex;flex-direction:column;gap:7px;flex:1;">${cyLegend}
          <div style="font-size:10px;color:var(--gray-dk);margin-top:4px;">Base : ${cyStats.emis} devis émis — calcul au nombre.</div>
        </div>
      </div>
    </div>`;

    chartsEl.innerHTML=barHtml+lineHtml+pieHtml+currentPieHtml;
  }

  // ── Alerts ──
  const alertsEl=document.getElementById('devisAlerts');
  const alerts=[];
  const today=new Date();
  const orphans=(DB.devis||[]).filter(d=>!d.projectId&&!d.aoId);
  if(orphans.length) alerts.push({niveau:'danger',msg:`${orphans.length} devis sans correspondance projet/AO\u00a0: ${orphans.map(d=>d.numero).join(', ')}`});
  const numCount={};rows.forEach(r=>{numCount[r.numero]=(numCount[r.numero]||0)+1;});
  const dups=Object.entries(numCount).filter(([,c])=>c>1).map(([n])=>n);
  if(dups.length) alerts.push({niveau:'warn',msg:`Numéros en double\u00a0: ${dups.join(', ')} — vérifier la numérotation`});
  const overdue=rows.filter(r=>r.statut==='Envoyé'&&r.dateReponseAttendue&&new Date(r.dateReponseAttendue)<today);
  if(overdue.length) alerts.push({niveau:'warn',msg:`${overdue.length} devis envoyé(s) sans réponse après la date prévue`});
  if(alertsEl) alertsEl.innerHTML=alerts.length?`<div style="margin-bottom:14px;">${alerts.map(a=>`<div class="al ${a.niveau==='danger'?'al-r':'al-o'}" style="margin-bottom:6px;cursor:default;"><div class="al-dot ${a.niveau==='danger'?'dot-r':'dot-o'}"></div><div class="al-txt"><span class="al-p">${a.msg}</span></div></div>`).join('')}</div>`:'';

  // ── Table ──
  const tableEl=document.getElementById('devisTable');
  if(!tableEl) return;
  if(!filtered.length){tableEl.innerHTML='<div style="padding:32px;text-align:center;color:var(--gray-mid);">Aucun devis trouvé</div>';return;}

  const rowClick=r=>{
    if(r.source==='projet') openProjectSheet(r.sourceId);
    else if(r.source==='ao') editAo(r.sourceId);
    else editDevisEntry(r.sourceId);
  };
  const actCol=r=>{
    if(r.source==='manuel') return `
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editDevisEntry('${r.sourceId}')" title="Modifier le devis">Édit. devis</button>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();attribuerDevisProjet('${r.sourceId}')" style="background:var(--green);" title="Créer un projet">→ Projet</button>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();attribuerDevisAO('${r.sourceId}')" style="background:var(--blue);" title="Créer une AO">→ AO</button>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteDevisEntry('${r.sourceId}')">×</button>`;
    if(r.source==='projet') return `
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editDevisInfo('${r.numero}')" title="Modifier émetteur, date, notes du devis">Édit. devis</button>
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editProject('${r.sourceId}')" title="Modifier le projet">Édit. projet</button>`;
    if(r.source==='ao') return `
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editDevisInfo('${r.numero}')" title="Modifier émetteur, date, notes du devis">Édit. devis</button>
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editAo('${r.sourceId}')" title="Modifier l'AO">Édit. AO</button>`;
    return '';
  };
  const typeIcon=r=>{
    if(r.source==='projet') return '<span title="Projet actif" style="color:var(--green);font-size:12px;margin-right:4px;">●</span>';
    if(r.source==='ao') return '<span title="AO en cours" style="color:var(--blue);font-size:12px;margin-right:4px;">●</span>';
    return '<span title="Non rattaché" style="color:var(--red);font-size:12px;margin-right:4px;">●</span>';
  };
  const agCourt=ag=>{if(!ag) return '—';const p=ag.split('—');return p[p.length-1].trim();};
  const dateFr=d=>{if(!d) return '—';try{const[y,mo,j]=d.split('-');return `${j}/${mo}/${y}`;}catch(e){return d;}};
  const sortInd=field=>{
    if(!sortVal.startsWith(field)) return '<span style="color:rgba(255,255,255,.4);font-size:10px;"> ⇅</span>';
    return sortDir==='asc'?'<span style="font-size:10px;"> ↑</span>':'<span style="font-size:10px;"> ↓</span>';
  };

  const THL='style="text-align:left;padding-left:10px;"';
  const TDL='style="text-align:left;padding-left:8px;"';

  let html=`<div style="overflow-x:auto;"><table class="ct-table"><thead><tr>
    <th ${THL} style="width:20px;text-align:left;padding-left:8px;"> </th>
    <th onclick="dvThClick('numero')" ${THL} style="cursor:pointer;user-select:none;text-align:left;padding-left:10px;">N° Devis${sortInd('numero')}</th>
    <th onclick="dvThClick('date')" style="cursor:pointer;user-select:none;white-space:nowrap;">Date émission${sortInd('date')}</th>
    <th ${THL} style="min-width:170px;text-align:left;padding-left:10px;">Objet</th>
    <th ${THL} style="min-width:120px;text-align:left;padding-left:10px;">Client</th>
    <th ${THL} style="min-width:110px;text-align:left;padding-left:10px;">Établissement DB</th>
    <th>Émetteur</th>
    <th>Resp. projet</th>
    <th style="text-align:right;">Montant</th>
    <th>Statut</th>
    <th>Actions</th>
  </tr></thead><tbody>`;

  // ── Group by year, sort within each group ──
  const NCOLS=11;

  // Build year groups (sorted by year desc), rows within each group keep filtered sort
  const yearOrder=sortDir==='asc'?1:-1; // if sort is date-asc, years asc; else years desc
  // Always put years in desc order regardless of within-year sort
  const yearGroups={};
  filtered.forEach(r=>{const yr=_dvYear(r);(yearGroups[yr]||(yearGroups[yr]=[])).push(r);});
  const sortedYears=Object.keys(yearGroups).sort((a,b)=>b.localeCompare(a,'fr',{numeric:true}));

  sortedYears.forEach(yr=>{
    const yrRows=yearGroups[yr];
    const yrMt=yrRows.reduce((s,x)=>s+(Number(x.montant)||0),0);
    const yrAcc=yrRows.filter(x=>x.statut==='Accepté').length;
    html+=`<tr class="section-row"><td colspan="${NCOLS}" style="text-align:left;padding-left:12px;">
      ${yr}
      <span class="member-role">${yrRows.length} devis</span>
      ${yrMt>0?`<span class="member-role">· ${fmt(yrMt)}</span>`:''}
      <span class="member-role">· ${yrAcc} accepté(s)</span>
    </td></tr>`;

    yrRows.forEach(r=>{
      const mt=Number(r.montant)||0;
      const rowStyle=r.source==='manuel'?'background:#FFF8F0;':'';
      html+=`<tr class="data-row" style="${rowStyle}cursor:pointer;" onclick="(function(){`;
      if(r.source==='projet') html+=`openProjectSheet('${r.sourceId}')`;
      else if(r.source==='ao') html+=`editAo('${r.sourceId}')`;
      else html+=`editDevisEntry('${r.sourceId}')`;
      html+=`})()">
        <td>${typeIcon(r)}</td>
        <td ${TDL} style="font-weight:700;color:var(--navy);white-space:nowrap;text-align:left;padding-left:8px;">${esc(r.numero)}</td>
        <td style="white-space:nowrap;font-variant-numeric:tabular-nums;">${dateFr(r.dateEmission)}</td>
        <td ${TDL} style="text-align:left;padding-left:8px;"><div style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escAttr(r.objet)}">${esc(r.objet)}</div></td>
        <td ${TDL} style="text-align:left;padding-left:8px;"><div style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escAttr(r.client||'')}">${esc(r.client||'—')}</div></td>
        <td><div style="font-size:11px;color:var(--gray-dk);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escAttr(r.agenceDB||'')}">${esc(agCourt(r.agenceDB))}</div></td>
        <td style="white-space:nowrap;">${esc(r.emetteur||'—')}</td>
        <td style="white-space:nowrap;">${r.responsable?`<span style="color:var(--blue-light);font-weight:600;">${esc(r.responsable)}</span>`:'<span style="color:var(--gray-mid);">—</span>'}</td>
        <td style="text-align:right;font-weight:600;">${mt>0?fmt(mt):'<span style="color:var(--gray-mid);">—</span>'}</td>
        <td>${dvBadge(r.statut)}</td>
        <td><div style="display:flex;gap:3px;flex-wrap:nowrap;" onclick="event.stopPropagation()">${actCol(r)}</div></td>
      </tr>`;
    });
  });
  html+='</tbody></table></div>';
  tableEl.innerHTML=html;
}

function dvThClick(field){
  const sel=document.getElementById('filtDevisSort');if(!sel) return;
  const cur=sel.value;
  sel.value=cur.startsWith(field)?(cur.endsWith('desc')?field+'-asc':field+'-desc'):field+'-desc';
  renderDevisPage();
}

function attribuerDevisProjet(devisId){
  const d=(DB.devis||[]).find(x=>x.id===devisId);if(!d)return;
  devisEnAttribution=d;
  openProjectModal();
  document.getElementById('prName').value=d.objet||'';
  document.getElementById('prClient').value=d.client||'';
  fillAgencySelect('prAgency',d.agenceDB||'');hideAgencyCustom('prAgencyCustom');
  fillMemberSelect('prResp',d.responsable||defaultMemberName());
  document.getElementById('prDevis').value=d.numero||'';
  document.getElementById('prNotes').value=d.notes||'';
  if(Array.isArray(d.missions)&&d.missions.length)document.getElementById('projectMissionGrid').innerHTML=missionGridHtml('prm',d);
  if(Number(d.montant)>0)document.getElementById('prCaCurrent').value=Number(d.montant);
  updateCAHint('pr');
  document.getElementById('mProjectTitle').textContent='Nouveau projet — issu du devis '+d.numero;document.getElementById('prChargeActif').checked=true;document.getElementById('prInclurePrevision').checked=false;
  setTimeout(()=>{const el=document.getElementById('prName');if(el)el.focus();},100);
}

function attribuerDevisAO(devisId){
  const d=(DB.devis||[]).find(x=>x.id===devisId);if(!d)return;
  devisEnAttribution=d;
  openAoModal();
  document.getElementById('aoName').value=d.objet||'';
  document.getElementById('aoClient').value=d.client||'';
  fillAgencySelect('aoAgency',d.agenceDB||'');hideAgencyCustom('aoAgencyCustom');
  fillMemberSelect('aoResp',d.responsable||defaultMemberName());
  document.getElementById('aoDevis').value=d.numero||'';
  document.getElementById('aoDevisDateEmission').value=d.dateEmission||((DB.devisDates||{})[d.numero]||'');
  document.getElementById('aoDate').value=d.dateReponseAttendue||'';
  document.getElementById('aoNotes').value=d.notes||'';
  if(Array.isArray(d.missions)&&d.missions.length){document.getElementById('aoMissionGrid').innerHTML=missionGridHtml('aom',d);}
  if(Number(d.montant)>0)document.getElementById('aoCaCurrent').value=Number(d.montant);
  document.getElementById('aoPhase').value='Offre déposée';
  document.getElementById('mAoTitle').textContent='Nouvelle AO — issue du devis '+d.numero;
  updateCAHint('ao');updateAoHero();
  setTimeout(()=>{const el=document.getElementById('aoName');if(el)el.focus();},100);
}

function _lierDevisApresProjet(projectId){
  if(!devisEnAttribution) return;
  const d=DB.devis.find(x=>x.id===devisEnAttribution.id);
  const p=DB.projets.find(x=>x.id===projectId);
  if(d&&p)syncWorkflowDevisToProject(p,d);
  DB.devisEmetteurs=DB.devisEmetteurs||{};
  if(devisEnAttribution.responsable) DB.devisEmetteurs[devisEnAttribution.numero]=devisEnAttribution.responsable;
  devisEnAttribution=null;
}
function _lierDevisApresAO(aoId){
  if(!devisEnAttribution) return;
  const d=DB.devis.find(x=>x.id===devisEnAttribution.id);
  const a=DB.pipelineAO.find(x=>x.id===aoId);
  if(d&&a)syncWorkflowDevisToAO(a,d);
  DB.devisEmetteurs=DB.devisEmetteurs||{};
  if(devisEnAttribution.responsable) DB.devisEmetteurs[devisEnAttribution.numero]=devisEnAttribution.responsable;
  devisEnAttribution=null;
}

function updateDevisHero(){
  const objet=document.getElementById('dvObjet')?.value||'';
  const client=document.getElementById('dvClient')?.value||'';
  const numero=document.getElementById('dvNumero')?.value||'';
  const statut=document.getElementById('dvStatut')?.value||'Envoyé';
  const montant=Number(document.getElementById('dvMontant')?.value)||0;
  const hn=document.getElementById('dvHeroName');if(hn)hn.textContent=(objet||'NOUVEAU DEVIS').toUpperCase();
  const hc=document.getElementById('dvHeroClient');if(hc)hc.textContent='Client : '+(client||'—');
  const hno=document.getElementById('dvHeroNumero');if(hno)hno.textContent='N° : '+(numero||'—');
  const hs=document.getElementById('dvHeroStatut');if(hs)hs.textContent='Statut : '+statut;
  const hm=document.getElementById('dvHeroMontant');if(hm)hm.textContent='Montant : '+fmt(montant);
}

function bindDevisMissionInputs(){
  document.querySelectorAll('#devisMissionGrid input').forEach(el=>{
    el.addEventListener('input',()=>{
      const missions=collectMissions('dvm');
      const total=missions.reduce((sum,x)=>sum+(Number(x.montant)||0),0);
      document.getElementById('dvMontant').value=total>0?total:'';
      updateDevisHero();
    });
  });
}

function setDevisFullMode(show){
  ['dvIdentificationTitle','dvObjetGrp','dvClientGrp','dvAgencyGrp','dvStatutGrp','dvMissionsTitle','devisMissionGrid','dvMontantGrp'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display=show?'':'none';
  });
}

function editDevisInfo(numero){
  DB.devisEmetteurs=DB.devisEmetteurs||{};
  DB.devisDates=DB.devisDates||{};
  DB.devisNotes=DB.devisNotes||{};
  editDevisId='__info__:'+numero;
  document.getElementById('mDevisTitle').textContent='Devis '+numero+' — Émetteur · Date · Notes';
  fillMemberSelect('dvResp',DB.devisEmetteurs[numero]||defaultMemberName());
  setDevisFullMode(false);
  const elN=document.getElementById('dvNumero');elN.value=numero;elN.readOnly=true;elN.style.opacity='0.55';
  document.getElementById('dvDateEmission').value=DB.devisDates[numero]||'';
  document.getElementById('dvDateReponse').value='';
  document.getElementById('dvNotes').value=DB.devisNotes[numero]||'';
  document.getElementById('dvObjet').value='Devis '+numero;document.getElementById('dvClient').value='';document.getElementById('dvMontant').value='';
  document.getElementById('dvStatut').value='Envoyé';
  updateDevisHero();
  document.getElementById('mDevis').classList.add('open');
}

function openDevisModal(){
  editDevisId=null;
  document.getElementById('mDevisTitle').textContent='Nouveau devis';
  fillMemberSelect('dvResp',defaultMemberName());
  setDevisFullMode(true);
  ['dvNumero','dvDateEmission','dvDateReponse','dvObjet','dvClient','dvMontant','dvNotes'].forEach(id=>{const el=document.getElementById(id);if(el){el.value='';el.readOnly=false;el.style.opacity='';}});
  document.getElementById('dvStatut').value='Envoyé';
  fillAgencySelect('dvAgency','');hideAgencyCustom('dvAgencyCustom');
  document.getElementById('devisMissionGrid').innerHTML=missionGridHtml('dvm');
  bindDevisMissionInputs();
  updateDevisHero();
  document.getElementById('mDevis').classList.add('open');
}

function editDevisEntry(id){
  const d=(DB.devis||[]).find(x=>x.id===id);if(!d)return;
  editDevisId=id;
  document.getElementById('mDevisTitle').textContent='Modifier devis';
  fillMemberSelect('dvResp',d.responsable||defaultMemberName());
  setDevisFullMode(true);
  const elN=document.getElementById('dvNumero');elN.value=d.numero||'';elN.readOnly=false;elN.style.opacity='';
  document.getElementById('dvDateEmission').value=d.dateEmission||'';
  document.getElementById('dvDateReponse').value=d.dateReponseAttendue||'';
  document.getElementById('dvObjet').value=d.objet||'';
  document.getElementById('dvClient').value=d.client||'';
  fillAgencySelect('dvAgency',d.agenceDB||'');hideAgencyCustom('dvAgencyCustom');
  document.getElementById('devisMissionGrid').innerHTML=missionGridHtml('dvm',d);
  bindDevisMissionInputs();
  document.getElementById('dvMontant').value=Number(d.montant)||'';
  document.getElementById('dvStatut').value=d.statut||'Envoyé';
  document.getElementById('dvNotes').value=d.notes||'';
  updateDevisHero();
  document.getElementById('mDevis').classList.add('open');
}

function saveDevisEntry(){
  const numero=document.getElementById('dvNumero').value.trim();

  if(editDevisId&&editDevisId.startsWith('__info__:')){
    const dateEm=document.getElementById('dvDateEmission').value||'';
    const resp=document.getElementById('dvResp').value;
    const notes=document.getElementById('dvNotes').value.trim();
    DB.devisDates=DB.devisDates||{};if(dateEm)DB.devisDates[numero]=dateEm;else delete DB.devisDates[numero];
    DB.devisEmetteurs=DB.devisEmetteurs||{};if(resp)DB.devisEmetteurs[numero]=resp;
    DB.devisNotes=DB.devisNotes||{};if(notes)DB.devisNotes[numero]=notes;else delete DB.devisNotes[numero];
    const elN=document.getElementById('dvNumero');if(elN){elN.readOnly=false;elN.style.opacity='';}
    editDevisId=null;saveDB();closeM('mDevis');renderDevisPage();toast('Devis mis à jour','ok');return;
  }

  const objet=document.getElementById('dvObjet').value.trim();
  if(!numero){toast('N° de devis obligatoire','err');return;}
  if(!objet){toast('Objet obligatoire','err');return;}
  DB.devis=DB.devis||[];
  if(!editDevisId){
    const allNums=[...(DB.projets||[]).map(p=>p.devis),...(DB.pipelineAO||[]).map(a=>a.devis),...(DB.devis||[]).map(d=>d.numero)].filter(Boolean);
    if(allNums.includes(numero)){toast('Ce numéro de devis existe déjà dans le suivi','err');return;}
  }
  const dateEm=document.getElementById('dvDateEmission').value||'';
  const resp=document.getElementById('dvResp').value;
  const missions=collectMissions('dvm');
  const missionTotal=missions.reduce((sum,x)=>sum+(Number(x.montant)||0),0);
  const manualTotal=Number(document.getElementById('dvMontant').value)||0;
  const montant=missionTotal>0?missionTotal:manualTotal;
  const agenceDB=(document.getElementById('dvAgencyCustom')&&document.getElementById('dvAgencyCustom').style.display!=='none'&&document.getElementById('dvAgencyCustom').value.trim()?document.getElementById('dvAgencyCustom').value.trim():document.getElementById('dvAgency').value.trim());
  DB.devisDates=DB.devisDates||{};if(dateEm)DB.devisDates[numero]=dateEm;
  DB.devisEmetteurs=DB.devisEmetteurs||{};if(resp)DB.devisEmetteurs[numero]=resp;
  const data={
    numero,dateEmission:dateEm,dateReponseAttendue:document.getElementById('dvDateReponse').value||'',
    objet,client:document.getElementById('dvClient').value.trim(),agenceDB,responsable:resp,
    missions,montant,statut:document.getElementById('dvStatut').value,notes:document.getElementById('dvNotes').value.trim(),
    projectId:null,aoId:null
  };
  if(editDevisId){
    const i=DB.devis.findIndex(x=>x.id===editDevisId);
    if(i>=0){
      const old=DB.devis[i];const links={projectId:old.projectId||null,aoId:old.aoId||null};
      DB.devis[i]={...old,...data,...links};const item=DB.devis[i];
      const p=item.projectId?(DB.projets||[]).find(x=>x.id===item.projectId):null;
      const a=item.aoId?(DB.pipelineAO||[]).find(x=>x.id===item.aoId):null;
      const aa=item.aoId?DB.workflowArchives?.ao?.[item.aoId]:null;
      [p,a,aa].filter(Boolean).forEach(target=>{target.devis=item.numero;target.devisId=item.id;if(item.dateEmission)target.dateDevisEmission=item.dateEmission;});
      stampHistory(item,'Devis modifié');
    }
  }else{
    const item={id:uid('dv'),...data};stampHistory(item,'Devis créé');DB.devis.push(item);
  }
  saveDB();closeM('mDevis');renderDevisPage();toast('Devis enregistré','ok');
}

function deleteDevisEntry(id){
  const d=(DB.devis||[]).find(x=>x.id===id);if(!d)return;
  if(d.projectId||d.aoId){toast('Ce devis est lié à un AO ou un projet : supprimez ou rebasculez d’abord le dossier lié.','err');return;}
  if(!confirm('Supprimer ce devis ?')) return;
  DB.devis=(DB.devis||[]).filter(x=>x.id!==id);
  saveDB();renderDevisPage();toast('Devis supprimé','ok');
}
