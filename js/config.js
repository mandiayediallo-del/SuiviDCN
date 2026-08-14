/* DCN V16.3 — gestion des collaborateurs et paramètres. */
(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function managerRequired(){
    if(window.DCN_PERMISSIONS?.isManager?.())return true;
    window.DCN_PERMISSIONS?.deny?.('Seul un Manager peut modifier les collaborateurs ou les paramètres.');
    return false;
  }
  function normEmail(v){return String(v||'').trim().toLowerCase();}
  function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(v));}
  function accessOf(m){
    const raw=String(m?.niveauAcces||'').trim().toUpperCase();
    if(raw==='MANAGER'||raw==='ADMIN')return 'Manager';
    const u=window.DCN_CURRENT_USER||{};
    if(String(u.memberId||'')===String(m?.id||'') && (u.isManager||u.isAdmin||String(u.accessLevel||'').toUpperCase()==='MANAGER'))return 'Manager';
    return 'Collaborateur';
  }

  window.renderConfigPage=function(){
    const tb=document.getElementById('tbMembers');
    if(tb){
      tb.innerHTML=(DB.membres||[]).map(m=>{
        const active=String(m.statut||'Actif').toLowerCase()==='actif';
        return `<tr>
          <td>${esc(m.nom)}</td>
          <td>${esc(m.email||'—')}</td>
          <td>${esc(m.role||'—')}</td>
          <td>${Number(m.capaciteBase)||100}%</td>
          <td><span class="badge ${accessOf(m)==='Manager'?'b-blue':'b-gray'}">${accessOf(m)}</span></td>
          <td>${typeof badgeStatus==='function'?badgeStatus(m.statut||'Actif'):esc(m.statut||'Actif')}</td>
          <td><div style="display:flex;gap:4px;justify-content:flex-end;">
            <button class="btn btn-outline btn-sm" onclick="editMember('${m.id}')">Modifier</button>
            <button class="btn ${active?'btn-danger':'btn-outline'} btn-sm" onclick="toggleMemberStatus('${m.id}')">${active?'Désactiver':'Réactiver'}</button>
          </div></td>
        </tr>`;
      }).join('');
    }

    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val??'';};
    set('cfgYear',DB.cfg.annee);set('cfgHigh',DB.cfg.seuilChargeHaute);set('cfgLow',DB.cfg.seuilChargeBasse);set('cfgCurrency',DB.cfg.devise);
    set('cfgServiceName',DB.cfg.serviceName||'');
    window.DCN_PERMISSIONS?.apply?.();
  };

  window.cancelMemberEdit=function(){
    ['editMemberId','newMemberName','newMemberEmail','newMemberRole'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const cap=document.getElementById('newMemberCapacity');if(cap)cap.value='100';
    const access=document.getElementById('newMemberAccess');if(access)access.value='Collaborateur';
    const st=document.getElementById('newMemberStatus');if(st)st.value='Actif';
    const btn=document.getElementById('memberSaveBtn');if(btn)btn.textContent='Ajouter le collaborateur';
    const cancel=document.getElementById('memberCancelBtn');if(cancel)cancel.style.display='none';
  };

  window.editMember=function(id){
    if(!managerRequired())return;
    const m=(DB.membres||[]).find(x=>String(x.id)===String(id));
    if(!m)return;
    document.getElementById('editMemberId').value=m.id;
    document.getElementById('newMemberName').value=m.nom||'';
    document.getElementById('newMemberEmail').value=m.email||'';
    document.getElementById('newMemberRole').value=m.role||'';
    document.getElementById('newMemberCapacity').value=Number(m.capaciteBase)||100;
    document.getElementById('newMemberAccess').value=accessOf(m);
    document.getElementById('newMemberStatus').value=m.statut||'Actif';
    document.getElementById('memberSaveBtn').textContent='Enregistrer';
    document.getElementById('memberCancelBtn').style.display='';
    document.getElementById('newMemberName').focus();
  };

  window.saveMemberForm=async function(){
    if(!managerRequired())return;
    const id0=document.getElementById('editMemberId').value.trim();
    const nom=document.getElementById('newMemberName').value.trim();
    const email=normEmail(document.getElementById('newMemberEmail').value);
    const role=document.getElementById('newMemberRole').value.trim();
    const capacite=Math.max(0,Math.min(200,Number(document.getElementById('newMemberCapacity').value)||100));
    const niveauAcces=document.getElementById('newMemberAccess').value==='Manager'?'Manager':'Collaborateur';
    const statut=document.getElementById('newMemberStatus').value==='Inactif'?'Inactif':'Actif';

    if(!nom){toast('Nom obligatoire','err');return;}
    if(!validEmail(email)){toast('Adresse Google obligatoire et invalide','err');return;}
    const duplicate=(DB.membres||[]).find(m=>normEmail(m.email)===email && String(m.id)!==String(id0));
    if(duplicate){toast('Cette adresse Google est déjà utilisée par '+duplicate.nom,'err');return;}

    let m=id0?(DB.membres||[]).find(x=>String(x.id)===String(id0)):null;
    const created=!m;
    if(!m){
      const id=uid('m');
      m={id,nom:'',email:'',role:'',capaciteBase:100,statut:'Actif',niveauAcces:'Collaborateur'};
      DB.membres.push(m);
      DB.charge[id]={};
      for(let i=0;i<12;i++)DB.charge[id][monthKey(i)]={projets:{},divers:0,formation:0,conges:0,absences:0};
    }
    Object.assign(m,{nom,email,role,capaciteBase:capacite,statut,niveauAcces});
    saveDB();
    renderConfigPage();
    cancelMemberEdit();

    try{
      await window.DCN_SYNC?.flush?.(DB);
      toast(created?'Collaborateur ajouté et synchronisé':'Collaborateur mis à jour','ok');
    }catch(e){
      toast('Modification locale enregistrée, mais synchronisation Google impossible','err');
    }
  };

  // Compatibilité avec les anciens appels.
  window.addMember=window.saveMemberForm;

  window.toggleMemberStatus=async function(id){
    if(!managerRequired())return;
    const m=(DB.membres||[]).find(x=>String(x.id)===String(id));if(!m)return;
    const active=String(m.statut||'Actif').toLowerCase()==='actif';
    const action=active?'désactiver':'réactiver';
    if(!confirm(`Voulez-vous ${action} ${m.nom} ?`))return;
    m.statut=active?'Inactif':'Actif';
    saveDB();renderConfigPage();
    try{await window.DCN_SYNC?.flush?.(DB);toast(`Collaborateur ${active?'désactivé':'réactivé'}`,'ok');}catch(e){}
  };

  // Ancien bouton éventuel : ne supprime plus l'historique, il désactive.
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

  // En cloud, "réinitialiser" ne doit jamais supprimer la base distante.
  window.resetData=async function(){
    if(!managerRequired())return;
    if(!confirm('Recharger les données depuis Google Sheets et abandonner les modifications locales non synchronisées ?'))return;
    await window.DCN_BISYNC?.pull?.({forceFull:true,userInitiated:true});
  };
})();
