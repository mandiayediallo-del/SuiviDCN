/* DCN V14 — module extrait du noyau V13B. */
function getAgencyList(){
  const fromComm=(DB.commercial||[]).map(c=>c.agenceDB).filter(Boolean);
  const fromProj=(DB.projets||[]).map(p=>p.agenceDB).filter(Boolean);
  const fromAO=(DB.pipelineAO||[]).map(a=>a.agenceDB).filter(Boolean);
  const fromDevis=(DB.devis||[]).map(d=>d.agenceDB).filter(Boolean);
  return [...new Set([...fromComm,...fromProj,...fromAO,...fromDevis])].sort((a,b)=>a.localeCompare(b,'fr'));
}

/** Remplit un select d'établissements */
function fillAgencySelect(selectId, current=''){
  const sel=document.getElementById(selectId);
  if(!sel)return;
  const list=getAgencyList();
  sel.innerHTML='<option value="">— Sélectionner un établissement —</option>'
    +list.map(a=>`<option value="${a.replace(/"/g,'&quot;')}" ${a===current?'selected':''}>${a}</option>`).join('')
    +'<option value="__custom__">✎ Autre (saisir librement)...</option>';
  // Show badge if found
  const badge=document.getElementById(selectId.replace('Agency','AgencyBadge'));
  if(badge){
    if(current&&list.includes(current)){
      const comm=DB.commercial.find(c=>c.agenceDB===current);
      if(comm){
        const statColors={Actif:'var(--green)',Dormant:'var(--orange)','Jamais contacte':'var(--red)','Prospect en cours':'var(--blue)'};
        badge.textContent='Suivi commercial : '+comm.statutRelation+(comm.contactNom||comm.contactPrenom?' · 👤 '+[comm.contactPrenom,comm.contactNom].filter(Boolean).join(' '):'');
        badge.style.background=statColors[comm.statutRelation]||'var(--blue-light)';
        badge.className='etab-badge show';
      } else {badge.className='etab-badge';}
    } else {badge.className='etab-badge';}
  }
}

function onAgencySelect(selectId, badgeId){
  const sel=document.getElementById(selectId);
  const customId=selectId.replace('Agency','AgencyCustom');
  const customEl=document.getElementById(customId);
  if(sel.value==='__custom__'){
    if(customEl){customEl.style.display='block';customEl.focus();}
    sel.value='';
  } else {
    if(customEl)customEl.style.display='none';
    fillAgencySelect(selectId, sel.value);
  }
}

function onAgencyCustom(selectId, customId){
  // When typing in free field, keep select empty to indicate custom
  const sel=document.getElementById(selectId);
  if(sel)sel.value='';
}

function toggleAgencyCustom(customId){
  const el=document.getElementById(customId);
  if(!el)return;
  if(el.style.display==='none'||!el.style.display){el.style.display='block';el.focus();}
  else el.style.display='none';
}

function hideAgencyCustom(customId){
  const el=document.getElementById(customId);
  if(el)el.style.display='none';
}

/** Vérifie si un numéro de devis est déjà utilisé */
function checkDevisDuplicate(val, hintId, excludeId=null){
  const hint=document.getElementById(hintId);
  if(!hint)return;
  if(!val||val.trim()===''){hint.textContent='';hint.className='devis-hint';return;}
  const v=val.trim().toUpperCase();
  const dup=[...DB.projets,...DB.pipelineAO].find(x=>x.id!==excludeId&&(x.devis||'').trim().toUpperCase()===v);
  if(dup){
    hint.textContent=`⚠ Numéro déjà utilisé : ${dup.nom}`;
    hint.className='devis-hint warn';
  } else {
    hint.textContent='✓ Numéro disponible';
    hint.className='devis-hint ok';
  }
}


function initHorizontalDragScroll(){
  const sels=['.tw','.charge-wrap','.gantt-wrap'];
  document.querySelectorAll(sels.join(',')).forEach(el=>{
    if(el.dataset.dragScrollInit==='1') return;
    el.dataset.dragScrollInit='1';
    let isDown=false,startX=0,startScrollLeft=0;
    const hasOverflow=()=>el.scrollWidth>el.clientWidth+4;
    el.addEventListener('mousedown',e=>{
      if(!hasOverflow()) return;
      isDown=true;
      startX=e.pageX;
      startScrollLeft=el.scrollLeft;
      el.classList.add('dragging');
      e.preventDefault();
    });
    window.addEventListener('mouseup',()=>{isDown=false;el.classList.remove('dragging');});
    el.addEventListener('mouseleave',()=>{isDown=false;el.classList.remove('dragging');});
    el.addEventListener('mousemove',e=>{
      if(!isDown) return;
      const dx=e.pageX-startX;
      el.scrollLeft=startScrollLeft-dx;
    });
    el.addEventListener('wheel',e=>{
      if(!hasOverflow()) return;
      if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    },{passive:false});
  });
}
