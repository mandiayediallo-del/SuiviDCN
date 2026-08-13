(function(){
'use strict';
function dcnFindProjectGrid(){ return document.querySelector('#mProject .fg'); }
function dcnMakeSectionTitle(text, cls){
  var div=document.createElement('div');
  div.className='sdiv psec-title '+cls+' ff';
  div.textContent=text;
  return div;
}
function dcnFieldGroup(id){
  var el=document.getElementById(id);
  return el ? el.closest('.fgrp') : null;
}
function dcnMoveAfter(anchor, nodes){
  if(!anchor || !anchor.parentNode) return;
  var parent=anchor.parentNode;
  var ref=anchor.nextSibling;
  nodes.forEach(function(n){ if(n){ parent.insertBefore(n, ref); } });
}
window.dcnFixProjectModalVisibility=function(){
  try{
    var grid=dcnFindProjectGrid();
    if(!grid) return;
    var notesGrp=dcnFieldGroup('prNotes');
    var actorsWrap=document.getElementById('dcnActeursWrap');
    var oldActorTitle=null;
    Array.prototype.forEach.call(grid.querySelectorAll('.sdiv'),function(x){
      var t=(x.textContent||'').toLowerCase();
      if(t.indexOf('acteur')>-1) oldActorTitle=x;
    });
    var actorTitle=document.getElementById('dcnProjectActorsTitle');
    if(!actorTitle){
      actorTitle=dcnMakeSectionTitle('🟣 Acteurs du projet','actors');
      actorTitle.id='dcnProjectActorsTitle';
      grid.appendChild(actorTitle);
    }
    if(actorsWrap){
      actorsWrap.classList.add('ff');
      actorsWrap.style.display='block';
      dcnMoveAfter(actorTitle,[actorsWrap]);
    }
    if(oldActorTitle && oldActorTitle!==actorTitle){ oldActorTitle.style.display='none'; }
    var contactTitle=null;
    Array.prototype.forEach.call(grid.querySelectorAll('.sdiv'),function(x){
      var t=(x.textContent||'').toLowerCase();
      if(t.indexOf('contact')>-1) contactTitle=x;
    });
    if(contactTitle && actorTitle.parentNode){
      grid.insertBefore(actorTitle, contactTitle);
      if(actorsWrap) grid.insertBefore(actorsWrap, contactTitle);
    }
    var notesTitle=document.getElementById('dcnProjectNotesTitle');
    if(!notesTitle){
      notesTitle=dcnMakeSectionTitle('🔴 Notes & alertes','notes');
      notesTitle.id='dcnProjectNotesTitle';
      grid.appendChild(notesTitle);
    }
    if(notesGrp){
      notesGrp.classList.add('ff','project-note-card');
      notesGrp.style.display='flex';
      dcnMoveAfter(notesTitle,[notesGrp]);
    }
    var notesInput=document.getElementById('prNotes');
    if(notesInput){
      notesInput.style.minHeight='110px';
      notesInput.placeholder='Notes libres, alertes, points de vigilance…';
    }
    if(typeof dcnRenderActeursList==='function') dcnRenderActeursList();
  }catch(e){ console.error('[DCN] correction visibilité modale projet', e); }
};
var _fixOpen=window.openProjectModal;
window.openProjectModal=function(){
  if(_fixOpen) _fixOpen.apply(this,arguments);
  setTimeout(window.dcnFixProjectModalVisibility,160);
};
var _fixEdit=window.editProject;
window.editProject=function(id){
  if(_fixEdit) _fixEdit.apply(this,arguments);
  setTimeout(window.dcnFixProjectModalVisibility,180);
};
document.addEventListener('DOMContentLoaded',function(){ setTimeout(window.dcnFixProjectModalVisibility,250); });
})();
