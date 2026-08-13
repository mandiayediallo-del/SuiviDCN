/* DCN V16 — transport GitHub Pages -> Apps Script sans CORS.
 * Les requêtes passent par formulaire POST + iframe invisible.
 * Chaque requête protégée inclut un jeton ID Google GIS, validé côté serveur.
 */
(function(){
  'use strict';
  const cfg=()=>window.DCN_RUNTIME_CONFIG||{};
  const pending=new Map();
  const pageNonce=(function(){try{const a=new Uint32Array(4);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(8,'0')).join('');}catch(e){return String(Date.now())+'_'+Math.random().toString(36).slice(2);}})();
  let seq=0;
  function apiUrl(){return String(cfg().API_URL||'').trim();}
  function timeoutMs(){return Number(cfg().REQUEST_TIMEOUT_MS)||45000;}
  function input(form,name,value){const el=document.createElement('input');el.type='hidden';el.name=name;el.value=value==null?'':String(value);form.appendChild(el);}
  function cleanup(id){const p=pending.get(id);if(!p)return;clearTimeout(p.timer);try{p.iframe.remove();}catch(e){}pending.delete(id);}
  function allowedMessageOrigin(origin){return origin==='https://script.google.com'||origin==='https://script.googleusercontent.com'||/\.googleusercontent\.com$/.test(String(origin||''));}
  window.addEventListener('message',function(ev){
    const d=ev.data;if(!d||d.channel!=='DCN_APPS_SCRIPT_BRIDGE'||d.nonce!==pageNonce||!allowedMessageOrigin(ev.origin))return;
    const p=pending.get(d.id);if(!p)return;cleanup(d.id);
    if(d.ok===false){const err=new Error(d.error||'Erreur Apps Script');err.code=d.code||'';p.reject(err);}else p.resolve(d.payload);
  });
  async function request(action,payload){
    const url=apiUrl();if(!url)throw new Error('Backend Google Sheets non configuré');
    let credential='';
    if(action!=='health'){
      if(!window.DCN_AUTH)throw new Error('Authentification Google non initialisée');
      credential=window.DCN_AUTH.getCredential();
      if(!credential)credential=await window.DCN_AUTH.requireFreshCredential();
      if(!credential)throw new Error('Connexion Google requise');
    }
    return new Promise((resolve,reject)=>{
      const id='dcn_'+Date.now().toString(36)+'_'+(++seq).toString(36);
      const frameName='dcn_bridge_frame_'+id.replace(/[^a-z0-9_]/gi,'_');
      const iframe=document.createElement('iframe');iframe.name=frameName;iframe.id=frameName;iframe.setAttribute('aria-hidden','true');iframe.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;';
      const form=document.createElement('form');form.method='POST';form.action=url;form.target=frameName;form.acceptCharset='UTF-8';form.style.display='none';
      input(form,'bridge','1');input(form,'requestId',id);input(form,'nonce',pageNonce);input(form,'action',action);input(form,'payload',JSON.stringify(payload||{}));input(form,'credential',credential);input(form,'parentOrigin',location.origin);
      const timer=setTimeout(()=>{cleanup(id);reject(new Error('Délai de communication Google Sheets dépassé'));},timeoutMs());
      pending.set(id,{resolve,reject,timer,iframe});document.body.appendChild(iframe);document.body.appendChild(form);
      try{form.submit();}catch(err){cleanup(id);reject(err);}finally{try{form.remove();}catch(e){}}
    });
  }
  window.DCN_BRIDGE={mode:'gis-token-iframe-postmessage',isConfigured(){return !!apiUrl();},request};
})();
