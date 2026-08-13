(function(){
  'use strict';

  var MOIS_LABELS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function getMemberName(mid){
    if(!window.DB||!DB.membres) return mid;
    var m=DB.membres.find(function(x){return x.id===mid;});
    return m?m.nom:mid;
  }

  function getProjectName(pid){
    if(!window.DB) return pid;
    var p=(DB.projets||[]).find(function(x){return x.id===pid;});
    if(p) return p.nom;
    var ao=(DB.pipelineAO||[]).find(function(x){return x.id===pid;});
    if(ao) return ao.nom;
    return pid;
  }

  function humanMonth(mk){
    if(!mk) return '';
    var parts=mk.split('-');
    if(parts.length<2) return mk;
    var mi=parseInt(parts[1],10)-1;
    return (MOIS_LABELS[mi]||parts[1])+' '+parts[0];
  }

  // ── TOOLTIP ──
  var tip=document.getElementById('dcn-tooltip');
  var tipTimer=null;

  function showTooltip(el, x, y){
    var pid=el.dataset.pid;
    var mid=el.dataset.mid;
    var mk=el.dataset.mk;
    var meta=el.dataset.meta;
    var col=el.dataset.col;
    var html='';

    if(pid && mid && mk){
      html+='<span class="tt-project">'+getProjectName(pid)+'</span>';
      html+='<div class="tt-row"><span class="tt-label">Mois</span><span class="tt-val">'+humanMonth(mk)+'</span></div>';
      html+='<div class="tt-row"><span class="tt-label">Membre</span><span class="tt-val">'+getMemberName(mid)+'</span></div>';
      if(el.value) html+='<div class="tt-divider"></div><div class="tt-row"><span class="tt-label">Charge</span><span class="tt-val" style="color:#FDE68A;">'+el.value+'%</span></div>';
    }
    else if(meta && mid && mk){
      var metaLbl={formation:'Formation',conges:'Congés',absences:'Absences'}[meta]||meta;
      html+='<span class="tt-project">'+metaLbl+'</span>';
      html+='<div class="tt-row"><span class="tt-label">Mois</span><span class="tt-val">'+humanMonth(mk)+'</span></div>';
      html+='<div class="tt-row"><span class="tt-label">Membre</span><span class="tt-val">'+getMemberName(mid)+'</span></div>';
      if(el.value) html+='<div class="tt-divider"></div><div class="tt-row"><span class="tt-label">Valeur</span><span class="tt-val" style="color:#93C5FD;">'+el.value+'%</span></div>';
    }
    else if(el.classList.contains('input-money')){
      var tr=el.closest('tr');
      if(tr){
        var firstCell=tr.querySelector('td');
        var projName=firstCell?firstCell.textContent.trim().replace(/\s+/g,' '):'—';
        if(projName.length>50) projName=projName.slice(0,48)+'…';
        html+='<span class="tt-project">'+projName+'</span>';
        var ci=parseInt(col,10);
        if(ci===0) html+='<div class="tt-row"><span class="tt-label">Période</span><span class="tt-val">Avant 2026</span></div>';
        else if(ci>=1 && ci<=12) html+='<div class="tt-row"><span class="tt-label">Mois</span><span class="tt-val">'+MOIS_LABELS[ci-1]+' 2026</span></div>';
        else if(ci===13) html+='<div class="tt-row"><span class="tt-label">Période</span><span class="tt-val">Après 2026</span></div>';
        if(el.value) html+='<div class="tt-divider"></div><div class="tt-row"><span class="tt-label">Montant</span><span class="tt-val" style="color:#FDE68A;">'+Number(el.value).toLocaleString('fr-FR')+' €</span></div>';
      }
    }

    if(!html) return;
    tip.innerHTML=html;
    var vw=window.innerWidth, vh=window.innerHeight;
    var tx=x+16, ty=y-10;
    tip.style.left=tx+'px';
    tip.style.top=ty+'px';
    tip.classList.add('visible');
    requestAnimationFrame(function(){
      var rect=tip.getBoundingClientRect();
      if(rect.right>vw-12) tip.style.left=(x-rect.width-8)+'px';
      if(rect.bottom>vh-12) tip.style.top=(y-rect.height-8)+'px';
    });
  }

  function hideTooltip(){
    tip.classList.remove('visible');
  }

  // ── LIGNE ACTIVE ──
  var activeRowEl=null;

  function setActiveRow(input){
    var tr=input.closest('tr');
    if(!tr||tr===activeRowEl) return;
    if(activeRowEl){
      activeRowEl.classList.remove('row-active');
      activeRowEl.classList.remove('row-focus');
    }
    tr.classList.add('row-active');
    activeRowEl=tr;
  }

  // ── ÉVÉNEMENTS GLOBAUX ──
  document.addEventListener('focusin', function(e){
    var el=e.target;
    if(el.matches && el.matches('.input-mini, .input-money')){
      setActiveRow(el);
      setTimeout(function(){ if(el.select) el.select(); }, 0);
    }
  });

  document.addEventListener('focusout', function(e){
    if(e.target.matches && e.target.matches('.input-mini, .input-money')){
      hideTooltip();
    }
  });

  // Tooltip au survol
  document.addEventListener('mouseenter', function(e){
    var el=e.target;
    if(el.matches && el.matches('.input-mini, .input-money')){
      clearTimeout(tipTimer);
      tipTimer=setTimeout(function(){
        var rect=el.getBoundingClientRect();
        showTooltip(el, rect.left+rect.width/2, rect.top);
      }, 400);
    }
  }, true);

  document.addEventListener('mouseleave', function(e){
    var el=e.target;
    if(el.matches && el.matches('.input-mini, .input-money')){
      clearTimeout(tipTimer);
      hideTooltip();
    }
  }, true);

  document.addEventListener('input', function(e){
    if(e.target.matches && e.target.matches('.input-mini, .input-money')){
      hideTooltip();
    }
  });

  // ── NAVIGATION CLAVIER AMÉLIORÉE ──
  document.addEventListener('keydown', function(e){
    var el=e.target;
    if(!el.matches || !el.matches('.input-mini, .input-money')) return;
    var tr=el.closest('tr');
    if(!tr) return;

    // Flèches haut/bas
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      var col=el.dataset.col, mid=el.dataset.mid;
      var sibling=e.key==='ArrowDown'?tr.nextElementSibling:tr.previousElementSibling;
      if(!sibling) return;
      var sel='[data-col="'+col+'"]';
      if(mid) sel+='[data-mid="'+mid+'"]';
      var target=sibling.querySelector(sel);
      if(!target) target=sibling.querySelector('[data-col="'+col+'"]');
      if(target) target.focus();
    }

    // Flèches gauche/droite (si curseur au bord)
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      var atEdge=e.key==='ArrowLeft'?el.selectionStart===0:el.selectionEnd===el.value.length;
      if(!atEdge) return;
      e.preventDefault();
      var inputs=Array.from(tr.querySelectorAll('.input-mini, .input-money'));
      var idx=inputs.indexOf(el);
      var next=e.key==='ArrowRight'?inputs[idx+1]:inputs[idx-1];
      if(next) next.focus();
    }
  });

  // Nettoyer la ligne active en cliquant ailleurs
  document.addEventListener('click', function(e){
    if(!e.target.matches || (!e.target.matches('.input-mini, .input-money') && !e.target.closest('.input-mini, .input-money'))){
      if(activeRowEl){
        activeRowEl.classList.remove('row-active');
        activeRowEl=null;
      }
    }
  });

})();
