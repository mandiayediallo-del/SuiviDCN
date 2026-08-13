/* DCN V16 — authentification Google Identity Services (GIS).
 * Le jeton ID reste côté navigateur et est transmis au backend Apps Script
 * à chaque requête. Le backend valide le jeton avant tout accès aux données.
 */
(function(){
  'use strict';
  const cfg=()=>window.DCN_RUNTIME_CONFIG||{};
  let credential='';
  let claims=null;
  let initialized=false;
  let initTimer=null;
  let readyResolve=null;
  let readyReject=null;
  let readyPromise=null;
  let serverUser=null;

  function decodeJwtPayload(token){
    try{
      const p=String(token||'').split('.')[1];
      if(!p)return null;
      const s=p.replace(/-/g,'+').replace(/_/g,'/');
      const pad=s+'='.repeat((4-s.length%4)%4);
      return JSON.parse(decodeURIComponent(Array.from(atob(pad)).map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
    }catch(e){return null;}
  }
  function validCachedToken(){
    if(!credential||!claims)return false;
    const exp=Number(claims.exp)||0;
    return exp>(Date.now()/1000)+60;
  }
  function ensureOverlay(){
    let ov=document.getElementById('dcnAuthOverlay');
    if(ov)return ov;
    ov=document.createElement('div');
    ov.id='dcnAuthOverlay';
    ov.innerHTML=`
      <div class="dcn-auth-card">
        <div class="dcn-auth-brand">DEMATHIEU BARD</div>
        <div class="dcn-auth-title">Construction Numérique</div>
        <div class="dcn-auth-sub">Connexion requise pour accéder à SuiviDCN et aux données partagées.</div>
        <div id="dcnGoogleButton" class="dcn-auth-google"></div>
        <div id="dcnAuthStatus" class="dcn-auth-status">Initialisation de Google…</div>
        <div class="dcn-auth-note">Seuls les comptes enregistrés dans l’onglet UTILISATEURS sont autorisés.</div>
      </div>`;
    document.body.appendChild(ov);
    return ov;
  }
  function injectStyle(){
    if(document.getElementById('dcnAuthStyle'))return;
    const st=document.createElement('style');st.id='dcnAuthStyle';st.textContent=`
      #dcnAuthOverlay{position:fixed;inset:0;z-index:999999;background:rgba(16,39,61,.94);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,Arial,sans-serif}
      #dcnAuthOverlay.hidden{display:none}
      .dcn-auth-card{width:min(430px,94vw);background:#fff;border-radius:16px;padding:30px 30px 26px;box-shadow:0 22px 70px rgba(0,0,0,.35);text-align:center}
      .dcn-auth-brand{font-size:12px;letter-spacing:2px;font-weight:800;color:#E8A020;margin-bottom:8px}
      .dcn-auth-title{font-size:24px;font-weight:800;color:#1A2E44;margin-bottom:9px}
      .dcn-auth-sub{font-size:13px;line-height:1.55;color:#526477;margin:0 auto 22px;max-width:340px}
      .dcn-auth-google{min-height:44px;display:flex;justify-content:center;align-items:center;margin:0 auto 16px}
      .dcn-auth-status{font-size:12px;color:#526477;min-height:20px;line-height:1.45}
      .dcn-auth-status.err{color:#B42318;font-weight:650}
      .dcn-auth-status.ok{color:#15803D;font-weight:650}
      .dcn-auth-note{margin-top:16px;padding-top:14px;border-top:1px solid #E5EAF0;font-size:10.5px;color:#7A8794}
      #dcnUserBadge{display:inline-flex;align-items:center;gap:7px;border:1px solid #D9E1E8;background:#fff;border-radius:999px;padding:4px 9px 4px 6px;font-size:11px;color:#1A2E44;white-space:nowrap}
      #dcnUserBadge .avatar{width:22px;height:22px;border-radius:50%;background:#EAF1F7;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px}
      #dcnUserBadge button{border:0;background:transparent;color:#728196;font-size:11px;cursor:pointer;padding:0 2px}
    `;document.head.appendChild(st);
  }
  function setStatus(msg,type){
    ensureOverlay();
    const el=document.getElementById('dcnAuthStatus');if(!el)return;
    el.textContent=msg||'';el.className='dcn-auth-status'+(type?' '+type:'');
  }
  function showOverlay(){ensureOverlay().classList.remove('hidden');}
  function hideOverlay(){const ov=document.getElementById('dcnAuthOverlay');if(ov)ov.classList.add('hidden');}
  function renderButton(){
    const host=document.getElementById('dcnGoogleButton');
    if(!host||!window.google?.accounts?.id)return;
    host.innerHTML='';
    google.accounts.id.renderButton(host,{theme:'outline',size:'large',shape:'rectangular',text:'signin_with',locale:'fr',width:300});
  }
  function onCredential(resp){
    if(!resp||!resp.credential){setStatus('Connexion Google annulée ou incomplète.','err');return;}
    credential=resp.credential;
    claims=decodeJwtPayload(credential);
    if(!claims){credential='';setStatus('Jeton Google illisible. Réessayez.','err');return;}
    setStatus('Compte Google reconnu. Chargement des données…','ok');
    if(readyResolve){const r=readyResolve;readyResolve=null;readyReject=null;r(credential);}
    window.dispatchEvent(new CustomEvent('dcn-auth-ready',{detail:{claims}}));
  }
  function initializeGoogle(){
    if(initialized)return true;
    if(!window.google?.accounts?.id)return false;
    const clientId=String(cfg().GOOGLE_CLIENT_ID||'').trim();
    if(!clientId){setStatus('ID client Google non configuré.','err');if(readyReject)readyReject(new Error('ID client Google non configuré'));return false;}
    google.accounts.id.initialize({client_id:clientId,callback:onCredential,auto_select:false,cancel_on_tap_outside:false,itp_support:true,context:'signin'});
    initialized=true;renderButton();setStatus('Connectez-vous avec votre compte Google.');
    try{google.accounts.id.prompt();}catch(e){}
    return true;
  }
  function beginInit(){
    injectStyle();ensureOverlay();showOverlay();
    if(initializeGoogle())return;
    let tries=0;clearInterval(initTimer);
    initTimer=setInterval(()=>{
      tries++;
      if(initializeGoogle()||tries>120){clearInterval(initTimer);initTimer=null;if(tries>120)setStatus('Impossible de charger Google Identity Services. Vérifiez votre connexion.','err');}
    },100);
  }
  function ready(){
    if(validCachedToken())return Promise.resolve(credential);
    if(!readyPromise){readyPromise=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});}
    beginInit();
    return readyPromise;
  }
  function getCredential(){return validCachedToken()?credential:'';}
  function getClaims(){return claims;}
  function setServerUser(user){
    serverUser=user||null;hideOverlay();
    const tb=document.querySelector('#tb .tb-right');if(!tb)return;
    let badge=document.getElementById('dcnUserBadge');
    if(!badge){badge=document.createElement('span');badge.id='dcnUserBadge';tb.prepend(badge);}
    const label=(user&&user.name)||claims?.name||claims?.email||'Compte Google';
    const initial=(label||'?').trim().charAt(0).toUpperCase();
    badge.innerHTML='<span class="avatar">'+initial+'</span><span>'+escapeHtml(label)+'</span><button type="button" title="Changer de compte">Déconnexion</button>';
    badge.querySelector('button').onclick=signOut;
  }
  function escapeHtml(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function showError(msg){showOverlay();setStatus(msg||'Connexion impossible.','err');renderButton();}
  function signOut(){
    try{if(claims?.email&&window.google?.accounts?.id)google.accounts.id.revoke(claims.email,()=>{});}catch(e){}
    try{if(window.google?.accounts?.id)google.accounts.id.disableAutoSelect();}catch(e){}
    credential='';claims=null;serverUser=null;readyPromise=null;readyResolve=null;readyReject=null;
    try{window.DCN_STATE?.clearCache?.();}catch(e){}
    location.reload();
  }
  function requireFreshCredential(){
    if(validCachedToken())return Promise.resolve(credential);
    credential='';claims=null;readyPromise=null;readyResolve=null;readyReject=null;return ready();
  }
  window.DCN_AUTH={ready,getCredential,getClaims,setServerUser,showError,showOverlay,hideOverlay,signOut,requireFreshCredential,get serverUser(){return serverUser;}};
  document.addEventListener('DOMContentLoaded',beginInit,{once:true});
})();
