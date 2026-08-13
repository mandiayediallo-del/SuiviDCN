/* DCN V15 — conversion entre tables Google Sheets normalisées et modèle historique de l'UI. */
(function(){
  'use strict';
  const C={etabIdByName:{},devisIdByNumero:{},userIdByName:{}};
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const bool=v=>v===true||v===1||String(v).toLowerCase()==='true'||String(v).toLowerCase()==='vrai';
  const active=r=>r && !r.deletedAt;
  function parseJson(v){if(!v)return {};try{return typeof v==='object'?v:JSON.parse(v);}catch(e){return {};}}
  function mergeExtra(row,obj){return {...parseJson(row.extraJson),...obj};}
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function etabId(name){if(!name)return '';return C.etabIdByName[name]||('etab_'+hash(String(name).trim()));}
  function userId(name){return C.userIdByName[name]||'';}
  function extraJson(obj,known){const out={};Object.keys(obj||{}).forEach(k=>{if(!known.has(k) && !k.startsWith('_'))out[k]=obj[k];});return Object.keys(out).length?JSON.stringify(out):'';}
  function group(rows,keyFn){const out={};(rows||[]).filter(active).forEach(r=>{const k=keyFn(r);(out[k]||(out[k]=[])).push(r);});return out;}

  function tablesToLegacy(tables){
    tables=tables||{};
    const users=(tables.UTILISATEURS||[]).filter(active);
    C.userIdByName={};users.forEach(r=>{if(r.nom)C.userIdByName[r.nom]=r.id;});
    const etabs=(tables.ETABLISSEMENTS||[]).filter(active);
    C.etabIdByName={};etabs.forEach(r=>{if(r.nom)C.etabIdByName[r.nom]=r.id;});
    const devisRows=(tables.DEVIS||[]).filter(active);
    C.devisIdByNumero={};devisRows.forEach(r=>{if(r.numero)C.devisIdByNumero[r.numero]=r.id;});
    const missions=group(tables.MISSIONS||[],r=>String(r.objetType||'')+'|'+String(r.objetId||''));
    const affects=group(tables.AFFECTATIONS||[],r=>String(r.projetId||''));

    const cfg={annee:new Date().getFullYear(),seuilChargeHaute:90,seuilChargeBasse:30,devise:'EUR'};
    let lastChargeCpUpdate=''; let devisNotes={};
    (tables.PARAMETRES||[]).filter(active).forEach(r=>{
      const k=String(r.cle||'');
      if(k.startsWith('cfg.'))cfg[k.slice(4)]=(/annee|seuil/i.test(k)?num(r.valeur):r.valeur);
      else if(k==='lastChargeCpUpdate')lastChargeCpUpdate=r.valeur||'';
      else if(k==='legacy.devisNotes')devisNotes=parseJson(r.valeur);
    });

    const membres=users.map(r=>mergeExtra(r,{
      id:r.id,nom:r.nom||'',email:r.email||'',role:r.role||'',capaciteBase:num(r.capaciteBase)||100,
      statut:r.statut||'Actif',niveauAcces:r.niveauAcces||''
    }));

    const projets=(tables.PROJETS||[]).filter(active).map(r=>{
      const base={
        id:r.id,code:r.code||'',nom:r.nom||'',nature:r.nature||'',statut:r.statut||'',client:r.client||'',
        agenceDB:r.etablissementNomSource||'',responsable:r.responsableNomSource||'',devis:r.devisNumero||'',
        devisId:r.devisId||'',aoOrigineId:r.aoOrigineId||'',dateDebut:r.dateDebut||'',dateFin:r.dateFin||'',
        montantFacture:num(r.montantFacture),avancement:num(r.avancement),caAnneesPrecedentes:num(r.caAnneesPrecedentes),
        caAnneeEnCours:num(r.caAnneeEnCours),caAnneesSuivantes:num(r.caAnneesSuivantes),modeFacturation:r.modeFacturation||'',
        chargeActif:bool(r.chargeActif),inclurePrevision:bool(r.inclurePrevision),contactNom:r.contactNom||'',
        contactPrenom:r.contactPrenom||'',contactFonction:r.contactFonction||'',contactMail:r.contactMail||'',contactTel:r.contactTel||'',
        notes:r.notes||'',dateDevis:r.dateDevis||'',missionLibelleDevis:r.missionLibelleDevis||'',sourcePDF:r.sourcePDF||'',
        sourcePages:r.sourcePages||'',sourceDevisRecap:r.sourceDevisRecap||'',totalJoursDevis:num(r.totalJoursDevis),
        typeSuivi:r.typeSuivi||'',dateProchaineAction:r.dateProchaineAction||'',chargeEstimee:num(r.chargeEstimee),
        sourceMode:r.sourceMode||'',lastModifiedAt:r.lastModifiedAt||r.updatedAt||'',lastAction:r.lastAction||'',
        missions:(missions['PROJET|'+r.id]||[]).sort((a,b)=>num(a.ordre)-num(b.ordre)).map(m=>({mission:m.mission||'',montant:num(m.montant),jours:num(m.jours)})),
        acteurs:(affects[r.id]||[]).map(a=>({membreId:a.membreId||'',nom:a.nomSource||'',role:a.roleProjet||'',principal:bool(a.principal)}))
      };
      return mergeExtra(r,base);
    });

    const pipelineAO=(tables.AO||[]).filter(active).map(r=>mergeExtra(r,{
      id:r.id,nom:r.nom||'',nature:r.nature||'',phase:r.phase||'',client:r.client||'',agenceDB:r.etablissementNomSource||'',
      responsable:r.responsableNomSource||'',probabilite:num(r.probabilite),dateReponse:r.dateReponse||'',devis:r.devisNumero||'',
      devisId:r.devisId||'',dateDevis:r.dateDevis||'',actionAFaire:r.actionAFaire||'',typeSuivi:r.typeSuivi||'',
      dateProchaineAction:r.dateProchaineAction||'',chargeEstimee:num(r.chargeEstimee),caAnneesPrecedentes:num(r.caAnneesPrecedentes),
      caAnneeEnCours:num(r.caAnneeEnCours),caAnneesSuivantes:num(r.caAnneesSuivantes),contactNom:r.contactNom||'',
      contactPrenom:r.contactPrenom||'',contactFonction:r.contactFonction||'',contactMail:r.contactMail||'',contactTel:r.contactTel||'',
      notes:r.notes||'',dateDebut:r.dateDebut||'',dateFin:r.dateFin||'',montantFacture:num(r.montantFacture),avancement:num(r.avancement),
      missionLibelleDevis:r.missionLibelleDevis||'',sourcePDF:r.sourcePDF||'',sourcePages:r.sourcePages||'',
      sourceDevisRecap:r.sourceDevisRecap||'',totalJoursDevis:num(r.totalJoursDevis),sourceMode:r.sourceMode||'',
      previsionMensuelle2026:parseJson(r.previsionMensuelle2026_json),lastModifiedAt:r.lastModifiedAt||r.updatedAt||'',lastAction:r.lastAction||'',
      missions:(missions['AO|'+r.id]||[]).sort((a,b)=>num(a.ordre)-num(b.ordre)).map(m=>({mission:m.mission||'',montant:num(m.montant),jours:num(m.jours)}))
    }));

    const devis=[]; const devisDates={}; const devisEmetteurs={};
    devisRows.forEach(r=>{
      if(r.dateEmission)devisDates[r.numero]=r.dateEmission;
      if(r.emetteurNomSource)devisEmetteurs[r.numero]=r.emetteurNomSource;
      const complete=String(r.niveauDonnees||'').toLowerCase()==='complet'||r.objet||r.client||num(r.montant)>0;
      if(complete)devis.push(mergeExtra(r,{
        id:r.id,numero:r.numero||'',dateEmission:r.dateEmission||'',dateReponseAttendue:r.dateReponseAttendue||'',
        objet:r.objet||'',client:r.client||'',agenceDB:r.etablissementNomSource||'',responsable:r.responsableNomSource||'',
        montant:num(r.montant),notes:r.notes||'',projectId:r.projectId||null,aoId:r.aoId||null,statut:r.statut||'',
        lastModifiedAt:r.lastModifiedAt||r.updatedAt||'',lastAction:r.lastAction||'',
        missions:(missions['DEVIS|'+r.id]||[]).sort((a,b)=>num(a.ordre)-num(b.ordre)).map(m=>({mission:m.mission||'',montant:num(m.montant),jours:num(m.jours)}))
      }));
    });

    const previsionsFacturation=[];
    const prevGroups=group(tables.PREVISIONS||[],r=>String(r.projetId||''));
    Object.keys(prevGroups).forEach(pid=>{
      const e={projectId:pid,before:0,months:new Array(12).fill(0),after:0,source:'',lastModifiedAt:'',lastAction:''};
      prevGroups[pid].forEach(r=>{
        const p=String(r.periode||'');
        if(p.startsWith('AVANT-'))e.before=num(r.montant);
        else if(p.startsWith('APRES-'))e.after=num(r.montant);
        else if(/^\d{4}-\d{2}$/.test(p)){const mi=Number(p.slice(5,7))-1;if(mi>=0&&mi<12)e.months[mi]=num(r.montant);}
        if(r.source)e.source=r.source;if(r.lastModifiedAtSource)e.lastModifiedAt=r.lastModifiedAtSource;if(r.lastActionSource)e.lastAction=r.lastActionSource;
      });
      previsionsFacturation.push(e);
    });

    const charge={}; const year=Number(cfg.annee)||new Date().getFullYear();
    membres.forEach(m=>{charge[m.id]={};for(let i=1;i<=12;i++)charge[m.id][year+'-'+String(i).padStart(2,'0')]={projets:{},divers:0,formation:0,conges:0,absences:0};});
    (tables.CHARGES||[]).filter(active).forEach(r=>{
      const mid=r.membreId,period=r.periode;if(!mid||!period)return;
      if(!charge[mid])charge[mid]={};if(!charge[mid][period])charge[mid][period]={projets:{},divers:0,formation:0,conges:0,absences:0};
      const e=charge[mid][period],typ=String(r.typeCharge||'').toUpperCase();
      if(typ==='PROJET')e.projets[r.objetId]=num(r.valeurPct);
      else if(typ==='DIVERS')e.divers=num(r.valeurPct);
      else if(typ==='FORMATION')e.formation=num(r.valeurPct);
      else if(typ==='CONGES')e.conges=num(r.valeurPct);
      else if(typ==='ABSENCES')e.absences=num(r.valeurPct);
    });

    const factures=(tables.FACTURES||[]).filter(active).map(r=>mergeExtra(r,{
      id:r.id,projetId:r.projetId||'',numero:r.numero||'',dateEmission:r.dateEmission||'',montantHT:num(r.montantHT),
      dateEcheance:r.dateEcheance||'',dateEncaissement:r.dateEncaissement||'',commentaire:r.commentaire||''
    }));
    const commercial=etabs.filter(r=>r.sourceCommercialId).map(r=>mergeExtra(r,{
      id:r.sourceCommercialId,agenceDB:r.nom||'',region:r.region||'',statutRelation:r.statutRelation||'',priorite:r.priorite||'',
      derniereAction:r.derniereAction||'',dateDerniereAction:r.dateDerniereAction||'',actionFaire:r.prochaineAction||'',
      dateProchaineAction:r.dateProchaineAction||'',contactNom:r.contactNom||'',contactPrenom:r.contactPrenom||'',
      contactFonction:r.contactFonction||'',contactMail:r.contactMail||'',contactTel:r.contactTel||'',commentaire:r.commentaire||'',
      jamaisContacte:bool(r.jamaisContacte)
    }));
    const parametresMensuels={};(tables.CALENDRIER||[]).filter(active).forEach(r=>{parametresMensuels[r.periode]={joursOuvres:num(r.joursOuvres),capaciteReference:num(r.capaciteReference)};});

    return {cfg,membres,projets,pipelineAO,commercial,factures,charge,parametresMensuels,previsionsFacturation,devis,devisDates,devisEmetteurs,lastChargeCpUpdate,devisNotes};
  }

  const PROJECT_KNOWN=new Set(['id','code','nom','nature','statut','client','agenceDB','responsable','devis','devisId','aoOrigineId','dateDebut','dateFin','montantFacture','avancement','caAnneesPrecedentes','caAnneeEnCours','caAnneesSuivantes','modeFacturation','chargeActif','inclurePrevision','contactNom','contactPrenom','contactFonction','contactMail','contactTel','notes','dateDevis','missionLibelleDevis','sourcePDF','sourcePages','sourceDevisRecap','totalJoursDevis','typeSuivi','dateProchaineAction','chargeEstimee','sourceMode','lastModifiedAt','lastAction','missions','acteurs']);
  function projectRow(p,db){return {id:p.id,code:p.code||'',nom:p.nom||'',nature:p.nature||'',statut:p.statut||'',client:p.client||'',etablissementId:etabId(p.agenceDB),etablissementNomSource:p.agenceDB||'',responsableId:userId(p.responsable),responsableNomSource:p.responsable||'',devisId:p.devisId||((db.devis||[]).find(d=>d.numero===p.devis)||{}).id||'',devisNumero:p.devis||'',aoOrigineId:p.aoOrigineId||'',dateDebut:p.dateDebut||'',dateFin:p.dateFin||'',montantFacture:num(p.montantFacture),avancement:num(p.avancement),caAnneesPrecedentes:num(p.caAnneesPrecedentes),caAnneeEnCours:num(p.caAnneeEnCours),caAnneesSuivantes:num(p.caAnneesSuivantes),modeFacturation:p.modeFacturation||'',chargeActif:!!p.chargeActif,inclurePrevision:!!p.inclurePrevision,contactNom:p.contactNom||'',contactPrenom:p.contactPrenom||'',contactFonction:p.contactFonction||'',contactMail:p.contactMail||'',contactTel:p.contactTel||'',notes:p.notes||'',dateDevis:p.dateDevis||'',missionLibelleDevis:p.missionLibelleDevis||'',sourcePDF:p.sourcePDF||'',sourcePages:p.sourcePages||'',sourceDevisRecap:p.sourceDevisRecap||'',totalJoursDevis:num(p.totalJoursDevis),typeSuivi:p.typeSuivi||'',dateProchaineAction:p.dateProchaineAction||'',chargeEstimee:num(p.chargeEstimee),sourceMode:p.sourceMode||'',lastModifiedAt:p.lastModifiedAt||'',lastAction:p.lastAction||'',extraJson:extraJson(p,PROJECT_KNOWN)};}
  const AO_KNOWN=new Set(['id','nom','nature','phase','client','agenceDB','responsable','probabilite','dateReponse','devis','devisId','dateDevis','actionAFaire','typeSuivi','dateProchaineAction','chargeEstimee','caAnneesPrecedentes','caAnneeEnCours','caAnneesSuivantes','contactNom','contactPrenom','contactFonction','contactMail','contactTel','notes','dateDebut','dateFin','montantFacture','avancement','missionLibelleDevis','sourcePDF','sourcePages','sourceDevisRecap','totalJoursDevis','sourceMode','previsionMensuelle2026','lastModifiedAt','lastAction','missions']);
  function aoRow(a,db){return {id:a.id,nom:a.nom||'',nature:a.nature||'',phase:a.phase||'',client:a.client||'',etablissementId:etabId(a.agenceDB),etablissementNomSource:a.agenceDB||'',responsableId:userId(a.responsable),responsableNomSource:a.responsable||'',probabilite:num(a.probabilite),dateReponse:a.dateReponse||'',devisId:a.devisId||((db.devis||[]).find(d=>d.numero===a.devis)||{}).id||'',devisNumero:a.devis||'',dateDevis:a.dateDevis||'',actionAFaire:a.actionAFaire||'',typeSuivi:a.typeSuivi||'',dateProchaineAction:a.dateProchaineAction||'',chargeEstimee:num(a.chargeEstimee),caAnneesPrecedentes:num(a.caAnneesPrecedentes),caAnneeEnCours:num(a.caAnneeEnCours),caAnneesSuivantes:num(a.caAnneesSuivantes),contactNom:a.contactNom||'',contactPrenom:a.contactPrenom||'',contactFonction:a.contactFonction||'',contactMail:a.contactMail||'',contactTel:a.contactTel||'',notes:a.notes||'',dateDebut:a.dateDebut||'',dateFin:a.dateFin||'',montantFacture:num(a.montantFacture),avancement:num(a.avancement),missionLibelleDevis:a.missionLibelleDevis||'',sourcePDF:a.sourcePDF||'',sourcePages:a.sourcePages||'',sourceDevisRecap:a.sourceDevisRecap||'',totalJoursDevis:num(a.totalJoursDevis),sourceMode:a.sourceMode||'',previsionMensuelle2026_json:a.previsionMensuelle2026?JSON.stringify(a.previsionMensuelle2026):'',lastModifiedAt:a.lastModifiedAt||'',lastAction:a.lastAction||'',extraJson:extraJson(a,AO_KNOWN)};}
  const DEVIS_KNOWN=new Set(['id','numero','dateEmission','dateReponseAttendue','objet','client','agenceDB','responsable','montant','notes','projectId','aoId','statut','lastModifiedAt','lastAction','missions']);
  function allDevisRows(db){
    const byNum={};(db.devis||[]).forEach(d=>byNum[d.numero]=d);
    const nums=new Set([...(Object.keys(db.devisDates||{})),...(Object.keys(db.devisEmetteurs||{})),...(Object.keys(db.devisNotes||{})),...Object.keys(byNum)]);
    return [...nums].sort().map(numero=>{const d=byNum[numero]||{};const id=d.id||C.devisIdByNumero[numero]||('dv_hist_'+String(numero).replace(/[^a-z0-9]+/gi,'_').toLowerCase());return {id,numero,dateEmission:d.dateEmission||(db.devisDates||{})[numero]||'',dateReponseAttendue:d.dateReponseAttendue||'',emetteurId:userId((db.devisEmetteurs||{})[numero]||''),emetteurNomSource:(db.devisEmetteurs||{})[numero]||'',statut:d.statut||'',objet:d.objet||'',client:d.client||'',etablissementId:etabId(d.agenceDB),etablissementNomSource:d.agenceDB||'',responsableId:userId(d.responsable),responsableNomSource:d.responsable||'',montant:num(d.montant),notes:d.notes||(db.devisNotes||{})[numero]||'',projectId:d.projectId||'',aoId:d.aoId||'',lastModifiedAt:d.lastModifiedAt||'',lastAction:d.lastAction||'',niveauDonnees:d.id?'Complet':'Métadonnées uniquement',extraJson:d.id?extraJson(d,DEVIS_KNOWN):''};});
  }
  function missionsRows(type,obj){return (obj.missions||[]).map((m,i)=>({id:'mis_'+type.toLowerCase()+'_'+obj.id+'_'+(i+1),objetType:type,objetId:obj.id,ordre:i+1,mission:m.mission||'',montant:num(m.montant),jours:num(m.jours)}));}
  function affectRows(p){return (p.acteurs||[]).map((a,i)=>({id:'aff_'+p.id+'_'+(i+1),projetId:p.id,membreId:a.membreId||'',nomSource:a.nom||'',roleProjet:a.role||'',principal:!!a.principal}));}
  function forecastRows(e,year){const rows=[];rows.push({id:'prev_'+e.projectId+'_01',projetId:e.projectId,periode:'AVANT-'+year,montant:num(e.before),source:e.source||'',lastModifiedAtSource:e.lastModifiedAt||'',lastActionSource:e.lastAction||''});(e.months||[]).slice(0,12).forEach((v,i)=>rows.push({id:'prev_'+e.projectId+'_'+String(i+2).padStart(2,'0'),projetId:e.projectId,periode:year+'-'+String(i+1).padStart(2,'0'),montant:num(v),source:e.source||'',lastModifiedAtSource:e.lastModifiedAt||'',lastActionSource:e.lastAction||''}));rows.push({id:'prev_'+e.projectId+'_14',projetId:e.projectId,periode:'APRES-'+year,montant:num(e.after),source:e.source||'',lastModifiedAtSource:e.lastModifiedAt||'',lastActionSource:e.lastAction||''});return rows;}
  function chargeRows(mid,period,e){let n=0;const rows=[];Object.keys((e&&e.projets)||{}).sort().forEach(oid=>rows.push({id:'chg_'+hash(mid+'|'+period+'|PROJET|'+oid),membreId:mid,periode:period,typeCharge:'PROJET',objetType:'PROJET',objetId:oid,valeurPct:num(e.projets[oid]),commentaire:''}));[['DIVERS','divers'],['FORMATION','formation'],['CONGES','conges'],['ABSENCES','absences']].forEach(([t,k])=>rows.push({id:'chg_'+hash(mid+'|'+period+'|'+t),membreId:mid,periode:period,typeCharge:t,objetType:'',objetId:'',valeurPct:num((e||{})[k]),commentaire:''}));return rows;}
  function factureRow(f){const known=new Set(['id','projetId','numero','dateEmission','montantHT','dateEcheance','dateEncaissement','commentaire']);return {id:f.id,projetId:f.projetId||'',numero:f.numero||'',dateEmission:f.dateEmission||'',montantHT:num(f.montantHT),dateEcheance:f.dateEcheance||'',dateEncaissement:f.dateEncaissement||'',commentaire:f.commentaire||'',extraJson:extraJson(f,known)};}
  function userRow(m){const known=new Set(['id','nom','email','role','capaciteBase','statut','niveauAcces']);return {id:m.id,nom:m.nom||'',email:m.email||'',role:m.role||'',capaciteBase:num(m.capaciteBase)||100,statut:m.statut||'Actif',niveauAcces:m.niveauAcces||'',extraJson:extraJson(m,known)};}
  function commercialRow(c){const id=etabId(c.agenceDB);const known=new Set(['id','agenceDB','region','contactNom','contactPrenom','contactFonction','contactMail','contactTel','statutRelation','priorite','actionFaire','derniereAction','dateDerniereAction','dateProchaineAction','commentaire','jamaisContacte']);return {id,nom:c.agenceDB||'',region:c.region||'',statutRelation:c.statutRelation||'',priorite:c.priorite||'',derniereAction:c.derniereAction||'',dateDerniereAction:c.dateDerniereAction||'',prochaineAction:c.actionFaire||'',dateProchaineAction:c.dateProchaineAction||'',contactNom:c.contactNom||'',contactPrenom:c.contactPrenom||'',contactFonction:c.contactFonction||'',contactMail:c.contactMail||'',contactTel:c.contactTel||'',commentaire:c.commentaire||'',jamaisContacte:!!c.jamaisContacte,sourceCommercialId:c.id||'',extraJson:extraJson(c,known)};}

  function stable(v){return JSON.stringify(v,Object.keys(v||{}).sort());}
  function mapBy(arr,key='id'){const m={};(arr||[]).forEach(x=>{if(x&&x[key]!=null)m[x[key]]=x;});return m;}
  function changed(a,b){return JSON.stringify(a)!==JSON.stringify(b);}
  function diffCollections(oldArr,newArr,table,rowFn,db,key='id'){
    const ops=[],om=mapBy(oldArr,key),nm=mapBy(newArr,key);
    Object.keys(nm).forEach(id=>{if(!om[id]||changed(om[id],nm[id]))ops.push({op:'upsert',table,key:{[key]:id},row:rowFn(nm[id],db)});});
    Object.keys(om).forEach(id=>{if(!nm[id])ops.push({op:'softDelete',table,key:{[key]:id}});});
    return ops;
  }
  function diff(oldDb,newDb){
    const ops=[];oldDb=oldDb||{};newDb=newDb||{};
    if(changed(oldDb.cfg,newDb.cfg))Object.keys(newDb.cfg||{}).forEach(k=>ops.push({op:'upsert',table:'PARAMETRES',key:{cle:'cfg.'+k},row:{cle:'cfg.'+k,valeur:newDb.cfg[k],description:'Configuration application'}}));
    if((oldDb.lastChargeCpUpdate||'')!==(newDb.lastChargeCpUpdate||''))ops.push({op:'upsert',table:'PARAMETRES',key:{cle:'lastChargeCpUpdate'},row:{cle:'lastChargeCpUpdate',valeur:newDb.lastChargeCpUpdate||'',description:'Note technique'}});
    if(changed(oldDb.devisNotes,newDb.devisNotes))ops.push({op:'upsert',table:'PARAMETRES',key:{cle:'legacy.devisNotes'},row:{cle:'legacy.devisNotes',valeur:JSON.stringify(newDb.devisNotes||{}),description:'Notes devis historiques'}});

    ops.push(...diffCollections(oldDb.membres||[],newDb.membres||[],'UTILISATEURS',userRow,newDb));
    const opP=mapBy(oldDb.projets||[]),np=mapBy(newDb.projets||[]);
    Object.keys(np).forEach(id=>{if(!opP[id]||changed(opP[id],np[id])){ops.push({op:'upsert',table:'PROJETS',key:{id},row:projectRow(np[id],newDb)});ops.push({op:'replaceGroup',table:'MISSIONS',where:{objetType:'PROJET',objetId:id},rows:missionsRows('PROJET',np[id])});ops.push({op:'replaceGroup',table:'AFFECTATIONS',where:{projetId:id},rows:affectRows(np[id])});}});
    Object.keys(opP).forEach(id=>{if(!np[id]){ops.push({op:'softDelete',table:'PROJETS',key:{id}});ops.push({op:'replaceGroup',table:'MISSIONS',where:{objetType:'PROJET',objetId:id},rows:[]});ops.push({op:'replaceGroup',table:'AFFECTATIONS',where:{projetId:id},rows:[]});}});

    const oo=mapBy(oldDb.pipelineAO||[]),no=mapBy(newDb.pipelineAO||[]);
    Object.keys(no).forEach(id=>{if(!oo[id]||changed(oo[id],no[id])){ops.push({op:'upsert',table:'AO',key:{id},row:aoRow(no[id],newDb)});ops.push({op:'replaceGroup',table:'MISSIONS',where:{objetType:'AO',objetId:id},rows:missionsRows('AO',no[id])});}});
    Object.keys(oo).forEach(id=>{if(!no[id]){ops.push({op:'softDelete',table:'AO',key:{id}});ops.push({op:'replaceGroup',table:'MISSIONS',where:{objetType:'AO',objetId:id},rows:[]});}});

    const oldD=allDevisRows(oldDb),newD=allDevisRows(newDb),odm=mapBy(oldD,'numero'),ndm=mapBy(newD,'numero');
    Object.keys(ndm).forEach(numero=>{if(!odm[numero]||changed(odm[numero],ndm[numero])){ops.push({op:'upsert',table:'DEVIS',key:{numero},row:ndm[numero]});const d=(newDb.devis||[]).find(x=>x.numero===numero);if(d)ops.push({op:'replaceGroup',table:'MISSIONS',where:{objetType:'DEVIS',objetId:ndm[numero].id},rows:missionsRows('DEVIS',{...d,id:ndm[numero].id})});}});
    Object.keys(odm).forEach(numero=>{if(!ndm[numero])ops.push({op:'softDelete',table:'DEVIS',key:{numero}});});

    const oldF=mapBy(oldDb.previsionsFacturation||[],'projectId'),newF=mapBy(newDb.previsionsFacturation||[],'projectId'),year=Number(newDb.cfg?.annee)||new Date().getFullYear();
    Object.keys(newF).forEach(pid=>{if(!oldF[pid]||changed(oldF[pid],newF[pid]))ops.push({op:'replaceGroup',table:'PREVISIONS',where:{projetId:pid},rows:forecastRows(newF[pid],year)});});
    Object.keys(oldF).forEach(pid=>{if(!newF[pid])ops.push({op:'replaceGroup',table:'PREVISIONS',where:{projetId:pid},rows:[]});});

    const mids=new Set([...Object.keys(oldDb.charge||{}),...Object.keys(newDb.charge||{})]);
    mids.forEach(mid=>{const periods=new Set([...Object.keys((oldDb.charge||{})[mid]||{}),...Object.keys((newDb.charge||{})[mid]||{})]);periods.forEach(period=>{const a=((oldDb.charge||{})[mid]||{})[period],b=((newDb.charge||{})[mid]||{})[period];if(changed(a,b))ops.push({op:'replaceGroup',table:'CHARGES',where:{membreId:mid,periode:period},rows:b?chargeRows(mid,period,b):[]});});});

    ops.push(...diffCollections(oldDb.factures||[],newDb.factures||[],'FACTURES',factureRow,newDb));

    const oc=mapBy(oldDb.commercial||[]),nc=mapBy(newDb.commercial||[]);
    Object.keys(nc).forEach(id=>{if(!oc[id]||changed(oc[id],nc[id]))ops.push({op:'upsert',table:'ETABLISSEMENTS',key:{nom:nc[id].agenceDB},row:commercialRow(nc[id])});});
    Object.keys(oc).forEach(id=>{if(!nc[id]){const c=oc[id];ops.push({op:'upsert',table:'ETABLISSEMENTS',key:{nom:c.agenceDB},row:{nom:c.agenceDB,sourceCommercialId:'',region:'',statutRelation:'',priorite:'',derniereAction:'',dateDerniereAction:'',prochaineAction:'',dateProchaineAction:'',contactNom:'',contactPrenom:'',contactFonction:'',contactMail:'',contactTel:'',commentaire:'',jamaisContacte:false}});}});

    const months=new Set([...Object.keys(oldDb.parametresMensuels||{}),...Object.keys(newDb.parametresMensuels||{})]);
    months.forEach(period=>{const a=(oldDb.parametresMensuels||{})[period],b=(newDb.parametresMensuels||{})[period];if(changed(a,b)&&b)ops.push({op:'upsert',table:'CALENDRIER',key:{periode:period},row:{periode,joursOuvres:num(b.joursOuvres),capaciteReference:num(b.capaciteReference)}});});
    return ops;
  }
  window.DCN_MAPPER={context:C,tablesToLegacy,diff};
})();
