(function(){
  const STORAGE_KEY='dcn_v3_db_dashboard_previsions_v1';
  const IMPORTED_FORECASTS=[]; // Les prévisions proviennent désormais de Google Sheets.

  function normalizeKey(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }
  function round2(n){ return Math.round((Number(n)||0)*100)/100; }
  function sumArr(arr){ return (arr||[]).reduce((s,v)=>s+(Number(v)||0),0); }
  function distributedMonthly(total, project){
    total=Number(total)||0;
    const arr=new Array(12).fill(0);
    if(!total) return arr;
    let months=(typeof projectActiveMonthsInYear==='function')?projectActiveMonthsInYear(project, DB.cfg.annee):[...Array(12).keys()];
    if(!months||!months.length) months=[...Array(12).keys()];
    const base=Math.floor((total/months.length)*100)/100;
    months.forEach(i=>arr[i]=base);
    let remainder=round2(total - sumArr(arr));
    let idx=0;
    while(remainder>0.0001 && idx<months.length*5){
      const mi=months[idx%months.length];
      arr[mi]=round2(arr[mi]+0.01);
      remainder=round2(remainder-0.01);
      idx++;
    }
    return arr;
  }
  function findImportedForecast(project){
    const code=normalizeKey((project.code||'').replace(/-/g,' '));
    const name=normalizeKey(project.nom||'');
    return IMPORTED_FORECASTS.find(f=> (f.keyCode && f.keyCode===code) || (f.keyName && f.keyName===name));
  }
  function getForecastEntry(projectId){
    DB.previsionsFacturation = DB.previsionsFacturation || [];
    return DB.previsionsFacturation.find(x=>x.projectId===projectId) || null;
  }
  function setForecastEntry(projectId, payload){
    DB.previsionsFacturation = DB.previsionsFacturation || [];
    const i=DB.previsionsFacturation.findIndex(x=>x.projectId===projectId);
    const value={projectId, before:0, months:new Array(12).fill(0), after:0, source:'manual', ...payload};
    if(i>=0) DB.previsionsFacturation[i]=value;
    else DB.previsionsFacturation.push(value);
    return value;
  }
  function syncProjectFromForecast(projectId){
    const p=DB.projets.find(x=>x.id===projectId);
    const e=getForecastEntry(projectId);
    if(!p || !e) return;
    const f=DCNCalc.normalizeForecast(e);
    p.caAnneesPrecedentes=round2(f.before);
    p.caAnneeEnCours=round2(f.yearTotal);
    p.caAnneesSuivantes=round2(f.after);
  }
  function syncAllProjectsFromForecast(){
    (DB.projets||[]).forEach(p=>syncProjectFromForecast(p.id));
  }
  function ensureForecastForProject(project, preferProjectValues=false){
    let entry=getForecastEntry(project.id);
    if(!entry){
      const imported=findImportedForecast(project);
      if(imported){
        entry=setForecastEntry(project.id, {before: imported.before||0, months:(imported.months||new Array(12).fill(0)).map(v=>Number(v)||0), after: imported.after||0, source:'excel'});
      } else {
        entry=setForecastEntry(project.id, {before:Number(project.caAnneesPrecedentes)||0, months:distributedMonthly(Number(project.caAnneeEnCours)||0, project), after:Number(project.caAnneesSuivantes)||0, source:'derived'});
      }
    } else if(preferProjectValues){
      entry.before=Number(project.caAnneesPrecedentes)||0;
      entry.after=Number(project.caAnneesSuivantes)||0;
      entry.months=distributedMonthly(Number(project.caAnneeEnCours)||0, project);
      entry.source='project-form';
    }
    syncProjectFromForecast(project.id);
  }
  function ensureForecastStore(){
    DB.previsionsFacturation = DB.previsionsFacturation || [];
    (DB.projets||[]).forEach(p=>ensureForecastForProject(p,false));
    const projectIds=new Set((DB.projets||[]).map(p=>p.id));
    DB.previsionsFacturation = DB.previsionsFacturation.filter(x=>projectIds.has(x.projectId));
    syncAllProjectsFromForecast();
  }
  function calcForecastGap(project, entry){
    return round2(DCNCalc.normalizeForecast(entry).grandTotal-calcMontantTotal(project));
  }
  function smartForecastSuggestion(project, entry){
    const total=round2(calcMontantTotal(project));
    const empty={before:0,months:new Array(12).fill(0),after:0,total,method:'none'};
    if(total<=0) return empty;
    const year=Number(DB.cfg.annee)||new Date().getFullYear();
    const start=project?.dateDebut?new Date(project.dateDebut+'T12:00:00'):null;
    const end=project?.dateFin?new Date(project.dateFin+'T12:00:00'):null;
    if(start && end && !isNaN(start) && !isNaN(end) && end>=start){
      const sy=start.getFullYear(), sm=start.getMonth(), ey=end.getFullYear(), em=end.getMonth();
      const count=(ey-sy)*12+(em-sm)+1;
      if(count>0 && count<=360){
        const cents=Math.round(total*100), base=Math.floor(cents/count), rem=cents-base*count;
        const result={before:0,months:new Array(12).fill(0),after:0,total,method:'dates'};
        for(let k=0;k<count;k++){
          const d=new Date(sy,sm+k,1);
          const amount=(base+(k<rem?1:0))/100;
          if(d.getFullYear()<year) result.before=round2(result.before+amount);
          else if(d.getFullYear()>year) result.after=round2(result.after+amount);
          else result.months[d.getMonth()]=round2(result.months[d.getMonth()]+amount);
        }
        return result;
      }
    }
    const f=entry?DCNCalc.normalizeForecast(entry):DCNCalc.normalizeForecast(null);
    if(f.grandTotal>0){
      const buckets=[f.before,...f.months,f.after];
      const current=buckets.reduce((s,v)=>s+(Number(v)||0),0);
      if(current>0){
        let cents=Math.round(total*100), weights=buckets.map(v=>Math.max(0,Number(v)||0));
        const weightTotal=weights.reduce((s,v)=>s+v,0);
        let vals=weights.map(w=>Math.floor(cents*w/weightTotal));
        let used=vals.reduce((s,v)=>s+v,0), remain=cents-used, i=0;
        while(remain>0){vals[i%vals.length]++;remain--;i++;}
        return {before:vals[0]/100,months:vals.slice(1,13).map(v=>v/100),after:vals[13]/100,total,method:'shape'};
      }
    }
    return {before:0,months:distributedMonthly(total,project),after:0,total,method:'year'};
  }
  function smartForecastState(project,entry){
    const f=DCNCalc.normalizeForecast(entry), projectTotal=round2(calcMontantTotal(project)), gap=round2(f.grandTotal-projectTotal);
    if(projectTotal<=0) return {kind:'amount',label:'Montant projet à renseigner',projectTotal,forecastTotal:f.grandTotal,gap};
    if(f.grandTotal<=0.01) return {kind:'missing',label:'Prévision à compléter',projectTotal,forecastTotal:f.grandTotal,gap};
    const suggestion=smartForecastSuggestion(project,entry);
    const expectedCurrent=sumArr(suggestion.months);
    if(expectedCurrent>1 && f.yearTotal<=0.01) return {kind:'detail',label:'Ventilation mensuelle à compléter',projectTotal,forecastTotal:f.grandTotal,gap};
    if(Math.abs(gap)>1) return {kind:'gap',label:`Écart ${fmt(gap)}`,projectTotal,forecastTotal:f.grandTotal,gap};
    return {kind:'ok',label:'Prévision cohérente',projectTotal,forecastTotal:f.grandTotal,gap};
  }
  function forecastControlHTML(project,entry){
    const s=smartForecastState(project,entry);
    const cls=s.kind==='ok'?'sf-ok':(s.kind==='gap'?'sf-bad':((s.kind==='missing'||s.kind==='detail'||s.kind==='amount')?'sf-warn':'sf-neutral'));
    const icon=s.kind==='ok'?'✓':(s.kind==='gap'?'⚠':((s.kind==='missing'||s.kind==='detail'||s.kind==='amount')?'◇':'•'));
    return `<div class="sf-control ${cls}"><div class="sf-line"><span>Montant projet</span><b>${fmt(s.projectTotal)}</b></div><div class="sf-line"><span>Prévision totale</span><b>${fmt(s.forecastTotal)}</b></div><div class="sf-pill">${icon} ${s.label}</div></div>`;
  }
  function setSmartForecast(project,entry,suggestion,action){
    entry.before=round2(suggestion.before||0);
    entry.months=(suggestion.months||new Array(12).fill(0)).map(v=>round2(v));
    entry.after=round2(suggestion.after||0);
    entry.source='smart-auto';
    entry.smartMethod=suggestion.method||'auto';
    entry.smartGeneratedAt=new Date().toISOString();
    if(typeof stampHistory==='function') stampHistory(entry,action||'Prévision automatique proposée');
    syncProjectFromForecast(project.id);
  }
  function applySmartForecast(projectId){
    const p=DB.projets.find(x=>x.id===projectId), e=getForecastEntry(projectId);
    if(!p||!e) return;
    const total=calcMontantTotal(p);
    if(total<=0){toast('Montant du projet à renseigner avant la répartition automatique','err');return;}
    const f=DCNCalc.normalizeForecast(e);
    if(f.grandTotal>0 && !confirm(`Recalculer automatiquement la prévision de « ${p.nom} » ?\n\nLa ventilation actuelle sera remplacée par une proposition basée en priorité sur les dates du projet.`)) return;
    const suggestion=smartForecastSuggestion(p,e);
    setSmartForecast(p,e,suggestion,'Prévision automatique appliquée');
    saveDB();renderPrevisionsPage();renderDashboard();renderProjectsPage();
    const msg=suggestion.method==='dates'?'Prévision répartie automatiquement selon les dates du projet':'Prévision automatique proposée';
    toast(msg,'ok');
  }
  function completeEmptySmartForecasts(){
    const targets=(DB.projets||[]).filter(p=>isForecastProject(p)).map(p=>({p,e:getForecastEntry(p.id)})).filter(x=>x.e && calcMontantTotal(x.p)>0 && DCNCalc.normalizeForecast(x.e).grandTotal<=0.01);
    if(!targets.length){toast('Aucune prévision vide à compléter','ok');return;}
    if(!confirm(`Compléter automatiquement ${targets.length} prévision(s) vide(s) ?\n\nLes prévisions déjà renseignées ne seront pas modifiées.`)) return;
    targets.forEach(({p,e})=>setSmartForecast(p,e,smartForecastSuggestion(p,e),'Prévision vide complétée automatiquement'));
    saveDB();renderPrevisionsPage();renderDashboard();renderProjectsPage();
    toast(`${targets.length} prévision(s) complétée(s)`,'ok');
  }
  window.applySmartForecast=applySmartForecast;
  window.completeEmptySmartForecasts=completeEmptySmartForecasts;
  window.smartForecastState=smartForecastState;
  function saveForecastCell(projectId, field, monthIndex, value){
    const e=getForecastEntry(projectId);
    if(!e) return;
    const num=Number(value)||0;
    if(field==='before') e.before=num;
    else if(field==='after') e.after=num;
    else if(field==='month') e.months[monthIndex]=num;
    e.source='manual';
    if(typeof stampHistory==='function') stampHistory(e,'Prévision modifiée');
    syncProjectFromForecast(projectId);
    saveDB();
    renderPrevisionsPage();
    renderDashboard();
    renderProjectsPage();
  }
  window.saveForecastCell=saveForecastCell;
  window.getForecastEntry=getForecastEntry;
  window.calcForecastGap=calcForecastGap;
  function deleteForecast(projectId){
    const p=DB.projets.find(x=>x.id===projectId);
    const e=getForecastEntry(projectId);
    if(!p || !e) return;
    if(!confirm(`Supprimer la prévision de facturation 2026 de "${p.nom}" ?`)) return;
    e.before=0;
    e.months=new Array(12).fill(0);
    e.after=0;
    e.source='manual';
    stampHistory(e,'Prévision supprimée');
    syncProjectFromForecast(projectId);
    saveDB();
    renderPrevisionsPage();
    renderDashboard();
    renderProjectsPage();
    toast('Prévision supprimée','ok');
  }
  window.deleteForecast=deleteForecast;
  window.saveDB=function(){ if(typeof markDirty==='function') markDirty(); if(window.DCN_SYNC)window.DCN_SYNC.schedule(DB); return true; };

  window.calcCAProjet=function(p){
    const e=(p&&p.id)?getForecastEntry(p.id):null;
    if(e) return {avant:Number(e.before)||0, courant:round2(sumArr(e.months)), apres:Number(e.after)||0};
    return {avant:Number(p?.caAnneesPrecedentes)||0, courant:Number(p?.caAnneeEnCours)||0, apres:Number(p?.caAnneesSuivantes)||0};
  };
  window.isForecastProject=function(p){
    return !!p && (p.statut==='En cours' || p.inclurePrevision===true || isRegieProject(p));
  };
  window.calcCAAnneeEnCours=function(){ return round2((DB.projets||[]).filter(isForecastProject).reduce((s,p)=>s+calcCAProjet(p).courant,0)); };
  window.calcCAGlobal=function(){ return (DB.projets||[]).filter(isForecastProject).reduce((acc,p)=>{ const ca=calcCAProjet(p); acc.avant+=ca.avant; acc.courant+=ca.courant; acc.apres+=ca.apres; return acc; }, {avant:0,courant:0,apres:0}); };
  window.calcCAMonthly2026=function(){
    const arr=new Array(12).fill(0);
    (DB.projets||[]).filter(isForecastProject).forEach(p=>{
      const e=getForecastEntry(p.id);
      const months=e?e.months:distributedMonthly(Number(p.caAnneeEnCours)||0,p);
      months.forEach((v,i)=>arr[i]+=Number(v)||0);
    });
    return arr.map(v=>round2(v));
  };
  window.calcCAJanToCurrentMonth=function(){ return round2(calcCAMonthly2026().slice(0, ACTIVE_MONTH+1).reduce((s,v)=>s+v,0)); };

  function upgradeSmartForecastPage(page){
    if(!page) return;
    const sbar=page.querySelector('.sbar');
    if(sbar && !page.querySelector('#btnForecastAutoEmpty')){
      const right=sbar.querySelector('div[style*="margin-left:auto"]');
      if(right){
        const btn=document.createElement('button');btn.className='btn btn-accent sf-auto-btn';btn.id='btnForecastAutoEmpty';btn.innerHTML='✨ Compléter les prévisions vides';btn.onclick=completeEmptySmartForecasts;right.insertBefore(btn,right.firstChild);
      }
    }
    const k=page.querySelector('#forecastKpis');if(k)k.style.gridTemplateColumns='repeat(6,1fr)';
    const heads=[...page.querySelectorAll('.forecast-table thead th')];
    const gapHead=heads.find(th=>th.textContent.trim()==='Écart');if(gapHead)gapHead.textContent='Contrôle';
    const legend=page.querySelector('.charge-legend');
    if(legend && !legend.querySelector('[data-smart-legend]')){
      const chip=document.createElement('span');chip.className='chip';chip.dataset.smartLegend='1';chip.innerHTML='<span class="charge-dot" style="background:#F59E0B"></span>Auto = proposition selon dates';legend.appendChild(chip);
    }
  }
  function injectForecastPage(){
    const existing=document.getElementById('page-previsions');
    if(existing){upgradeSmartForecastPage(existing);return;}
    const monthHeaders = MOIS.map(m=>`<th>${m}</th>`).join('');
    const page=document.createElement('div');
    page.className='page';
    page.id='page-previsions';
    page.innerHTML=`
      <div class="sbar">
        <input class="fi" id="srchForecast" placeholder="Rechercher un projet..." oninput="renderPrevisionsPage()" style="max-width:240px;">
        <select class="fs" id="filtForecastResp" onchange="renderPrevisionsPage()"><option value="">Tous responsables</option></select>
        <select class="fs" id="filtForecastStatus" onchange="renderPrevisionsPage()"><option value="">Projets en cours</option></select>
        <div style="margin-left:auto;display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="renderPrevisionsPage()">Actualiser</button>
        </div>
      </div>
      <div class="kgrid" style="grid-template-columns:repeat(6,1fr);margin-bottom:14px;" id="forecastKpis"></div>
      <div class="card" style="margin-bottom:14px;">
        <div class="ch"><span class="ct">Prévisions facturation 2026</span><span id="forecastCount"></span></div>
        <div class="cb" style="padding:10px 16px 0 16px;">
          <div class="charge-legend">
            <span class="chip"><span class="charge-dot" style="background:#2563EB"></span>Projet en cours</span>
            <span class="chip"><span class="charge-dot" style="background:#F59E0B"></span>Projet basculé AO</span>
            <span class="chip"><span class="charge-dot" style="background:#DBEAFE"></span>Cellule renseignée</span>
          </div>
        </div>
        <div class="tw"><table class="forecast-table">
          <thead><tr>
            <th>Projet</th><th>N° Devis</th><th>Statut</th><th>Resp.</th><th class="col-years-prev">Avant 2026</th>
            ${monthHeaders}
            <th>Total 2026</th><th class="col-years-next">Après 2026</th><th>Écart</th><th style="text-align:center;width:52px;">🔔</th><th>Actions</th>
          </tr></thead>
          <tbody id="tbForecast"></tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Portefeuille 2026 par mois</span></div>
        <div class="cb"><div class="chart-box"><canvas id="chartForecast"></canvas></div><div class="chart-metrics" id="chartForecastSummary"></div></div>
      </div>`;
    document.getElementById('main').insertBefore(page, document.getElementById('page-facturation'));
    upgradeSmartForecastPage(page);
  }

  function getMoneyInputClass(v){
    const n=Math.abs(Number(v)||0);
    if(!n) return '';
    if(n>=10000) return 'is-strong';
    if(n>=5000) return 'is-mid';
    return 'is-filled';
  }
  function forecastRowType(p){
    return p.phase || p.sourceMode==='PROJET' || /AO|appel/i.test(p.notes||'') ? 'ao' : 'projet';
  }
  function focusTableRow(el){
    const tr=el.closest('tr');
    if(!tr) return;
    tr.parentElement.querySelectorAll('tr.row-focus').forEach(r=>r.classList.remove('row-focus'));
    tr.classList.add('row-focus');
  }
  function bindGridNavigation(scopeSelector){
    document.querySelectorAll(scopeSelector).forEach(input=>{
      input.addEventListener('focus',()=>focusTableRow(input));
      input.addEventListener('keydown',e=>{
        if(e.key!=='Enter') return;
        e.preventDefault();
        const row=input.closest('tr');
        if(!row) return;
        const col=Number(input.dataset.col||0);
        let next=row.nextElementSibling;
        while(next){
          const target=next.querySelector(`[data-col="${col}"]`);
          if(target){ target.focus(); target.select?.(); return; }
          next=next.nextElementSibling;
        }
      });
    });
  }
  window.renderPrevisionsPage=function(){
    ensureForecastStore();
    upgradeSmartForecastPage(document.getElementById('page-previsions'));
    const search=(document.getElementById('srchForecast')?.value||'').toLowerCase();
    const respSel=document.getElementById('filtForecastResp');
    if(respSel){
      const current=respSel.value;
      respSel.innerHTML='<option value="">Tous responsables</option>'+DB.membres.map(m=>`<option ${m.nom===current?'selected':''}>${m.nom}</option>`).join('');
    }
    const resp=respSel?.value||'';
    const st=document.getElementById('filtForecastStatus')?.value||'';
    // Prévisions : les projets actifs doivent rester visibles même si l'ancien drapeau inclurePrevision=false est présent dans les données.
    let list=(DB.projets||[]).filter(p=>(['En cours','A venir'].includes(p.statut) || isRegieProject(p) || p.inclurePrevision===true) && getForecastEntry(p.id));
    if(search) list=list.filter(p=>[p.code||'',p.nom||'',p.client||'',p.agenceDB||''].join(' ').toLowerCase().includes(search));
    if(resp) list=list.filter(p=>p.responsable===resp);
    if(st) list=list.filter(p=>p.statut===st);
    // Ordre volontairement stable : on conserve l'ordre de DB.projets pour éviter que les lignes ne sautent après modification d'un montant.
    const totals={before:0,after:0,months:new Array(12).fill(0),gaps:0,missing:0,ok:0,projectAmount:0,forecastAmount:0};
    const rows=list.map(p=>{
      const e=getForecastEntry(p.id);
      const total2026=sumArr(e.months);
      const gap=calcForecastGap(p,e);
      const smart=smartForecastState(p,e);
      const rowType=forecastRowType(p);
      const firstClass=rowType==='ao'?'ao-cell':'proj-cell';
      const nameClass=rowType==='ao'?'forecast-project-name forecast-ao':'forecast-project-name';
      totals.before += Number(e.before)||0;
      totals.after += Number(e.after)||0;
      e.months.forEach((v,i)=>totals.months[i]+=Number(v)||0);
      totals.projectAmount+=smart.projectTotal;
      totals.forecastAmount+=smart.forecastTotal;
      if(smart.kind==='gap')totals.gaps++;else if(smart.kind==='missing'||smart.kind==='detail'||smart.kind==='amount')totals.missing++;else if(smart.kind==='ok')totals.ok++;
      return `<tr class="forecast-row ${rowType==='ao'?'forecast-row-ao':''}">
        <td class="${firstClass} project-sheet-link" data-project-id="${p.id}" onclick="openProjectSheet('${p.id}')" title="Cliquer pour ouvrir la fiche"><div style="font-weight:600">${p.code||'—'}</div><span class="${nameClass}">${p.nom}</span></td>
        <td style="font-size:11px;font-family:monospace;color:var(--blue);white-space:nowrap;">${p.devis||'—'}</td>
        <td>${badgeStatus(p.statut)} ${billingBadge(p)}${p.inclurePrevision===true&&p.statut!=='En cours'?'<span class="badge" style="background:#EDE9FE;color:#6D28D9;margin-left:3px;" title="Inclus manuellement dans les prévisions">⊕ Forcé</span>':''}</td>
        <td>${p.responsable||'—'}</td>
        <td class="col-years-prev"><input class="input-money ${getMoneyInputClass(e.before)}" value="${Number(e.before)||''}" data-col="0" onchange="saveForecastCell('${p.id}','before',null,this.value);this.className='input-money '+getMoneyInputClass(this.value)"></td>
        ${e.months.map((v,i)=>`<td><input class="input-money ${getMoneyInputClass(v)}" value="${Number(v)||''}" data-col="${i+1}" onchange="saveForecastCell('${p.id}','month',${i},this.value);this.className='input-money '+getMoneyInputClass(this.value)"></td>`).join('')}
        <td class="amount"><strong>${fmt(total2026)}</strong></td>
        <td class="col-years-next"><input class="input-money ${getMoneyInputClass(e.after)}" value="${Number(e.after)||''}" data-col="13" onchange="saveForecastCell('${p.id}','after',null,this.value);this.className='input-money '+getMoneyInputClass(this.value)"></td>
        <td>${forecastControlHTML(p,e)}</td>
        <td style="text-align:center;">${dcnAlerteBadge(p,'projet')}</td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap;"><button class="btn btn-outline btn-sm" onclick="editProject('${p.id}')">Edit.</button><button class="btn btn-outline btn-sm sf-auto-btn" onclick="applySmartForecast('${p.id}')" title="Proposer une ventilation automatique basée sur les dates du projet">✨ Auto</button><button class="btn btn-accent btn-sm" onclick="revertProjectToAo('${p.id}')">AO</button><button class="btn btn-danger btn-sm" onclick="deleteForecast('${p.id}')">x</button></div></td>
      </tr>`;
    });
    const total2026=totals.months.reduce((s,v)=>s+v,0);
    const portfolioGap=round2(totals.forecastAmount-totals.projectAmount);
    const portfolioControl=`<div class="sf-control ${Math.abs(portfolioGap)<=1?'sf-ok':'sf-bad'}"><div class="sf-line"><span>Montant projets</span><b>${fmt(totals.projectAmount)}</b></div><div class="sf-line"><span>Prévision totale</span><b>${fmt(totals.forecastAmount)}</b></div><div class="sf-pill">${Math.abs(portfolioGap)<=1?'✓ Cohérent':'⚠ Écart '+fmt(portfolioGap)}</div></div>`;
    document.getElementById('tbForecast').innerHTML = rows.join('') + `<tr class="total-row"><td><strong>TOTAL</strong></td><td></td><td></td><td></td><td class="amount col-years-prev"><strong>${fmt(totals.before)}</strong></td>${totals.months.map(v=>`<td class="amount"><strong>${fmt(v)}</strong></td>`).join('')}<td class="amount"><strong>${fmt(total2026)}</strong></td><td class="amount col-years-next"><strong>${fmt(totals.after)}</strong></td><td>${portfolioControl}</td><td></td><td></td></tr>`;
    document.getElementById('forecastCount').textContent = `${list.length} projet(s)`;
    const janToCurrent=totals.months.slice(0, ACTIVE_MONTH+1).reduce((s,v)=>s+v,0);
    const rest=total2026-janToCurrent;
    const toTreat=totals.gaps+totals.missing;
    document.getElementById('forecastKpis').innerHTML=`
      <div class="kcard kb"><div class="klbl">Prévision totale 2026</div><div class="kval">${fmt(total2026)}</div></div>
      <div class="kcard ka"><div class="klbl">Jan → mois courant</div><div class="kval">${fmt(janToCurrent)}</div></div>
      <div class="kcard kg"><div class="klbl">Reste année</div><div class="kval">${fmt(rest)}</div></div>
      <div class="kcard kb"><div class="klbl">Montant projets</div><div class="kval">${fmt(totals.projectAmount)}</div><div class="ksub">Périmètre affiché</div></div>
      <div class="kcard kg"><div class="klbl">Prévisions cohérentes</div><div class="kval">${totals.ok}</div><div class="ksub">sur ${list.length} projet(s)</div></div>
      <div class="kcard ${toTreat?'kr':'kg'}"><div class="klbl">À traiter</div><div class="kval">${toTreat}</div><div class="ksub">${totals.gaps} écart(s) · ${totals.missing} à compléter</div></div>`;
    document.getElementById('chartForecastSummary').innerHTML = [
      ['Total 2026', fmt(total2026)],
      ['Prévision portefeuille', fmt(totals.forecastAmount)],
      ['Écart portefeuille', fmt(round2(totals.forecastAmount-totals.projectAmount))],
      ['Mois le plus fort', fmt(Math.max(...totals.months))]
    ].map(x=>`<div class="chart-metric"><div class="lbl">${x[0]}</div><div class="val">${x[1]}</div></div>`).join('');
    if(typeof upsertChart==='function'){
      upsertChart('forecast','chartForecast',{type:'bar',data:{labels:MOIS,datasets:[{label:'Prévision de facturation',data:totals.months,backgroundColor:'rgba(45,89,134,.8)',borderWidth:0,maxBarThickness:36}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>formatK(ctx.parsed.y)}}},scales:{y:{beginAtZero:true,ticks:{callback:(v)=>formatK(v)}},x:{ticks:{maxRotation:0,minRotation:0}}}}});
    }
    bindGridNavigation('#tbForecast input');
  }

  const oldRenderPage=window.renderPage;
  window.renderPage=function(id){
    if(id==='previsions'){ const r=renderPrevisionsPage(); if(typeof enhanceProjectSheetLinks==='function')setTimeout(enhanceProjectSheetLinks,0); return r; }
    const r=oldRenderPage(id); if(typeof enhanceProjectSheetLinks==='function')setTimeout(enhanceProjectSheetLinks,0); return r;
  };
  window.goPage=function(id){
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
    const page=document.getElementById('page-'+id);
    if(page) page.classList.add('active');
    const titles={
      dashboard:'Dashboard 2026',
      projets:'Projets',
      charge:'Plan de charge',
      gantt:'Planning Gantt',
      pipeline:'Pipeline Appels d\'offre',
      etablissement:'Suivi des établissements',
      commercial:'Suivi commercial',
      previsions:'Prévisions facturation',
      facturation:'Facturation',
      config:'Configuration'
    };
    document.getElementById('pgTitle').textContent=titles[id]||id;
    const nav=[...document.querySelectorAll('.ni')]
      .find(n=>n.dataset.page===id || n.getAttribute('onclick')===`goPage('${id}')`);
    if(nav) nav.classList.add('active');
    renderPage(id);
  };
  const oldRenderAll=window.renderAll;
  window.renderAll=function(){
    ensureForecastStore();
    oldRenderAll();
    renderPrevisionsPage();
  };

  const oldSaveProject=window.saveProject;
  window.saveProject=function(){
    const beforeIds=(DB.projets||[]).map(p=>p.id);
    const editingId=(typeof editProjectId!=='undefined'?editProjectId:null);
    oldSaveProject();
    if(document.getElementById('mProject').classList.contains('open')) return;
    const targetId=editingId || (DB.projets||[]).map(p=>p.id).find(id=>!beforeIds.includes(id));
    if(targetId){
      const p=getProjectById(targetId);
      if(p) ensureForecastForProject(p,false);
      saveDB(); renderAll();
    }
  };
  const oldTransformAo=window.transformAo;
  window.transformAo=function(id){
    // V9 : la transformation ouvre désormais la fiche Projet préremplie.
    // Aucune mutation des prévisions tant que l'utilisateur n'a pas enregistré le projet.
    return oldTransformAo(id);
  };
  const oldRevertProjectToAo=window.revertProjectToAo;
  window.revertProjectToAo=function(id){
    // V9 : l'archivage/restauration des prévisions est géré dans le workflow central,
    // après confirmation utilisateur uniquement.
    return oldRevertProjectToAo(id);
  };

  injectForecastPage();
  ensureForecastStore();
  saveDB();
  renderAll();
  initHorizontalDragScroll();
})();
