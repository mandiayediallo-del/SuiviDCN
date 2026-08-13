/* DCN V14 — module extrait du noyau V13B. */
// ── AO CRUD ──
function openAoModal(){editAoId=null;document.getElementById('mAoTitle').textContent='Nouvelle AO';fillMemberSelect('aoResp');document.getElementById('aoMissionGrid').innerHTML=missionGridHtml('aom');fillAgencySelect('aoAgency','');hideAgencyCustom('aoAgencyCustom');['aoName','aoClient','aoProb','aoDate','aoDevis','aoDevisDateEmission','aoAction','aoContactName','aoContactMail','aoNotes','aoCaPrev','aoCaCurrent','aoCaNext','aoNextActionDate','aoCharge'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('aoNature').value='Mission directe';document.getElementById('aoPhase').value='Identification';document.getElementById('aoFollowType').value='AO formelle';document.getElementById('btnAoToProject').style.display='none';updateCAHint('ao');updateAoHero();document.getElementById('mAo').classList.add('open');}
function editAo(id){const a=DB.pipelineAO.find(x=>x.id===id);if(!a)return;editAoId=id;document.getElementById('mAoTitle').textContent='Editer AO';fillMemberSelect('aoResp',a.responsable||'');document.getElementById('aoMissionGrid').innerHTML=missionGridHtml('aom',a);document.getElementById('aoName').value=a.nom||'';document.getElementById('aoNature').value=a.nature||'Mission directe';document.getElementById('aoPhase').value=a.phase||'Identification';document.getElementById('aoClient').value=a.client||'';fillAgencySelect('aoAgency',a.agenceDB||'');hideAgencyCustom('aoAgencyCustom');document.getElementById('aoProb').value=a.probabilite||'';document.getElementById('aoDate').value=a.dateReponse||'';document.getElementById('aoDevis').value=a.devis||'';document.getElementById('aoDevisDateEmission').value=a.dateDevisEmission||((DB.devisDates||{})[a.devis]||'');document.getElementById('aoAction').value=a.actionAFaire||'';document.getElementById('aoFollowType').value=a.typeSuivi||'AO formelle';document.getElementById('aoNextActionDate').value=a.dateProchaineAction||'';document.getElementById('aoCharge').value=Number(a.chargeEstimee)||0;document.getElementById('aoCaPrev').value=Number(a.caAnneesPrecedentes)||0;document.getElementById('aoCaCurrent').value=Number(a.caAnneeEnCours)||0;document.getElementById('aoCaNext').value=Number(a.caAnneesSuivantes)||0;document.getElementById('aoContactName').value=a.contactNom||'';document.getElementById('aoContactMail').value=a.contactMail||'';document.getElementById('aoNotes').value=a.notes||'';document.getElementById('btnAoToProject').style.display='inline-flex';updateCAHint('ao');updateAoHero();document.getElementById('mAo').classList.add('open');}
function saveAo(){
  const nom=document.getElementById('aoName').value.trim();
  if(!nom){toast('Nom AO obligatoire','err');return;}
  const missions=collectMissions('aom');
  const devis=(document.getElementById('aoDevis')?.value||'').trim();
  const dateDevisEmission=document.getElementById('aoDevisDateEmission')?.value||'';
  const data={
    nom,
    nature:document.getElementById('aoNature').value,
    phase:document.getElementById('aoPhase').value,
    client:document.getElementById('aoClient').value.trim(),
    agenceDB:(document.getElementById('aoAgencyCustom')&&document.getElementById('aoAgencyCustom').style.display!=='none'&&document.getElementById('aoAgencyCustom').value.trim()?document.getElementById('aoAgencyCustom').value.trim():document.getElementById('aoAgency').value.trim()),
    responsable:document.getElementById('aoResp').value,
    devis,
    dateDevisEmission,
    probabilite:Number(document.getElementById('aoProb').value)||0,
    dateReponse:document.getElementById('aoDate').value,
    typeSuivi:document.getElementById('aoFollowType').value,
    actionAFaire:document.getElementById('aoAction').value.trim(),
    dateProchaineAction:document.getElementById('aoNextActionDate').value,
    chargeEstimee:Number(document.getElementById('aoCharge').value)||0,
    missions,
    caAnneesPrecedentes:normalizeAmount(document.getElementById('aoCaPrev').value),
    caAnneeEnCours:normalizeAmount(document.getElementById('aoCaCurrent').value),
    caAnneesSuivantes:normalizeAmount(document.getElementById('aoCaNext').value),
    contactNom:document.getElementById('aoContactName').value.trim(),
    contactMail:document.getElementById('aoContactMail').value.trim(),
    notes:document.getElementById('aoNotes').value.trim()
  };
  if(devis){DB.devisDates=DB.devisDates||{};if(dateDevisEmission)DB.devisDates[devis]=dateDevisEmission;}
  const total=missions.reduce((s,x)=>s+(Number(x.montant)||0),0);
  const msgs=validateBusinessRules({mode:'ao',data,total});
  if(msgs.length&&!confirm(msgs.join('\n')+'\n\nContinuer quand même ?'))return;
  if(editAoId){
    const i=DB.pipelineAO.findIndex(x=>x.id===editAoId);
    DB.pipelineAO[i]={...DB.pipelineAO[i],...data,workflowStage:'AO'};
    syncWorkflowDevisToAO(DB.pipelineAO[i]);
    stampHistory(DB.pipelineAO[i],'AO modifiée');
    ensureAoInCharge(editAoId,data.responsable,data.chargeEstimee);
  } else {
    const item={id:uid('ao'),...data,sourceMode:devisEnAttribution?'DEVIS':'DIRECT',workflowStage:'AO'};
    stampHistory(item,'AO créée');
    DB.pipelineAO.push(item);
    ensureAoInCharge(item.id,data.responsable,data.chargeEstimee);
    if(devisEnAttribution)_lierDevisApresAO(item.id);else syncWorkflowDevisToAO(item);
  }
  saveDB();closeM('mAo');renderAll();toast('AO enregistree','ok');
}
function deleteAo(id){
  if(!confirm('Supprimer ?'))return;
  const a=DB.pipelineAO.find(x=>x.id===id);
  DB.pipelineAO=DB.pipelineAO.filter(x=>x.id!==id);
  removeAoFromCharge(id);
  const d=findWorkflowDevis(a?.devisId,a?.devis);
  if(d&&d.aoId===id){d.aoId=null;stampHistory(d,'AO liée supprimée');}
  if(DB.workflowArchives?.ao)delete DB.workflowArchives.ao[id];
  saveDB();renderAll();
}
function transformAo(id){
  const a=DB.pipelineAO.find(x=>x.id===id);if(!a)return;
  // On ouvre d'abord la fiche Projet préremplie. L'AO n'est retirée qu'au clic sur Enregistrer.
  closeM('mAo');
  openProjectModal();
  aoEnTransformation=a;
  document.getElementById('mProjectTitle').textContent='Nouveau projet — issu de l’AO '+(a.nom||'');
  document.getElementById('prCode').value=a.code||'';
  document.getElementById('prName').value=a.nom||'';
  document.getElementById('prStatus').value='A venir';
  document.getElementById('prNature').value=a.nature||'Mission directe';
  document.getElementById('prClient').value=a.client||'';
  fillAgencySelect('prAgency',a.agenceDB||'');hideAgencyCustom('prAgencyCustom');
  fillMemberSelect('prResp',a.responsable||'');
  document.getElementById('prDevis').value=a.devis||'';
  document.getElementById('prStart').value=a.dateDebut||'';
  document.getElementById('prEnd').value=a.dateFin||'';
  document.getElementById('prBilled').value='';
  document.getElementById('prProgress').value='';
  document.getElementById('prCaPrev').value=Number(a.caAnneesPrecedentes)||0;
  document.getElementById('prCaCurrent').value=Number(a.caAnneeEnCours)||0;
  document.getElementById('prCaNext').value=Number(a.caAnneesSuivantes)||0;
  document.getElementById('projectMissionGrid').innerHTML=missionGridHtml('prm',a);
  document.getElementById('prContactNom').value=a.contactNom||'';
  document.getElementById('prContactPrenom').value=a.contactPrenom||'';
  document.getElementById('prContactFonction').value=a.contactFonction||'';
  document.getElementById('prContactMail').value=a.contactMail||'';
  document.getElementById('prContactTel').value=a.contactTel||'';
  document.getElementById('prNotes').value=a.notes||'';
  document.getElementById('prChargeActif').checked=true;
  document.getElementById('prInclurePrevision').checked=false;
  document.getElementById('prBillingMode').value=a.modeFacturation||a.billingMode||'forfait';
  updateCAHint('pr');
  if(typeof dcnUpdateProjectEditHero==='function')dcnUpdateProjectEditHero();
  setTimeout(()=>{const el=document.getElementById('prCode');if(el)el.focus();},100);
}

function revertProjectToAo(id){
  const p=DB.projets.find(x=>x.id===id);if(!p)return;
  if(projectHasInvoices(id)){toast('Impossible : ce projet a des factures liées','err');return;}
  confirmAction(
    '"'+p.nom+'" sera retiré des projets et remis dans le pipeline AO. Les prévisions projet seront archivées et le plan de charge sera conservé.',
    function(){
      ensureWorkflowStore();
      archiveWorkflowForecast(id);
      const archived=DB.workflowArchives.ao[id]||{};
      const ao={...archived,
        id:p.id,nom:p.nom,nature:p.nature||archived.nature||'Mission directe',
        phase:archived.phase||p.aoPhaseOrigine||'Qualification',client:p.client,agenceDB:p.agenceDB,responsable:p.responsable,
        probabilite:Number(archived.probabilite??p.aoProbabiliteOrigine??50)||0,
        dateReponse:archived.dateReponse||p.aoDateReponseOrigine||'',
        actionAFaire:archived.actionAFaire||p.aoActionOrigine||'Qualifier le besoin',
        missions:p.missions||[],caAnneesPrecedentes:Number(p.caAnneesPrecedentes)||0,caAnneeEnCours:Number(p.caAnneeEnCours)||0,caAnneesSuivantes:Number(p.caAnneesSuivantes)||0,
        contactNom:p.contactNom||'',contactPrenom:p.contactPrenom||'',contactFonction:p.contactFonction||'',contactMail:p.contactMail||'',contactTel:p.contactTel||'',notes:p.notes||'',
        devis:p.devis||'',devisId:p.devisId||archived.devisId||null,dateDevisEmission:p.dateDevisEmission||archived.dateDevisEmission||'',
        dateDebut:p.dateDebut||'',dateFin:p.dateFin||'',typeSuivi:archived.typeSuivi||p.typeSuivi||'AO formelle',
        dateProchaineAction:archived.dateProchaineAction||p.aoDateProchaineActionOrigine||'',chargeEstimee:Number(archived.chargeEstimee??p.chargeEstimeeAO??0)||0,
        sourceMode:'PROJET',workflowStage:'AO'
      };
      stampHistory(ao,'Projet rebasculé en AO');
      DB.pipelineAO.push(ao);
      DB.projets=DB.projets.filter(x=>x.id!==id);
      DB.previsionsFacturation=(DB.previsionsFacturation||[]).filter(x=>x.projectId!==id);
      // Même identifiant = la charge reste attachée au dossier et réapparaît immédiatement côté AO.
      syncWorkflowDevisToAO(ao);
      const d=findWorkflowDevis(ao.devisId,ao.devis);if(d){if(d.projectId===id)d.projectId=null;d.aoId=ao.id;if(d.statut==='Accepté')d.statut='Envoyé';stampHistory(d,'Projet rebasculé en AO');}
      saveDB();closeM('mProject');renderAll();toast('Projet rebasculé en AO','ok');
    },
    'Rebasculer en AO'
  );
}
