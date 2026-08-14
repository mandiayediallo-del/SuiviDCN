/* DCN V16.4 — fiches prestataires externes. */
(function(){
  'use strict';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function managerRequired(){
    if(window.DCN_PERMISSIONS?.isManager?.())return true;
    window.DCN_PERMISSIONS?.deny?.('Seul un Manager peut modifier les prestataires.');
    return false;
  }
  function displayName(p){return p?.nomCommercial||p?.raisonSociale||'Prestataire';}
  function resourcesOf(pid){
    return (DB.membres||[]).filter(m=>String(m.typeRessource||'Interne')==='Externe'&&String(m.prestataireId||'')===String(pid));
  }
  function activeResourcesOf(pid){return resourcesOf(pid).filter(m=>String(m.statut||'Actif')==='Actif');}
  function resourceFull(m){
    if(typeof resourceFullName==='function')return resourceFullName(m);
    return [m?.prenom,m?.nom].filter(Boolean).join(' ')||m?.nom||m?.prenom||'Ressource';
  }
  function projectIdsForPrestataire(pid){
    const mids=new Set(resourcesOf(pid).map(m=>String(m.id)));
    const ids=new Set();
    (DB.projets||[]).forEach(pr=>{
      if((pr.acteurs||[]).some(a=>mids.has(String(a.membreId||''))))ids.add(pr.id);
    });
    // Complément : une charge saisie lie aussi la ressource au projet.
    mids.forEach(mid=>{
      const byPeriod=(DB.charge||{})[mid]||{};
      Object.values(byPeriod).forEach(e=>{
        Object.entries((e&&e.projets)||{}).forEach(([projectId,val])=>{
          if(Number(val)>0 && (DB.projets||[]).some(p=>String(p.id)===String(projectId)))ids.add(projectId);
        });
      });
    });
    return [...ids];
  }
  function projectsOf(pid){
    const ids=new Set(projectIdsForPrestataire(pid));
    return (DB.projets||[]).filter(p=>ids.has(p.id));
  }
  function ratingText(v){
    const n=Math.max(0,Math.min(5,Number(v)||0));
    return n?`${n.toFixed(n%1?1:0)} / 5`:'Non évalué';
  }
  function statusBadge(s){
    const cls={'Actif':'bg','Référencé':'bb','À tester':'bo','Suspendu':'br','Ne plus consulter':'bgr'}[s]||'bgr';
    return `<span class="badge ${cls}">${esc(s||'À tester')}</span>`;
  }
  function assuranceAlert(p){
    if(!p.assuranceEcheance)return '';
    const d=new Date(p.assuranceEcheance+'T12:00:00'),today=new Date();
    const days=Math.ceil((d-today)/86400000);
    if(days<0)return '<span class="badge br" title="Assurance échue">Assurance échue</span>';
    if(days<=30)return '<span class="badge bo" title="Assurance à renouveler">Assurance < 30 j</span>';
    return '';
  }

  window.renderPrestatairesPage=function(){
    DB.prestataires=Array.isArray(DB.prestataires)?DB.prestataires:[];
    const search=norm(document.getElementById('srchPrestataire')?.value||'');
    const status=document.getElementById('filtPrestataireStatut')?.value||'';

    const filtered=DB.prestataires.filter(p=>{
      if(status && String(p.statut||'')!==status)return false;
      if(!search)return true;
      const hay=[
        p.raisonSociale,p.nomCommercial,p.siret,p.pays,p.contactPrenom,p.contactNom,p.contactFonction,
        p.contactEmail,p.specialites,p.zoneIntervention,p.notes
      ].map(norm).join(' ');
      return hay.includes(search);
    }).sort((a,b)=>displayName(a).localeCompare(displayName(b),'fr'));

    const activeProviders=DB.prestataires.filter(p=>['Actif','Référencé'].includes(String(p.statut||''))).length;
    const externalActive=(DB.membres||[]).filter(m=>String(m.typeRessource||'Interne')==='Externe'&&String(m.statut||'Actif')==='Actif').length;
    const projectIds=new Set();
    DB.prestataires.forEach(p=>projectIdsForPrestataire(p.id).forEach(id=>projectIds.add(id)));
    const tjms=DB.prestataires.map(p=>Number(p.tjm)||0).filter(v=>v>0);
    const avgTjm=tjms.length?Math.round(tjms.reduce((a,b)=>a+b,0)/tjms.length):0;

    const k=document.getElementById('prestataireKpis');
    if(k)k.innerHTML=`
      <div class="kcard kb"><div class="klbl">Prestataires suivis</div><div class="kval">${DB.prestataires.length}</div><div class="ksub">${activeProviders} référencé(s) / actif(s)</div></div>
      <div class="kcard kg"><div class="klbl">Ressources externes actives</div><div class="kval">${externalActive}</div><div class="ksub">Présentes dans le plan de charge</div></div>
      <div class="kcard ka"><div class="klbl">Projets liés</div><div class="kval">${projectIds.size}</div><div class="ksub">Avec au moins une ressource externe</div></div>
      <div class="kcard"><div class="klbl">TJM moyen</div><div class="kval">${avgTjm?avgTjm.toLocaleString('fr-FR')+' €':'—'}</div><div class="ksub">${tjms.length} tarif(s) renseigné(s)</div></div>`;

    const tb=document.getElementById('tbPrestataires');
    if(tb){
      tb.innerHTML=filtered.length?filtered.map(p=>{
        const rs=activeResourcesOf(p.id),allRs=resourcesOf(p.id),projects=projectsOf(p.id);
        const contact=[p.contactPrenom,p.contactNom].filter(Boolean).join(' ');
        const contactSub=[p.contactFonction,p.contactEmail].filter(Boolean).join(' · ');
        return `<tr>
          <td><strong>${esc(displayName(p))}</strong>${p.nomCommercial&&p.raisonSociale?`<div style="font-size:10px;color:var(--gray-dk);">${esc(p.raisonSociale)}</div>`:''}<div style="margin-top:4px;">${assuranceAlert(p)}</div></td>
          <td class="prest-contact">${esc(contact||'—')}<div class="sub">${esc(contactSub||'')}</div></td>
          <td class="prest-specialites">${esc(p.specialites||'—')}</td>
          <td><strong>${rs.length}</strong> active(s)<div style="font-size:10px;color:var(--gray-dk);">${allRs.length} au total</div></td>
          <td>${Number(p.tjm)>0?Number(p.tjm).toLocaleString('fr-FR')+' €':'—'}</td>
          <td>${projects.length}${projects.length?`<div style="font-size:10px;color:var(--gray-dk);">${esc(projects.slice(0,2).map(x=>x.code||x.nom).join(' · '))}${projects.length>2?'…':''}</div>`:''}</td>
          <td class="prest-rating">${esc(ratingText(p.evaluation))}</td>
          <td>${statusBadge(p.statut)}</td>
          <td><button class="btn btn-outline btn-sm" onclick="editPrestataire('${esc(p.id)}')">Modifier</button></td>
        </tr>`;
      }).join(''):'<tr><td colspan="9" class="empty">Aucun prestataire selon les filtres</td></tr>';
    }
    const count=document.getElementById('prestataireCount');if(count)count.textContent=`${filtered.length} affiché(s)`;
    window.DCN_PERMISSIONS?.apply?.();
  };

  function renderLinkedInfo(pid){
    const rHost=document.getElementById('psLinkedResources'),pHost=document.getElementById('psLinkedProjects');
    const rs=pid?resourcesOf(pid):[],ps=pid?projectsOf(pid):[];
    if(rHost)rHost.innerHTML=rs.length?rs.map(r=>`${esc(resourceFull(r))} — ${esc(r.role||'')} — capacité ${Number(r.capaciteBase)||100}%${String(r.statut||'Actif')!=='Actif'?' — Inactif':''}`).join('<br>'):'Aucune ressource liée';
    if(pHost)pHost.innerHTML=ps.length?ps.map(pr=>`${esc(pr.code||'')} ${esc(pr.nom||'')}`.trim()).join('<br>'):'Aucun projet lié';
  }

  function clearForm(){
    const ids=['prestataireId','psRaisonSociale','psNomCommercial','psSiret','psPays','psAdresse','psContactPrenom','psContactNom','psContactFonction','psContactEmail','psContactTel','psSpecialites','psTjm','psZoneIntervention','psAssuranceEcheance','psDocuments','psNotes'];
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const ev=document.getElementById('psEvaluation');if(ev)ev.value='0';
    const st=document.getElementById('psStatut');if(st)st.value='À tester';
    renderLinkedInfo('');
  }

  window.openPrestataireModal=function(){
    if(!managerRequired())return;
    clearForm();
    document.getElementById('mPrestataireTitle').textContent='Nouveau prestataire externe';
    document.getElementById('mPrestataire').classList.add('open');
    setTimeout(()=>document.getElementById('psRaisonSociale')?.focus(),30);
  };

  window.editPrestataire=function(id){
    if(!managerRequired())return;
    const p=(DB.prestataires||[]).find(x=>String(x.id)===String(id));
    if(!p){toast('Prestataire introuvable','err');return;}
    const vals={
      prestataireId:p.id,psRaisonSociale:p.raisonSociale||'',psNomCommercial:p.nomCommercial||'',psSiret:p.siret||'',psPays:p.pays||'',
      psAdresse:p.adresse||'',psContactPrenom:p.contactPrenom||'',psContactNom:p.contactNom||'',psContactFonction:p.contactFonction||'',
      psContactEmail:p.contactEmail||'',psContactTel:p.contactTel||'',psSpecialites:p.specialites||'',psTjm:Number(p.tjm)||'',
      psZoneIntervention:p.zoneIntervention||'',psEvaluation:Number(p.evaluation)||0,psAssuranceEcheance:p.assuranceEcheance||'',
      psDocuments:p.documents||'',psStatut:p.statut||'À tester',psNotes:p.notes||''
    };
    Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
    renderLinkedInfo(p.id);
    document.getElementById('mPrestataireTitle').textContent='Modifier — '+displayName(p);
    document.getElementById('mPrestataire').classList.add('open');
  };

  window.savePrestataire=async function(){
    if(!managerRequired())return;
    const id0=document.getElementById('prestataireId').value.trim();
    const data={
      raisonSociale:document.getElementById('psRaisonSociale').value.trim(),
      nomCommercial:document.getElementById('psNomCommercial').value.trim(),
      siret:document.getElementById('psSiret').value.trim(),
      pays:document.getElementById('psPays').value.trim(),
      adresse:document.getElementById('psAdresse').value.trim(),
      contactPrenom:document.getElementById('psContactPrenom').value.trim(),
      contactNom:document.getElementById('psContactNom').value.trim(),
      contactFonction:document.getElementById('psContactFonction').value.trim(),
      contactEmail:document.getElementById('psContactEmail').value.trim(),
      contactTel:document.getElementById('psContactTel').value.trim(),
      specialites:document.getElementById('psSpecialites').value.trim(),
      tjm:Math.max(0,Number(document.getElementById('psTjm').value)||0),
      zoneIntervention:document.getElementById('psZoneIntervention').value.trim(),
      evaluation:Math.max(0,Math.min(5,Number(document.getElementById('psEvaluation').value)||0)),
      assuranceEcheance:document.getElementById('psAssuranceEcheance').value||'',
      documents:document.getElementById('psDocuments').value.trim(),
      statut:document.getElementById('psStatut').value||'À tester',
      notes:document.getElementById('psNotes').value.trim()
    };
    if(!data.raisonSociale){toast('Raison sociale obligatoire','err');return;}

    const duplicate=(DB.prestataires||[]).find(p=>norm(p.raisonSociale)===norm(data.raisonSociale)&&String(p.id)!==String(id0));
    if(duplicate){toast('Un prestataire avec cette raison sociale existe déjà','err');return;}

    DB.prestataires=Array.isArray(DB.prestataires)?DB.prestataires:[];
    let p=id0?DB.prestataires.find(x=>String(x.id)===String(id0)):null;
    const created=!p;
    if(!p){p={id:uid('ps')};DB.prestataires.push(p);}
    Object.assign(p,data);

    // Le nom de société des ressources externes est synchronisé avec la fiche prestataire.
    (DB.membres||[]).forEach(m=>{
      if(String(m.prestataireId||'')===String(p.id))m.societe=displayName(p);
    });

    saveDB();
    closeM('mPrestataire');
    renderPrestatairesPage();
    if(typeof renderConfigPage==='function')renderConfigPage();
    try{
      await window.DCN_SYNC?.flush?.(DB);
      toast(created?'Prestataire créé et synchronisé':'Prestataire mis à jour','ok');
    }catch(e){
      toast('Prestataire enregistré localement, synchronisation Google à reprendre','err');
    }
  };

  window.DCN_PRESTATAIRES={displayName,resourcesOf,projectsOf,projectIdsForPrestataire};
})();
