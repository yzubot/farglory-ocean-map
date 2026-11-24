'use strict';
// ===== 工具 =====
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function hav(a,b){const R=6371000,r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r;const x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
// 園區在山坡：東（入口、台11線）低，西（水晶城堡）高。用經度粗估「往山上」多少公尺水平距離。
const uphillM=(a,b)=>Math.max(0,(a[1]-b[1])*LOCAL.mx);
const isTop=p=>p[1]<121.6006,isBottom=p=>p[1]>121.6021;  // 8區山頂一帶／入口一帶
function walk(a,b){const d=hav(a,b),m=d*1.5,up=uphillM(a,b);
  const min=Math.max(1,Math.round(m/45+up*1.5/45*0.5));  // 上坡段多算約 50% 時間
  const t={m:Math.round(m/10)*10,min,up:up>60};
  if((isTop(a)&&isBottom(b))||(isBottom(a)&&isTop(b)))t.cable=true;
  return t;}
const fmtWalk=w=>`${w.m} 公尺・約 ${w.min} 分${w.up?'（上坡）':''}${w.cable?'・可搭纜車':''}`;
// 真實經緯度 → 官網圖像素（薄板樣條，係數由 tools/build.py 產生）
function toMap(lat,lon){const T=GEO.tps;const x=(lon-LOCAL.lon0)*LOCAL.mx,y=(lat-LOCAL.lat0)*LOCAL.my;
  let u=T.a[0][0]+x*T.a[1][0]+y*T.a[2][0],v=T.a[0][1]+x*T.a[1][1]+y*T.a[2][1];
  for(let i=0;i<T.c.length;i++){const r=Math.hypot(x-T.c[i][0],y-T.c[i][1]);if(r>0){const k=r*r*Math.log(r);u+=k*T.w[i][0];v+=k*T.w[i][1];}}return [u,v];}
function pxPerM(lat,lon){const a=toMap(lat,lon),b=toMap(lat+1/LOCAL.my*10,lon),c=toMap(lat,lon+1/LOCAL.mx*10);return Math.sqrt(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])))/10;}
const PARK={s:23.8985,w:121.5983,n:23.9035,e:121.6045};
const inPark=p=>p[0]>PARK.s&&p[0]<PARK.n&&p[1]>PARK.w&&p[1]<PARK.e;

// ===== 類別、分區 =====
const CAT={ride:['遊樂設施','🎠'],water:['戲水（夏季）','💦'],cable:['晴空纜車','🚡'],show:['展館／表演','🐬'],spot:['其他','📍'],food:['餐飲','🍴'],shop:['商店','🛍️'],
 wc:['洗手間','🚻'],nurse:['育嬰室','🍼'],svc:['客服中心','❓'],rent:['推車租借','🛒'],locker:['置物櫃','🧳'],aid:['醫務室','⛑️'],gate:['入口','🎫'],bus:['接駁／公車','🚌']};
const ZONE={1:['海洋村','#e11d48'],2:['探險島','#0f766e'],3:['海洋劇場','#0891b2'],4:['歡樂大街','#7c3aed'],5:['海盜灣','#92400e'],6:['布萊登海岸','#1d4ed8'],7:['海底王國','#ea580c'],8:['水晶城堡','#a21caf']};
const zTag=z=>ZONE[z]?`<span class="zone" style="background:${ZONE[z][1]}" data-tip="官網八大主題區：${z} 區 ${ZONE[z][0]}。">${z}區 ${ZONE[z][0]}</span>`:'';
const PLAY=['ride','water','cable','show'];

// ===== 日期 =====
const pad=n=>String(n).padStart(2,'0');
const isoDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const WK='日一二三四五六';
const selDay=()=>$('#day').value||isoDay(new Date());
function maintOn(p,day){const d=new Date(day+'T00:00:00'),wd=d.getDay(),we=wd===0||wd===6;
  if(p.stop)return p.stop;
  for(const [a,b,why,opt] of (p.maint||[])){if(day>=a&&day<=b){if(opt==='wkend'){if(!we)return why;}else return why;}}
  if(p.c==='water'){const mo=d.getMonth()+1;if(mo<5||mo>10)return '冬季應不開放（推估，以現場為準）';}
  return '';}

// ===== 地圖：真實 =====
const mapR=L.map('mapReal',{zoomControl:true,maxZoom:21}).fitBounds([[23.8999,121.5994],[23.9025,121.6033]],{padding:[4,4]});
const far=()=>$('#mapReal').classList.toggle('far',mapR.getZoom()<18);setTimeout(far,0);
const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:21,maxNativeZoom:19,attribution:'© OpenStreetMap'}).addTo(mapR);
const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:21,maxNativeZoom:19,attribution:'Esri World Imagery'});
const ov=L.imageOverlay('overlay.webp',GEO.bounds,{opacity:.8,attribution:'導覽圖 © 遠雄海洋公園（對位推估）'}).addTo(mapR);
// ===== 地圖：官網原圖 =====
const [W,H]=GEO.size;
const mapO=L.map('mapOrig',{crs:L.CRS.Simple,minZoom:-3,maxZoom:2,zoomSnap:.25,attributionControl:true});
L.imageOverlay('map.jpg',[[-H,0],[0,W]],{attribution:'導覽圖 © 遠雄海洋公園'}).addTo(mapO);
mapO.setView([-1200,1400],-2);
const oLL=m=>[-m[1],m[0]];

