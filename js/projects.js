/* DCN V14 — module extrait du noyau V13B. */
// ── PROJETS CRUD ──
function openProjectModal(){
  editProjectId=null;
  if(typeof aoEnTransformation!=='undefined') aoEnTransformation=null;
  document.getElementById('mProjectTitle').textContent='Nouveau projet';
  fillMemberSelect('prResp');document.getElementById('projectMissionGrid').innerHTML=missionGridHtml('prm');
  ['prCode','prName','prClient','prDevis','prStart','prEnd','prBilled','prProgress','prContactNom','prContactPrenom','prContactFonction','prContactMail','prContactTel','prNotes','prCaPrev','prCaCurrent','prCaNext'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  fillAgencySelect('prAgency','');hideAgencyCustom('prAgencyCustom');
  document.getElementById('prNature').value='Mission directe';document.getElementById('prStatus').value='En cours';
  document.getElementById('prBillingMode').value='forfait';
  document.getElementById('prChargeActif').checked=true;
  document.getElementById('prInclurePrevision').checked=false;
  document.getElementById('btnProjectSheetFromEdit').style.display='none';
  document.getElementById('btnProjectToAo').style.display='none'; updateCAHint('pr');
  document.getElementById('mProject').classList.add('open');
}
function editProject(id){
  const p=DB.projets.find(x=>x.id===id);if(!p)return;editProjectId=id;
  document.getElementById('mProjectTitle').textContent='Éditer projet';fillMemberSelect('prResp',p.responsable||'');
  document.getElementById('projectMissionGrid').innerHTML=missionGridHtml('prm',p);
  document.getElementById('prCode').value=p.code||'';document.getElementById('prName').value=p.nom||'';document.getElementById('prStatus').value=p.statut||'En cours';document.getElementById('prNature').value=p.nature||'Mission directe';document.getElementById('prBillingMode').value=p.modeFacturation||p.billingMode||'forfait';document.getElementById('prClient').value=p.client||'';
  // chargeActif : par défaut true pour projets actifs, false pour soldés/terminés — mais peut être overridé
  const defaultChargeActif=!['Solde','Termine'].includes(p.statut);
  document.getElementById('prChargeActif').checked=p.chargeActif!==undefined?p.chargeActif:defaultChargeActif;
  document.getElementById('prChargeActifHint').textContent=p.statut==='Solde'||p.statut==='Termine'?'⚠ Projet soldé/terminé — cocher si du travail reste malgré tout à effectuer.':'Cocher même si le projet est soldé ou terminé financièrement, si du travail reste à faire.';
  document.getElementById('prInclurePrevision').checked=p.inclurePrevision===true;
  fillAgencySelect('prAgency', p.agenceDB||'');
  document.getElementById('prDevis').value=p.devis||'';
  checkDevisDuplicate(p.devis||'','prDevisHint',id);
  document.getElementById('prStart').value=p.dateDebut||'';document.getElementById('prEnd').value=p.dateFin||'';document.getElementById('prBilled').value=isProjectFacturationKnown(p)?String(Number(p.montantFacture)||0):'';document.getElementById('prProgress').value=p.avancement||'';
  document.getElementById('prCaPrev').value=Number(p.caAnneesPrecedentes)||0;document.getElementById('prCaCurrent').value=Number(p.caAnneeEnCours)||0;document.getElementById('prCaNext').value=Number(p.caAnneesSuivantes)||0;
  document.getElementById('prContactNom').value=p.contactNom||'';document.getElementById('prContactPrenom').value=p.contactPrenom||'';document.getElementById('prContactFonction').value=p.contactFonction||'';document.getElementById('prContactMail').value=p.contactMail||'';document.getElementById('prContactTel').value=p.contactTel||'';
  document.getElementById('prNotes').value=p.notes||'';document.getElementById('btnProjectSheetFromEdit').style.display='inline-flex';document.getElementById('btnProjectToAo').style.display='inline-flex';updateCAHint('pr');document.getElementById('mProject').classList.add('open');
}

function openProjectSheetFromEdit(){
  if(!editProjectId){toast('Aucun projet ouvert','err');return;}
  closeM('mProject');
  openProjectSheet(editProjectId);
}
function isRegieProject(project){return (project?.modeFacturation||project?.billingMode||'forfait')==='regie';}
function billingBadge(project){return isRegieProject(project)?'<span class="badge bregie">Régie</span>':'';}
function dcnRound2(n){return Math.round((Number(n)||0)*100)/100;}
function dcnSumArr(arr){return (arr||[]).reduce((sum,v)=>sum+(Number(v)||0),0);}
function dcnDistributeMonthly(total, project){
  total=Number(total)||0;
  const arr=new Array(12).fill(0);
  if(!total) return arr;
  let months=(typeof projectActiveMonthsInYear==='function')?projectActiveMonthsInYear(project, DB.cfg.annee):[...Array(12).keys()];
  if(!months||!months.length) months=[...Array(12).keys()];
  const base=Math.floor((total/months.length)*100)/100;
  months.forEach(i=>arr[i]=base);
  let remainder=dcnRound2(total-dcnSumArr(arr));
  let idx=0;
  while(remainder>0.0001 && idx<months.length*5){
    const mi=months[idx%months.length];
    arr[mi]=dcnRound2(arr[mi]+0.01);
    remainder=dcnRound2(remainder-0.01);
    idx++;
  }
  return arr;
}
function dcnAdjustMonthsToTotal(existingMonths, targetTotal, project){
  targetTotal=Number(targetTotal)||0;
  const current=dcnSumArr(existingMonths);
  if(!targetTotal) return new Array(12).fill(0);
  if(Math.abs(current-targetTotal)<0.01) return (existingMonths||new Array(12).fill(0)).map(v=>Number(v)||0);
  if(current>0){
    let arr=(existingMonths||new Array(12).fill(0)).map(v=>dcnRound2((Number(v)||0)*targetTotal/current));
    let diff=dcnRound2(targetTotal-dcnSumArr(arr));
    const active=arr.map((v,i)=>({v,i})).filter(x=>x.v>0).map(x=>x.i);
    const slots=active.length?active:((typeof projectActiveMonthsInYear==='function')?projectActiveMonthsInYear(project, DB.cfg.annee):[...Array(12).keys()]);
    let step=diff>=0?0.01:-0.01, guard=0;
    while(Math.abs(diff)>0.0001 && guard<100000){
      const mi=slots[guard%slots.length];
      arr[mi]=dcnRound2(arr[mi]+step);
      diff=dcnRound2(diff-step);
      guard++;
    }
    return arr;
  }
  return dcnDistributeMonthly(targetTotal, project);
}
function dcnSyncForecastFromProject(project){
  if(!project||!project.id) return null;
  DB.previsionsFacturation=DB.previsionsFacturation||[];
  let entry=DB.previsionsFacturation.find(x=>x.projectId===project.id);
  if(!entry){
    entry={projectId:project.id,before:0,months:new Array(12).fill(0),after:0,source:'project-form'};
    DB.previsionsFacturation.push(entry);
  }
  entry.before=Number(project.caAnneesPrecedentes)||0;
  entry.after=Number(project.caAnneesSuivantes)||0;
  entry.months=dcnAdjustMonthsToTotal(entry.months, Number(project.caAnneeEnCours)||0, project);
  entry.source='project-form';
  if(typeof stampHistory==='function') stampHistory(entry,'Prévision synchronisée depuis projet');
  return entry;
}

function saveProject(){
  const nom=document.getElementById('prName').value.trim();
  const billedRaw=(document.getElementById('prBilled').value||'').trim();if(!nom){toast('Nom obligatoire','err');return;}
  const missions=collectMissions('prm');
  const data={code:document.getElementById('prCode').value.trim(),nom,statut:document.getElementById('prStatus').value,chargeActif:document.getElementById('prChargeActif').checked,inclurePrevision:document.getElementById('prInclurePrevision').checked,modeFacturation:document.getElementById('prBillingMode').value||'forfait',nature:document.getElementById('prNature').value,client:document.getElementById('prClient').value.trim(),agenceDB:(document.getElementById('prAgencyCustom').style.display!=='none'&&document.getElementById('prAgencyCustom').value.trim()?document.getElementById('prAgencyCustom').value.trim():document.getElementById('prAgency').value.trim()),devis:document.getElementById('prDevis').value.trim(),responsable:document.getElementById('prResp').value,dateDebut:document.getElementById('prStart').value,dateFin:document.getElementById('prEnd').value,missions,caAnneesPrecedentes:normalizeAmount(document.getElementById('prCaPrev').value),caAnneeEnCours:normalizeAmount(document.getElementById('prCaCurrent').value),caAnneesSuivantes:normalizeAmount(document.getElementById('prCaNext').value),montantFacture:billedRaw===''?0:(Number(billedRaw)||0),facturationRenseignee:billedRaw!=='',avancement:Number(document.getElementById('prProgress').value)||0,contactNom:document.getElementById('prContactNom').value.trim(),contactPrenom:document.getElementById('prContactPrenom').value.trim(),contactFonction:document.getElementById('prContactFonction').value.trim(),contactMail:document.getElementById('prContactMail').value.trim(),contactTel:document.getElementById('prContactTel').value.trim(),notes:document.getElementById('prNotes').value.trim()};
  const total=missions.reduce((s,x)=>s+(Number(x.montant)||0),0);
  const msgs=validateBusinessRules({mode:'projet',data,total});
  if(msgs.length&&!confirm(msgs.join('\n')+'\n\nContinuer quand même ?'))return;
  data.acteurs=(typeof _dcnActeurs!=='undefined'&&_dcnActeurs.length)?JSON.parse(JSON.stringify(_dcnActeurs)):[];
  if(data.acteurs.length){const princ=data.acteurs.find(a=>a.principal)||data.acteurs[0];const m=(DB.membres||[]).find(x=>x.id===princ.membreId)||{};if(m.nom)data.responsable=m.nom;}

  if(editProjectId){
    const i=DB.projets.findIndex(x=>x.id===editProjectId);
    if(i<0)return;
    DB.projets[i]={...DB.projets[i],...data};
    syncWorkflowDevisToProject(DB.projets[i]);
    stampHistory(DB.projets[i],'Projet modifié');
    dcnSyncForecastFromProject(DB.projets[i]);
  } else if(typeof aoEnTransformation!=='undefined' && aoEnTransformation){
    // AO -> Projet : on conserve le même ID afin de conserver automatiquement le plan de charge déjà saisi sur l'AO.
    const sourceAo=(DB.pipelineAO||[]).find(x=>x.id===aoEnTransformation.id)||aoEnTransformation;
    const id=sourceAo.id||uid('p');
    archiveWorkflowAO(sourceAo);
    const item={
      id,...data,
      sourceMode:'AO',workflowStage:'PROJET',aoOrigineId:sourceAo.id,
      devisId:sourceAo.devisId||null,
      dateDevisEmission:sourceAo.dateDevisEmission||'',
      typeSuivi:sourceAo.typeSuivi||'AO formelle',
      aoPhaseOrigine:sourceAo.phase||'',aoProbabiliteOrigine:Number(sourceAo.probabilite)||0,
      aoDateReponseOrigine:sourceAo.dateReponse||'',aoActionOrigine:sourceAo.actionAFaire||'',
      aoDateProchaineActionOrigine:sourceAo.dateProchaineAction||'',chargeEstimeeAO:Number(sourceAo.chargeEstimee)||0
    };
    stampHistory(item,'AO transformée en projet');
    DB.projets.push(item);
    DB.pipelineAO=DB.pipelineAO.filter(x=>x.id!==sourceAo.id);
    ensureProjectInCharge(id); // ne remplace pas les charges existantes : elles suivent l'AO grâce au même ID.
    restoreWorkflowForecast(id);
    dcnSyncForecastFromProject(item);
    syncWorkflowDevisToProject(item,null,sourceAo);
    aoEnTransformation=null;editAoId=null;
  } else {
    const id=uid('p');
    const item={id,...data,sourceMode:devisEnAttribution?'DEVIS':'DIRECT',workflowStage:'PROJET'};
    stampHistory(item,'Projet créé');
    DB.projets.push(item);ensureProjectInCharge(id);dcnSyncForecastFromProject(item);
    if(devisEnAttribution)_lierDevisApresProjet(id);else syncWorkflowDevisToProject(item);
  }
  saveDB();closeM('mProject');renderAll();toast('Projet enregistre','ok');
}
function deleteProject(id){
  if(!confirm('Supprimer ce projet ?'))return;
  const p=DB.projets.find(x=>x.id===id);
  DB.projets=DB.projets.filter(x=>x.id!==id);
  removeProjectFromCharge(id);
  DB.previsionsFacturation=(DB.previsionsFacturation||[]).filter(x=>x.projectId!==id);
  const d=findWorkflowDevis(p?.devisId,p?.devis);
  if(d){if(d.projectId===id)d.projectId=null;if(d.aoId===id)d.aoId=null;if(!d.projectId&&!d.aoId&&d.statut==='Accepté')d.statut='Envoyé';stampHistory(d,'Projet lié supprimé');}
  if(DB.workflowArchives?.ao)delete DB.workflowArchives.ao[id];
  if(DB.workflowArchives?.forecast)delete DB.workflowArchives.forecast[id];
  saveDB();renderAll();
}


function updateAoHero(){
  const n=document.getElementById('aoName');
  const c=document.getElementById('aoClient');
  const ph=document.getElementById('aoPhase');
  const dv=document.getElementById('aoDevis');
  const pr=document.getElementById('aoProb');
  const d=document.getElementById('aoDate');
  const hn=document.getElementById('aoHeroName');
  const hc=document.getElementById('aoHeroClient');
  const hdv=document.getElementById('aoHeroDevis');
  const hp=document.getElementById('aoHeroPhase');
  const hpr=document.getElementById('aoHeroProb');
  const hd=document.getElementById('aoHeroDate');
  if(hn) hn.textContent=(n&&n.value?n.value:'NOM DE L’AO').toUpperCase();
  if(hc) hc.textContent='Client : '+(c&&c.value?c.value:'—');
  if(hdv) hdv.textContent='Devis : '+(dv&&dv.value?dv.value:'—');
  if(hp) hp.textContent='Phase : '+(ph&&ph.value?ph.value:'—');
  if(hpr) hpr.textContent='Probabilité : '+(pr&&pr.value?pr.value+'%':'—');
  if(hd) hd.textContent='Date réponse : '+(d&&d.value?d.value:'—');
}
