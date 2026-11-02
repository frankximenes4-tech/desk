/* Hand-drawn canvas charts. No chart library. devicePixelRatio aware. */
(function(){
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function setup(cv){const r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);return {c,w:r.width,h:r.height};}
const last=new WeakMap();
function line(cv,pts,opt){ // pts [[t,v]], opt {start, marks:[{t,kind,text}]}
  const prev=last.get(cv)||{n:0}; const grew=pts.length>prev.n&&prev.n>0; last.set(cv,{n:pts.length});
  const t0=performance.now(), dur=(grew&&!RM)?250:0;
  function frame(now){const k=dur?Math.min(1,(now-t0)/dur):1; draw(k); if(k<1) requestAnimationFrame(frame);}
  function draw(k){
    const {c,w,h}=setup(cv); c.clearRect(0,0,w,h);
    const top=44,bot=h-10;
    const vs=pts.map(p=>p[1]).concat(opt.start!=null?[opt.start]:[]);
    let lo=Math.min(...vs),hi=Math.max(...vs); if(hi-lo<1e-9){hi+=1;lo-=1;} const pad=(hi-lo)*.1; lo-=pad;hi+=pad;
    const ts=pts.map(p=>p[0]); const tmin=ts[0], tmax=ts[ts.length-1]||tmin+1;
    const X=t=>16+(w-32)*((t-tmin)/Math.max(1,tmax-tmin)), Y=v=>bot-(bot-top)*((v-lo)/(hi-lo));
    if(opt.start!=null){c.setLineDash([4,4]);c.strokeStyle='rgba(235,235,245,0.3)';c.lineWidth=1;c.beginPath();c.moveTo(0,Y(opt.start));c.lineTo(w,Y(opt.start));c.stroke();c.setLineDash([]);}
    if(pts.length<2) return;
    let n=pts.length; let lastX=X(pts[n-1][0]), lastY=Y(pts[n-1][1]);
    if(k<1&&n>1){const a=pts[n-2],b=pts[n-1];lastX=X(a[0])+(X(b[0])-X(a[0]))*k;lastY=Y(a[1])+(Y(b[1])-Y(a[1]))*k;}
    c.beginPath(); pts.slice(0,n-1).forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1]))); c.lineTo(lastX,lastY);
    const g=c.createLinearGradient(0,top,0,bot); g.addColorStop(0,'rgba(0,211,90,0.28)'); g.addColorStop(1,'rgba(0,211,90,0)');
    c.save(); c.lineTo(lastX,bot); c.lineTo(X(pts[0][0]),bot); c.closePath(); c.fillStyle=g; c.fill(); c.restore();
    c.beginPath(); pts.slice(0,n-1).forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1]))); c.lineTo(lastX,lastY);
    c.strokeStyle='#00d35a'; c.lineWidth=2; c.lineJoin='round'; c.stroke();
    // marks above the line, never overlap: a later mark moves up a row
    c.font='600 11px -apple-system,system-ui'; const rows=[];
    (opt.marks||[]).filter(m=>m.t>=tmin&&m.t<=tmax).forEach(m=>{
      const x=X(m.t), tw=c.measureText(m.text).width+12; let r=0;
      while((rows[r]||[]).some(s=>!(x+tw/2<s[0]||x-tw/2>s[1]))) r++;
      (rows[r]=rows[r]||[]).push([x-tw/2,x+tw/2]);
      const y=Math.max(4, Y(valAt(m.t))-26-r*20);
      c.globalAlpha=opt.fade?Math.min(1,k*1.25):1;
      c.fillStyle=m.kind==='buy'?'#0a84ff':m.kind==='win'?'#00d35a':'#ff453a';
      rr(c,Math.min(w-tw-2,Math.max(2,x-tw/2)),y,tw,18,9); c.fill(); c.fillStyle=m.kind==='win'?'#000':'#fff';
      c.fillText(m.text,Math.min(w-tw-2,Math.max(2,x-tw/2))+6,y+13); c.globalAlpha=1;
    });
    function valAt(t){let b=pts[0][1];for(const p of pts){if(p[0]<=t)b=p[1];else break;}return b;}
  }
  requestAnimationFrame(frame);
}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function candles(cv,cs,opt){
  const {c,w,h}=setup(cv); c.clearRect(0,0,w,h); if(!cs.length) return;
  const vh=h*.2, top=10, bot=h-vh-8;
  let lo=Math.min(...cs.map(k=>k.l)), hi=Math.max(...cs.map(k=>k.h));
  if(opt.exitLine){lo=Math.min(lo,opt.exitLine);hi=Math.max(hi,opt.exitLine);} if(hi-lo<=0){hi*=1.01;lo*=.99;}
  const Y=v=>bot-(bot-top)*((v-lo)/(hi-lo)); const bw=Math.max(2,(w-32)/cs.length*.7); const step=(w-32)/cs.length;
  const vmax=Math.max(1,...cs.map(k=>k.v));
  cs.forEach((k,i)=>{const x=16+step*i+step/2, up=k.c>=k.o; c.strokeStyle=c.fillStyle=up?'#00d35a':'#ff453a';
    c.beginPath();c.moveTo(x,Y(k.h));c.lineTo(x,Y(k.l));c.lineWidth=1;c.stroke();
    const y1=Y(Math.max(k.o,k.c)),y2=Y(Math.min(k.o,k.c)); c.fillRect(x-bw/2,y1,bw,Math.max(1,y2-y1));
    c.globalAlpha=.35; const vhh=vh*(k.v/vmax); c.fillRect(x-bw/2,h-vhh,bw,vhh); c.globalAlpha=1;});
  if(opt.exitLine){c.setLineDash([6,4]);c.strokeStyle='#ff9f0a';c.lineWidth=1.5;c.beginPath();c.moveTo(0,Y(opt.exitLine));c.lineTo(w,Y(opt.exitLine));c.stroke();c.setLineDash([]);
    c.fillStyle='#ff9f0a';c.font='600 11px -apple-system,system-ui';c.fillText('Risk trailing stop',16,Y(opt.exitLine)-6);}
}
function ring(cv,score,greenFrom){
  const {c,w,h}=setup(cv); const r=Math.min(w,h)/2-8, cx=w/2, cy=h/2; c.clearRect(0,0,w,h);
  c.lineWidth=10; c.lineCap='round'; c.strokeStyle='#2c2c2e'; c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.stroke();
  if(score!=null){c.strokeStyle=score>=greenFrom?'#00d35a':'#ffd60a'; c.beginPath(); c.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*score/100); c.stroke();}
  c.fillStyle='#fff'; c.font='600 40px "SF Pro Display",-apple-system,system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(score==null?'–':String(score),cx,cy);
}
window.DeskChart={line,candles,ring};
})();