// ===== 標記 =====
function heightInfo(p){const h=+$('#kh').value||0,age=+$('#ka').value||0;
  if(!['ride','water'].includes(p.c))return {ok:true,txt:'不限'};
  const mt=maintOn(p,selDay());
  if(p.stop)return {ok:false,txt:'停止使用'};
  if(p.c==='water')return {ok:false,mid:true,txt:'夏季戲水'};
  if(p.age){const ok=age>=p.age[0]&&age<=p.age[1];return {ok,mid:!ok,txt:ok?`適合（${p.age[0]}–${p.age[1]} 歲）`:`適合 ${p.age[0]}–${p.age[1]} 歲`};}
  if(p.min&&h<p.min)return {ok:false,txt:`要 ${p.min} 公分`};
  return {ok:true,txt:p.min?`可以玩（${p.min} 公分以上${p.adult&&h<p.adult?'，大人陪':''}）`:'可以玩'};}
function popHtml(p){let s=`<b>${esc(p.n)}</b><br><span style="color:#666">${p.no?'#'+esc(p.no)+'・':''}${CAT[p.c][0]}${ZONE[p.z]?'・'+p.z+'區 '+ZONE[p.z][0]:''}</span>`;
  if(['ride','water'].includes(p.c)){const hi=heightInfo(p);s+=`<br><b style="color:${hi.ok?'#15803d':'#b91c1c'}">${esc(hi.txt)}</b>`;}
  if(p.acc)s+=`<br>${esc(p.acc)}`;
  const mt=maintOn(p,selDay());if(mt&&!p.stop)s+=`<br><b style="color:#b45309">${esc(selDay().slice(5))}：${esc(mt)}</b>`;
  if(p.est)s+=`<br><span style="color:#888;font-size:12px">位置由官網導覽圖換算（推估）</span>`;
  if(last&&inPark(last))s+=`<br>從你這裡：${fmtWalk(walk(last,p.ll))}`;
  return s;}
const facR=L.layerGroup().addTo(mapR),facO=L.layerGroup().addTo(mapO),rideR=L.layerGroup().addTo(mapR),rideO=L.layerGroup().addTo(mapO);
const MK=new Map();
function drawMarkers(){[facR,facO,rideR,rideO].forEach(g=>g.clearLayers());MK.clear();
  POIS.forEach(p=>{let icon;const big=PLAY.includes(p.c);
    if(big){const hi=heightInfo(p);const mt=maintOn(p,selDay());
      const col=p.c==='show'?'#0891b2':p.c==='cable'?(mt?'#9ca3af':'#a21caf'):(hi.ok&&!mt)?'#15803d':'#9ca3af';
      icon=L.divIcon({className:'',html:`<div class="pin" style="background:${col}">${esc(p.no||'★')}</div>`,iconSize:[24,24],iconAnchor:[12,12]});}
    else icon=L.divIcon({className:'fac',html:CAT[p.c][1],iconSize:[22,22],iconAnchor:[11,11]});
    const a=L.marker(p.ll,{icon,title:p.n}).bindPopup(()=>popHtml(p)).addTo(big?rideR:facR);
    let b=null;if(p.m){b=L.marker(oLL(p.m),{icon,title:p.n}).bindPopup(()=>popHtml(p)).addTo(big?rideO:facO);}
    MK.set(p,[a,b]);});}

// ===== 地圖模式切換 =====
let mode='real',oInit=false;
function setMode(m){mode=m;$('#mapReal').style.display=m==='real'?'block':'none';$('#mapOrig').style.display=m==='orig'?'block':'none';
  $('#btnMode').textContent=m==='real'?'🗺️ 官網原圖':'🛰️ 真實地圖';(m==='real'?mapR:mapO).invalidateSize();
  if(m==='orig'&&!oInit){oInit=true;mapO.fitBounds([[-2060,700],[-150,2400]]);if(meO)mapO.setView(meO.getLatLng(),-0.5);}}
$('#btnMode').onclick=()=>setMode(mode==='real'?'orig':'real');
$('#btnSat').onclick=function(){const on=mapR.hasLayer(sat);if(on){mapR.removeLayer(sat);osm.addTo(mapR);}else{mapR.removeLayer(osm);sat.addTo(mapR);}ov.bringToFront();this.classList.toggle('on',!on);if(mode!=='real')setMode('real');};
$('#btnOv').onclick=function(){const on=mapR.hasLayer(ov);on?mapR.removeLayer(ov):ov.addTo(mapR);this.classList.toggle('on',!on);if(mode!=='real')setMode('real');};
$('#op').oninput=e=>ov.setOpacity(e.target.value/100);
$('#btnFac').onclick=function(){const on=mapR.hasLayer(facR);on?(mapR.removeLayer(facR),mapO.removeLayer(facO)):(facR.addTo(mapR),facO.addTo(mapO));this.classList.toggle('on',!on);};
mapR.on('zoomend',far);
function go(p,withStar){const [a,b]=MK.get(p)||[];
  [hitR,hitO].forEach(h=>h&&h.remove());hitR=hitO=null;
  if(withStar){const ic=L.divIcon({className:'',html:'<div class="hit">★</div>',iconSize:[32,32],iconAnchor:[16,16]});
    hitR=L.marker(p.ll,{icon:ic,zIndexOffset:1000}).bindPopup(()=>popHtml(p)).addTo(mapR);
    if(p.m)hitO=L.marker(oLL(p.m),{icon:ic,zIndexOffset:1000}).bindPopup(()=>popHtml(p)).addTo(mapO);}
  if(mode==='real'||!p.m){if(mode!=='real')setMode('real');mapR.setView(p.ll,19);(hitR||a).openPopup();}
  else{mapO.setView(oLL(p.m),0.25);(hitO||b)?(hitO||b).openPopup():L.popup().setLatLng(oLL(p.m)).setContent(popHtml(p)).openOn(mapO);}
  if(window.innerWidth<900)$('#mapwrap').scrollIntoView({behavior:'smooth',block:'start'});}
