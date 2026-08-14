/* DCN V16.4 — gestion des ressources internes / externes et paramètres. */
(function(){
  'use strict';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function managerRequired(){
    if(window.DCN_PERMISSIONS?.isManager?.())return true;
    window.DCN_PERMISSIONS?.deny?.('Seul un Manager peut modifier les ressources ou les paramètres.');
    return false;
  }
  function normEmail(v){return String(v||'').trim().toLowerCase();}
  function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(v));}
  function typeOf(m){return String(m?.typeRessource||'Interne')==='Externe'?'Externe':'Interne';}
  function accessOf(m){
    if(typeOf(m)==='Externe')return 'Aucun accès';
    const raw=String(m?.niveauAcces||'').trim().toUpperCase();
    if(raw==='MANAGER'||raw==='ADMIN')return 'Manager';
    return 'Collaborateur';
  }
  function providerById(id){return (DB.prestataires||[]).find(p=>String(p.id)===String(id));}
  function providerName(p){return p?(p.nomCommercial||p.raisonSociale||'Prestataire'):'';}
  function fullName(m){
    if(typeof resourceFullName==='function')return resourceFullName(m);
    return [m?.prenom,m?.nom].filter(Boolean).join(' ')||m?.nom||m?.prenom||'Ressource';
  }
  function populateProviderSelect(selected=''){
    const sel=document.getElementById('newMemberProvider');if(!sel)return;
    const ps=[...(DB.prestataires||[])].sort((a,b)=>providerName(a).localeCompare(providerName(b),'fr'));
    sel.innerHTML='<option value="">— Choisir un prestataire —</option>'+ps.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===String(selected)?'selected':''}>${esc(providerName(p))}${p.raisonSociale&&p.nomCommercial?' — '+esc(p.raisonSociale):''}</option>`).join('');
  }

  window.onMemberTypeChange=function(){
    const type=document.getElementById('newMemberType')?.value||'Interne';
    const provider=document.getElementById('newMemberProvider');
    const providerGroup=document.getElementById('memberProviderGroup');
    const email=document.getElementById('newMemberEmail');
    const access=document.getElementById('newMemberAccess');
    const hint=document.getElementById('memberFormHint');

    if(type==='Externe'){
      if(providerGroup)providerGroup.style.display='';
      if(provider)provider.disabled=false;
      if(email){email.required=false;email.placeholder='Facultatif — aucun accès à SuiviDCN';}
      if(access){access.value='Aucun accès';access.disabled=true;}
      if(hint)hint.textContent='Externe : suivi dans le Plan de charge et les projets, mais connexion à SuiviDCN interdite. La société/prestataire est obligatoire.';
    }else{
      if(providerGroup)providerGroup.style.display='none';
      if(provider){provider.value='';provider.disabled=true;}
      if(email){email.required=true;email.placeholder='Compte Google utilisé pour se connecter';}
      if(access){if(access.value==='Aucun accès')access.value='Collaborateur';access.disabled=false;}
      if(hint)hint.textContent='Interne : email Google obligatoire. Manager = tout modifier ; Collaborateur = lecture partout et modification de sa propre charge uniquement.';
    }
  };

  window.renderConfigPage=function(){
    const tb=document.getElementById('tbMembers');
    if(tb){
      tb.innerHTML=(DB.membres||[]).map(m=>{
        const type=typeOf(m),active=String(m.statut||'Actif').toLowerCase()==='actif';
        const provider=providerById(m.prestataireId);
        const company=type==='Externe'?(providerName(provider)||m.societe||'—'):'Demathieu Bard';
        return `<tr>
          <td>${esc(m.nom||'—')}</td>
          <td>${esc(m.prenom||'—')}</td>
          <td><span class="resource-type ${type.toLowerCase()}">${type}</span></td>
          <td>${esc(company)}</td>
          <td>${esc(m.email||'—')}</td>
          <td>${esc(m.role||'—')}</td>
          <td>${Number(m.capaciteBase)||100}%</td>
          <td><span class="badge ${accessOf(m)==='Manager'?'b-blue':accessOf(m)==='Aucun accès'?'bgr':'b-gray'}">${accessOf(m)}</span></td>
          <td>${active?'<span class="badge bg">Oui</span>':'<span class="badge bgr">Non</span>'}</td>
          <td><div style="display:flex;gap:4px;justify-content:flex-end;">
            <button class="btn btn-outline btn-sm" onclick="editMember('${esc(m.id)}')">Modifier</button>
            <button class="btn ${active?'btn-danger':'btn-outline'} btn-sm" onclick="toggleMemberStatus('${esc(m.id)}')">${active?'Désactiver':'Réactiver'}</button>
          </div></td>
        </tr>`;
      }).join('');
    }

    populateProviderSelect(document.getElementById('newMemberProvider')?.value||'');
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val??'';};
    set('cfgYear',DB.cfg.annee);set('cfgHigh',DB.cfg.seuilChargeHaute);set('cfgLow',DB.cfg.seuilChargeBasse);set('cfgCurrency',DB.cfg.devise);
    set('cfgServiceName',DB.cfg.serviceName||'');
    onMemberTypeChange();
    window.DCN_PERMISSIONS?.apply?.();
  };

  window.cancelMemberEdit=function(){
    const clear=['editMemberId','newMemberName','newMemberFirstName','newMemberEmail','newMemberRole'];
    clear.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const type=document.getElementById('newMemberType');if(type)type.value='Interne';
    const provider=document.getElementById('newMemberProvider');if(provider)provider.value='';
    const cap=document.getElementById('newMemberCapacity');if(cap)cap.value='100';
    const access=document.getElementById('newMemberAccess');if(access){access.disabled=false;access.value='Collaborateur';}
    const st=document.getElementById('newMemberStatus');if(st)st.value='Actif';
    const btn=document.getElementById('memberSaveBtn');if(btn)btn.textContent='Ajouter la ressource';
    const cancel=document.getElementById('memberCancelBtn');if(cancel)cancel.style.display='none';
    populateProviderSelect('');
    onMemberTypeChange();
  };

  window.editMember=function(id){
    if(!managerRequired())return;
    const m=(DB.membres||[]).find(x=>String(x.id)===String(id));
    if(!m)return;
    document.getElementById('editMemberId').value=m.id;
    document.getElementById('newMemberName').value=m.nom||'';
    document.getElementById('newMemberFirstName').value=m.prenom||'';
    document.getElementById('newMemberType').value=typeOf(m);
    populateProviderSelect(m.prestataireId||'');
    document.getElementById('newMemberProvider').value=m.prestataireId||'';
    document.getElementById('newMemberEmail').value=m.email||'';
    document.getElementById('newMemberRole').value=m.role||'';
    document.getElementById('newMemberCapacity').value=Number(m.capaciteBase)||100;
    document.getElementById('newMemberAccess').value=accessOf(m);
    document.getElementById('newMemberStatus').value=m.statut||'Actif';
    document.getElementById('memberSaveBtn').textContent='Enregistrer';
    document.getElementById('memberCancelBtn').style.display='';
    onMemberTypeChange();
    document.getElementById('newMemberName').focus();
  };

  window.saveMemberForm=async function(){
    if(!managerRequired())return;
    const id0=document.getElementById('editMemberId').value.trim();
    const nom=document.getElementById('newMemberName').value.trim();
    const prenom=document.getElementById('newMemberFirstName').value.trim();
    const type=document.getElementById('newMemberType').value==='Externe'?'Externe':'Interne';
    const prestataireId=type==='Externe'?document.getElementById('newMemberProvider').value:'';
    const provider=providerById(prestataireId);
    const email=normEmail(document.getElementById('newMemberEmail').value);
    const role=document.getElementById('newMemberRole').value.trim();
    const capacite=Math.max(1,Math.min(200,Number(document.getElementById('newMemberCapacity').value)||100));
    const niveauAcces=type==='Externe'?'Aucun accès':(document.getElementById('newMemberAccess').value==='Manager'?'Manager':'Collaborateur');
    const statut=document.getElementById('newMemberStatus').value==='Inactif'?'Inactif':'Actif';

    if(!nom){toast('Nom obligatoire','err');return;}
    if(!prenom){toast('Prénom obligatoire','err');return;}
    if(!role){toast('Fonction obligatoire','err');return;}
    if(type==='Interne'&&!validEmail(email)){toast('Pour une ressource interne, l’adresse Google est obligatoire','err');return;}
    if(type==='Externe'&&!prestataireId){toast('Pour une ressource externe, choisissez sa société / son prestataire','err');return;}
    if(type==='Externe'&&!provider){toast('Prestataire introuvable. Créez d’abord sa fiche dans Prestataires externes.','err');return;}
    if(email){
      const duplicate=(DB.membres||[]).find(m=>normEmail(m.email)===email && String(m.id)!==String(id0));
      if(duplicate){toast('Cette adresse Google est déjà utilisée par '+fullName(duplicate),'err');return;}
    }

    let m=id0?(DB.membres||[]).find(x=>String(x.id)===String(id0)):null;
    const created=!m;
    if(!m){
      const id=uid('m');
      m={id,nom:'',prenom:'',email:'',role:'',capaciteBase:100,typeRessource:type,prestataireId:'',societe:'',statut:'Actif',niveauAcces:'Collaborateur'};
      DB.membres.push(m);
      DB.charge[id]={};
    }
    Object.assign(m,{
      nom,prenom,email,role,capaciteBase:capacite,typeRessource:type,prestataireId,
      societe:type==='Externe'?providerName(provider):'',
      statut,niveauAcces
    });
    saveDB();
    renderConfigPage();
    cancelMemberEdit();

    try{
      await window.DCN_SYNC?.flush?.(DB);
      toast(created?'Ressource ajoutée et synchronisée':'Ressource mise à jour','ok');
    }catch(e){
      toast('Modification locale enregistrée, mais synchronisation Google impossible','err');
    }
  };

  window.addMember=window.saveMemberForm;

  window.toggleMemberStatus=async function(id){
    if(!managerRequired())return;
    const m=(DB.membres||[]).find(x=>String(x.id)===String(id));if(!m)return;
    const active=String(m.statut||'Actif').toLowerCase()==='actif';
    const action=active?'désactiver':'réactiver';
    if(!confirm(`Voulez-vous ${action} ${fullName(m)} ?`))return;
    m.statut=active?'Inactif':'Actif';
    saveDB();renderConfigPage();
    try{await window.DCN_SYNC?.flush?.(DB);toast(`Ressource ${active?'désactivée':'réactivée'}`,'ok');}catch(e){}
  };
  window.deleteMember=function(id){return window.toggleMemberStatus(id);};

  window.saveCfg=async function(){
    if(!managerRequired())return;
    DB.cfg.annee=Number(document.getElementById('cfgYear').value)||DB.cfg.annee;
    DB.cfg.seuilChargeHaute=Number(document.getElementById('cfgHigh').value)||90;
    DB.cfg.seuilChargeBasse=Number(document.getElementById('cfgLow').value)||30;
    DB.cfg.devise=document.getElementById('cfgCurrency').value||'EUR';
    const sn=document.getElementById('cfgServiceName');if(sn)DB.cfg.serviceName=sn.value.trim();
    saveDB();updateServiceBadge();renderConfigPage();
    try{await window.DCN_SYNC?.flush?.(DB);toast('Configuration sauvegardée','ok');}catch(e){}
  };

  window.updateServiceBadge=function(){
    const name=DB.cfg&&DB.cfg.serviceName;
    const badge=document.getElementById('serviceNameBadge');
    if(badge){if(name){badge.textContent=name;badge.style.display='block';}else badge.style.display='none';}
  };

  window.showLastAction=function(msg){
    const el=document.getElementById('lastActionIndicator');if(!el)return;
    el.textContent=msg;el.style.opacity='1';clearTimeout(el._t);
    el._t=setTimeout(()=>{el.style.opacity='0';},8000);
  };

  window.resetData=async function(){
    if(!managerRequired())return;
    if(!confirm('Recharger les données depuis Google Sheets et abandonner les modifications locales non synchronisées ?'))return;
    await window.DCN_BISYNC?.pull?.({forceFull:true,userInitiated:true});
  };
})();
