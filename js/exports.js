/* DCN V14 — module extrait du noyau V13B. */
// ── EXPORT ──
function exportJSON(){const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='dcn_backup_'+new Date().toISOString().split('T')[0]+'.json';a.click();showLastAction('✓ Export JSON téléchargé');}
function importJSON(input){const file=input.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(e){try{const data=JSON.parse(e.target.result);if(!data.projets||!data.cfg){toast('Fichier JSON invalide','err');return;}Object.assign(DB,data);saveDB();updateServiceBadge();renderAll();document.getElementById('jsonImportInput').value='';const nb=data.projets.length;showLastAction('✓ Import réussi — '+nb+' projets chargés');toast('Données importées avec succès','ok');}catch(err){toast('Erreur lecture JSON','err');}};reader.readAsText(file);}

function saveHtmlFile(){
  if(window.DCN_SAVE_DATA) return window.DCN_SAVE_DATA();
  if(typeof toast==='function') toast('Module de sauvegarde non disponible','err');
}

function exportExcel(){
  try{
    const YEAR=DB.cfg?.annee||2026;
    const MF=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const MS=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
    const cn=v=>Number(v)||0;
    const s=arr=>(arr||[]).reduce((a,v)=>a+cn(v),0);
    const r2=n=>Math.round((Number(n)||0)*100)/100;
    const euro=n=>r2(cn(n));
    const pct=v=>Math.round(cn(v)*100)/100;
    const mk2=i=>`${YEAR}-${String(i+1).padStart(2,'0')}`;
    const NOW_M=ACTIVE_MONTH;

    function xe(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function fd(d){if(!d)return '';try{return new Date(d).toLocaleDateString('fr-FR');}catch(e){return String(d||'');}}
    function cell(v,st='cell',tp){
      if(v===null||v===undefined||v==='')return `<Cell ss:StyleID="${st}"><Data ss:Type="String"></Data></Cell>`;
      const t=tp||(typeof v==='number'?'Number':'String');
      return `<Cell ss:StyleID="${st}"><Data ss:Type="${t}">${t==='Number'?String(v):xe(v)}</Data></Cell>`;
    }
    function fcell(formula,st='cell'){
      return `<Cell ss:StyleID="${st}" ss:Formula="${xe(formula)}"><Data ss:Type="Number">0</Data></Cell>`;
    }
    function row(vals,sts=[]){
      return `<Row>${vals.map((v,i)=>Array.isArray(v)?cell(v[0],v[1],v[2]):cell(v,sts[i]||'cell')).join('')}</Row>`;
    }
    function hrow(h){return `<Row ss:AutoFitHeight="0" ss:Height="22">${h}</Row>`;}
    function ws(name,rows,widths=[]){
      const cols=widths.map(w=>`<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`).join('');
      return `<Worksheet ss:Name="${xe(name).slice(0,31)}"><Table>${cols}${rows.join('')}</Table>`+
        `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">`+
        `<FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal>`+
        `<TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
    }

    // ── Styles ──
    const styles=`<Styles>
<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
<Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#1A2E44" ss:Pattern="Solid"/></Style>
<Style ss:ID="sub"><Font ss:Italic="1" ss:Size="10" ss:Color="#5A6A7A" ss:FontName="Calibri"/><Interior ss:Color="#EEF2F7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2D5986"/></Borders></Style>
<Style ss:ID="sec"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Vertical="Center"/><Interior ss:Color="#2D5986" ss:Pattern="Solid"/></Style>
<Style ss:ID="sec2"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Vertical="Center"/><Interior ss:Color="#1A5C35" ss:Pattern="Solid"/></Style>
<Style ss:ID="sec3"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Vertical="Center"/><Interior ss:Color="#5C1A3A" ss:Pattern="Solid"/></Style>
<Style ss:ID="hdr"><Font ss:Bold="1" ss:Size="9" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#34495E" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1A2E44"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A5568"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A5568"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A5568"/></Borders></Style>
<Style ss:ID="hdrL"><Font ss:Bold="1" ss:Size="9" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#34495E" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1A2E44"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A5568"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A5568"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A5568"/></Borders></Style>
<Style ss:ID="hdrNow"><Font ss:Bold="1" ss:Size="9" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#E8A020" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C4851A"/></Borders></Style>
<Style ss:ID="kpiL"><Font ss:Bold="1" ss:Size="8" ss:Color="#7F8C8D" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#F8FAFB" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8EEF4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#DDE3EA"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#DDE3EA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8EEF4"/></Borders></Style>
<Style ss:ID="kpiB"><Font ss:Bold="1" ss:Size="18" ss:Color="#1A4E8A" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#EBF2FA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2D5986"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2D5986"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2D5986"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2D5986"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="kpiG"><Font ss:Bold="1" ss:Size="18" ss:Color="#1A7A42" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#E8F8EF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#27AE60"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#27AE60"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#27AE60"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#27AE60"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="kpiO"><Font ss:Bold="1" ss:Size="18" ss:Color="#995B0A" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FEF4E5" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="kpiR"><Font ss:Bold="1" ss:Size="18" ss:Color="#9A1B1B" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FDEAEA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/></Borders><NumberFormat ss:Format="0"/></Style>
<Style ss:ID="kpiRpct"><Font ss:Bold="1" ss:Size="18" ss:Color="#9A1B1B" ss:FontName="Calibri"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FDEAEA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E74C3C"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="cell"><Font ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/></Borders></Style>
<Style ss:ID="cellB"><Font ss:Bold="1" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/></Borders></Style>
<Style ss:ID="money"><Font ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/></Borders><NumberFormat ss:Format="#,##0;[Red]-#,##0"/></Style>
<Style ss:ID="moneyZ"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#C8C8C8"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/></Borders></Style>
<Style ss:ID="moneyNow"><Font ss:Bold="1" ss:FontName="Calibri" ss:Size="11" ss:Color="#7A4500"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Interior ss:Color="#FFF8EE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/></Borders><NumberFormat ss:Format="#,##0;[Red]-#,##0"/></Style>
<Style ss:ID="moneyAcc"><Font ss:Bold="1" ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Interior ss:Color="#E8A020" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="total"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="11"/><Interior ss:Color="#1A2E44" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0A1E30"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0A1E30"/></Borders></Style>
<Style ss:ID="totalR"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#1A2E44" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0A1E30"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0A1E30"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="totalRpct"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#1A2E44" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0A1E30"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0A1E30"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="totalAcc"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="12"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#E8A020" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="cum"><Font ss:Bold="1" ss:Color="#2D5986" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#EEF5FF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C5D8F0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C5D8F0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C5D8F0"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C5D8F0"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="cumNow"><Font ss:Bold="1" ss:Color="#7A4500" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#FFF8EE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="alertD"><Font ss:Bold="1" ss:Color="#9A1B1B" ss:FontName="Calibri" ss:Size="11"/><Interior ss:Color="#FDEAEA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0AAAA"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#E74C3C"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0AAAA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0AAAA"/></Borders></Style>
<Style ss:ID="alertW"><Font ss:Color="#854F0A" ss:FontName="Calibri" ss:Size="11"/><Interior ss:Color="#FFFBE6" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#E8A020"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/></Borders></Style>
<Style ss:ID="chHigh"><Font ss:Bold="1" ss:Color="#9A1B1B" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#FDEAEA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0AAAA"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0AAAA"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0AAAA"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0AAAA"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="chOk"><Font ss:Bold="1" ss:Color="#1A7A42" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#E8F8EF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A8DFC0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A8DFC0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A8DFC0"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A8DFC0"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="chLow"><Font ss:Bold="1" ss:Color="#995B0A" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#FEF4E5" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="chZero"><Font ss:Color="#C8C8C8" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#FAFAFA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/></Borders></Style>
<Style ss:ID="chNow"><Font ss:Bold="1" ss:Color="#7A4500" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#FFF8EE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E8A020"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5D08A"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="avgAcc"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#E8A020" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C4851A"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="pct"><Font ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EAECEE"/></Borders><NumberFormat ss:Format="0%"/></Style>
<Style ss:ID="gap"><Font ss:FontName="Calibri" ss:Size="4"/><Interior ss:Color="#F4F6F8" ss:Pattern="Solid"/></Style>
</Styles>`;

    // Fonctions utilitaires colonnes Excel
    function colLetter(n){let s='';n++;while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26);}return s;}

    // ══════════════════════════════════════════════
    // FEUILLE 1 — DASHBOARD
    // ══════════════════════════════════════════════
    const mk=typeof activeMonthKey==='function'?activeMonthKey():`${YEAR}-04`;
    const k=typeof calcDashboardKPIs==='function'?calcDashboardKPIs(mk):{financier:{},charge:{},production:{},commercial:{},alertes:[]};
    const caMonthly=typeof calcCAMonthly2026==='function'?calcCAMonthly2026():new Array(12).fill(0);
    const caJan=typeof calcCAJanToCurrentMonth==='function'?calcCAJanToCurrentMonth():0;
    const caTotal=k.financier.caAnneeEnCours||0;
    const caFacture=k.financier.caFacture||0;
    const caReste=Math.max(0,caTotal-caJan);
    const pipeline=k.financier.pipelineUtile2026||0;
    const nbActifs=k.production.nbProjetsActifs||0;
    const chargeMoy=Math.round(k.charge.chargeMoyenne||0);
    const alertes=(k.alertes||[]).slice(0,6);
    const cumCA=[];let acc=0;caMonthly.forEach(v=>{acc=r2(acc+v);cumCA.push(acc);});

    let r1=[];
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="30"><Cell ss:StyleID="title" ss:MergeAcross="5"><Data ss:Type="String">CONSTRUCTION NUMÉRIQUE — BILAN MENSUEL ${YEAR}</Data></Cell></Row>`);
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="18"><Cell ss:StyleID="sub" ss:MergeAcross="5"><Data ss:Type="String">Généré le ${new Date().toLocaleDateString('fr-FR')}  ·  Référence : ${MF[NOW_M]} ${YEAR}  ·  Demathieu Bard</Data></Cell></Row>`);
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="6"><Cell ss:StyleID="gap" ss:MergeAcross="5"><Data ss:Type="String"></Data></Cell></Row>`);
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="18"><Cell ss:StyleID="sec" ss:MergeAcross="5"><Data ss:Type="String">INDICATEURS FINANCIERS</Data></Cell></Row>`);
    r1.push(row([['CA PRÉVU 2026','kpiL'],['FACTURÉ À CE JOUR','kpiL'],['RESTE À PRODUIRE','kpiL'],['PIPELINE ≥ 50%','kpiL'],['PROJETS ACTIFS','kpiL'],['CHARGE MOY.','kpiL']]));
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="40">${cell(euro(caTotal),'kpiG','Number')}${cell(euro(caFacture),'kpiB','Number')}${cell(euro(caReste),'kpiO','Number')}${cell(euro(pipeline),'kpiB','Number')}${cell(nbActifs,'kpiB','Number')}${cell(chargeMoy+'%',(chargeMoy>=90?'kpiRpct':chargeMoy>=70?'kpiO':'kpiB'))}</Row>`);
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="6"><Cell ss:StyleID="gap" ss:MergeAcross="5"><Data ss:Type="String"></Data></Cell></Row>`);
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="18"><Cell ss:StyleID="sec2" ss:MergeAcross="5"><Data ss:Type="String">CA PAR MOIS ${YEAR}</Data></Cell></Row>`);
    r1.push(`<Row>${cell('Indicateur','hdrL')}${MS.slice(0,6).map((m,i)=>cell(i===NOW_M?m+' ▶':m,i===NOW_M?'hdrNow':'hdr')).join('')}</Row>`);
    r1.push(`<Row>${cell('Mensuel','cellB')}${caMonthly.slice(0,6).map((v,i)=>cell(euro(v),i===NOW_M?'moneyNow':'money','Number')).join('')}</Row>`);
    r1.push(`<Row>${cell('Cumul 2026','cellB')}${cumCA.slice(0,6).map((v,i)=>cell(euro(v),i===NOW_M?'cumNow':'cum','Number')).join('')}</Row>`);
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="6"><Cell ss:StyleID="gap" ss:MergeAcross="5"><Data ss:Type="String"></Data></Cell></Row>`);
    r1.push(`<Row ss:AutoFitHeight="0" ss:Height="18"><Cell ss:StyleID="sec3" ss:MergeAcross="5"><Data ss:Type="String">ALERTES PRIORITAIRES</Data></Cell></Row>`);
    if(!alertes.length){
      r1.push(`<Row><Cell ss:StyleID="alertW" ss:MergeAcross="5"><Data ss:Type="String">Aucune alerte active</Data></Cell></Row>`);
    } else {
      alertes.forEach(a=>{
        r1.push(`<Row ss:AutoFitHeight="0" ss:Height="18"><Cell ss:StyleID="${a.niveau==='danger'?'alertD':'alertW'}" ss:MergeAcross="5"><Data ss:Type="String">${xe((a.niveau==='danger'?'⚠ ':' ')+a.msg)}</Data></Cell></Row>`);
      });
    }
    const sheet1=ws('1. Dashboard',r1,[180,100,100,100,100,100]);

    // ══════════════════════════════════════════════
    // FEUILLE 2 — PRÉVISIONS FACTURATION
    // Miroir exact de la page Prévisions : mêmes projets (même filtre),
    // mêmes montants mensuels (getForecastEntry), mêmes colonnes.
    // ══════════════════════════════════════════════
    const forecastProjects=(DB.projets||[]).filter(p=>
      (['En cours','A venir'].includes(p.statut)||
       (typeof isRegieProject==='function'&&isRegieProject(p))||
       p.inclurePrevision===true)&&
      (typeof getForecastEntry==='function'&&getForecastEntry(p.id))
    );
    const feOf=p=>{
      const fe=(typeof getForecastEntry==='function')?getForecastEntry(p.id):null;
      return {
        before:Number(fe?.before)||0,
        months:(fe&&Array.isArray(fe.months)?fe.months:new Array(12).fill(0)).map(v=>Number(v)||0),
        after:Number(fe?.after)||0
      };
    };
    let r2rows=[];
    r2rows.push(`<Row ss:AutoFitHeight="0" ss:Height="30"><Cell ss:StyleID="title" ss:MergeAcross="19"><Data ss:Type="String">PRÉVISIONS DE FACTURATION — ${YEAR}</Data></Cell></Row>`);
    r2rows.push(`<Row ss:AutoFitHeight="0" ss:Height="18"><Cell ss:StyleID="sub" ss:MergeAcross="19"><Data ss:Type="String">Mise à jour : ${new Date().toLocaleDateString('fr-FR')}  ·  Données identiques à la page Prévisions  ·  Colonne ▶ = ${MF[NOW_M]} ${YEAR}</Data></Cell></Row>`);
    r2rows.push(`<Row ss:AutoFitHeight="0" ss:Height="6"><Cell ss:StyleID="gap" ss:MergeAcross="19"><Data ss:Type="String"></Data></Cell></Row>`);
    // Header : mêmes colonnes que la page Prévisions
    r2rows.push(`<Row ss:AutoFitHeight="0" ss:Height="22">${cell('Projet','hdrL')}${cell('N° Devis','hdr')}${cell('Statut','hdr')}${cell('Resp.','hdr')}${cell('Avant '+YEAR,'hdr')}${MF.map((m,i)=>cell(i===NOW_M?MS[i]+' ▶':MS[i],i===NOW_M?'hdrNow':'hdr')).join('')}${cell('TOTAL '+YEAR,'hdrNow')}${cell('Après '+YEAR,'hdr')}${cell('Écart','hdr')}</Row>`);

    const totalsF={before:0,after:0,months:new Array(12).fill(0)};
    forecastProjects.forEach(p=>{
      const fe=feOf(p);
      const rowSum=r2(s(fe.months));
      const gapV=(typeof calcForecastGap==='function')?calcForecastGap(p,fe):0;
      totalsF.before=r2(totalsF.before+fe.before);
      totalsF.after=r2(totalsF.after+fe.after);
      fe.months.forEach((v,i)=>totalsF.months[i]=r2(totalsF.months[i]+v));
      const mCols=fe.months.map((v,i)=>v!==0?cell(euro(v),i===NOW_M?'moneyNow':'money','Number'):cell('','moneyZ')).join('');
      const projectExcelLabel=[p.code,p.nom].filter(Boolean).join('-');const projectExcelDisplay=projectExcelLabel.length>60?projectExcelLabel.slice(0,58)+'…':projectExcelLabel;r2rows.push(`<Row>${cell(projectExcelDisplay,'cellB')}${cell(p.devis||'','cell')}${cell(p.statut||'','cell')}${cell(p.responsable||'','cell')}${fe.before?cell(euro(fe.before),'money','Number'):cell('','moneyZ')}${mCols}${cell(euro(rowSum),'moneyAcc','Number')}${fe.after?cell(euro(fe.after),'money','Number'):cell('','moneyZ')}${cell(euro(gapV),Math.abs(gapV)>1?'alertD':'money','Number')}</Row>`);
    });

    // Ligne TOTAL — identique au total de la page
    const monthTotals=totalsF.months.map(v=>r2(v));
    const grandTotal=r2(s(monthTotals));
    r2rows.push(`<Row ss:AutoFitHeight="0" ss:Height="22">${cell('TOTAL','total')}${cell('','total')}${cell('','total')}${cell('','total')}${cell(euro(totalsF.before),'totalR','Number')}${monthTotals.map((v,i)=>cell(euro(v),i===NOW_M?'totalAcc':'totalR','Number')).join('')}${cell(euro(grandTotal),'totalAcc','Number')}${cell(euro(totalsF.after),'totalR','Number')}${cell('','total')}</Row>`);

    // Ligne CUMUL
    const cumVals=[];let cumAcc=0;monthTotals.forEach(v=>{cumAcc=r2(cumAcc+v);cumVals.push(cumAcc);});
    r2rows.push(`<Row ss:AutoFitHeight="0" ss:Height="20">${cell('CUMULÉ '+YEAR,'cellB')}${cell('','cell')}${cell('','cell')}${cell('','cell')}${cell('','cell')}${cumVals.map((v,i)=>cell(euro(v),i===NOW_M?'cumNow':'cum','Number')).join('')}${cell('','cell')}${cell('','cell')}${cell('','cell')}</Row>`);

    const sheet2=ws('2. Prévisions facturation',r2rows,[285,90,80,80,75,65,65,65,65,65,65,65,65,65,65,65,65,85,75,70]);

    // ══════════════════════════════════════════════
    // FEUILLE 3 — PLAN DE CHARGE
    // ══════════════════════════════════════════════
    const MPAL=['#1A3A5C','#1A5C35','#4A1A6C','#7A3A0A','#2A5C4A','#5C1A1A','#1A4A5C','#3A3A1A'];
    const members=typeof activeMembers==='function'?activeMembers():DB.membres||[];
    let r3=[];
    r3.push(`<Row ss:AutoFitHeight="0" ss:Height="30"><Cell ss:StyleID="title" ss:MergeAcross="13"><Data ss:Type="String">PLAN DE CHARGE ÉQUIPE — ${YEAR}</Data></Cell></Row>`);
    r3.push(`<Row ss:AutoFitHeight="0" ss:Height="18"><Cell ss:StyleID="sub" ss:MergeAcross="13"><Data ss:Type="String">Charge totale par collaborateur (%)  ·  Rouge ≥ ${DB.cfg?.seuilChargeHaute||90}%  ·  Orange &lt; ${DB.cfg?.seuilChargeBasse||30}%  ·  Vert = optimal</Data></Cell></Row>`);
    r3.push(`<Row ss:AutoFitHeight="0" ss:Height="6"><Cell ss:StyleID="gap" ss:MergeAcross="13"><Data ss:Type="String"></Data></Cell></Row>`);
    r3.push(`<Row ss:AutoFitHeight="0" ss:Height="22">${cell('Collaborateur','hdrL')}${MS.map((m,i)=>cell(i===NOW_M?m+' ▶':m,i===NOW_M?'hdrNow':'hdr')).join('')}${cell('Moyenne','hdrNow')}</Row>`);

    const DATA_CH_START=5;
    members.forEach((m,mi)=>{
      const palColor=MPAL[mi%MPAL.length];
      const memberStyle=`<Style ss:ID="mb${mi}"><Font ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF" ss:FontName="Calibri"/><Alignment ss:Vertical="Center"/><Interior ss:Color="${palColor}" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fff"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fff"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fff"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#fff"/></Borders></Style>`;
      // Note: styles dynamiques dans les data cells pas possible en SpreadsheetML — on utilise les styles prédéfinis
      const monthCells=MS.map((_,i)=>{
        const v=typeof calcChargeTotale==='function'?Math.round(calcChargeTotale(m.id,mk2(i))):0;
        const seuilH=DB.cfg?.seuilChargeHaute||90;
        const seuilB=DB.cfg?.seuilChargeBasse||30;
        let st=v===0?'chZero':v>=seuilH?'chHigh':v<seuilB?'chLow':'chOk';
        if(i===NOW_M) st=v>=seuilH?'chNow':v<seuilB?'chNow':'chNow';
        return cell(v>0?(v+'%'):'—',(v===0&&i!==NOW_M)?'chZero':st);
      }).join('');
      const excelChRow=DATA_CH_START+mi;
      const avgVal=Math.round(MS.reduce((acc,_,mi2)=>{
        const v2=typeof calcChargeTotale==='function'?Math.round(calcChargeTotale(m.id,mk2(mi2))):0;
        return acc+v2;
      },0)/12);
      r3.push(`<Row ss:AutoFitHeight="0" ss:Height="22">${cell(m.nom||'','cellB')}${monthCells}${cell(avgVal+'%','avgAcc')}</Row>`);
    });

    // Ligne MOYENNE ÉQUIPE
    const chTotRow=DATA_CH_START+members.length;
    r3.push(`<Row ss:AutoFitHeight="0" ss:Height="6"><Cell ss:StyleID="gap" ss:MergeAcross="13"><Data ss:Type="String"></Data></Cell></Row>`);
    const teamMonthAvg=MS.map((_,mi2)=>{
      const vals=members.map(m2=>typeof calcChargeTotale==='function'?Math.round(calcChargeTotale(m2.id,mk2(mi2))):0);
      return members.length?Math.round(vals.reduce((a,v)=>a+v,0)/members.length):0;
    });
    const teamAvg=members.length?Math.round(teamMonthAvg.reduce((a,v)=>a+v,0)/12):0;
    r3.push(`<Row ss:AutoFitHeight="0" ss:Height="22">${cell('Moyenne équipe','total')}${teamMonthAvg.map((v,i)=>cell(v+'%','totalRpct')).join('')}${cell(teamAvg+'%','totalAcc')}</Row>`);

    const sheet3=ws('3. Plan de charge',r3,[130,52,52,52,52,52,52,52,52,52,52,52,52,65]);

    // ══ Assemblage final ══
    const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>`+
      `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" `+
      `xmlns:o="urn:schemas-microsoft-com:office:office" `+
      `xmlns:x="urn:schemas-microsoft-com:office:excel" `+
      `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" `+
      `xmlns:html="http://www.w3.org/TR/REC-html40">${styles}${sheet1}${sheet2}${sheet3}</Workbook>`;

    const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8;'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`Construction_Numerique_${MF[NOW_M]}_${YEAR}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
    toast(`Export Excel généré — ${MF[NOW_M]} ${YEAR}`,'ok');
  }catch(err){
    console.error(err);
    toast('Erreur export Excel : '+err.message,'err');
  }
}