let hitR=null,hitO=null;
const focus=p=>go(p,false),star=p=>go(p,true);

// ===== 定位 =====
let last=null,acc=0,follow=false,watch=null,meR=null,accR=null,meO=null,accO=null;
function onPos(pos){const p=[pos.coords.latitude,pos.coords.longitude];last=p;acc=pos.coords.accuracy;
  if(!meR){meR=L.circleMarker(p,{radius:9,color:'#fff',weight:3,fillColor:'#2563eb',fillOpacity:1}).addTo(mapR);accR=L.circle(p,{radius:acc,color:'#2563eb',weight:1,fillOpacity:.12}).addTo(mapR);if(inPark(p))mapR.setView(p,18);}
  meR.setLatLng(p);accR.setLatLng(p).setRadius(acc);
  if(inPark(p)){const m=toMap(p[0],p[1]),ll=oLL(m),rpx=acc*pxPerM(p[0],p[1]);
    if(!meO){meO=L.circleMarker(ll,{radius:9,color:'#fff',weight:3,fillColor:'#2563eb',fillOpacity:1}).addTo(mapO);accO=L.circle(ll,{radius:rpx,color:'#2563eb',weight:1,fillOpacity:.12}).addTo(mapO);}
    meO.setLatLng(ll);accO.setLatLng(ll).setRadius(rpx);}
  if(follow){mode==='real'?mapR.panTo(p):meO&&mapO.panTo(meO.getLatLng());}
  const t=new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
  $('#gps').textContent=inPark(p)?`📍 已定位（${t}，誤差約 ${Math.round(acc)} 公尺）。搜尋結果與設施清單會顯示走過去要多久。`:`📍 已定位，但你還不在遠雄海洋公園附近（${t}）。到了園區藍點會出現在地圖上。`;
  renderRides();search();}
function onErr(e){$('#gps').textContent=e.code===1?'定位被拒絕了。到手機設定→Safari／Chrome→位置，改成允許，再重新整理。':'暫時抓不到定位（'+e.message+'），到空曠處再試一次。';}
$('#btnGps').onclick=function(){if(!navigator.geolocation){$('#gps').textContent='這個瀏覽器不支援定位。';return;}
  if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;this.classList.remove('on');this.textContent='📍 開啟我的定位';return;}
  $('#gps').textContent='定位中…';watch=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
  this.classList.add('on');this.textContent='📍 定位中（按一下關閉）';};
$('#btnFollow').onclick=function(){follow=!follow;this.classList.toggle('on',follow);if(follow&&last)(mode==='real'?mapR.panTo(last):meO&&mapO.panTo(meO.getLatLng()));};
$('#btnMe').onclick=()=>{if(!last){$('#btnGps').click();return;}mode==='real'?mapR.setView(last,18):meO?mapO.setView(meO.getLatLng(),0):mapR.setView(last,16);};

