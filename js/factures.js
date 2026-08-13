/* DCN V14 — module extrait du noyau V13B. */
// ── FACTURES CRUD ──
function openFactureModal(projectId=''){
  editFactureId=null;
  const title=document.getElementById('mFactureTitle');
  const p=projectId?DB.projets.find(x=>x.id===projectId):null;
  title.textContent=p?`Nouvelle facture — ${p.code||p.nom}`:'Nouvelle facture';
  const sel=document.getElementById('faProject');
  sel.innerHTML=DB.projets.map(pr=>`<option value="${pr.id}" ${pr.id===projectId?'selected':''}>${pr.code||''} — ${pr.nom}</option>`).join('');
  ['faNumber','faIssue','faAmount','faDue','faPaid','faComment'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('mFacture').classList.add('open');
  setTimeout(()=>document.getElementById('faNumber')?.focus(),0);
}
function editFacture(id){const f=DB.factures.find(x=>x.id===id);if(!f)return;editFactureId=id;document.getElementById('mFactureTitle').textContent='Editer facture';document.getElementById('faProject').innerHTML=DB.projets.map(p=>`<option value="${p.id}" ${p.id===f.projetId?'selected':''}>${p.code||''} — ${p.nom}</option>`).join('');document.getElementById('faNumber').value=f.numero||'';document.getElementById('faIssue').value=f.dateEmission||'';document.getElementById('faAmount').value=f.montantHT||'';document.getElementById('faDue').value=f.dateEcheance||'';document.getElementById('faPaid').value=f.dateEncaissement||'';document.getElementById('faComment').value=f.commentaire||'';document.getElementById('mFacture').classList.add('open');}
function saveFacture(){
  const numero=document.getElementById('faNumber').value.trim(),montant=Number(document.getElementById('faAmount').value)||0;
  if(!numero||!montant){toast('N° et montant obligatoires','err');return;}
  const data={projetId:document.getElementById('faProject').value,numero,dateEmission:document.getElementById('faIssue').value,montantHT:montant,dateEcheance:document.getElementById('faDue').value,dateEncaissement:document.getElementById('faPaid').value,commentaire:document.getElementById('faComment').value.trim()};
  if(editFactureId){
    const i=DB.factures.findIndex(x=>x.id===editFactureId);
    const old=DB.factures[i];
    if(old&&old.syncMontantFacture===true)adjustProjectFacturation(old.projetId,-(Number(old.montantHT)||0),true);
    const synced=old&&old.syncMontantFacture===true;
    DB.factures[i]={...old,...data,syncMontantFacture:synced};
    if(synced)adjustProjectFacturation(data.projetId,montant,true);
  }else{
    DB.factures.push({id:uid('f'),...data,syncMontantFacture:true});
    adjustProjectFacturation(data.projetId,montant,true);
  }
  saveDB();closeM('mFacture');renderAll();toast('Facture enregistrée','ok');
}
function deleteFacture(id){
  if(!confirm('Supprimer ?'))return;
  const f=DB.factures.find(x=>x.id===id);
  if(f&&f.syncMontantFacture===true)adjustProjectFacturation(f.projetId,-(Number(f.montantHT)||0),true);
  DB.factures=DB.factures.filter(x=>x.id!==id);saveDB();renderAll();
}
