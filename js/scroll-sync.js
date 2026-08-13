(function(){
/* Sync glissière supérieure avec la glissière inférieure */
function syncPair(wrapId, topId, innerId) {
  var wrap = document.getElementById(wrapId);
  var top  = document.getElementById(topId);
  var inn  = document.getElementById(innerId);
  if (!wrap || !top || !inn) return;

  function refreshW() {
    var w = wrap.scrollWidth;
    if (w > 100) inn.style.width = w + 'px';
  }
  refreshW();

  var lk = false;
  top.addEventListener('scroll', function() {
    if (lk) return; lk = true; wrap.scrollLeft = top.scrollLeft; lk = false;
  });
  wrap.addEventListener('scroll', function() {
    if (lk) return; lk = true; top.scrollLeft = wrap.scrollLeft; lk = false;
    refreshW();
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(refreshW).observe(wrap);
  }
}

function init() {
  syncPair('chargeWrap', 'chargeTopScroll', 'chargeTopScrollInner');
  syncPair('ganttWrap',  'ganttTopScroll',  'ganttTopScrollInner');
}

/* Re-sync inner width after dynamic re-render */
function resync(wrapId, innerId) {
  var wrap = document.getElementById(wrapId);
  var inn  = document.getElementById(innerId);
  if (wrap && inn) inn.style.width = Math.max(wrap.scrollWidth, 600) + 'px';
}

['renderChargePage','renderChargePageCompact','setChargeView'].forEach(function(fn) {
  if (typeof window[fn] === 'function') {
    var orig = window[fn];
    window[fn] = function() { orig.apply(this, arguments); setTimeout(function(){ resync('chargeWrap','chargeTopScrollInner'); }, 200); };
  }
});
if (typeof window.renderGanttPage === 'function') {
  var _og = window.renderGanttPage;
  window.renderGanttPage = function() { _og.apply(this, arguments); setTimeout(function(){ resync('ganttWrap','ganttTopScrollInner'); }, 200); };
}

/* Hook goPage to also enhance .tw tables in other pages */
if (typeof window.goPage === 'function') {
  var _gp = window.goPage;
  window.goPage = function(id) {
    _gp(id);
    setTimeout(function() {
      init();
      /* add nav to .tw tables that overflow */
      document.querySelectorAll('.tw').forEach(function(el) {
        if (el.id === 'chargeWrap' || el.id === 'ganttWrap' || el.dataset.dcnNav) return;
        if (el.scrollWidth <= el.clientWidth + 5) return;
        el.dataset.dcnNav = '1';
        var bar = document.createElement('div');
        bar.style.cssText = 'display:flex;align-items:center;gap:5px;padding:5px 0 4px;flex-wrap:wrap;';
        var bP = document.createElement('button'); bP.className='dcn-nav-btn'; bP.innerHTML='&#9664; Préc.';
        bP.onclick=function(){el.scrollBy({left:-Math.round(el.clientWidth*0.75),behavior:'smooth'});};
        var bN = document.createElement('button'); bN.className='dcn-nav-btn'; bN.innerHTML='Suiv. &#9654;';
        bN.onclick=function(){el.scrollBy({left:Math.round(el.clientWidth*0.75),behavior:'smooth'});};
        var hint = document.createElement('span'); hint.className='dcn-nav-hint'; hint.textContent='(ou glisser)';
        bar.appendChild(bP); bar.appendChild(bN); bar.appendChild(hint);
        var ts = document.createElement('div'); ts.className='dcn-ts';
        var ti = document.createElement('div'); ti.style.cssText='height:1px;width:'+el.scrollWidth+'px;';
        ts.appendChild(ti); el.parentNode.insertBefore(bar, el); el.parentNode.insertBefore(ts, el);
        var lk=false;
        ts.addEventListener('scroll',function(){if(lk)return;lk=true;el.scrollLeft=ts.scrollLeft;lk=false;});
        el.addEventListener('scroll',function(){if(lk)return;lk=true;ts.scrollLeft=el.scrollLeft;lk=false;ti.style.width=el.scrollWidth+'px';});
      });
    }, 450);
  };
}

/* Startup */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 600); });
} else {
  setTimeout(init, 600);
}
console.log('[DCN NAV V2] ✓');
})();