// ===== 今天 =====
// 節目時刻表（官網，適用 2026/10/26–12/24）。wedOff＝週三休演。
const SHOWS=[
 ['10:20','大洋池的生態奧秘','探險島水族館',2,'',0],
 ['10:50','奇妙海洋慶典','水晶城堡劇場',8,'',1],
 ['11:00','美人魚實境秀（付費、要預約）','海洋探索館',3,'mermaid',0],
 ['12:00','遇見海豚','海洋劇場（海豚）',3,'',0],
 ['13:15','美人魚泡泡遊行','歡樂大街（4區）',4,'',1],
 ['14:00','美人魚實境秀（付費、要預約）','海洋探索館',3,'mermaid',0],
 ['14:30','海獅巡警隊','海獅劇場',2,'',0],
 ['15:30','美人魚見面會','海洋探索館',3,'',0],
 ['15:40','奇妙海洋慶典','水晶城堡劇場',8,'',1],
 ['16:10','大洋池的生態奧秘','探險島水族館',2,'',0],
];
const SHUT_IN=['09:00','09:30','10:00','10:30','11:00','12:00','13:00','14:00'];
const SHUT_OUT=['12:20','13:20','14:20','15:20','15:50','16:20','16:50','17:20'];
const mermaidPrice=wd=>wd===3?120:wd===6?160:wd===0?150:130;
function renderToday(){const day=selDay();const d=new Date(day+'T00:00:00'),wd=d.getDay(),we=wd===0||wd===6;const box=$('#todayBox');
  const now=new Date(),isToday=isoDay(now)===day,nm=now.getHours()*60+now.getMinutes();
  const toM=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
  const inSched=day>='2026-10-26'&&day<='2026-12-24';
  let cd='';if(isToday){const left=17*60-nm;cd=left>0?`<p data-tip="距離 17:00 閉園還有多久。">⏳ 距閉園約 ${Math.floor(left/60)} 小時 ${left%60} 分</p>`:'<p>今天已閉園。</p>';}
  const nextIdx=isToday?SHOWS.findIndex(s=>toM(s[0])>=nm&&!(s[5]&&wd===3)):-1;
  const shows=SHOWS.map((s,i)=>{const [t,n,where,z,kind,wedOff]=s;const off=wedOff&&wd===3;const past=isToday&&toM(t)<nm;
    const p=POIS.find(x=>x.n===where);
    let extra=kind==='mermaid'?`・${day.slice(5)}（週${WK[wd]}）每人 ${mermaidPrice(wd)} 元；3 歲以下或未滿 100 公分不佔位免費`:'';
    return `<li class="${off?'off':''} ${past?'past':''} ${i===nextIdx?'now':''}" data-poi="${esc(where)}" data-tip="${off?'週三休演。':''}${i===nextIdx?'下一場。':''}點一下地圖移到表演地點。"><div class="top"><span class="nm">${t} ${esc(n)}</span><span class="ds">${zTag(z)}</span></div><div class="nt">${esc(where)}${off?'・<b>週三休演</b>':''}${esc(extra)}${p&&last&&inPark(last)?'・'+fmtWalk(walk(last,p.ll)):''}</div></li>`;}).join('');
  const mt=POIS.filter(p=>['ride','cable','water'].includes(p.c)).map(p=>[p,maintOn(p,day)]).filter(x=>x[1]);
  const kidN=['海洋嘉年華（旋轉木馬）','海國王號','碰碰船','愛情摩天輪','晴空纜車（2區探險島站）','大章魚沙灘','鯨魚的夢想家'];
  const mth=mt.filter(([p])=>p.c!=='cable'||p.no==='11').map(([p,why])=>`<li data-tip="官網「保養停演公告」${p.c==='water'?'（戲水為季節性推估）':''}。${kidN.includes(p.n)?'這個是小小孩能玩的設施。':''}">${kidN.includes(p.n)?'⚠️ ':''}${esc(p.c==='cable'?'晴空纜車':p.n)}：${esc(why)}</li>`).join('')||'<li>沒有排定保養</li>';
  const nextIn=isToday?SHUT_IN.find(t=>toM(t)>=nm):null,nextOut=isToday?SHUT_OUT.find(t=>toM(t)>=nm):null;
  box.innerHTML=`<div class="card"><p data-tip="選擇的日期與星期。">${d.getMonth()+1}/${d.getDate()}（週${WK[wd]}）${we?'・假日':'・平日'}</p>
   <p data-tip="官網營業時間：平日 09:30–17:00。假日、寒暑假可能不同，請看官網營業時間頁。">園區營業 <span class="big">09:30–17:00</span>${we?' <span class="tag t-mid" data-tip="這頁只確認了平日時間，假日以官網為準。">假日以官網為準</span>':''}</p>
   <p data-tip="官網：最後入園／售票時間。">最後入園・售票 <b>15:00</b></p>${cd}</div>
   <h3 data-tip="官網節目時刻表（適用 2026/10/26–12/24）。週三：奇妙海洋慶典、美人魚泡泡遊行休演。演出可能因天候調整或取消。">表演時刻${wd===3?'（週三：2 項休演）':''}</h3>
   ${inSched?'':'<div class="card warn" data-tip="時刻表只適用到 12/24，之後請看官網新時刻表。">⚠️ 這天不在 10/26–12/24 時刻表期間內，時間可能不同。</div>'}
   <ul class="list" id="showList">${shows}</ul>
   <div class="card"><p data-tip="海洋探索館的美人魚實境秀要另外付費、預約入場。">🧜 美人魚實境秀：線上商城<b>每天 15:00 開放預約</b>（通常是預約隔天場次）。週三 120／平日 130／週日 150／週六 160 元；3 歲以下或未滿 100 公分不佔位免費。</p>
   <p><a class="btn" href="https://shop.farglory-oceanpark.com.tw/Session.aspx" target="_blank" rel="noopener" data-tip="官方線上商城的場次預約頁。">預約美人魚實境秀</a></p></div>
   <h3 data-tip="官網「保養停演公告」2026 年度機械遊樂設施保養時程（不含不定期安檢）。">保養／停開</h3><div class="card"><ul>${mth}</ul></div>
   <h3 data-tip="遠雄悅來大飯店住客接駁車。上車處：園區大門外左側站牌。">🚌 飯店接駁車（遠雄悅來）</h3>
   <div class="card"><p data-tip="飯店發車往海洋公園的時間。">飯店 → 園區：${SHUT_IN.map(t=>`<b${t===nextIn?' class="warn"':''}>${t}</b>`).join('、')}</p>
   <p data-tip="從園區大門外左側站牌回飯店的時間；17:20 是末班。">園區 → 飯店：${SHUT_OUT.map(t=>`<b${t===nextOut?' class="warn"':''}>${t}</b>`).join('、')}（末班 17:20）</p>
   ${isToday&&nextOut?`<p data-tip="現在時間之後最近一班回飯店的接駁車。">下一班回飯店：<b class="warn">${nextOut}</b></p>`:''}
   <p class="sub" data-tip="以飯店／現場公告為準，客滿或天候可能調整。">上車處：園區大門外左側站牌。以飯店公告為準。</p></div>`;
  box.querySelectorAll('#showList li').forEach(li=>li.onclick=()=>{const p=POIS.find(x=>x.n===li.dataset.poi);if(p)star(p);});}

