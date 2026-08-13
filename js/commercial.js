/* DCN V14 — module extrait du noyau V13B. */
// ── COMMERCIAL CRUD ──

function getCommercialAgencyList(){
  const names=[
    ...(DB.commercial||[]).map(x=>x.agenceDB),
    ...(DB.projets||[]).map(x=>x.agenceDB),
    ...(DB.pipelineAO||[]).map(x=>x.agenceDB)
  ].filter(Boolean).map(x=>String(x).trim()).filter(Boolean);
  return [...new Set(names)].sort((a,b)=>a.localeCompare(b,'fr'));
}
function populateCommercialAgencySelect(selected=''){
  const sel=document.getElementById('coAgency');
  if(!sel) return;
  const agencies=getCommercialAgencyList();
  if(selected && !agencies.includes(selected)) agencies.unshift(selected);
  sel.innerHTML='<option value="">-- Choisir une agence --</option>'+agencies.map(a=>`<option value="${escAttr(a)}" ${a===selected?'selected':''}>${a}</option>`).join('');
}
function normalizeCommercialStatus(v){
  return String(v||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/^En cours$/i,'Prospect en cours')
    .replace(/^Relance$/i,'Dormant')
    .trim().toLowerCase();
}

function openCommercialModal(){
  editCommercialId=null;
  const title=document.getElementById('mCommercialTitle'); if(title) title.textContent='Nouvelle fiche commerciale';
  populateCommercialAgencySelect('');
  ['coRegion','coContactNom','coContactPrenom','coFunction','coContactMail','coContactTel','coLastAction','coLastDate','coNextDate','coComment'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const defaults={coAgency:'',coStatus:'Jamais contacte',coPriority:'Haute',coAction:'Appeler'};
  Object.keys(defaults).forEach(id=>{const el=document.getElementById(id);if(el)el.value=defaults[id];});
  const modal=document.getElementById('mCommercial'); if(modal) modal.classList.add('open');
}
function editCommercial(id){
  const c=(DB.commercial||[]).find(x=>x.id===id);
  if(!c){toast('Fiche commerciale introuvable','err');return;}
  editCommercialId=id;
  const title=document.getElementById('mCommercialTitle'); if(title) title.textContent='Éditer fiche';
  populateCommercialAgencySelect(c.agenceDB||'');
  const map={coAgency:c.agenceDB||'',coRegion:c.region||'',coContactNom:c.contactNom||'',coContactPrenom:c.contactPrenom||'',coFunction:c.contactFonction||'',coContactMail:c.contactMail||'',coContactTel:c.contactTel||'',coStatus:c.statutRelation||'Jamais contacte',coPriority:c.priorite||'Haute',coAction:c.actionFaire||'Rien',coLastAction:c.derniereAction||'',coLastDate:c.dateDerniereAction||'',coNextDate:c.dateProchaineAction||'',coComment:c.commentaire||''};
  Object.keys(map).forEach(id=>{const el=document.getElementById(id);if(el)el.value=map[id];});
  const modal=document.getElementById('mCommercial'); if(modal) modal.classList.add('open');
}
function saveCommercial(){
  const agencyEl=document.getElementById('coAgency');
  const agence=(agencyEl?.value||'').trim();
  if(!agence){toast('Agence obligatoire','err');return;}
  const statut=document.getElementById('coStatus')?.value||'Jamais contacte';
  const data={
    agenceDB:agence,
    region:(document.getElementById('coRegion')?.value||'').trim(),
    contactNom:(document.getElementById('coContactNom')?.value||'').trim(),
    contactPrenom:(document.getElementById('coContactPrenom')?.value||'').trim(),
    contactFonction:(document.getElementById('coFunction')?.value||'').trim(),
    contactMail:(document.getElementById('coContactMail')?.value||'').trim(),
    contactTel:(document.getElementById('coContactTel')?.value||'').trim(),
    statutRelation:statut,
    priorite:document.getElementById('coPriority')?.value||'Haute',
    actionFaire:document.getElementById('coAction')?.value||'Rien',
    derniereAction:(document.getElementById('coLastAction')?.value||'').trim(),
    dateDerniereAction:document.getElementById('coLastDate')?.value||'',
    dateProchaineAction:document.getElementById('coNextDate')?.value||'',
    commentaire:(document.getElementById('coComment')?.value||'').trim(),
    jamaisContacte:normalizeCommercialStatus(statut)===normalizeCommercialStatus('Jamais contacte')
  };
  if(editCommercialId){
    const i=(DB.commercial||[]).findIndex(x=>x.id===editCommercialId);
    if(i>=0) DB.commercial[i]={...DB.commercial[i],...data};
  }else{
    DB.commercial.push({id:uid('c'),...data});
  }
  saveDB();closeM('mCommercial');renderAll();toast('Fiche enregistrée','ok');
}
function deleteCommercial(id){if(!confirm('Supprimer ?'))return;DB.commercial=DB.commercial.filter(x=>x.id!==id);saveDB();renderAll();}
