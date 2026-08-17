/* DCN V16.4.2 — correctif autonome d'ouverture des fiches projet.
 * Chargé après les autres modules pour neutraliser les conflits de wrappers.
 */
(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function findEntity(id){
    id=String(id||'').trim();
    return (window.DB?.projets||[]).find(x=>String(x.id)===id)
      || (window.DB?.pipelineAO||[]).find(x=>String(x.id)===id)
      || null;
  }

  function ensureShell(){
    let ov=document.getElementById('projectSheetOv');
    let preview=document.getElementById('projectSheetPreview');

    if(!ov){
      ov=document.createElement('div');
      ov.id='projectSheetOv';
      ov.className='ov';
      document.body.appendChild(ov);
    }

    if(!preview){
      ov.innerHTML=`
        <div class="project-sheet-modal">
          <div class="mh">
            <div class="mt">Fiche projet</div>
            <button class="mx" type="button" data-dcn-close-project-sheet>×</button>
          </div>
          <div class="mb" style="padding:12px 16px;border-bottom:1px solid var(--border);">
            <div class="project-sheet-actions">
              <button class="btn btn-accent" type="button" data-dcn-edit-project>✎ Éditer</button>
              <button class="btn btn-primary" type="button" data-dcn-word-project>Télécharger Word</button>
              <button class="btn btn-outline" type="button" data-dcn-print-project>Imprimer / PDF</button>
              <button class="btn btn-outline" type="button" data-dcn-close-project-sheet>Fermer</button>
            </div>
          </div>
          <div class="project-sheet-preview" id="projectSheetPreview"></div>
        </div>`;
      preview=ov.querySelector('#projectSheetPreview');
    }
    return {ov,preview};
  }

  function fallbackHtml(entity,err){
    const isAo=(window.DB?.pipelineAO||[]).some(x=>String(x.id)===String(entity.id));
    return `<div class="project-sheet" style="padding:24px;">
      <div style="font-size:11px;font-weight:800;color:var(--blue);text-transform:uppercase;margin-bottom:6px;">${isAo?'Appel d’offres':'Projet'}</div>
      <div style="font-size:22px;font-weight:800;color:var(--navy);margin-bottom:6px;">${esc(entity.code||entity.devis||'')} ${entity.code||entity.devis?'— ':''}${esc(entity.nom||'')}</div>
      <div style="font-size:12px;color:var(--gray-dk);margin-bottom:18px;">${esc(entity.client||'Client non renseigné')}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tbody>
          <tr><td style="padding:8px;border-bottom:1px solid var(--border);font-weight:700;">Statut</td><td style="padding:8px;border-bottom:1px solid var(--border);">${esc(entity.statut||entity.phase||'—')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid var(--border);font-weight:700;">Agence</td><td style="padding:8px;border-bottom:1px solid var(--border);">${esc(entity.agenceDB||'—')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid var(--border);font-weight:700;">Début</td><td style="padding:8px;border-bottom:1px solid var(--border);">${esc(entity.dateDebut||'—')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid var(--border);font-weight:700;">Fin</td><td style="padding:8px;border-bottom:1px solid var(--border);">${esc(entity.dateFin||'—')}</td></tr>
        </tbody>
      </table>
      ${err?`<div style="margin-top:18px;padding:10px;border:1px solid #F3C6C6;background:#FFF5F5;border-radius:6px;font-size:11px;color:#8A1C1C;">La fiche détaillée a rencontré une erreur : ${esc(err.message||String(err))}</div>`:''}
    </div>`;
  }

  function safeOpen(id){
    id=String(id||'').trim();
    const entity=findEntity(id);
    if(!entity){
      console.warn('[DCN 16.4.2] projet introuvable',id);
      if(typeof window.toast==='function')window.toast('Projet introuvable','err');
      return false;
    }

    const shell=ensureShell();
    window.CURRENT_PROJECT_SHEET_ID=id;

    // Afficher d'abord la modale, quoi qu'il arrive ensuite.
    shell.ov.classList.add('open');

    try{
      if(typeof window.buildProjectSheetHTML==='function'){
        shell.preview.innerHTML=window.buildProjectSheetHTML(id);
      }else if(typeof buildProjectSheetHTML==='function'){
        shell.preview.innerHTML=buildProjectSheetHTML(id);
      }else{
        shell.preview.innerHTML=fallbackHtml(entity,new Error('buildProjectSheetHTML indisponible'));
      }
    }catch(err){
      console.error('[DCN 16.4.2] erreur fiche détaillée',err);
      shell.preview.innerHTML=fallbackHtml(entity,err);
    }

    try{
      if(typeof window.enhanceSheetQuickNav==='function')setTimeout(window.enhanceSheetQuickNav,0);
    }catch(e){}
    return true;
  }

  function closeSafe(){
    const ov=document.getElementById('projectSheetOv');
    if(ov)ov.classList.remove('open');
  }

  // Expose explicitement les fonctions globales et remplace les anciens wrappers.
  window.dcnOpenProjectSheetSafe=safeOpen;
  window.openProjectSheet=safeOpen;
  window.closeProjectSheet=closeSafe;

  function projectIdFromClick(target){
    if(!target?.closest)return '';

    const explicit=target.closest('[data-project-id]');
    if(explicit?.dataset?.projectId)return explicit.dataset.projectId;

    const row=target.closest('#tbProjects tr');
    if(!row)return '';

    if(row.dataset?.projectId)return row.dataset.projectId;

    // Compatibilité avec les anciennes lignes onclick="openProjectSheet('id')"
    const onclick=row.getAttribute('onclick')||'';
    const m=onclick.match(/openProjectSheet\(['"]([^'"]+)['"]\)/);
    if(m)return m[1];

    // Dernier recours : retrouver le projet par le texte code/nom affiché.
    const txt=(row.textContent||'').toLowerCase();
    const p=(window.DB?.projets||[]).find(p=>{
      const code=String(p.code||'').toLowerCase();
      const nom=String(p.nom||'').toLowerCase();
      return (code&&txt.includes(code)) || (nom&&txt.includes(nom));
    });
    return p?.id||'';
  }

  document.addEventListener('click',function(e){
    if(!e.target?.closest)return;

    const close=e.target.closest('[data-dcn-close-project-sheet]');
    if(close){e.preventDefault();e.stopImmediatePropagation();closeSafe();return;}

    if(e.target.closest('[data-dcn-edit-project]')){
      e.preventDefault();e.stopImmediatePropagation();
      const id=window.CURRENT_PROJECT_SHEET_ID;
      closeSafe();
      if((window.DB?.projets||[]).some(x=>String(x.id)===String(id)) && typeof window.editProject==='function')window.editProject(id);
      else if((window.DB?.pipelineAO||[]).some(x=>String(x.id)===String(id)) && typeof window.editAo==='function')window.editAo(id);
      return;
    }
    if(e.target.closest('[data-dcn-word-project]')){
      e.preventDefault();e.stopImmediatePropagation();
      if(typeof window.downloadProjectSheetWord==='function')window.downloadProjectSheetWord();
      return;
    }
    if(e.target.closest('[data-dcn-print-project]')){
      e.preventDefault();e.stopImmediatePropagation();
      if(typeof window.printProjectSheet==='function')window.printProjectSheet();
      return;
    }

    // Ne pas transformer les boutons d'action d'une ligne en ouverture de fiche.
    if(e.target.closest('button,input,select,textarea,a,label'))return;

    const id=projectIdFromClick(e.target);
    if(!id)return;

    // Uniquement les liens de fiche explicites ou les lignes de l'onglet Projets.
    const allowed=e.target.closest('.project-sheet-link,[data-project-id],#tbProjects tr');
    if(!allowed)return;

    e.preventDefault();
    e.stopImmediatePropagation();
    safeOpen(id);
  },true);

  // Rend toutes les lignes projet explicitement identifiables après chaque rendu.
  function tagRows(){
    const rows=document.querySelectorAll('#tbProjects tr');
    rows.forEach(row=>{
      if(row.dataset.projectId)return;
      const onclick=row.getAttribute('onclick')||'';
      const m=onclick.match(/openProjectSheet\(['"]([^'"]+)['"]\)/);
      if(m){
        row.dataset.projectId=m[1];
        row.removeAttribute('onclick'); // évite le double déclenchement historique.
      }
    });
  }

  const observer=new MutationObserver(()=>tagRows());
  const startObserver=()=>{
    const tb=document.getElementById('tbProjects');
    if(tb){observer.observe(tb,{childList:true,subtree:true});tagRows();}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});
  else startObserver();

  // Après chaque ouverture de page, retaguer.
  window.addEventListener('dcn-core-ready',()=>setTimeout(tagRows,0));
})();