// ===== 設施清單 =====
let fMode='ok';
function renderRides(redraw){const ul=$('#rides');ul.innerHTML='';const day=selDay();
  let L0=POIS.filter(p=>[...PLAY,'spot'].includes(p.c)||(fMode==='rain'&&p.c==='food'));
  if(fMode==='rain')L0=L0.filter(p=>p.rain);
  if(fMode==='ok')L0=L0.filter(p=>heightInfo(p).ok&&!maintOn(p,day)&&p.c!=='spot');
  L0=L0.map(p=>({p,hi:heightInfo(p),d:last&&inPark(last)?hav(last,p.ll):null}));
  L0.sort((a,b)=>a.d!=null?a.d-b.d:((a.p.kid||99)-(b.p.kid||99))||((+a.p.no||99)-(+b.p.no||99)));
  L0.forEach(({p,hi})=>{const li=document.createElement('li');li.dataset.tip='點一下，地圖會移到這裡。';const mt=maintOn(p,day);
    const tg=['ride','water'].includes(p.c)?`<span class="tag ${hi.ok?'t-ok':hi.mid?'t-mid':'t-no'}" data-tip="依你輸入的身高 ${$('#kh').value} 公分、${$('#ka').value} 歲判斷。">${esc(hi.txt)}</span>`:`<span class="tag t-gray" data-tip="這類不看身高。">${CAT[p.c][0]}</span>`;
    const ex=[zTag(p.z),p.rain?'<span class="tag t-gray" data-tip="室內或有遮蔽，下雨也能玩。">室內</span>':'',mt&&!p.stop?`<span class="tag t-no" data-tip="官網保養停演公告：${esc(mt)}">${esc(day.slice(5))} 停開</span>`:'',p.est?'<span class="tag t-gray" data-tip="位置由官網導覽圖換算到真實座標，誤差約 10–50 公尺。">位置推估</span>':''].join('');
    let w='';if(last&&inPark(last))w=fmtWalk(walk(last,p.ll));
    li.innerHTML=`<div class="top"><span class="nm">${p.no?esc(p.no)+'. ':''}${esc(p.n)}</span><span class="ds" data-tip="從你目前位置走過去的距離與時間（推嬰兒車速度估算，上坡加時）。">${w}</span></div><div>${tg}${ex}</div><div class="nt">${esc(p.acc||'')}</div>`;
    li.onclick=()=>focus(p);ul.appendChild(li);});
  if(!L0.length)ul.innerHTML='<li class="none">沒有符合的設施。</li>';
  if(redraw)drawMarkers();}
[['fOk','ok'],['fAll','all'],['fRain','rain']].forEach(([id,m])=>$('#'+id).onclick=function(){fMode=m;document.querySelectorAll('#fOk,#fAll,#fRain').forEach(b=>b.classList.toggle('on',b===this));renderRides();});
['kh','ka'].forEach(id=>$('#'+id).addEventListener('input',()=>renderRides(true)));

// ===== 搜尋 =====
const ALIAS={'廁所':'洗手間','尿布':'育嬰室 洗手間','換尿布':'育嬰室','哺乳':'育嬰室','餵奶':'育嬰室','親子廁所':'育嬰室','推車':'推車租借','嬰兒車':'推車租借','娃娃車':'推車租借','吃':'餐飲','餐廳':'餐飲','吃飯':'餐飲','兒童餐':'兒童餐 寶寶餐','寶寶':'寶寶餐','木馬':'旋轉木馬','球池':'鯨魚的夢想家','沙':'大章魚沙灘','海豚':'海洋劇場 海豚','海獅':'海獅劇場','美人魚':'海洋探索館','人魚':'海洋探索館','魚':'水族館','纜車':'晴空纜車','上山':'晴空纜車','接駁':'接駁','回飯店':'接駁','巴士':'接駁 公車','醫':'醫務室','受傷':'醫務室','走失':'客服中心','寄物':'置物櫃 客服中心','咖啡':'咖啡 星巴克','城堡':'水晶城堡'};
const norm=t=>String(t).toLowerCase().replace(/臺/g,'台').replace(/\s+/g,'');
function search(){const q=norm($('#q').value);const ul=$('#res');ul.innerHTML='';if(!q)return;
  const keys=[q];for(const [k,v] of Object.entries(ALIAS))if(k.includes(q)||q.includes(k))keys.push(...v.split(' ').map(norm));
  let hits=POIS.filter(p=>{const hay=norm(p.n+' '+CAT[p.c][0]+' '+(p.a||'')+' '+(p.acc||'')+' '+(ZONE[p.z]?ZONE[p.z][0]+p.z+'區':'')+(p.no?' #'+p.no:''));return keys.some(k=>hay.includes(k));});
  if(last&&inPark(last))hits.sort((a,b)=>hav(last,a.ll)-hav(last,b.ll));
  if(!hits.length){ul.innerHTML='<li class="none">找不到。試試別的說法，例如：木馬、球池、廁所、吃飯、纜車。</li>';return;}
  hits.slice(0,15).forEach(p=>{const li=document.createElement('li');li.dataset.tip='點一下，地圖會移到這裡並標星號。';
    let d=CAT[p.c][0];if(last&&inPark(last))d+='・'+fmtWalk(walk(last,p.ll));
    li.innerHTML=`<div class="top"><span class="nm">${p.no?esc(p.no)+'. ':''}${esc(p.n)}</span><span class="ds">${esc(d)}</span></div><div>${zTag(p.z)}</div>${p.acc?`<div class="nt">${esc(p.acc)}</div>`:''}`;li.onclick=()=>star(p);ul.appendChild(li);});}
