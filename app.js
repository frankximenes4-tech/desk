/* Desk app — plan B: polls R2 JSON under the secret data path. No keys, no token, no framework. */
(function(){
'use strict';
const R2_PUBLIC='https://pub-18bd69418df5429fa61fc41fd422705e.r2.dev';
const POLL_S=15, RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
// data path: opened once as #d=..., then kept in localStorage; fragment removed from the address bar
(function(){const m=location.hash.match(/[#&]d=([A-Za-z0-9_-]{32,})/); if(m){localStorage.setItem('desk.d',m[1]); history.replaceState(null,'',location.pathname+location.search);}})();
const DP=localStorage.getItem('desk.d');
const S={state:null,chart:null,activity:null,tab:'home',range:'LIVE',lastOk:null,fail:0,retryAt:0,coin:null,audit:null,sheet:null};
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'–':'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const short=n=>n==null?'n/a':n>=1e6?'$'+(n/1e6).toFixed(2)+'M':n>=1e3?'$'+(n/1e3).toFixed(1)+'K':'$'+Number(n).toFixed(0);
const tm=ts=>ts?new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
const px=p=>p==null?'–':p<0.01?'$'+Number(p).toPrecision(4):'$'+Number(p).toFixed(4);
async function get(name){const r=await fetch(`${R2_PUBLIC}/d/${DP}/${name}`,{cache:'no-store'}); if(!r.ok) throw new Error(r.status); return r.json();}
async function poll(){
  if(!DP){S.fail=1;render();return;}
  try{const [st,ch,ac]=await Promise.all([get('state.json'),get('chart.json'),get('activity.json')]);
    S.state=st;S.chart=ch;S.activity=ac;S.lastOk=new Date();S.fail=0;
    if(S.sheet&&S.sheet.type==='coin') S.coin=await get(`coin/${S.sheet.mint}.json`).catch(()=>S.coin);
    if(S.sheet&&S.sheet.type==='audit') S.audit=await get(`audit/${S.sheet.mint}.json`).catch(()=>S.audit);
  }catch(e){S.fail++;}
  S.retryAt=Date.now()+POLL_S*1000; render(); setTimeout(poll,POLL_S*1000);
}
setInterval(()=>{if(S.fail) errRow();},1000);
function errRow(){const e=$('#err'); if(!S.fail){e.hidden=true;return;} e.hidden=false;
  const n=Math.max(0,Math.ceil((S.retryAt-Date.now())/1000));
  e.textContent=DP?`Desk offline · retrying in ${n}s · last update ${S.lastOk?tm(S.lastOk):'never'}`:'Desk offline · open the app once with its private #d= link';}
function render(){errRow(); const v=$('#view');
  if(!S.state){v.innerHTML=skeleton();return;}
  ({home:home,agents:agents,activity:activityTab,account:account})[S.tab](v);
  if(S.sheet) renderSheet();}
function skeleton(){return `<div class="nav"><div class="sk" style="width:120px;height:20px"></div></div><div class="sk" style="height:66px;width:70%;margin:12px 0"></div><div class="sk" style="height:240px;margin:12px 0"></div><div class="sk" style="height:300px"></div>`;}
// odometer: each changed digit rolls 600ms ease-out, 30ms stagger right to left
function odometer(el,text){const old=el.dataset.v||'';el.dataset.v=text;
  if(RM||old.length!==text.length||!old){el.innerHTML=[...text].map(ch=>/\d/.test(ch)?`<span class="d"><span>${ch}</span></span>`:`<span>${esc(ch)}</span>`).join('');return;}
  const chars=[...text], n=chars.length; el.innerHTML='';
  chars.forEach((ch,i)=>{ if(!/\d/.test(ch)){const s=document.createElement('span');s.textContent=ch;el.appendChild(s);return;}
    const d=document.createElement('span');d.className='d'; const o=old[i];
    if(o===ch){d.innerHTML=`<span>${ch}</span>`;}else{const col=document.createElement('span');col.innerHTML=`${o}<br>${ch}`;col.style.lineHeight='1em';col.style.transitionDelay=((n-1-i)*30)+'ms';d.appendChild(col);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{col.style.transform='translateY(-1em)';}));}
    el.appendChild(d);});}
function paperBadge(){return S.state.mode==='PAPER'?'<span class="badge paper">PAPER</span>':'';}
function unread(){const seen=localStorage.getItem('desk.seen')||'';return (S.activity?.rows||[]).some(r=>r.ts>seen);}
function home(v){const st=S.state;
  v.innerHTML=`<div class="nav"><button class="avatar" data-go="account">${esc((st.account.handle||'?')[0].toUpperCase())}</button><span class="title">Grok Bot ›</span>
    <button class="icon" id="srch" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button>
    <button class="icon" id="bell" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>${unread()?'<span class="dot"></span>':''}</button></div>
   <div id="sbox" hidden><input class="search" id="q" placeholder="Name, symbol or mint" autocomplete="off"><div class="list" id="qres"></div></div>
   <div class="balrow"><span class="odo" id="bal"></span>${paperBadge()}</div>
   <div class="sub"><span class="${st.todayPct>=0?'up':'down'}">${st.todayPct>=0?'+':''}${st.todayPct.toFixed(2)}%</span> today <span class="badge mult">${st.multiplier.toFixed(2)}×</span></div>
   <div class="chartwrap"><canvas id="lc"></canvas>${hasTrades()?'':'<div class="empty-chart">Waiting for the first trade</div>'}</div>
   <div class="ranges">${['LIVE','1H','4H','1D','1W','ALL'].map(r=>`<button data-range="${r}" class="${S.range===r?'on':''}">${r}</button>`).join('')}</div>
   <h2>Agents · ${Object.values(st.agents._meta).filter(a=>!a.paused).length} running</h2><div class="carousel">${cards()}</div>
   <h2>Activity <small data-go="activity">See all</small></h2><div class="list">${rows((S.activity?.rows||[]).slice(0,5))}</div>`;
  odometer($('#bal'),money(st.balance)); drawLine(); drawRing();
  $('#srch').onclick=()=>{$('#sbox').hidden=!$('#sbox').hidden;$('#q').focus();};
  $('#bell').onclick=()=>{localStorage.setItem('desk.seen',new Date().toISOString());S.tab='activity';setTab();};
  $('#q').oninput=e=>{const q=e.target.value.trim().toLowerCase(); const r=q?(st.search||[]).filter(c=>(c.name||'').toLowerCase().includes(q)||(c.symbol||'').toLowerCase().includes(q)||c.mint.toLowerCase()===q).slice(0,8):[];
    $('#qres').innerHTML=r.map(c=>`<div class="row" data-coin="${esc(c.mint)}"><div class="tt"><div class="t1">${esc(c.name||c.mint.slice(0,6))}</div><div class="t2">${esc(c.symbol||'')} · ${esc(c.mint.slice(0,4))}…</div></div></div>`).join('')||(q?'<div class="empty">No match</div>':'');};
}
function hasTrades(){return (S.chart?.marks||[]).length>0;}
function drawLine(){const cv=$('#lc'); if(!cv||!S.chart) return; const span={LIVE:3600e3,'1H':3600e3,'4H':4*3600e3,'1D':864e5,'1W':7*864e5,ALL:Infinity}[S.range];
  const now=Date.now(); let pts=S.chart.points.map(p=>[Date.parse(p[0]),p[1]]).filter(p=>now-p[0]<=span);
  if(S.range==='LIVE'&&S.chart.startTs) pts=pts.filter(p=>p[0]>=Date.parse(S.chart.startTs));
  if(pts.length===1) pts.unshift([pts[0][0]-60e3,pts[0][1]]);
  DeskChart.line(cv,pts,{start:S.chart.start,fade:true,marks:S.chart.marks.map(m=>({t:Date.parse(m.ts),kind:m.kind,text:m.text}))});}
function strips(layers,running){const L=layers||[];return '<div class="strips">'+[0,1,2,3,4,5,6,7].map(i=>{const l=L[i]; const cls=l?(l.pass===true?'ok':l.pass===false?'bad':''):(running&&i===L.length?'scan':'');return `<div class="strip ${cls}">${i+1}</div>`;}).join('')+'</div>';}
function cards(){const a=S.state.agents;
  const sc=a.scanner, au=a.auditor, an=a.analyst, ex=a.executor, rk=a.risk, cur=au.current;
  return `
  <div class="acard"><div class="h"><span class="nm">Auditor</span><span class="meta">${au.rejected} rejected</span></div><div class="big">${au.takenApart} taken apart</div>
    ${strips(cur&&cur.layers,cur&&cur.running)}<div class="meta">${cur?(cur.running?'taking apart...':(cur.reason?esc(cur.name)+' · '+esc(cur.reason):'8/8 → Executor')):'No coin taken apart yet'}</div></div>
  <div class="acard"><div class="h"><span class="nm" style="color:${sc.color}">Scanner</span><span class="meta">${sc.waiting} waiting</span></div><div class="big">${sc.pools} pools</div>
    <div class="feed">${sc.feed.length?sc.feed.slice(0,6).map(f=>f.verdict==='pass'?`<div><span class="n">${esc(f.name)} · liq ${short(f.liq)}</span><span>→ auditor</span></div>`:`<div class="killed"><span class="n">${esc(f.name)}</span><span class="r">${esc(f.reason||'')}</span></div>`).join(''):'<div style="border:0;color:var(--sec)">Listening for graduations</div>'}</div></div>
  <div class="acard"><div class="h"><span class="nm" style="color:${an.color}">Analyst${an.mode==='rules'?' (rules)':''}</span><span class="meta">${an.last?esc(an.last.name):''}</span></div><div class="meta">Scoring</div><canvas class="ring" id="ring"></canvas></div>
  <div class="acard"><div class="h"><span class="nm" style="color:${ex.color}">Executor</span></div><div class="big">${ex.trades} trades</div>
    <div class="meta">${ex.last?money(ex.last.size)+' · '+ex.stackPct+'% of stack':'No signal yet'}</div><div class="bar"><i style="width:${ex.last?'100%':'0'}"></i></div><div class="meta">${ex.last?(ex.last.status==='bought'?'✓ Filled':'Executing...'):''}</div></div>
  <div class="acard"><div class="h"><span class="nm" style="color:${rk.color}">Risk</span><span class="meta">${rk.open} open</span></div><div class="big">${rk.guarding?'Guarding':(rk.lastExit||'Idle')}</div>
    <div><span class="pill red">stop -${rk.stopPct}%</span><span class="pill green">trail ${rk.trailPct}%</span></div></div>`;}
function drawRing(){const c=$('#ring'); if(c){const an=S.state.agents.analyst; DeskChart.ring(c,an.last?an.last.score:null,an.minScore);}}
function rows(rs){if(!rs.length) return '<div class="empty">Nothing yet tonight</div>';
  const icon={bought:['#0a84ff','↓'],sold:['#00d35a','↑'],stopped:['#ff453a','!'],rejected:['#8e8e93','×']};
  return rs.map(r=>{const [c,i]=icon[r.kind]||['#8e8e93','•']; const cls=r.value.startsWith('+')?'up':r.value.startsWith('-')?'down':'';
    return `<div class="row" data-${r.kind==='rejected'?'audit':'coin'}="${esc(r.mint)}"><div class="ic" style="color:${c}">${i}</div><div class="tt"><div class="t1">${esc(r.title)}</div><div class="t2">${esc(r.subtitle)}</div></div><div class="v ${cls}">${esc(r.value)}</div></div>`;}).join('');}
function activityTab(v){v.innerHTML=`<div class="nav"><span class="title">Activity</span></div><div class="list">${rows(S.activity?.rows||[])}</div>`;}
const ORDER=[['scanner','Scanner'],['auditor','Auditor'],['analyst','Analyst'],['executor','Executor'],['risk','Risk']];
function agents(v){const st=S.state; const cnt={scanner:st.agents.scanner.pools,auditor:st.agents.auditor.takenApart,analyst:(st.agents._meta.analyst.decisions||[]).length,executor:st.agents.executor.trades,risk:st.agents.risk.open};
  v.innerHTML=`<div class="nav"><span class="title">Agents</span></div>`+ORDER.map(([k,n])=>{const m=st.agents._meta[k];
    return `<div class="full"><div class="hd"><span class="sdot ${m.paused?'off':''}"></span><b>${n}</b><span class="cnt">${cnt[k]} today</span></div>
     <div class="ro">${m.paused?'Paused':'Running'} · heartbeat ${tm(m.heartbeat)} · pause/resume in Telegram: "${m.paused?'resume':'pause'} ${k}"${k==='risk'&&st.agents.risk.open?' (locked while a position is open)':''}</div>
     <div class="dec">${(m.decisions||[]).map(d=>`<div><span class="t">${tm(d.ts)}</span><span>${d.link?`<a href="${esc(d.link)}" target="_blank" rel="noopener">${esc(d.coin)}</a>`:esc(d.coin)} · ${esc(d.verdict)}</span><span class="t">${esc(d.reason||'')}</span></div>`).join('')||'<div style="display:block;color:var(--sec)">No decisions yet</div>'}</div>
     <button data-settings="${k}" style="color:var(--blue)">Settings</button></div>`;}).join('');}
function account(v){const st=S.state,a=st.account,s=st.settings;
  const groups={scanner:[],auditor:[],analyst:[],executor:[],risk:[],desk:[]};
  Object.keys(s).forEach(k=>{const g=k.split('.')[0]; if(groups[g]&&s[k]!==null) groups[g].push(k);});
  v.innerHTML=`<div class="nav"><span class="title">Account</span>${paperBadge()}</div>
  <div class="group"><div class="it"><span class="k">Mode</span><span class="vv">${a.mode}</span></div><div class="it"><span class="k">Stack</span><span class="vv">${money(a.stack)}</span></div>
   ${a.ticketCheck?`<div class="it"><span class="k" style="color:var(--orange)">${esc(a.ticketCheck)}</span></div>`:''}</div>
  <div class="ro" style="margin:0 4px">Read-only on this hosting. Change anything in Telegram: "paper", "live", "stack 1240", "set stop to -8%".</div>
  <div class="group"><a class="it" href="${esc(a.profileUrl)}" target="_blank" rel="noopener"><span class="k">Your FOMO profile</span><span class="vv">@${esc(a.handle)} ›</span></a>
   <button class="it" id="invite" style="width:100%;text-align:left"><span class="k">Invite a friend</span><span class="vv" id="invv">Share ›</span></button></div>
  <div class="group"><div class="it"><span class="k">Telegram</span><span class="vv">${esc(a.telegram)}</span></div><div class="it"><span class="k">Send test push</span><span class="vv">send "status" to the bot</span></div>
   <div class="it"><span class="k">Notifications</span><span class="vv" style="font-family:var(--textf)">${esc(a.notifications)}</span></div></div>
  ${Object.entries(groups).map(([g,ks])=>`<div class="ghead" id="set-${g}">${g[0].toUpperCase()+g.slice(1)}</div><div class="group">${ks.map(k=>`<div class="it"><span class="k">${esc(k.split('.').slice(1).join(' ').replace(/_/g,' '))}</span><span class="vv">${esc(JSON.stringify(s[k]))}</span></div>`).join('')}</div>`).join('')}`;
  $('#invite').onclick=async()=>{const u=a.signupUrl; if(navigator.share){try{await navigator.share({url:u,title:'FOMO'});}catch(e){}}else{await navigator.clipboard.writeText(u);$('#invv').textContent='Link copied';}};}
// sheets
function openSheet(type,mint){S.sheet={type,mint};S.coin=null;S.audit=null;$('#sheet').hidden=false;renderSheet();
  get(`${type}/${mint}.json`).then(d=>{if(type==='coin')S.coin=d;else S.audit=d;renderSheet();}).catch(()=>{if(type==='coin')S.coin={missing:true};else S.audit={missing:true};renderSheet();});}
$('#sheetBack').onclick=()=>{S.sheet=null;$('#sheet').hidden=true;};
function renderSheet(){const b=$('#sheetBody'); $('#sheetPaper').hidden=!(S.sheet.type==='coin'&&S.state&&S.state.mode==='PAPER');
  if(S.sheet.type==='coin') coinView(b); else auditView(b);}
function coinView(b){const c=S.coin; $('#sheetTitle').textContent=c&&c.name||'Coin';
  if(!c){b.innerHTML='<div class="sk" style="height:60px;margin:12px 0"></div><div class="sk" style="height:260px"></div>';return;}
  if(c.missing){b.innerHTML='<div class="empty">No data for this coin on the desk tonight</div>';return;}
  const age=c.migratedAt?Math.floor((Date.now()-Date.parse(c.migratedAt))/3600e3):null; const pos=c.position, open=pos&&!pos.closed_at;
  const chg=open&&c.price?100*(c.price/pos.entry_price-1):null;
  b.innerHTML=`<div style="font-size:22px;font-weight:600">${esc(c.name||c.mint.slice(0,6))} ${c.shield?`<span class="badge" style="background:#0d3b22;color:var(--green)">🛡 ${c.shield}</span>`:''}</div>
   <div class="ro">${esc(c.symbol||'')} · Solana · ${age==null?'':age+'h old'}</div>
   <div class="odo" style="font-size:44px;margin-top:10px">${px(c.price)}</div>
   ${chg!=null?`<div class="${chg>=0?'up':'down'}">${chg>=0?'▲':'▼'} ${Math.abs(chg).toFixed(2)}% since entry</div>`:''}
   <div class="chartwrap" style="height:260px"><canvas id="cc" style="height:260px"></canvas>${c.candles.length?'':'<div class="empty-chart">No candles yet</div>'}</div>
   <div class="stats"><div>Market cap<b>${short(c.stats.marketCap)}</b></div><div>Liquidity<b>${short(c.stats.liquidity)}</b></div><div>24h volume<b>${short(c.stats.volume24h)}</b></div><div>Holders<b>${c.stats.holders??'n/a'}</b></div></div>
   ${open?`<div class="full"><div>Your position · ${money(pos.size_usd)} in · Executor</div><div class="ro" style="margin-top:8px">Stop ${px(c.exit.stop)} (-${c.exit.stopPct}%) · Trail ${c.exit.trail?px(c.exit.trail):'from '+px(c.exit.trailStartPrice)} · Timeout in ${Math.floor(c.exit.timeoutLeftS/3600)}h ${Math.floor(c.exit.timeoutLeftS%3600/60)}m</div></div>`:''}
   <a class="cta ${open?'sell':''}" href="${esc(c.coinUrl)}" target="_blank" rel="noopener">${open?'Sell on FOMO':'Buy on FOMO'}</a>`;
  DeskChart.candles($('#cc'),c.candles,{exitLine:open&&c.exit?c.exit.exitLine:null});}
let beamShown={};
function auditView(b){const a=S.audit; $('#sheetTitle').textContent='Auditor';
  if(!a){b.innerHTML='<div class="sk" style="height:220px;margin:24px auto;width:220px"></div>';return;}
  if(a.missing||!a.layers.some(l=>l.pass!==null)){b.innerHTML='<div class="empty">No coin taken apart yet</div>';return;}
  const done=a.layers.filter(l=>l.pass!==null);
  b.innerHTML=`<div class="discs">${a.layers.map((l,i)=>`<div class="disc" id="d${i}">${l.n}</div>`).join('')}</div>
   <div class="verdict" id="vd"></div><div class="ro" id="vs"></div>
   <div class="group vrows">${a.layers.map(l=>`<div class="it"><span class="k">${l.n} ${esc(l.name)}</span><span class="vv" style="color:${l.pass===true?'var(--green)':l.pass===false?'var(--red)':'var(--ter)'}">${esc(l.value)}</span></div>`).join('')}</div>
   <div class="group"><div class="it"><span class="k">Take apart before buying</span><span class="vv">${a.auditorEnabled?'On':'Off'} · change in Telegram</span></div></div>
   <a class="cta" href="${esc(a.coinUrl)}" target="_blank" rel="noopener">Open on FOMO</a>`;
  const fin=()=>{ if(a.running){$('#vd').textContent='Taking apart...';return;}
    if(a.reason){$('#vd').innerHTML=`<span class="down">Rejected · ${esc(a.reason)}</span>`;$('#vs').textContent=`Grok Bot won't buy ${a.name}`;}
    else{$('#vd').innerHTML=`<span class="up">Cleared · 8/8 parts</span>`;$('#vs').textContent=a.sentUsd?`Sent to Executor · ${money(a.sentUsd)}`:'Sent to Analyst';}};
  const key=a.mint+':'+done.length, paint=i=>{const l=done[i];const d=$('#d'+i);d.classList.remove('beam');d.classList.add(l.pass?'ok':'bad');d.textContent=l.pass?'✓':'✕';};
  if(RM||beamShown[key]){done.forEach((_,i)=>paint(i));fin();return;}
  beamShown[key]=1; let i=0; // beam: 350ms per layer, then 150ms to green/red; only layers the server sent
  (function step(){if(i>=done.length){fin();return;} const d=$('#d'+i); if(!d) return; d.classList.add('beam'); setTimeout(()=>{setTimeout(()=>{paint(i);i++;step();},150);},350);})();}
// navigation
function setTab(){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab)); window.scrollTo(0,0); render();}
document.addEventListener('click',e=>{const t=e.target.closest('[data-tab],[data-go],[data-range],[data-coin],[data-audit],[data-settings]'); if(!t) return;
  if(t.dataset.tab||t.dataset.go){S.tab=t.dataset.tab||t.dataset.go;setTab();}
  else if(t.dataset.range){S.range=t.dataset.range;render();}
  else if(t.dataset.coin) openSheet('coin',t.dataset.coin);
  else if(t.dataset.audit) openSheet('audit',t.dataset.audit);
  else if(t.dataset.settings){S.tab='account';setTab();setTimeout(()=>{const el=document.getElementById('set-'+t.dataset.settings);el&&el.scrollIntoView();},50);}});
addEventListener('resize',()=>{if(S.state&&S.tab==='home'){drawLine();drawRing();}});
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render(); poll();
})();
