if(!window.Chart){
  class MiniChart {
    constructor(ctx, cfg){
      this.ctx = ctx;
      this.canvas = ctx.canvas;
      this.cfg = cfg || {};
      this._resizeHandler = () => this.render();
      window.addEventListener('resize', this._resizeHandler);
      this.render();
    }
    destroy(){
      window.removeEventListener('resize', this._resizeHandler);
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
      ctx.restore();
    }
    render(){
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.round(rect.width || this.canvas.clientWidth || 640));
      const h = Math.max(180, Math.round(rect.height || this.canvas.clientHeight || 220));
      if(this.canvas.width !== Math.round(w*dpr) || this.canvas.height !== Math.round(h*dpr)){
        this.canvas.width = Math.round(w*dpr);
        this.canvas.height = Math.round(h*dpr);
      }
      const ctx = this.ctx;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,w,h);
      const type = this.cfg.type || 'bar';
      if(type === 'doughnut') this.drawDoughnut(w,h);
      else if(type === 'line') this.drawLine(w,h);
      else this.drawBar(w,h);
    }
    getDatasets(){
      return (((this.cfg||{}).data||{}).datasets)||[];
    }
    getLabels(){
      return (((this.cfg||{}).data||{}).labels)||[];
    }
    drawBar(w,h){
      const ctx = this.ctx, labels = this.getLabels();
      const ds = this.getDatasets()[0] || {data:[]};
      const data = (ds.data || []).map(v => Number(v)||0);
      const horizontal = (((this.cfg.options||{}).indexAxis) === 'y');
      const maxOpt = ((((this.cfg.options||{}).scales||{}).x||{}).max);
      const maxVal = Math.max(1, maxOpt || 0, ...data);
      const pad = horizontal ? {t:18,r:44,b:26,l:Math.min(330, Math.max(150, w*0.34))} : {t:16,r:18,b:34,l:44};
      const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
      ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1;
      ctx.fillStyle = '#64748B'; ctx.font = '11px Segoe UI, sans-serif';
      if(horizontal){
        const rowH = ch / Math.max(1, labels.length);
        for(let i=0;i<labels.length;i++){
          const y = pad.t + i*rowH + rowH/2;
          ctx.beginPath(); ctx.moveTo(pad.l, y + rowH*0.28); ctx.lineTo(w-pad.r, y + rowH*0.28); ctx.stroke();
          ctx.fillStyle = '#334155';
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(String(labels[i]).slice(0,52), pad.l - 8, y);
          const bw = (data[i]/maxVal) * cw;
          const bh = Math.min(22, rowH*0.55);
          const by = y - bh/2;
          const fill = Array.isArray(ds.backgroundColor) ? (ds.backgroundColor[i] || '#4A7BAF') : (ds.backgroundColor || '#4A7BAF');
          this.roundRect(pad.l, by, bw, bh, 6, fill);
          ctx.fillStyle = '#0F172A';
          ctx.textAlign = 'left';
          ctx.fillText((String(ds.label||'').toLowerCase().includes('ca')? Math.round(data[i]).toLocaleString('fr-FR')+' €' : String(data[i])), Math.min(w-pad.r-20, pad.l + bw + 6), y);
        }
      } else {
        const n = Math.max(1, labels.length);
        const step = cw / n;
        const baseY = pad.t + ch;
        ctx.beginPath(); ctx.moveTo(pad.l, baseY); ctx.lineTo(w-pad.r, baseY); ctx.stroke();
        for(let g=1; g<=4; g++){
          const gy = pad.t + ch - (ch*g/4);
          ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w-pad.r, gy); ctx.stroke();
        }
        for(let i=0;i<n;i++){
          const val = data[i] || 0;
          const barW = Math.min(36, step*0.58);
          const x = pad.l + i*step + (step-barW)/2;
          const bh = (val/maxVal) * (ch-4);
          const y = baseY - bh;
          const fill = Array.isArray(ds.backgroundColor) ? (ds.backgroundColor[i] || '#2D5986') : (ds.backgroundColor || '#2D5986');
          this.roundRect(x, y, barW, bh, 6, fill);
          ctx.fillStyle = '#475569';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(String(labels[i]).slice(0,8), x + barW/2, baseY + 8);
        }
      }
    }
    drawLine(w,h){
      const ctx = this.ctx, labels = this.getLabels(), datasets = this.getDatasets();
      const all = datasets.flatMap(ds => (ds.data||[]).map(v=>Number(v)||0));
      const maxVal = Math.max(1, ...all) * 1.12;
      const pad = {t:30,r:18,b:56,l:54};
      const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
      const baseY = pad.t + ch;
      ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1;
      ctx.fillStyle = '#64748B'; ctx.font = '11px Segoe UI, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for(let g=0; g<=4; g++){
        const val = maxVal*g/4;
        const gy = baseY - ch*g/4;
        ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w-pad.r, gy); ctx.stroke();
        ctx.fillText(Math.round(val/1000)+' k€', pad.l-8, gy);
      }
      const n = Math.max(1, labels.length);
      const xAt = (i)=> pad.l + (n===1 ? cw/2 : (cw*i/(n-1)));
      datasets.forEach((ds,di)=>{
        const data = (ds.data||[]).map(v=>Number(v)||0);
        const color = ds.borderColor || ds.backgroundColor || ['#94A3B8','#2D5986','#F39C12'][di%3];
        ctx.beginPath();
        data.forEach((v,i)=>{
          const x = xAt(i), y = baseY - (v/maxVal)*ch;
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke();
        data.forEach((v,i)=>{
          const x = xAt(i), y = baseY - (v/maxVal)*ch;
          ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle = color; ctx.fill();
        });
      });
      let lx = w - 190, ly = 10;
      datasets.forEach((ds,i)=>{
        const color = ds.borderColor || ds.backgroundColor || ['#94A3B8','#2D5986','#F39C12'][i%3];
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx + i*62, ly+6, 5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#334155'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(ds.label||'', lx + 10 + i*62, ly);
      });
      ctx.fillStyle = '#334155'; ctx.font = '10px Segoe UI, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
      labels.forEach((lab,i)=>{
        const x = xAt(i);
        const text = String(lab).slice(0,24);
        ctx.fillText(text, x, baseY + 10);
      });
    }
    drawDoughnut(w,h){
      const ctx = this.ctx, labels = this.getLabels();
      const ds = this.getDatasets()[0] || {data:[]};
      const data = (ds.data || []).map(v => Math.max(0, Number(v)||0));
      const total = data.reduce((a,b)=>a+b,0) || 1;
      const colors = ds.backgroundColor || ['#3B82F6','#10B981','#F59E0B','#EF4444','#94A3B8'];
      const cx = Math.min(w*0.36, 140), cy = h*0.48;
      const radius = Math.min(78, h*0.28, w*0.18);
      const inner = radius*0.58;
      let start = -Math.PI/2;
      data.forEach((v,i)=>{
        const angle = (v/total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        start += angle;
      });
      ctx.beginPath();
      ctx.fillStyle = '#FFFFFF';
      ctx.arc(cx, cy, inner, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 24px Segoe UI, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sum = data.reduce((a,b)=>a+b,0);
      ctx.fillText(String(sum), cx, cy - 6);
      ctx.font = '12px Segoe UI, sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText('éléments', cx, cy + 16);
      const lx = w*0.58, ly = 22, row = 24;
      labels.forEach((label,i)=>{
        const y = ly + i*row;
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(lx, y, 10, 10);
        ctx.fillStyle = '#334155';
        ctx.font = '11px Segoe UI, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const value = data[i] || 0;
        ctx.fillText(`${label} (${value})`, lx + 16, y - 1);
      });
    }
    roundRect(x,y,w,h,r,fill){
      const ctx = this.ctx;
      if(w <= 0 || h <= 0) return;
      const rr = Math.min(r, w/2, h/2);
      ctx.beginPath();
      ctx.moveTo(x+rr,y);
      ctx.arcTo(x+w,y,x+w,y+h,rr);
      ctx.arcTo(x+w,y+h,x,y+h,rr);
      ctx.arcTo(x,y+h,x,y,rr);
      ctx.arcTo(x,y,x+w,y,rr);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }
  window.Chart = MiniChart;
}