$('#q').addEventListener('input',search);
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter'){const f=$('#res li:not(.none)');if(f){f.click();$('#q').blur();}}});
const QUICK=[['旋轉木馬','海洋嘉年華（6區，85 公分以上）'],['球池','鯨魚的夢想家（1–6 歲室內球池）'],['沙灘','大章魚沙灘（1–6 歲室內沙坑）'],['廁所','洗手間（親子廁所在客服中心、探險島補貨站、鯨魚的夢想家）'],['育嬰室','育嬰室（換尿布、哺乳）'],['推車','推車租借（5F 驗票中心旁）'],['吃飯','園內餐廳'],['兒童餐','有寶寶餐／兒童餐的餐廳'],['纜車','晴空纜車（2區↔8區）'],['海豚','海洋劇場 遇見海豚'],['美人魚','海洋探索館'],['接駁','飯店接駁車站牌']];
QUICK.forEach(([k,t])=>{const b=document.createElement('button');b.textContent=k;b.dataset.tip='搜尋：'+t;b.onclick=()=>{$('#q').value=k;search();};$('#quick').appendChild(b);});

// ===== 資訊頁 =====
$('#t-info').innerHTML=`
<h2 data-tip="官網營業時間與入園須知（2026-11-24 查）。">營業時間</h2>
<div class="card"><table>
 <tr><th data-tip="一般非假日。">平日</th><td class="n" data-tip="園區開放時間。"><b>09:30–17:00</b></td><td data-tip="最後入園與售票時間。">最後入園／售票 15:00</td></tr></table>
 <p class="sub" data-tip="假日、寒暑假、特殊節日時間可能調整，以官網營業時間頁為準。">假日與特殊日期以官網為準。客服 <a href="tel:038123123" data-tip="遠雄海洋公園服務專線。">03-812-3123</a></p></div>

<h2 data-tip="官網票價查詢頁（2026-11-24 查）。">門票</h2>
<div class="card"><table>
 <tr><th data-tip="票種與資格。">票種</th><th class="n" data-tip="官網現場票價（新台幣）。">票價</th></tr>
 <tr><td data-tip="一般成人。">全票</td><td class="n" data-tip="現場全票。">990</td></tr>
 <tr><td data-tip="3–6 歲，或身高 100–115 公分（要帶證明）。">幼童票（3–6 歲或 100–115 公分）</td><td class="n" data-tip="幼童票。">490</td></tr>
 <tr><td data-tip="未滿 3 歲或身高 100 公分以下免費，要有家長陪同，請帶健保卡／戶口名簿等年齡證明。"><b>免費：未滿 3 歲或 100 公分以下</b></td><td class="n" data-tip="免費，須家長陪同。">0</td></tr></table>
 <p data-tip="2024-08 出生的孩子到 2027-08 前都未滿 3 歲；身高約 89 公分也在 100 公分以下。">👶 弟弟（2 歲、約 89 公分）：<b>免費</b>，帶健保卡或戶口名簿。</p></div>

<h2 data-tip="官網「最新優惠」頁（2026-11-24 查），條件細節以官網為準。">目前優惠</h2>
<div class="card"><ul>
 <li data-tip="週年慶活動：12 歲以下兒童搭配一張全票，兒童免費。條件與期限見官網。">週年慶「買大送小」：12 歲以下搭一全票免費</li>
 <li data-tip="11 月生日的壽星優惠，要帶證件。詳細折扣見官網。">11 月壽星優惠（帶證件）</li>
 <li data-tip="國旅補助住宿方案：同行加一人 100 元。詳見官網。">國旅補助：同行加一 100 元</li>
 <li data-tip="美人魚嘉年華雙人票 1,865 元（內容見官網）。">美人魚嘉年華雙人票 1,865 元</li></ul>
 <p><a class="btn" href="https://www.farglory-oceanpark.com.tw/" target="_blank" rel="noopener" data-tip="遠雄海洋公園官網，最新優惠與公告。">官網</a></p></div>

<h2 data-tip="官網：園區只收新台幣；導覽圖 DM 列出的多元支付。">付款方式</h2>
<div class="card"><p data-tip="園區不接受新台幣以外的貨幣。">只收<b>新台幣</b>。可用：國旅卡、VISA、Mastercard、JCB、銀聯、LINE Pay、Apple Pay、Google Pay、Samsung Pay、全支付、悠遊付、悠遊卡、一卡通 iPASS、icash2.0、台灣 Pay、微信支付。</p></div>

<h2 data-tip="官網入園須知與導覽圖 DM。">推車、置物櫃、育嬰室</h2>
<div class="card"><ul>
 <li data-tip="5F 驗票中心旁租借，每次 150 元，押證件或 500 元押金。數量有限。">🛒 推車租借 <b>150 元／次</b>（5F 驗票中心旁），押證件或 500 元</li>
 <li data-tip="小櫃每小時 20 元、大櫃每小時 30 元。">🧳 置物櫃：每小時 20／30 元</li>
 <li data-tip="導覽圖圖例：海洋村客服中心、探險島補貨站、鯨魚的夢想家旁都標有育嬰室或親子廁所。">🍼 育嬰室／親子廁所：1 區客服中心、2 區探險島補貨站、4 區鯨魚的夢想家</li>
 <li data-tip="導覽圖入口區標示救護站與 AED。">⛑️ 醫務室：入口附近（客服中心可協助）</li>
 <li data-tip="客服中心服務：輪椅租借、寄物、寵物寄放、提款機、救護站、AED、年票會員辦理。">❓ 客服中心（1 區）：輪椅、寄物、寵物寄放、ATM、走失協尋</li>
 <li data-tip="園區在山坡上，排隊區多半不能推車進去，要停在外面。">排隊區請把推車停在外面</li></ul></div>

<h2 data-tip="園區在山坡上：入口最低，8 區水晶城堡最高。">推嬰兒車怎麼走</h2>
<div class="card"><ul>
 <li data-tip="晴空纜車 2 區探險島站 ↔ 8 區水晶城堡站，一趟幾分鐘，免走大段上坡。12/01–12/23 保養。">🚡 <b>先搭晴空纜車上山</b>（2 區→8 區），再一路往下逛 7→6→5／4→3→1 區</li>
 <li data-tip="直線約 300 公尺，但路是之字形上坡，推車大約 15–25 分鐘。">入口走到山頂：推車約 15–25 分鐘上坡（推估）</li>
 <li data-tip="導覽圖標有無障礙步道，避開「黑鬍子好漢坡」階梯。">走「無障礙步道」，避開階梯（黑鬍子好漢坡）</li>
 <li data-tip="這頁的步行時間：每分鐘 45 公尺、路線比直線多 50%、往山上的距離多算 50% 時間。">這頁的分鐘數是推估，實際看人潮與坡度</li></ul></div>

<h2 data-tip="下雨時可以去的室內地點。">☔ 雨天備案（室內）</h2>
<div class="card"><ul>
 <li data-tip="2 區，室內大洋池。">探險島水族館（10:20、16:10 大洋池的生態奧秘）</li>
 <li data-tip="3 區，美人魚實境秀與見面會。">海洋探索館（美人魚）</li>
 <li data-tip="4 區，1–6 歲室內球池。">鯨魚的夢想家（球池）</li>
 <li data-tip="7 區，1–6 歲室內沙坑。">大章魚沙灘（沙坑）</li>
 <li data-tip="各餐廳都有室內座位。">餐廳：沙木里、峽灣、梅格烘焙屋、媽爸披薩屋、城堡餐酒館</li>
 <li data-tip="海洋劇場有大屋頂，小雨通常照常演出，以現場為準。">海洋劇場有屋頂（以現場為準）</li></ul></div>

<h2 data-tip="導覽圖 DM 第 2 頁「美食餐廳」價位（部分餐點，價格可能變動）。">餐廳（價位）</h2>
<div class="card"><table>
 <tr><th data-tip="餐廳名稱與區域。">餐廳</th><th data-tip="代表餐點。">吃什麼</th><th class="n" data-tip="DM 標示價位。">價位</th></tr>
 <tr><td data-tip="4 區歡樂大街，#23。">沙木里餐廳</td><td data-tip="有寶寶餐。">拉麵、定食、<b>寶寶餐</b></td><td class="n" data-tip="元。">50–399</td></tr>
 <tr><td data-tip="4 區，#21。">峽灣餐廳</td><td data-tip="南洋風味。">海南雞飯、咖哩飯、牛肉麵</td><td class="n" data-tip="元。">50–499</td></tr>
 <tr><td data-tip="4 區，#22。">梅格烘焙屋</td><td data-tip="冬季有玉米濃湯。">焗烤飯麵、甜點、玉米濃湯</td><td class="n" data-tip="元。">50–299</td></tr>
 <tr><td data-tip="4 區，#25。">媽爸披薩屋</td><td data-tip="現烤披薩。">披薩、雞翅</td><td class="n" data-tip="元。">50–999</td></tr>
 <tr><td data-tip="8 區山頂，#48。">城堡餐酒館</td><td data-tip="有兒童餐。">炸雞、捲餅、<b>兒童餐</b></td><td class="n" data-tip="元。">50–888</td></tr>
 <tr><td data-tip="1 區，#2，燈塔。">燈塔咖啡屋</td><td data-tip="DM：星巴克咖啡服務。">星巴克咖啡、下午茶</td><td class="n" data-tip="元。">100–299</td></tr>
 <tr><td data-tip="6 區，#40。">多尼漢堡</td><td data-tip="漢堡套餐。">漢堡、炸物</td><td class="n" data-tip="元。">199–888</td></tr>
 <tr><td data-tip="4 區，#30。">嘉年華小吃</td><td data-tip="炸雞專賣。">炸雞、爆米花</td><td class="n" data-tip="元。">50–899</td></tr>
 <tr><td data-tip="1 區，#9。">海洋冰品屋</td><td data-tip="冰品點心。">造型冰、雞排、熱狗</td><td class="n" data-tip="元。">50–500</td></tr>
 <tr><td data-tip="4 區，#29。">貝利冰淇淋</td><td data-tip="冰品。">哈根達斯、刨冰</td><td class="n" data-tip="元。">50–299</td></tr>
 <tr><td data-tip="5 區，#35。">海盜餐酒館</td><td data-tip="主題餐飲。">主題餐飲</td><td class="n" data-tip="元。">150–690</td></tr></table></div>

<h2 data-tip="遠雄悅來大飯店（花蓮壽豐，在海洋公園上方山坡）。">🏨 遠雄悅來大飯店</h2>
<div class="card">
 <p data-tip="飯店總機。">電話 <a href="tel:038123999" data-tip="遠雄悅來大飯店總機。">03-812-3999</a></p>
 <p data-tip="飯店發車往海洋公園。">接駁 飯店→園區：09:00、09:30、10:00、10:30、11:00、12:00、13:00、14:00</p>
 <p data-tip="園區大門外左側站牌上車；17:20 末班。">接駁 園區→飯店：12:20、13:20、14:20、15:20、15:50、16:20、16:50、<b>17:20 末班</b></p>
 <p class="sub" data-tip="以飯店公告為準。">上車處：園區大門外左側站牌。以飯店公告為準。</p></div>

<h2 data-tip="官網入園須知與導覽圖遊客注意事項。">注意事項／禁止攜帶</h2>
<div class="card"><ul>
 <li data-tip="官網：禁止攜帶含酒精飲料、危險物品、管制藥品。">禁帶酒精飲料、危險物品</li>
 <li data-tip="導覽圖注意事項：禁止滑板車、直排輪、腳踏車等。">禁止滑板車、直排輪、腳踏車等</li>
 <li data-tip="寵物不能入園，可到客服中心詢問寄放。">寵物不能入園（客服中心可寄放）</li>
 <li data-tip="未經園區動物照護員引導，不能觸摸、餵食動物。">不可餵食、觸摸動物</li>
 <li data-tip="園區全面禁菸，只能在吸菸區。">全面禁菸（吸菸區除外）</li>
 <li data-tip="海盜大驚航官網公告停止使用。">海盜大驚航：停止使用</li></ul></div>

<p class="note">資料來源：遠雄海洋公園官網 farglory-oceanpark.com.tw（導覽圖 DM 20260730、票價、營業時間、節目時刻表、保養停演公告、遊樂設施搭乘限制，2026-11-24 查）、OpenStreetMap。導覽圖對位與部分設施座標是推估。本頁非官方，<b>以現場公告為準</b>。</p>`;

