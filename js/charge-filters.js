(function(){
'use strict';

window.DCN_CHARGE_FILTERS = window.DCN_CHARGE_FILTERS || { member:'all', status:'all', saisie:'all' };

function dcnChargeCss(){
  if(document.getElementById('dcn-charge-filters-style-v5')) return;
  var st=document.createElement('style');
  st.id='dcn-charge-filters-style-v5';
  st.textContent = `
    .dcn-charge-filter-panel{margin:0 16px 12px 16px;padding:12px;border:1px solid var(--border);border-radius:10px;background:linear-gradient(180deg,#FFFFFF,#F8FAFC);display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;box-shadow:0 6px 16px rgba(26,46,68,.05)}
    .dcn-charge-filter-panel .fgrp{min-width:170px;gap:4px}.dcn-charge-filter-panel .flbl{font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--gray-dk);font-weight:800}.dcn-charge-filter-panel .fs{min-width:170px}.dcn-charge-filter-panel .hint{font-size:10px;color:var(--gray-dk);line-height:1.35;max-width:360px;padding-bottom:7px}.dcn-charge-filter-panel .btn{white-space:nowrap}.dcn-charge-row-hidden-note{font-size:10px;color:var(--gray-dk);font-weight:600;margin-left:5px}.dcn-charge-status{margin-left:5px;padding:1px 5px;border-radius:999px;background:#EEF2FF;color:#3730A3;font-size:8px;font-weight:800;vertical-align:middle}.dcn-charge-empty-line{opacity:.72}.dcn-charge-filter-summary{font-size:10px;color:var(--gray-dk);padding:0 16px 10px 16px;}
  `;
  document.head.appendChild(st);
}
function dcnEsc(s){return String(s==null?'':s).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
function dcnShort(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}
function dcnActiveMembersFiltered(){
  var members=activeMembers();
  var f=window.DCN_CHARGE_FILTERS||{};
  if(f.member && f.member!=='all') members=members.filter(function(m){return m.id===f.member;});
  return members;
}
function dcnItemStatus(item){return item.type==='ao'?'AO / Pipeline':(item.statut||'Sans statut');}
function dcnAllChargeItems(){
  var projets=(DB.projets||[]).map(function(p){return Object.assign({type:'projet'},p);});
  var aos=(typeof aosActifsCharge==='function'?aosActifsCharge():(DB.pipelineAO||[])).map(function(a){return Object.assign({type:'ao'},a);});
  return projets.concat(aos);
}
function dcnItemValsForMembers(item,members){
  var vals=[];
  members.forEach(function(m){
    for(var i=0;i<12;i++){
      var mk=monthKey(i), e=getChargeEntry(m.id,mk), v=Number((e.projets||{})[item.id])||0;
      vals.push(v);
    }
  });
  return vals;
}
function dcnItemSaisieState(item,members){
  var vals=dcnItemValsForMembers(item,members);
  var positives=vals.filter(function(v){return v>0;});
  return {
    hasAny: positives.length>0,
    empty: positives.length===0,
    strong: positives.some(function(v){return v>=70;}),
    low: positives.some(function(v){return v>0 && v<((DB.cfg&&DB.cfg.seuilChargeBasse)||30);})
  };
}
function dcnPassSaisie(item,members){
  var mode=(window.DCN_CHARGE_FILTERS||{}).saisie||'all';
  var s=dcnItemSaisieState(item,members);
  if(mode==='filled') return s.hasAny;
  if(mode==='empty') return s.empty;
  if(mode==='strong') return s.strong;
  if(mode==='low') return s.low;
  return true;
}
function dcnPassStatus(item){
  var st=(window.DCN_CHARGE_FILTERS||{}).status||'all';
  return st==='all' || dcnItemStatus(item)===st;
}
function dcnVisibleItemsForMembers(members){
  return dcnAllChargeItems().filter(function(item){return dcnPassStatus(item)&&dcnPassSaisie(item,members);});
}
function dcnVisibleItemsForMember(mid){
  var m=(DB.membres||[]).find(function(x){return x.id===mid;});
  return dcnVisibleItemsForMembers(m?[m]:[]);
}
function dcnStatusOptions(){
  var set={};
  (DB.projets||[]).forEach(function(p){set[p.statut||'Sans statut']=1;});
  set['AO / Pipeline']=1;
  return Object.keys(set).sort(function(a,b){return a.localeCompare(b,'fr');});
}
window.dcnSetChargeFilter=function(key,val){
  window.DCN_CHARGE_FILTERS[key]=val||'all';
  renderChargePage();
};
window.dcnResetChargeFilters=function(){
  window.DCN_CHARGE_FILTERS={member:'all',status:'all',saisie:'all'};
  renderChargePage();
};
function dcnEnsureFiltersUI(){
  dcnChargeCss();
  var wrap=document.getElementById('chargeWrap');
  if(!wrap) return;
  var panel=document.getElementById('dcnChargeFilterPanel');
  if(!panel){
    panel=document.createElement('div');
    panel.id='dcnChargeFilterPanel';
    panel.className='dcn-charge-filter-panel';
    wrap.parentNode.insertBefore(panel,wrap);
  }
  var f=window.DCN_CHARGE_FILTERS||{member:'all',status:'all',saisie:'all'};
  var memberOpts='<option value="all">Tous les collaborateurs</option>'+activeMembers().map(function(m){return '<option value="'+dcnEsc(m.id)+'" '+(f.member===m.id?'selected':'')+'>'+dcnEsc(m.nom)+'</option>';}).join('');
  var statusOpts='<option value="all">Tous les statuts</option>'+dcnStatusOptions().map(function(s){return '<option value="'+dcnEsc(s)+'" '+(f.status===s?'selected':'')+'>'+dcnEsc(s)+'</option>';}).join('');
  var saisie=[['all','Toutes les lignes'],['filled','Lignes remplies uniquement'],['empty','Lignes vides uniquement'],['strong','Charges fortes'],['low','Charges faibles']].map(function(o){return '<option value="'+o[0]+'" '+(f.saisie===o[0]?'selected':'')+'>'+o[1]+'</option>';}).join('');
  panel.innerHTML = `
    <div class="fgrp"><label class="flbl">Collaborateur</label><select class="fs" onchange="dcnSetChargeFilter('member',this.value)">${memberOpts}</select></div>
    <div class="fgrp"><label class="flbl">Statut projet</label><select class="fs" onchange="dcnSetChargeFilter('status',this.value)">${statusOpts}</select></div>
    <div class="fgrp"><label class="flbl">État de saisie</label><select class="fs" onchange="dcnSetChargeFilter('saisie',this.value)">${saisie}</select></div>
    <button class="btn btn-outline btn-sm" onclick="dcnResetChargeFilters()">Réinitialiser</button>
    <button class="btn btn-accent btn-sm" onclick="dcnShowMaskedCharges()">Afficher les charges masquées</button>
    <div class="hint">Les deux vues utilisent les mêmes filtres. Les totaux affichés sont recalculés sur les lignes visibles après filtre.</div>
  `;
}
function dcnVisibleProductive(mid,mk){
  var items=dcnVisibleItemsForMember(mid);
  var e=getChargeEntry(mid,mk);
  return items.reduce(function(s,item){return s+(Number((e.projets||{})[item.id])||0);},0);
}
function dcnVisibleTotal(mid,mk){
  var e=getChargeEntry(mid,mk);
  return dcnVisibleProductive(mid,mk)+normalizePercent(e.divers||0)+normalizePercent(e.formation)+normalizePercent(e.conges)+normalizePercent(e.absences);
}
function dcnVisibleDisponibilite(mid,mk){return (getMonthConfig(mk).capaciteReference||100)-dcnVisibleTotal(mid,mk);}
function dcnCellInput(v,mid,mk,pid,wide){
  return `<input class="input-mini ${getChargeInputClass(v)}" value="${v||''}" data-mid="${dcnEsc(mid)}" data-mk="${dcnEsc(mk)}" data-pid="${dcnEsc(pid)}" oninput="setChargeProjet(this)" ${wide?'':'style="width:44px;font-size:10px;"'}>`;
}
function dcnMetaInput(v,mid,mk,key,wide){
  return `<input class="input-mini ${getChargeInputClass(v)}" value="${v||''}" data-mid="${dcnEsc(mid)}" data-mk="${dcnEsc(mk)}" data-meta="${dcnEsc(key)}" oninput="setChargeMeta(this)" ${wide?'':'style="width:44px;font-size:10px;"'}>`;
}
function dcnRenderSummary(members,items){
  var el=document.getElementById('dcnChargeFilterSummary');
  if(!el){
    var wrap=document.getElementById('chargeWrap');
    if(!wrap) return;
    el=document.createElement('div');
    el.id='dcnChargeFilterSummary';
    el.className='dcn-charge-filter-summary';
    wrap.parentNode.insertBefore(el,wrap);
  }
  var f=window.DCN_CHARGE_FILTERS||{};
  var status=f.status==='all'?'tous statuts':f.status;
  var saisie={all:'toutes lignes',filled:'lignes remplies',empty:'lignes vides',strong:'charges fortes',low:'charges faibles'}[f.saisie||'all'];
  el.textContent=`Affichage : ${members.length} collaborateur(s), ${items.length} ligne(s), ${status}, ${saisie}.`;
}
function dcnProjectLabel(item,max){
  var isAo=item.type==='ao';
  var st=dcnItemStatus(item);
  var solde=(!isAo&&['Solde','Termine'].includes(item.statut)&&item.chargeActif===true)?'<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;font-size:9px;font-weight:700;background:#EDE9FE;color:#5B21B6;vertical-align:middle;">FACT. TERMINÉE</span>':'';
  var prefix=isAo?'[AO] ':'';
  var code=item.code?`<span style="color:var(--gray-dk);font-size:10px;">${dcnEsc(item.code)}</span> — `:'';
  return `${code}${prefix}${dcnEsc(dcnShort(item.nom,max||38))}<span class="dcn-charge-status">${dcnEsc(st)}</span>${solde}`;
}

window.renderChargePage=function(){
  renderMonthParams();
  dcnEnsureFiltersUI();
  if(typeof CHARGE_VIEW!=='undefined' && CHARGE_VIEW==='compact'){renderChargePageCompact();return;}
  var members=dcnActiveMembersFiltered();
  var html=`<table class="ct-table"><thead><tr><th class="col-name">Projet / ligne</th>${MOIS.map(function(m,i){return `<th class="${i===ACTIVE_MONTH?'col-now':''}">${m}</th>`;}).join('')}</tr></thead><tbody>`;
  members.forEach(function(m){
    var items=dcnVisibleItemsForMembers([m]);
    html+=`<tr class="section-row"><td colspan="13">${dcnEsc((m.nom||'').toUpperCase())} <span class="member-role">${dcnEsc(m.role||'Collaborateur')}</span></td></tr>`;
    items.forEach(function(item){
      var isAo=item.type==='ao';
      var isSolde=!isAo&&['Solde','Termine'].includes(item.statut)&&item.chargeActif===true;
      var state=dcnItemSaisieState(item,[m]);
      var rowBg=isSolde?'#F5F3FF':isAo?'#FFFBEB':'';
      var nameStyle=isSolde?'color:#5B21B6;':isAo?'color:var(--accent-dark);font-style:italic;':'';
      html+=`<tr class="data-row ${state.empty?'dcn-charge-empty-line':''}" style="${rowBg?'background:'+rowBg+';':''}"><td class="col-name line-indent project-sheet-link" data-project-id="${dcnEsc(item.id)}" onclick="openProjectSheet('${dcnEsc(item.id)}')" title="Cliquer pour ouvrir la fiche" style="${rowBg?'background:'+rowBg+';':''}${nameStyle}">${dcnProjectLabel(item,42)}</td>`;
      for(var i=0;i<12;i++){
        var mk=monthKey(i), e=getChargeEntry(m.id,mk), v=Number((e.projets||{})[item.id])||0;
        html+=`<td class="${i===ACTIVE_MONTH?'col-now':''}" style="${rowBg&&i!==ACTIVE_MONTH?'background:'+rowBg+';':''}">${dcnCellInput(v,m.id,mk,item.id,true)}</td>`;
      }
      html+='</tr>';
    });
    ['divers','formation','conges','absences'].forEach(function(key){
      var lbl={divers:'Divers',formation:'Formation',conges:'Congés',absences:'Absences'}[key];
      html+=`<tr class="meta-row ${key} data-row"><td class="col-name line-indent">${lbl}</td>`;
      for(var i=0;i<12;i++){
        var mk=monthKey(i), v=Number(getChargeEntry(m.id,mk)[key])||0;
        html+=`<td class="${i===ACTIVE_MONTH?'col-now':''}">${dcnMetaInput(v,m.id,mk,key,true)}</td>`;
      }
      html+='</tr>';
    });
    html+=`<tr class="total-row calc-row"><td class="col-name line-indent">Total occupé visible</td>`;
    for(var i=0;i<12;i++){
      var mk=monthKey(i), t=Math.round(dcnVisibleTotal(m.id,mk));
      html+=`<td id="ct-${dcnEsc(m.id)}-${mk}" class="${i===ACTIVE_MONTH?'col-now':''} ${t>100?'calc-over':''}">${t}%</td>`;
    }
    html+='</tr><tr class="total-row calc-row"><td class="col-name line-indent">Disponible visible</td>';
    for(var j=0;j<12;j++){
      var mk2=monthKey(j), d=Math.round(dcnVisibleDisponibilite(m.id,mk2));
      html+=`<td id="cd-${dcnEsc(m.id)}-${mk2}" class="${j===ACTIVE_MONTH?'col-now':''} ${d<0?'calc-over':'calc-under'}">${d}%</td>`;
    }
    html+='</tr>';
  });
  if(!members.length) html+='<tr><td colspan="13" class="empty">Aucun collaborateur selon le filtre</td></tr>';
  html+='</tbody></table>';
  document.getElementById('chargeWrap').innerHTML=html;
  dcnRenderSummary(members,dcnVisibleItemsForMembers(members));
  bindGridNavigation('#chargeWrap input');
  if(typeof enhanceProjectSheetLinks==='function')enhanceProjectSheetLinks();
};

window.renderChargePageCompact=function(){
  dcnEnsureFiltersUI();
  var members=dcnActiveMembersFiltered();
  var items=dcnVisibleItemsForMembers(members);
  var monthBorders=['#BFDBFE','#BBF7D0','#FED7AA','#DDD6FE','#FECDD3','#CCFBF1','#FEF08A','#BFDBFE','#BBF7D0','#FED7AA','#DDD6FE','#FECDD3'];
  var thMonths=`<th class="col-name" rowspan="2" style="position:sticky;left:0;z-index:4;background:var(--navy);min-width:250px;text-align:left;">Projet</th>`;
  MOIS.forEach(function(m,i){thMonths+=`<th colspan="${Math.max(members.length,1)}" style="text-align:center;border-left:2px solid rgba(255,255,255,.15);background:${i===ACTIVE_MONTH?'var(--blue)':'var(--navy)'};">${m}</th>`;});
  var thMembers='';
  MOIS.forEach(function(m,i){members.forEach(function(mbr,mi){thMembers+=`<th style="font-size:9px;text-align:center;padding:4px 3px;${mi===0?'border-left:2px solid rgba(255,255,255,.15);':''}background:${i===ACTIVE_MONTH?'rgba(45,89,134,.9)':'rgba(26,46,68,.85)'};">${dcnEsc((mbr.nom||'').split(' ')[0].slice(0,7))}</th>`;});if(!members.length) thMembers+='<th>—</th>';});
  var html=`<table class="ct-table"><thead><tr>${thMonths}</tr><tr>${thMembers}</tr></thead><tbody>`;
  items.forEach(function(item){
    var isAo=item.type==='ao';
    var isSolde=!isAo&&['Solde','Termine'].includes(item.statut)&&item.chargeActif===true;
    var rowBg=isSolde?'#F5F3FF':isAo?'#FFFBEB':'';
    var nameStyle=isSolde?'color:#5B21B6;':isAo?'color:var(--accent-dark);font-style:italic;':'';
    var state=dcnItemSaisieState(item,members);
    html+=`<tr class="${state.empty?'dcn-charge-empty-line':''}" style="${rowBg?'background:'+rowBg+';':''}"><td class="col-name project-sheet-link" data-project-id="${dcnEsc(item.id)}" onclick="openProjectSheet('${dcnEsc(item.id)}')" style="position:sticky;left:0;z-index:2;box-shadow:1px 0 0 #EAEEF2;${rowBg?'background:'+rowBg+';':'background:#FAFBFC;'}${nameStyle}font-size:11px;padding:3px 8px;cursor:pointer;" title="Cliquer pour ouvrir la fiche">${dcnProjectLabel(item,34)}</td>`;
    for(var i=0;i<12;i++){
      var mk=monthKey(i);
      members.forEach(function(mbr,mi){
        var e=getChargeEntry(mbr.id,mk), v=Number((e.projets||{})[item.id])||0;
        var cellBg=i===ACTIVE_MONTH?'var(--month-now)':rowBg;
        var borderL=mi===0?'border-left:2px solid '+(i===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[i])+';':'';
        html+=`<td style="padding:2px;${cellBg?'background:'+cellBg+';':''}${borderL}">${dcnCellInput(v,mbr.id,mk,item.id,false)}</td>`;
      });
      if(!members.length) html+='<td></td>';
    }
    html+='</tr>';
  });
  html+=`<tr><td class="col-name" colspan="${1+Math.max(members.length,1)*12}" style="background:var(--navy);color:#fff;font-size:10px;font-weight:700;padding:6px 10px;text-transform:uppercase;letter-spacing:.5px;">Charges non productives & totaux visibles</td></tr>`;
  ['divers','formation','conges','absences'].forEach(function(key){
    var lbl={divers:'Divers',formation:'Formation',conges:'Congés',absences:'Absences'}[key];
    var lblColor={divers:'#7C3AED',formation:'var(--blue)',conges:'var(--orange)',absences:'var(--red)'}[key];
    html+=`<tr><td class="col-name" style="position:sticky;left:0;z-index:2;background:#FAFBFC;box-shadow:1px 0 0 #EAEEF2;font-weight:600;color:${lblColor};font-size:11px;padding:3px 8px;">${lbl}</td>`;
    for(var i=0;i<12;i++){
      var mk=monthKey(i);
      members.forEach(function(mbr,mi){
        var v=Number(getChargeEntry(mbr.id,mk)[key])||0;
        var borderL=mi===0?'border-left:2px solid '+(i===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[i])+';':'';
        html+=`<td style="padding:2px;${i===ACTIVE_MONTH?'background:var(--month-now);':''}${borderL}">${dcnMetaInput(v,mbr.id,mk,key,false)}</td>`;
      });
      if(!members.length) html+='<td></td>';
    }
    html+='</tr>';
  });
  html+=`<tr style="background:#E8EEF5;"><td class="col-name" style="position:sticky;left:0;z-index:2;background:#E8EEF5;box-shadow:1px 0 0 #EAEEF2;font-weight:700;font-size:11px;padding:4px 8px;">TOTAL OCCUPÉ VISIBLE</td>`;
  for(var i=0;i<12;i++){
    var mk=monthKey(i);
    members.forEach(function(mbr,mi){
      var t=Math.round(dcnVisibleTotal(mbr.id,mk));
      var borderL=mi===0?'border-left:2px solid '+(i===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[i])+';':'';
      html+=`<td id="ct-${dcnEsc(mbr.id)}-${mk}-cpt" style="text-align:center;font-weight:700;font-size:11px;padding:4px 2px;${i===ACTIVE_MONTH?'background:var(--month-now);':'background:#E8EEF5;'}${borderL}${t>100?'color:var(--red);':'color:var(--green);'}">${t}%</td>`;
    });
    if(!members.length) html+='<td></td>';
  }
  html+=`</tr><tr style="background:#F0F3F6;"><td class="col-name" style="position:sticky;left:0;z-index:2;background:#F0F3F6;box-shadow:1px 0 0 #EAEEF2;font-weight:700;font-size:11px;padding:4px 8px;">DISPONIBLE VISIBLE</td>`;
  for(var j=0;j<12;j++){
    var mk2=monthKey(j);
    members.forEach(function(mbr,mi){
      var d=Math.round(dcnVisibleDisponibilite(mbr.id,mk2));
      var borderL=mi===0?'border-left:2px solid '+(j===ACTIVE_MONTH?'var(--month-now-border)':monthBorders[j])+';':'';
      html+=`<td id="cd-${dcnEsc(mbr.id)}-${mk2}-cpt" style="text-align:center;font-weight:700;font-size:11px;padding:4px 2px;${j===ACTIVE_MONTH?'background:var(--month-now);':'background:#F0F3F6;'}${borderL}${d<0?'color:var(--red);':'color:#1A7A42;'}">${d}%</td>`;
    });
    if(!members.length) html+='<td></td>';
  }
  html+='</tr></tbody></table>';
  document.getElementById('chargeWrap').innerHTML=html;
  dcnRenderSummary(members,items);
  bindGridNavigation('#chargeWrap input');
  if(typeof enhanceProjectSheetLinks==='function')enhanceProjectSheetLinks();
};

window.refreshCalcCells=function(mid){
  for(var i=0;i<12;i++){
    var mk=monthKey(i), t=Math.round(dcnVisibleTotal(mid,mk)), d=Math.round(dcnVisibleDisponibilite(mid,mk));
    var tc=document.getElementById(`ct-${mid}-${mk}`), dc=document.getElementById(`cd-${mid}-${mk}`);
    if(tc){tc.textContent=t+'%';tc.classList.toggle('calc-over',t>100);}
    if(dc){dc.textContent=d+'%';dc.classList.toggle('calc-over',d<0);dc.classList.toggle('calc-under',d>=0);}
    var tcc=document.getElementById(`ct-${mid}-${mk}-cpt`), dcc=document.getElementById(`cd-${mid}-${mk}-cpt`);
    if(tcc){tcc.textContent=t+'%';tcc.style.color=t>100?'var(--red)':'var(--green)';}
    if(dcc){dcc.textContent=d+'%';dcc.style.color=d<0?'var(--red)':'#1A7A42';}
  }
};
window.setChargeProjet=function(el){
  var mid=el.dataset.mid,mk=el.dataset.mk,pid=el.dataset.pid,v=normalizePercent(el.value);
  getChargeEntry(mid,mk).projets[pid]=v;
  el.className='input-mini '+getChargeInputClass(v);
  saveDB();refreshCalcCells(mid);
};
window.setChargeMeta=function(el){
  var mid=el.dataset.mid,mk=el.dataset.mk,key=el.dataset.meta,v=normalizePercent(el.value);
  getChargeEntry(mid,mk)[key]=v;
  el.className='input-mini '+getChargeInputClass(v);
  saveDB();refreshCalcCells(mid);
};
window.dcnShowMaskedCharges=function(){
  var membersAll=activeMembers();
  var membersVisible=dcnActiveMembersFiltered();
  var visibleMemberIds={};membersVisible.forEach(function(m){visibleMemberIds[m.id]=1;});
  var itemsAll=dcnAllChargeItems();
  var hidden=[];
  membersAll.forEach(function(m){
    itemsAll.forEach(function(item){
      for(var i=0;i<12;i++){
        var mk=monthKey(i), v=Number((getChargeEntry(m.id,mk).projets||{})[item.id])||0;
        if(v<=0) continue;
        var memberHidden=!visibleMemberIds[m.id];
        var statusHidden=!dcnPassStatus(item);
        var saisieHidden=!dcnPassSaisie(item,[m]);
        if(memberHidden||statusHidden||saisieHidden){
          hidden.push(`${m.nom} — ${MOIS_L[i]} — ${item.nom} (${dcnItemStatus(item)}) : ${v}%`);
        }
      }
    });
  });
  if(!hidden.length){alert('Aucune charge masquée par les filtres actuels.');return;}
  alert('Charges masquées par les filtres actuels :\n\n'+hidden.slice(0,80).join('\n')+(hidden.length>80?'\n…':''));
};

document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){try{if(typeof CHARGE_VIEW!=='undefined'){CHARGE_VIEW=CHARGE_VIEW||'standard';} if(document.getElementById('page-charge')) renderChargePage();}catch(e){console.error('[DCN charge filters]',e);}},250);});
console.log('[DCN FIX V5] Plan de charge complet + filtres chargé ✓');
})();
