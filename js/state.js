/* DCN V15 — cache local de confort. Google Sheets reste la source de vérité. */
(function(){
  'use strict';
  const STORAGE_KEY='dcn_v15_cache';
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  function getCache(){
    try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}
  }
  function persistCache(data){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}catch(e){console.warn('Cache DCN indisponible',e);return false;}
  }
  function clearCache(){try{localStorage.removeItem(STORAGE_KEY);}catch(e){}}
  window.DCN_STATE={STORAGE_KEY,getCache,persistCache,clearCache,clone};
})();