// ===== 行程 =====
const PLAN=[
 ['09:30','入園：5F 驗票中心旁租推車','推車租借（5F 驗票中心旁）','2 歲免費（帶健保卡）。推車 150 元／次，押證件或 500。'],
 ['09:40','探險島水族館、水獺館（室內）','探險島水族館','入口旁，先看魚。'],
 ['10:20','大洋池的生態奧秘','探險島水族館','水族館大洋池表演。'],
 ['10:40','搭晴空纜車上山（2區→8區）','晴空纜車（2區探險島站）','省掉推車上坡。上山再一路往下玩。'],
 ['10:55','水晶城堡拍照、魔法殿堂','魔法殿堂','週三奇妙海洋慶典休演（其他天 10:50）。城堡餐酒館有兒童餐。'],
 ['11:05','大章魚沙灘（室內沙坑）','大章魚沙灘','1–6 歲。帶濕紙巾。'],
 ['11:25','海國王號','海國王號','85 公分以上，大人陪坐。'],
 ['11:35','海洋嘉年華旋轉木馬','海洋嘉年華（旋轉木馬）','85 公分以上，大人陪坐。旁邊碰碰船也可以（85 公分）。'],
 ['12:00','遇見海豚（海洋劇場）','海洋劇場（海豚）','11:45 前到比較好找位子。'],
 ['12:30','午餐：沙木里（寶寶餐）／峽灣','沙木里餐廳','4 區歡樂大街，室內。'],
 ['13:15','鯨魚的夢想家（室內球池）／午睡','鯨魚的夢想家','1–6 歲；旁邊有育嬰室。週三沒有泡泡遊行。'],
 ['14:30','海獅巡警隊','海獅劇場','2 區，往下走回入口方向。'],
 ['15:10','回 3 區：美人魚見面會 15:30','海洋探索館','室內。'],
 ['16:10','大洋池的生態奧秘（第二場）或回飯店','飯店接駁車站牌（大門外左側）','接駁回飯店 16:20、16:50、17:20 末班。'],
];
function renderPlan(){const pl=$('#plan');pl.innerHTML='';let prev=null;
  PLAN.forEach(([t,n,key,d])=>{const p=POIS.find(x=>x.n===key);const li=document.createElement('li');li.dataset.tip='點一下，地圖會移到這一站。';
    let w='';if(prev&&p){if(/纜車/.test(prev.n)&&p.z===8)w='搭纜車上山';else{const x=walk(prev.ll,p.ll);w=`從上一站約 ${x.m} 公尺、${x.min} 分${x.up?'（上坡）':''}`;}}
    li.innerHTML=`<span class="t" data-tip="建議時間（平日）。">${t}</span><span><b>${esc(n)}</b></span><span class="d">${esc(d)}</span>${w?`<span class="w" data-tip="推嬰兒車速度估算。">${w}</span>`:''}`;
    if(p)li.onclick=()=>focus(p);pl.appendChild(li);if(p)prev=p;});}

// ===== 分頁 =====
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('on',s.id==='t-'+b.dataset.t));});
$('#day').value=(()=>{const t=isoDay(new Date());return t<'2026-11-25'?'2026-11-25':t;})();
$('#day').addEventListener('change',()=>{renderToday();renderRides(true);});
renderToday();renderRides(true);renderPlan();
setInterval(()=>{if($('#t-today').classList.contains('on'))renderToday();},60000);

// ===== tooltip（hover／輕觸，position:fixed 不被裁切）=====
const tip=$('#tip');
function showTip(el){const t=el.dataset.tip;if(!t)return;tip.textContent=t;tip.style.display='block';const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
  let x=Math.min(Math.max(8,r.left+r.width/2-w/2),window.innerWidth-w-8),y=r.top-h-8;if(y<8)y=r.bottom+8;tip.style.left=x+'px';tip.style.top=y+'px';}
function hideTip(){tip.style.display='none';}
document.addEventListener('mouseover',e=>{const el=e.target.closest('[data-tip]');el?showTip(el):hideTip();});
document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');el&&showTip(el);});
document.addEventListener('click',e=>{const el=e.target.closest('[data-tip]');if(el){showTip(el);clearTimeout(window._tt);window._tt=setTimeout(hideTip,3500);}else hideTip();},true);
document.addEventListener('touchstart',e=>{if(!e.target.closest('[data-tip]'))hideTip();},{passive:true});
document.addEventListener('scroll',hideTip,true);
