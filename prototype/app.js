const DATA=window.GAME_DATA;
/* ================= constants ================= */
const TS=32, VW=15, VH=11, MW=52, MH=38;
const GATE_SILVER_PCT=.22;
const SAVE_VERSION=1, CONTENT_VERSION='prototype-r1';
const SKILLS={m:{t:'Meaning Strike',d:'What does it mean?',n:'Meaning'},p:{t:'Sound Blast',d:'How is it read? (pinyin)',n:'Pinyin'},h:{t:'Precision Jab',d:'Which characters? (hanzi)',n:'Hanzi'},u:{t:'Heavy Slam',d:'Use it in a sentence',n:'Usage'},w:{t:'Brush Finisher',d:'Write it yourself · 2 damage',n:'Writing'}};
const SK=['m','p','h','u','w'];
// atk = the question type the creature attacks you with; spell = name of that attack
const TYPES={
  fog:{n:'Fogling',weak:'m',atk:'m',spell:'Fog Cloud',c:'#9C97BF'},
  echo:{n:'Echo Bat',weak:'p',atk:'p',spell:'Screech',c:'#3D9C9A'},
  twin:{n:'Twin Shade',weak:'h',atk:'h',spell:'Mirror Trick',c:'#4A5A86'},
  jumble:{n:'Jumble Bug',weak:'u',atk:'u',spell:'Word Scramble',c:'#D98A3A'},
  ink:{n:'Ink Imp',weak:'w',atk:'h',spell:'Ink Splash',c:'#3B3F55'}
};
const CHARDATA=window.HANZI_DATA;
const REVIEW_DAYS=3, REVIEW_MAX_DAYS=30;
const DAILY_OPTIONS=[10,15,20,30,0]; // 0 = no limit
const ZONES={a:{n:'Camping Forest',l:1,cls:''},b:{n:'Misty Path',l:2,cls:'b2'},c:{n:'Kitchen Garden',l:3,cls:'b3'}};
const IDIOMS={
  '狼吞虎咽':{e:'Restore all HP',fx:'heal'},
  '齐心协力':{e:'Next hit does double damage',fx:'double'},
  '抛到脑后':{e:'Next wrong answer does no damage',fx:'shield'},
  '异口同声':{e:'All your spirits shout together for 1 damage',fx:'shout'}
};
const HATS={red:{n:'Red Cap',p:40,c:'#C63F2B'},bamboo:{n:'Bamboo Hat',p:70,c:'#C9A45C'},crown:{n:'Gold Crown',p:150,c:'#E2B23C'}};
DATA.school=DATA.school.concat(DATA.sentence);
const WORDS=DATA.words; const WMAP={}; WORDS.forEach(w=>WMAP[w.w]=w);
const EXAM={}; Object.entries(DATA.exam).forEach(([w,list])=>{EXAM[w]={h:[],p:[],u:[]};list.forEach(q=>{const k=q.k==='vocab'?'h':q.k==='pinyin'?'p':'u';EXAM[w][k].push(q)})});

/* ================= utils ================= */
const $=s=>document.querySelector(s);
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtQ=s=>esc(s).replace(/__(.+?)__/g,'<u>$1</u>').replace(/_{3,}/g,'<span class="blank">　</span>');
let activeSpeechButton=null,activeSpeechIdle='';
function resetSpeechButton(){
  if(activeSpeechButton){activeSpeechButton.textContent=activeSpeechIdle;activeSpeechButton.setAttribute('aria-pressed','false')}
  activeSpeechButton=null;activeSpeechIdle='';
}
function stopSpeaking(){
  try{if('speechSynthesis' in window)speechSynthesis.cancel()}catch(e){}
  resetSpeechButton();
}
function speak(t,button=null){
  if(activeSpeechButton&&activeSpeechButton===button){stopSpeaking();return false}
  stopSpeaking();
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){toast('Read-aloud is not available in this browser.');return false}
  try{
    const u=new SpeechSynthesisUtterance(t);u.lang='zh-CN';u.rate=.85;
    if(button){activeSpeechButton=button;activeSpeechIdle=button.textContent;button.textContent='Stop';button.setAttribute('aria-pressed','true')}
    u.onend=resetSpeechButton;u.onerror=resetSpeechButton;speechSynthesis.speak(u);return true;
  }catch(e){resetSpeechButton();toast('Read-aloud could not start. Try again or use another browser.');return false}
}
window.speak=speak;

/* ================= levels & save state ================= */
// Each level is its own game with its own save. Only P5 content exists in this prototype.
const LEVELS=[
  {id:'p3',label:'Primary 3',ready:false},{id:'p4',label:'Primary 4',ready:false},
  {id:'p5',label:'Primary 5',ready:true},{id:'p6',label:'Primary 6',ready:false}];
const PROFILE_KEY='wsq-profile', LEGACY_KEY='zilin-save-v1';
const saveKey=lvl=>'wsq-save-'+lvl;
const backupKey=lvl=>saveKey(lvl)+'-backup';
const recoveryKey=lvl=>saveKey(lvl)+'-recovery';
function freshState(){return{version:SAVE_VERSION,level:null,contentVersion:CONTENT_VERSION,x:20,y:14,dir:'down',lvl:1,xp:0,hp:20,coins:20,potions:1,noodles:0,hats:[],hat:null,words:{},chars:{},stats:{m:[0,0],p:[0,0],h:[0,0],u:[0,0],w:[0,0],x:[0,0],d:[0,0],c:[0,0]},stories:[],battles:0,playMs:0,boss:false,gateTest:false,seenIntro:false,energy:{day:'',used:0},school:{day:'',runs:0,examWeek:''},settings:{daily:15,lenient:true,sendWritten:true},
  keyItems:[],reading:{active:null,scroll:false,done:[],results:{},tries:{}},written:[],tampered:false}}
/* Save encoding: base64 of the JSON plus a checksum. This stops casual editing in the browser's dev tools
   (the text is unreadable, and any edit breaks the checksum, which the parent panel then reports).
   It is NOT real security: a determined person could still decode it. */
const SAVE_SALT='wsq·字灵·v1';
function fnv(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}
function b64enc(s){const b=new TextEncoder().encode(s);let bin='';for(let i=0;i<b.length;i+=0x8000)bin+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(bin)}
function b64dec(s){const bin=atob(s);const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return new TextDecoder().decode(b)}
function encodeSave(obj){const body=b64enc(JSON.stringify(obj));return 'WSQ1.'+body+'.'+fnv(SAVE_SALT+body)}
function decodeSave(raw){
  if(!raw)return null;
  if(raw.startsWith('WSQ1.')){const [,body,sig]=raw.split('.');const obj=JSON.parse(b64dec(body));if(fnv(SAVE_SALT+body)!==sig)obj.tampered=true;return obj}
  if(raw.startsWith('{'))return JSON.parse(raw);   // older plain-JSON saves
  return null;
}
let profile=null;try{profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch(e){}
let LEVEL=profile?.level||null;
let S=freshState();
let saveBlocked=false,saveRecovery=null,storageWarning='';
function validateSave(obj,lvl){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('The save is not an object.');
  if(obj.version!=null&&obj.version>SAVE_VERSION)throw Error('This save was created by a newer game version.');
  if(obj.level&&obj.level!==lvl)throw Error('This save belongs to '+obj.level.toUpperCase()+', not '+lvl.toUpperCase()+'.');
  for(const k of ['lvl','xp','hp','coins'])if(obj[k]!=null&&(!Number.isFinite(obj[k])||obj[k]<0))throw Error('Invalid '+k+' value.');
  if(obj.words!=null&&(typeof obj.words!=='object'||Array.isArray(obj.words)))throw Error('Invalid word progress.');
  return obj;
}
function loadSave(lvl){
  S=freshState();
  saveBlocked=false;saveRecovery=null;storageWarning='';
  try{let raw=localStorage.getItem(saveKey(lvl));
    if(!raw&&lvl==='p5')raw=localStorage.getItem(LEGACY_KEY);   // carry over the first prototype's save
    const obj=raw?validateSave(decodeSave(raw),lvl):null;if(obj)S=obj
  }catch(e){
    console.error(e);saveBlocked=true;storageWarning=e.message||'The save could not be read.';
    try{const raw=localStorage.getItem(saveKey(lvl))||localStorage.getItem(LEGACY_KEY);if(raw){saveRecovery=raw;localStorage.setItem(recoveryKey(lvl),raw)}}catch(x){}
  }
  migrate();
}
const today=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const weekKey=()=>{const d=new Date();const t=new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7));return t.getFullYear()+'-'+(t.getMonth()+1)+'-'+t.getDate()};
const daysSince=day=>{if(!day)return 999;const [y,m,d]=day.split('-').map(Number);return Math.floor((new Date().setHours(0,0,0,0)-new Date(y,m-1,d).getTime())/864e5)};
function energyLeft(){if(S.energy.day!==today())S.energy={day:today(),used:0};return S.settings.daily?Math.max(0,S.settings.daily-S.energy.used):Infinity}
// bring any older save (or a state carried over from a previous version of the page) up to date
function migrate(){const f=freshState();for(const k in f){if(S[k]==null)S[k]=f[k]}
  S.stats=Object.assign(f.stats,S.stats);S.settings=Object.assign(freshState().settings,S.settings);
  S.school=Object.assign(freshState().school,S.school);S.reading=Object.assign(freshState().reading,S.reading);
  S.version=SAVE_VERSION;S.level=LEVEL;S.contentVersion=CONTENT_VERSION;
  Object.values(S.words||{}).forEach(s=>{if(s.revInterval==null)s.revInterval=REVIEW_DAYS})}
if(LEVEL)loadSave(LEVEL);
try{if(window.claude?.hot?.data?.S&&window.claude.hot.data.LEVEL===LEVEL){S=window.claude.hot.data.S;migrate()}}catch(e){}
// run a step without letting one error freeze the game
function safe(fn,fallback){try{return fn()}catch(e){console.error(e);if(fallback)fallback()}}
try{window.claude?.hot?.snapshot?.(()=>({S,LEVEL}))}catch(e){}
function save(){
  if(!LEVEL||saveBlocked)return false;
  try{
    S.version=SAVE_VERSION;S.level=LEVEL;S.contentVersion=CONTENT_VERSION;
    const key=saveKey(LEVEL),previous=localStorage.getItem(key);
    if(previous)try{validateSave(decodeSave(previous),LEVEL);localStorage.setItem(backupKey(LEVEL),previous)}catch(e){}
    localStorage.setItem(key,encodeSave(S));storageWarning='';return true;
  }catch(e){storageWarning='Progress could not be saved. Export a copy from the Parent Panel.';console.error(e);return false}
}
setInterval(()=>{if(LEVEL){S.playMs+=5000;save()}},5000);
const maxHp=()=>18+S.lvl*2;
function ws(w){
  const s=S.words[w]||(S.words[w]={c:0,st:{},ld:{},r:0,x:0,rev:null,revInterval:REVIEW_DAYS});
  s.ld=s.ld||{};if(s.revInterval==null)s.revInterval=REVIEW_DAYS;SK.forEach(k=>{if(s.st[k]==null)s.st[k]=0});return s;
}
const starsOf=w=>{const s=S.words[w];if(!s)return 0;return SK.filter(k=>(s.st[k]||0)>=2).length};
const tierOf=w=>{const s=S.words[w];if(!s||!s.c)return null;const n=starsOf(w);return n===5?'gold':n>=3?'silver':'bronze'};
const isResting=w=>{const s=S.words[w];return tierOf(w)==='gold'&&daysSince(s.rev)<(s.revInterval||REVIEW_DAYS)};
const silverCount=()=>WORDS.filter(w=>{const t=tierOf(w.w);return t==='silver'||t==='gold'}).length;
const collectedCount=()=>WORDS.filter(w=>S.words[w.w]?.c).length;
const hasLantern=()=>S.keyItems.includes('cave-lantern');
const gateSilverRequired=()=>Math.ceil(WORDS.length*GATE_SILVER_PCT);
const gateOpen=()=>S.gateTest||(silverCount()>=gateSilverRequired()&&hasLantern());
function record(word,skill,ok,bid){
  const st=S.stats[skill]||S.stats.x; st[1]++; if(ok)st[0]++;
  if(!word)return;
  const s=ws(word);
  // A star needs two correct answers in that skill on two DIFFERENT DAYS (at most one tick per skill per day).
  if(ok){s.r++; if(SK.includes(skill) && s.ld[skill]!==today() && s.st[skill]<2){const was=tierOf(word);s.st[skill]++; s.ld[skill]=today(); if(tierOf(word)==='gold'&&was!=='gold'){s.rev=today();s.revInterval=REVIEW_DAYS}}}
  else {
    s.x++;
    if(SK.includes(skill)&&tierOf(word)==='gold'&&!isResting(word)){
      s.st[skill]=Math.max(0,(s.st[skill]||0)-1);s.rev=null;s.revInterval=REVIEW_DAYS;
      if(B?.review&&B.word?.w===word)B.reviewFailed=true;
    }
  }
}
function recordChar(ch,helped,bid){
  const c=S.chars[ch]||(S.chars[ch]={lv:0,n:0,help:0,lb:-1});
  c.n++;c.help=(c.help||0)+(helped?1:0);
  if(!helped&&c.lb!==bid&&c.lv<2){c.lv++;c.lb=bid}
  else if(helped&&c.lv>0){c.lv--}
}
const charLv=ch=>S.chars[ch]?.lv||0;
function gainXp(n){S.xp+=n;let levels=0;while(S.xp>=S.lvl*30){S.xp-=S.lvl*30;S.lvl++;levels++;S.hp=maxHp()}refreshHud();return levels}

/* ================= map ================= */
const map=[];
function hash(x,y){let h=x*374761393+y*668265263;h=(h^(h>>>13))*1274126177;return ((h^(h>>>16))>>>0)%100}
var BUILDINGS,NPCS,SIGNS,QUESTION_VILLAGERS;
function defineWorld(){
  BUILDINGS=[
    {id:'school',n:'School',x:13,y:8,w:5,h:3,dx:15,roof:'#2F6F8F'},
    {id:'inn',n:'Inn',x:22,y:8,w:5,h:3,dx:24,roof:'#8E3B2E'},
    {id:'shop',n:'Shop',x:22,y:17,w:5,h:3,dx:24,roof:'#3F7A4A'},
    {id:'hall',n:'Reading Hall',x:14,y:18,w:5,h:3,dx:16,roof:'#6B4E8E'}
  ];
  NPCS=[
    {id:'teller',x:17,y:14,n:'Storyteller',c:'#7A4E9C'},
    {id:'guard',x:21,y:5,n:'Gatekeeper',c:'#8E3B2E'},
    {id:'grandma',x:26,y:14,n:'Grandma Wang',c:'#C9804B'},
    {id:'xiaoqiang',x:18,y:11,n:'Xiaoqiang',c:'#D98A3A'},
    {id:'lin',x:26,y:12,n:'Mr Lin',c:'#4A6FA5'},
    {id:'mei',x:27,y:20,n:'Chef Mei',c:'#E8E1D0'},
    {id:'dong',x:13,y:13,n:'Ah Dong',c:'#3F7A4A'}
  ];
  // the order in which a passage's questions are handed out to villagers (up to 7 questions)
  QUESTION_VILLAGERS=['grandma','teller','xiaoqiang','lin','mei','dong','guard'];
  SIGNS=[
    {x:12,y:15,t:'← Camping Forest · Lesson 1 words'},
    {x:28,y:15,t:'Misty Path · Lesson 2 words →'},
    {x:21,y:22,t:'↓ Kitchen Garden · Lesson 3 words'},
    {x:19,y:5,t:'↑ Muddle Cave · home of the Muddle King'}
  ];
}
defineWorld();
(function(){
  for(let y=0;y<MH;y++){map.push(new Array(MW).fill('.'))}
  const rect=(x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)map[j][i]=c};
  rect(0,0,MW,5,'T'); rect(17,1,7,3,'.');
  for(let i=0;i<MW;i++){map[MH-1][i]='T'}
  for(let j=0;j<MH;j++){map[j][0]='T';map[j][MW-1]='T';map[j][1]='T';map[j][MW-2]='T'}
  rect(2,6,10,MH-8,'a'); rect(29,6,MW-31,MH-8,'b'); rect(13,23,15,MH-25,'c');
  for(let y=5;y<MH-1;y++)for(let x=2;x<MW-2;x++){const c=map[y][x];if((c==='a'||c==='b')&&hash(x,y)<11)map[y][x]='T';if(c==='c'&&hash(x,y)<5)map[y][x]='T'}
  rect(2,5,36,1,'.');
  for(let x=1;x<MW-1;x++)map[16][x]='=';
  for(let y=2;y<MH-1;y++)map[y][20]='=';
  map[4][20]='G'; map[1][20]='K'; map[1][19]='R'; map[1][21]='R';
  BUILDINGS.forEach(b=>{rect(b.x,b.y,b.w,b.h,'B');map[b.y+b.h-1][b.dx]='D'});
  for(let y=11;y<16;y++){map[y][15]='=';map[y][24]='='}
  rect(13,22,3,1,'~');
  NPCS.forEach(n=>map[n.y][n.x]='N');
  SIGNS.forEach(s=>map[s.y][s.x]='S');
})();
const zoneAt=(x,y)=>{const c=map[y][x];if(ZONES[c])return c;if(x<12&&y>5)return'a';if(x>28&&y>5)return'b';if(y>22)return'c';return null};

/* ================= rendering ================= */
const cv=$('#cv'),g=cv.getContext('2d');
let P={x:S.x,y:S.y,px:S.x*TS,py:S.y*TS,moving:false,dir:S.dir,step:0};
let tick=0;
function drawTile(c,x,y,sx,sy){
  const h=hash(x,y);
  const zone=zoneAt(x,y);
  let base=zone==='b'?'#8FA88C':zone==='c'?'#9CC46A':zone==='a'?'#5E9B55':'#7DBA6A';
  if(y<5)base='#5E9B55';
  g.fillStyle=base;g.fillRect(sx,sy,TS,TS);
  if(c==='.'&&h<18){g.fillStyle=zone?'rgba(0,0,0,.08)':'rgba(255,255,255,.18)';g.fillRect(sx+(h%5)*6,sy+(h%7)*4,3,3)}
  if(c==='.'&&!zone&&y>5&&h>94){g.fillStyle=h%2?'#F2C94C':'#F29FB0';g.beginPath();g.arc(sx+16,sy+16,3,0,7);g.fill()}
  if(c==='='){g.fillStyle='#D9C08A';g.fillRect(sx,sy,TS,TS);g.fillStyle='rgba(120,90,40,.18)';g.fillRect(sx+(h%6)*5,sy+(h%4)*7,4,3)}
  if(c==='a'||c==='b'||c==='c'){
    const col=c==='a'?['#2F6B35','#3E8243']:c==='b'?['#5E6E7E','#77879A']:['#4E8A2E','#6BA83E'];
    const sway=Math.sin((tick+h*7)/30)*1.5;
    for(let k=0;k<3;k++){const ox=sx+4+k*9+sway,oy=sy+10+(k%2)*8;
      g.fillStyle=col[k%2];g.beginPath();g.moveTo(ox,oy+14);g.lineTo(ox+3,oy);g.lineTo(ox+6,oy+14);g.fill();
      g.beginPath();g.moveTo(ox+3,oy+14);g.lineTo(ox+8,oy+3);g.lineTo(ox+9,oy+14);g.fill()}
    if(c==='c'&&h%4===0){g.fillStyle='#3E7A22';g.fillRect(sx+22,sy+6,5,14);g.fillStyle='#5DA03A';g.fillRect(sx+21,sy+8,7,4)}
  }
  if(c==='~'){g.fillStyle='#4F8FB8';g.fillRect(sx,sy,TS,TS);g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=2;const o=(tick/8+h)%TS;g.beginPath();g.moveTo(sx+4,sy+(o%20)+6);g.lineTo(sx+14,sy+(o%20)+6);g.stroke()}
  if(c==='T'){
    g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(sx+16,sy+27,12,4,0,0,7);g.fill();
    g.fillStyle='#6B4A2B';g.fillRect(sx+13,sy+18,6,10);
    const dark=zone==='b'?'#4D6159':'#2D6A36',light=zone==='b'?'#6C8378':'#3F8B47';
    g.fillStyle=dark;g.beginPath();g.arc(sx+16,sy+13,12,0,7);g.fill();
    g.fillStyle=light;g.beginPath();g.arc(sx+12,sy+10,6,0,7);g.fill();
  }
  if(c==='R'){g.fillStyle='#6E6A64';g.beginPath();g.arc(sx+16,sy+18,14,0,7);g.fill()}
}
function drawBuilding(b,ox,oy){
  const sx=b.x*TS-ox, sy=b.y*TS-oy, w=b.w*TS, h=b.h*TS;
  g.fillStyle='#EDE3CC';g.fillRect(sx+4,sy+22,w-8,h-22);
  g.fillStyle='#B8A47E';for(let i=0;i<b.w;i++){g.fillRect(sx+i*TS+10,sy+40,12,12)}
  // curved roof
  g.fillStyle=b.roof;g.beginPath();g.moveTo(sx-6,sy+30);g.quadraticCurveTo(sx+10,sy+22,sx+14,sy+4);g.lineTo(sx+w-14,sy+4);g.quadraticCurveTo(sx+w-10,sy+22,sx+w+6,sy+30);g.closePath();g.fill();
  g.fillStyle='rgba(0,0,0,.18)';for(let i=0;i<6;i++)g.fillRect(sx+12+i*((w-24)/6),sy+8,2,18);
  // door
  const dx=b.dx*TS-ox;g.fillStyle='#6B3A22';g.fillRect(dx+7,sy+h-26,18,26);
  // plaque
  g.font='700 15px "Baloo 2", sans-serif';const pw=Math.min(w-8,g.measureText(b.n).width+16);g.fillStyle='#1B2430';g.fillRect(sx+w/2-pw/2,sy+30,pw,18);g.fillStyle='#E2B23C';g.textAlign='center';g.textBaseline='middle';g.fillText(b.n,sx+w/2,sy+40);
}
function drawPerson(sx,sy,col,dir,step,hat){
  const bob=step?Math.sin(step*Math.PI)*2:0;
  g.fillStyle='rgba(0,0,0,.2)';g.beginPath();g.ellipse(sx+16,sy+29,9,3,0,0,7);g.fill();
  g.fillStyle=col;g.fillRect(sx+9,sy+15-bob,14,12);
  g.fillStyle='#2A2A2A';g.fillRect(sx+10,sy+26-bob,4,3);g.fillRect(sx+18,sy+26-bob,4,3);
  g.fillStyle='#F2CFA6';g.beginPath();g.arc(sx+16,sy+10-bob,7,0,7);g.fill();
  g.fillStyle='#2B2118';g.beginPath();g.arc(sx+16,sy+8-bob,7,Math.PI,0);g.fill();
  if(dir!=='up'){g.fillStyle='#1B2430';const ex=dir==='left'?-2:dir==='right'?2:0;g.fillRect(sx+12+ex,sy+10-bob,2,2);g.fillRect(sx+18+ex,sy+10-bob,2,2)}
  if(hat){g.fillStyle=HATS[hat].c;if(hat==='bamboo'){g.beginPath();g.moveTo(sx+4,sy+6-bob);g.lineTo(sx+16,sy-3-bob);g.lineTo(sx+28,sy+6-bob);g.fill()}else if(hat==='crown'){g.fillRect(sx+10,sy+1-bob,12,4);g.beginPath();g.moveTo(sx+10,sy+1-bob);g.lineTo(sx+12,sy-4-bob);g.lineTo(sx+16,sy+1-bob);g.lineTo(sx+20,sy-4-bob);g.lineTo(sx+22,sy+1-bob);g.fill()}else{g.beginPath();g.arc(sx+16,sy+5-bob,7,Math.PI,0);g.fill();g.fillRect(sx+16,sy+4-bob,10,2)}}
}
function render(){
  tick++;
  const ox=Math.max(0,Math.min(MW*TS-VW*TS,P.px-7*TS)), oy=Math.max(0,Math.min(MH*TS-VH*TS,P.py-5*TS));
  const tx0=Math.floor(ox/TS),ty0=Math.floor(oy/TS);
  for(let y=ty0;y<=ty0+VH&&y<MH;y++)for(let x=tx0;x<=tx0+VW&&x<MW;x++){
    const c=map[y][x];drawTile(['B','D','N','S','G','K'].includes(c)?'.':c,x,y,x*TS-ox,y*TS-oy);
    const sx=x*TS-ox,sy=y*TS-oy;
    if(c==='S'){g.fillStyle='#6B4A2B';g.fillRect(sx+14,sy+16,4,14);g.fillStyle='#C9A45C';g.fillRect(sx+5,sy+6,22,13);g.fillStyle='#6B4A2B';g.fillRect(sx+8,sy+10,16,2);g.fillRect(sx+8,sy+14,12,2)}
    if(c==='G'){const open=gateOpen();g.fillStyle='#8E3B2E';g.fillRect(sx+2,sy+2,4,30);g.fillRect(sx+26,sy+2,4,30);g.fillStyle='#1B2430';g.fillRect(sx-2,sy,36,6);if(!open){g.fillStyle='#6B4A2B';for(let i=0;i<4;i++)g.fillRect(sx+7+i*5,sy+8,3,22);g.fillStyle='#E2B23C';g.fillRect(sx+13,sy+16,6,6)}}
    if(c==='K'){g.fillStyle='#6E6A64';g.beginPath();g.arc(sx+16,sy+22,20,Math.PI,0);g.fill();g.fillStyle='#111';g.beginPath();g.arc(sx+16,sy+30,11,Math.PI,0);g.fill();g.fillRect(sx+5,sy+30,22,2);if(S.boss){g.fillStyle='#E2B23C';g.fillRect(sx+13,sy+4,6,6)}}
  }
  BUILDINGS.forEach(b=>drawBuilding(b,ox,oy));
  NPCS.forEach(n=>{const sx=n.x*TS-ox,sy=n.y*TS-oy;drawPerson(sx,sy,n.c,'down',0,n.id==='guard'?'red':null);
    if(pendingFor(n.id)!=null){const bob=Math.sin(tick/12)*2;g.fillStyle='#FFFFFF';g.strokeStyle='#1B2430';g.lineWidth=2;g.beginPath();g.arc(sx+16,sy-10+bob,8,0,7);g.fill();g.stroke();g.fillStyle='#C63F2B';g.font='700 13px "Baloo 2", sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('?',sx+16,sy-9+bob)}});
  drawPerson(P.px-ox,P.py-oy,'#2F6F8F',P.dir,P.moving?P.step:0,S.hat);
  const z=zoneAt(P.x,P.y);
  if(z==='b'){g.fillStyle='rgba(220,220,235,'+(0.16+Math.sin(tick/60)*.05)+')';g.fillRect(0,0,cv.width,cv.height)}
}

/* ================= movement ================= */
const keys={};let held=null;let locked=false;let encounterCooldown=4;let lastZone=null;
const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
addEventListener('keydown',e=>{const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',W:'up',S:'down',A:'left',D:'right'}[e.key];if(k&&$('#ov').hidden){held=k;e.preventDefault()}});
addEventListener('keyup',e=>{held=null});
const joystick=$('#joystick'),joystickKnob=$('#joystickKnob');
function moveJoystick(e){
  const r=joystick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),distance=Math.hypot(dx,dy),limit=42,scale=distance>limit?limit/distance:1;
  joystickKnob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
  held=distance<14?null:Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
}
joystick.addEventListener('pointerdown',e=>{GameAudio.unlock();joystick.classList.add('active');joystick.setPointerCapture(e.pointerId);moveJoystick(e)});
joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))moveJoystick(e)});
function releaseJoystick(){held=null;joystick.classList.remove('active');joystickKnob.style.transform='translate(0,0)'}
joystick.addEventListener('pointerup',releaseJoystick);joystick.addEventListener('pointercancel',releaseJoystick);joystick.addEventListener('lostpointercapture',releaseJoystick);
const solid=c=>['T','~','B','R','N','S','D','G','K'].includes(c);
function tryMove(d){
  P.dir=d;const [dx,dy]=DIRS[d];const nx=P.x+dx,ny=P.y+dy;
  if(nx<0||ny<0||nx>=MW||ny>=MH)return;
  const c=map[ny][nx];
  if(c==='G'&&gateOpen()){startMoveTo(nx,ny);return}
  if(solid(c)){held=null;bump(c,nx,ny);return}
  startMoveTo(nx,ny);
}
function startMoveTo(nx,ny){P.moving=true;P.tx=nx;P.ty=ny;P.step=0}
function update(){
  if(!$('#ov').hidden){render();return}
  if(P.moving){
    P.step+=0.125;
    P.px=(P.x+(P.tx-P.x)*P.step)*TS;P.py=(P.y+(P.ty-P.y)*P.step)*TS;
    if(P.step>=1){P.x=P.tx;P.y=P.ty;P.px=P.x*TS;P.py=P.y*TS;P.moving=false;S.x=P.x;S.y=P.y;S.dir=P.dir;arrived()}
  } else if(held){tryMove(held)}
  render();
}
function arrived(){
  const z=zoneAt(P.x,P.y);
  if(z!==lastZone){lastZone=z;toast(z?ZONES[z].n+' · Lesson '+ZONES[z].l:'Scholar Village')}
  const c=map[P.y][P.x];
  if(ZONES[c]){encounterCooldown--;if(encounterCooldown<=0&&Math.random()<.16){encounterCooldown=3;held=null;
    if(energyLeft()<=0){if(!warnedTired){warnedTired=true;dialog('Grandma Wang',[`The creatures have all gone to sleep for today. You've had ${S.settings.daily} battles, which is plenty of practice!`,'Your spirits need a rest too. Stars fill up best when you practise on different days, so come back tomorrow!','You can still read stories, take a quiz at the School, or look through your Spirit Book.'])}else toast('The creatures are asleep. Come back tomorrow!');return}
    if(!pickWord(c)){toast(ZONES[c].n+' is peaceful. All its spirits are Gold and resting!');return}
    startBattle(c)}}
}
let warnedTired=false;
let toastT;function toast(t){const el=$('#toast');el.textContent=t;el.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>el.style.opacity=0,1800)}
function loop(){update();requestAnimationFrame(loop)}

/* ================= overlay helpers ================= */
const ov=$('#ov');
function openOv(html,dim){stopSpeaking();ov.className='overlay'+(dim?' dim':'');ov.innerHTML=html;ov.hidden=false;held=null;ov.scrollTop=0}
function closeOv(){stopSpeaking();GameAudio.setScene('village');ov.hidden=true;ov.innerHTML='';refreshHud();save()}
function dialog(who,lines,buttons){
  let i=0;
  const show=()=>{
    const last=i===lines.length-1;
    openOv(`<div class="dialog"><div class="who">${esc(who)}</div><p>${lines[i]}</p><div class="row" id="dlgBtns"></div></div>`,true);
    const box=$('#dlgBtns');
    const btns=last&&buttons?buttons:[{t:last?'OK':'Next ▸',f:()=>{if(last)closeOv();else{i++;show()}}}];
    btns.forEach(b=>{const el=document.createElement('button');el.className='btn'+(b.cls?' '+b.cls:'');el.textContent=b.t;el.onclick=b.f;box.appendChild(el)});
    box.firstChild?.focus();
  };show();
}
function showLevelUp(levels,onContinue=closeOv){
  if(!levels)return onContinue();
  GameAudio.sfx('level');
  const from=S.lvl-levels;
  openOv(`<div class="panel reveal" style="justify-content:center">
    <div class="level-burst" aria-label="Level up">LEVEL UP!</div>
    <h2 style="margin:0">Level ${from} → ${S.lvl}</h2>
    <p class="msg">Your maximum HP increased to <b>${maxHp()}</b>, and your HP is fully restored.</p>
    ${levels>1?`<p class="sub">Amazing — you gained ${levels} levels at once!</p>`:''}
    <div class="row"><button class="btn jade" id="levelContinue">Continue</button></div></div>`);
  const b=$('#levelContinue');b.onclick=()=>{b.disabled=true;onContinue()};b.focus();
}
function objectiveText(){
  if(!S.seenIntro)return 'Meet Grandma Wang in Scholar Village.';
  if(!S.reading.scroll)return 'Read a passage in the Reading Hall to begin earning the Cave Lantern.';
  const p=activePassage();
  if(p&&Object.keys(S.reading.results).length<p.qs.length)return `Answer the villagers’ passage questions: ${Object.keys(S.reading.results).length}/${p.qs.length}.`;
  if(!hasLantern())return 'Finish the current passage to earn the Cave Lantern.';
  if(!gateOpen())return `Raise ${gateSilverRequired()-silverCount()} more spirits to Silver for the Muddle Cave gate.`;
  if(!S.boss)return 'The Muddle Cave gate is open. Challenge the Muddle King!';
  return 'Region 1 is clear. Keep turning spirits Gold while the next region is built.';
}
function refreshHud(){
  $('#hLv').textContent=S.lvl;$('#hXp').style.width=(S.xp/(S.lvl*30)*100)+'%';
  $('#hXpT').textContent=`${S.xp}/${S.lvl*30} XP`;
  $('#hHp').style.width=(S.hp/maxHp()*100)+'%';$('#hHpT').textContent=S.hp+'/'+maxHp();
  $('#hCoin').textContent=S.coins;$('#hSp').textContent=collectedCount();
  const e=energyLeft();$('#hEn').textContent=e===Infinity?'∞':e;
  $('#objectiveText').textContent=objectiveText();
  const audioButton=$('#bAudio');if(audioButton){const on=GameAudio.isEnabled();audioButton.textContent=on?'Sound on':'Sound off';audioButton.setAttribute('aria-pressed',String(on))}
}

/* ================= interactions ================= */
function bump(c,x,y){
  if(c==='D'){const b=BUILDINGS.find(b=>b.dx===x&&b.y+b.h-1===y);if(b)enterBuilding(b.id);return}
  if(c==='S'){const s=SIGNS.find(s=>s.x===x&&s.y===y);dialog('Sign',[esc(s.t)]);return}
  if(c==='N'){const n=NPCS.find(n=>n.x===x&&n.y===y);talk(n);return}
  if(c==='G'){talk(NPCS.find(n=>n.id==='guard'));return}
  if(c==='K'){if(S.boss)dialog('Muddle Cave',['The cave is quiet. You already beat the Muddle King!']);else bossIntro();return}
}
function talk(n){
  const pq=pendingFor(n.id);if(pq!=null)return offerPassageQ(n,pq);
  if(n.id==='guard'){
    const sc=silverCount(),need=gateSilverRequired(),pct=Math.round(sc/WORDS.length*100);
    if(gateOpen())dialog('Gatekeeper',['Your spirits are strong! The gate is open.','The Muddle King waits in the cave to the north. Good luck!']);
    else dialog('Gatekeeper',[`The Muddle King is tough. I can only open the gate when <b>${Math.round(GATE_SILVER_PCT*100)}%</b> of this region's spirits are Silver or better, and you have the <b>Cave Lantern</b>.`,`Silver or better: <b>${sc}/${WORDS.length} (${pct}%)</b>. Need: <b>${need}</b>. Cave Lantern: <b>${hasLantern()?'yes':'not yet'}</b>.`,`Every spirit has five stars: Meaning, Pinyin, Hanzi, Usage and Writing. Get a skill right on two different days to fill its star. Three stars turns a spirit Silver.`]);
  }
  if(n.id==='teller')storyMenu();
  if(n.id==='xiaoqiang')dialog('Xiaoqiang',['My treasure? It was a pork rib! Hee hee.','Have you been to the <b>Reading Hall</b>? When you read a passage there, we villagers each ask you a question about it.']);
  if(n.id==='lin')dialog('Mr Lin',['Has anyone seen my glasses? …Oh. They\'re on my head again.','Remember to rest your eyes when you read!']);
  if(n.id==='mei')dialog('Chef Mei',['Salt or sugar, salt or sugar… I always mix them up!','Collect the Lesson 3 food words for me, will you?']);
  if(n.id==='dong')dialog('Ah Dong',['I\'m collecting word spirits too. Bet I get more than you!','Let\'s see who reaches Gold first.']);
  if(n.id==='grandma')dialog('Grandma Wang',['Every creature in the tall grass has a word spirit sealed inside it.','Each attack tests a different part of the word: its meaning, its pinyin, its characters, how to use it, or writing it yourself.','Check the creature\'s <b>weak spot</b>. The matching attack does extra damage!','Be careful: creatures attack back after every turn, and some cast spells you have to answer to block. Rest at the Inn when your HP is low.']);
}

/* ================= Reading Hall: one passage, questions spread across villagers ================= */
const COMP=DATA.comp;
const STANDARD_COMP=COMP.filter(p=>p.sub!=='Higher Chinese');
const HIGHER_COMP=COMP.filter(p=>p.sub==='Higher Chinese');
const activePassage=()=>S.reading.active?COMP.find(p=>p.id===S.reading.active):null;
function pendingFor(vid){
  const p=activePassage();if(!p||!S.reading.scroll)return null;
  for(let i=0;i<p.qs.length;i++){if(QUESTION_VILLAGERS[i]===vid&&!S.reading.results[i])return i}
  return null;
}
const vname=id=>NPCS.find(n=>n.id===id)?.n||id;
function markAllWords(text){
  const words=WORDS.map(w=>w.w).sort((a,b)=>b.length-a.length);
  const re=new RegExp(words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
  return esc(text).replace(re,m=>`<span class="vw" data-w="${m}">${m}</span>`);
}
function passageHTML(p){return p.text.split(/\n+/).filter(x=>x.trim()).map(x=>`<p>${markAllWords(x)}</p>`).join('')}
function bindWordPops(root,popId){
  root.querySelectorAll('.vw').forEach(el=>el.onclick=()=>{const W=WMAP[el.dataset.w];const pop=root.querySelector('#'+popId);if(pop)pop.innerHTML=`<div class="pop"><span class="hz">${esc(W.w)}</span><span>${esc(W.p)}</span><span>${esc(W.m)}</span><button class="speak" style="color:var(--paper);border-color:var(--paper)" onclick="speak('${W.w}',this)">Hear it</button></div>`});
}
function enterHall(){
  let p=activePassage();
  if(!p){
    const left=STANDARD_COMP.filter(x=>!S.reading.done.includes(x.id));
    p=pick(left.length?left:STANDARD_COMP);
    S.reading={...S.reading,active:p.id,scroll:false,results:{},tries:{}};save();
  }
  showPassage(p);
}
function showPassage(p){
  const r=S.reading;const n=p.qs.length;const answered=Object.keys(r.results).length;
  openOv(`<div class="panel"><div class="phead"><h2>Reading Hall</h2><button class="close" id="x" aria-label="Close">✕</button></div>
    <p class="msg">${r.scroll?`Your passage scroll. <b>${answered}/${n}</b> questions answered. Villagers with a <b style="color:var(--seal)">?</b> above their heads have a question for you. You can come back and re-read this any time.`:
      `Librarian: "Here's today's passage. Read it carefully! Afterwards, ${n} villagers will each ask you <b>one</b> question about it. Tap a highlighted word to see its meaning."`}</p>
    <div class="story rh-text"><h3 style="margin:0 0 6px;font-size:20px">${esc(p.title)}</h3>${passageHTML(p)}</div><div id="rpop"></div>
    <div class="rh-list">${p.qs.map((q,i)=>`<span class="rh-chip ${r.results[i]?'done':''}">${r.results[i]?'✓':'?'} ${esc(vname(QUESTION_VILLAGERS[i]))}</span>`).join('')}</div>
    <div class="row"><button class="btn alt" id="rd">Read aloud</button>${HIGHER_COMP.length?'<button class="btn alt" id="hc">Higher Chinese challenge</button>':''}<button class="btn" id="ok">${r.scroll?'Close':'I\'ve read it'}</button></div></div>`);
  bindWordPops(ov,'rpop');
  $('#x').onclick=closeOv;$('#rd').onclick=e=>speak(p.text.replace(/\s+/g,''),e.currentTarget);
  if($('#hc'))$('#hc').onclick=showHigherChineseChallenge;
  $('#ok').onclick=()=>{if(!r.scroll){S.reading.scroll=true;save();dialog('Librarian',[`Here's your passage scroll. It's in your bag, and you can open it from any question.`,`Now go and find ${p.qs.map((q,i)=>vname(QUESTION_VILLAGERS[i])).join(', ')}. They'll each ask you one question.`,hasLantern()?'Finish them all to earn a reward!':'Finish them all and the villagers will give you the <b>Cave Lantern</b>. You need it to enter the Muddle Cave!'])}else closeOv()};
}
function showHigherChineseChallenge(){
  const p=pick(HIGHER_COMP);if(!p)return;
  openOv(`<div class="panel"><div class="phead"><h2>Higher Chinese Challenge</h2><button class="close" id="x" aria-label="Back">✕</button></div>
    <p class="msg">Optional challenge — this does not affect the Cave Lantern or any gate.</p>
    <div class="story rh-text"><h3 style="margin:0 0 6px;font-size:20px">${esc(p.title)}</h3>${passageHTML(p)}</div><div id="rpop"></div>
    <div class="row"><button class="btn alt" id="rd">Read aloud</button><button class="btn" id="back">Back to Reading Hall</button></div></div>`);
  bindWordPops(ov,'rpop');$('#x').onclick=enterHall;$('#back').onclick=enterHall;$('#rd').onclick=e=>speak(p.text.replace(/\s+/g,''),e.currentTarget);
}
function offerPassageQ(n,i){
  const p=activePassage();
  dialog(n.n,[`I heard you read <b>${esc(p.title)}</b> at the Reading Hall. Can I ask you a question about it?`],[{t:'Answer',f:()=>askPassageQ(i)},{t:'Later',cls:'alt',f:closeOv}]);
}
const normAns=s=>String(s).replace(/[\s，。！？、；：“”‘’"'.,!?()（）《》]/g,'');
function askPassageQ(i){
  const p=activePassage();const q=p.qs[i];const vid=QUESTION_VILLAGERS[i];const tries=S.reading.tries[i]||0;
  const ctx=(q.ctx||'').split('\n').filter(l=>!l.startsWith('评分')).join('<br>');
  openOv(`<div class="panel"><div class="phead"><h2>${esc(vname(vid))} asks…</h2><button class="close" id="x" aria-label="Later">✕</button></div>
    <p class="sub">${esc(p.title)} · question ${i+1} of ${p.qs.length}</p>
    <details class="rh-scroll" ${tries?'open':''}><summary>Open the passage scroll</summary><div class="passage" style="max-height:220px">${passageHTML(p)}</div><div id="qpop"></div></details>
    <p class="q">${fmtQ(q.q)}</p>${ctx?`<p class="sub">${esc(ctx).replace(/&lt;br&gt;/g,'<br>')}</p>`:''}
    <div id="qa"></div><div id="fb"></div></div>`);
  bindWordPops(ov,'qpop');
  $('#x').onclick=closeOv;
  const qa=$('#qa'),fb=$('#fb');
  const finish=(how,shown)=>{
    S.reading.results[i]={how,day:today()};S.stats.c[1]++;if(how==='right'||how==='got')S.stats.c[0]++;
    const coins={right:10,got:10,partly:6,help:3}[how];S.coins+=coins;const xp=how==='help'?2:5,up=gainXp(xp);save();refreshHud();
    fb.innerHTML=`<div class="feedback ${how==='help'?'bad':'good'}"><b>${{right:'Correct! Well read.',got:'Great! You matched the model answer.',partly:'Good try! Remember the parts you missed.',help:'That\'s OK. Now you know where the answer is.'}[how]}</b>
      ${shown?`<div>Answer: <b>${esc(shown)}</b></div>`:''}<div class="sub">+${coins} coins · +${xp} XP</div><div class="row"><button class="btn" id="fbGo">Next ▸</button></div></div>`;
    qa.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=true);
    const go=$('#fbGo');go.focus();go.onclick=()=>{go.disabled=true;safe(()=>up?showLevelUp(up,afterPassageAnswer):afterPassageAnswer(),closeOv)};
  };
  const retry=msg=>{S.reading.tries[i]=tries+1;save();fb.innerHTML=`<div class="feedback bad"><b>${msg}</b><div class="row"><button class="btn" id="fbGo">Try again</button></div></div>`;qa.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=true);$('#fbGo').onclick=()=>askPassageQ(i)};
  if(q.f==='mcq'){
    const opts=shuffle(q.o);
    qa.innerHTML=`<div class="opts long">${opts.map((o,k)=>`<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div><div class="row" style="margin-top:8px"><button class="btn alt" id="idk">I don't know</button></div>`;
    qa.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const ok=opts[+b.dataset.k]===q.c;
      if(ok){b.classList.add('right');finish(tries?'help':'right')}
      else{b.classList.add('wrong');if(tries<1)retry('Not quite. Look at the passage again and try once more.');else{qa.querySelectorAll('.opt').forEach(x=>{if(opts[+x.dataset.k]===q.c)x.classList.add('right')});finish('help',q.c)}}});
    $('#idk').onclick=()=>finish('help',q.c);
  } else if(q.f==='fill'){
    qa.innerHTML=`<div class="row"><input id="fillIn" class="rh-input" autocomplete="off" placeholder="Type your answer in Chinese"><button class="btn" id="chk">Check</button><button class="btn alt" id="idk">I don't know</button></div><p class="sub">Tip: use Chinese (pinyin) typing on your device.</p>`;
    const chk=()=>{const v=normAns($('#fillIn').value);if(!v)return;const ok=q.acc.some(a=>normAns(a)===v);
      if(ok)finish(tries?'help':'right',q.ans);else if(tries<1)retry('Not quite. Find the word in the passage and try again.');else finish('help',q.ans)};
    $('#chk').onclick=chk;$('#fillIn').onkeydown=e=>{if(e.key==='Enter')chk()};$('#idk').onclick=()=>finish('help',q.ans);
  } else {
    qa.innerHTML=`<textarea id="openIn" class="rh-input" rows="3" placeholder="Write your answer here, or on paper"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn" id="show">Show the model answer</button><button class="btn alt" id="idk">I don't know</button></div><div id="model"></div>`;
    $('#idk').onclick=()=>{logWritten(p,q,'',"didn't know");finish('help',q.ans)};
    $('#show').onclick=()=>{const typed=$('#openIn').value.trim();$('#show').disabled=true;$('#openIn').disabled=true;
      $('#model').innerHTML=`<div class="feedback good"><b>Model answer</b><div style="white-space:pre-line">${esc(q.ans)}</div>
        <p class="sub" style="margin:0">Compare it with your answer. How did you do?</p>
        <div class="row"><button class="btn jade" data-r="got">Got it</button><button class="btn alt" data-r="partly">Partly</button><button class="btn alt" data-r="not">Not yet</button></div></div>`;
      $('#model').querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const r=b.dataset.r;logWritten(p,q,typed,{got:'got it',partly:'partly',not:'not yet'}[r]);
        if(r==='not'&&tries<1){S.reading.tries[i]=1;save();closeOv();dialog(vname(vid),['That\'s OK! Read the passage again, then come back and try once more.']);return}
        $('#model').querySelectorAll('button').forEach(x=>x.disabled=true);finish(r==='not'?'help':r)})};
  }
}
function logWritten(p,q,typed,rating){if(!S.settings.sendWritten)return;S.written.unshift({day:today(),title:p.title,q:q.q,a:typed,ans:q.ans,rating});S.written=S.written.slice(0,30)}
function afterPassageAnswer(){
  const p=activePassage();
  if(Object.keys(S.reading.results).length<p.qs.length){closeOv();toast('Find the next villager with a ?');return}
  S.reading.done.push(p.id);S.reading.active=null;S.reading.scroll=false;S.coins+=30;
  const first=!hasLantern();if(first)S.keyItems.push('cave-lantern');else S.potions++;
  save();refreshHud();
  dialog('Grandma Wang',[`You answered every question about <b>${esc(p.title)}</b>. Wonderful reading!`,
    first?'The villagers made you a gift: the <b>Cave Lantern</b>! You need it to enter the dark Muddle Cave.':'Here are 30 coins and a Rice Ball. The Reading Hall has a new passage for you whenever you are ready.']);
}

/* ================= question generation ================= */
const TONES={a:'āáǎà',e:'ēéěè',i:'īíǐì',o:'ōóǒò',u:'ūúǔù','ü':'ǖǘǚǜ'};
function syl(s){for(const [v,t] of Object.entries(TONES)){for(let k=0;k<4;k++){if(s.includes(t[k]))return{base:s.replace(t[k],v),v,tone:k+1}}}
  const order=['a','o','e','i','u','ü'];for(const v of order){if(s.includes(v))return{base:s,v,tone:0}}return{base:s,v:null,tone:0}}
function withTone(s,tone){const q=syl(s);if(!q.v)return s;if(tone===0)return q.base;
  let v=q.v;if(q.base.includes('a'))v='a';else if(q.base.includes('o'))v='o';else if(q.base.includes('e'))v='e';else if(q.base.includes('iu'))v='u';else if(q.base.includes('ui'))v='i';
  return q.base.replace(v,TONES[v][tone-1])}
function pinyinVariants(py){
  const parts=py.split(' ');const out=new Set();let guard=0;
  while(out.size<3&&guard++<60){const p=parts.slice();const i=rnd(p.length);const cur=syl(p[i]).tone;let t=rnd(4)+1;if(t===cur)t=(t%4)+1;p[i]=withTone(p[i],t);if(parts.length>1&&Math.random()<.35){const j=(i+1)%p.length;const cj=syl(p[j]).tone;let t2=rnd(4)+1;if(t2===cj)t2=(t2%4)+1;p[j]=withTone(p[j],t2)}const s=p.join(' ');if(s!==py)out.add(s)}
  return [...out];
}
function others(word,n,filter){let pool=WORDS.filter(w=>w.w!==word.w&&(!filter||filter(w)));if(pool.length<n)pool=WORDS.filter(w=>w.w!==word.w);return shuffle(pool).slice(0,n)}
function mkOpts(correct,dist){const seen=new Set([correct]);const d=[];dist.forEach(x=>{if(x&&!seen.has(x)){seen.add(x);d.push(x)}});return shuffle([correct,...d.slice(0,3)])}
const EXAM_HINT={sentence:'Pick the best way to complete the sentence.',vocab:'Pick the word or character that fits the blank.',pinyin:'Pick the correct pinyin for the underlined word.',usage:'Which sentence uses the word correctly?',phrase:'Pick the meaning closest to the underlined word.',conj:'Pick the pair of joining words that fits.'};
function examQ(q,kind){
  kind=kind||q.k;
  const m=q.q.match(/以下哪一个句子是正确的？\s*[（(]词语：(.+?)[）)]/);
  if(m)return{prompt:`<p class="q">Which sentence uses <b style="font-size:1.2em">${esc(m[1])}</b> correctly?</p><p class="sub">Exam question</p>`,opts:shuffle(q.o),c:q.c,exam:true,long:true};
  const stem=q.q.replace(/\s*[（(]选出[^）)]*[）)]\s*/g,'');
  return{prompt:`<p class="q">${fmtQ(stem)}</p><p class="sub">${EXAM_HINT[kind]||''} · Exam question</p>`,opts:shuffle(q.o),c:q.c,exam:true}}
function makeQ(word,k){
  const W=word, E=EXAM[W.w]||{h:[],p:[],u:[]};
  if(k==='m'){
    const d=others(W,6).map(o=>o.m);
    return{prompt:`<div class="bigword">${esc(W.w)}</div><p class="q">What does this word mean?</p>`,opts:mkOpts(W.m,d),c:W.m}
  }
  if(k==='p'){
    if(E.p.length&&Math.random()<.5)return examQ(pick(E.p));
    const same=others(W,4,o=>o.p.split(' ').length===W.p.split(' ').length).map(o=>o.p);
    const d=pinyinVariants(W.p);while(d.length<3)d.push(same.shift());
    return{prompt:`<div class="bigword">${esc(W.w)}</div><p class="q">How do you read it? Pick the correct pinyin.</p>`,opts:mkOpts(W.p,d),c:W.p}
  }
  if(k==='h'){
    if(E.h.length&&Math.random()<.6)return examQ(pick(E.h));
    const d=others(W,6,o=>o.w.length===W.w.length).map(o=>o.w);
    return{prompt:`<p class="q"><b>${esc(W.m)}</b> · ${esc(W.p)}</p><p class="q">Which is the correct word?</p>`,opts:mkOpts(W.w,d),c:W.w,hz:true}
  }
  if(k==='u'){
    if(E.u.length&&Math.random()<.4)return examQ(pick(E.u));
    const cands=W.sb.filter(s=>s[0].includes(W.w));const s=pick(cands.length?cands:W.sb);
    const blanked=s[0].replace(W.w,'<span class="blank">　？　</span>');
    const d=others(W,6,o=>o.w.length===W.w.length&&o.l===W.l).map(o=>o.w);
    return{prompt:`<p class="q">${esc(s[0]).replace(esc(W.w),'<span class="blank">　？　</span>')}</p><p class="sub">Pick the word that fits the blank.</p>`,opts:mkOpts(W.w,d),c:W.w,hz:true,en:s[1]}
  }
}
function idiomQ(word){
  const W=WMAP[word];const right=pick(W.sb)[0];
  const wrongs=[];for(const o of shuffle(WORDS)){if(o.w===W.w||wrongs.length>=3)continue;const s=o.sb.find(s=>s[0].includes(o.w));if(s)wrongs.push(s[0].replace(o.w,W.w))}
  return{prompt:`<p class="q">To cast <b>${esc(W.w)}</b>, pick the sentence that uses it <b>correctly</b>:</p>`,opts:shuffle([right,...wrongs]),c:right,long:true}
}

/* ================= question UI ================= */
function askQuestion(container,q,word,onDone){
  const long=q.long||q.opts.some(o=>o.length>12);
  container.innerHTML=`${q.prompt}<div class="opts ${long?'long':''}">${q.opts.map((o,i)=>`<button class="opt ${q.hz&&!long?'hz':''}" data-i="${i}">${esc(o)}</button>`).join('')}</div><div id="fb"></div>`;
  container.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
    const ok=q.opts[+b.dataset.i]===q.c;
    GameAudio.sfx(ok?'correct':'wrong');
    container.querySelectorAll('.opt').forEach(x=>{x.disabled=true;if(q.opts[+x.dataset.i]===q.c)x.classList.add('right')});
    if(!ok)b.classList.add('wrong');
    const fb=container.querySelector('#fb');
    const W=word?WMAP[word]:null;
    fb.innerHTML=`<div class="feedback ${ok?'good':'bad'}">
      <div><b>${ok?'Correct!':'Not quite. The answer is: '+esc(q.c)}</b></div>
      ${W?`<div class="fw"><span class="hz">${esc(W.w)}</span><span>${esc(W.p)}</span><span>${esc(W.m)}</span><button class="speak" onclick="speak('${W.w}',this)">Hear it</button></div><div>Example: ${esc(W.ex)}</div>`:''}
      ${q.en?`<div class="sub">${esc(q.en)}</div>`:''}
      <div class="row"><button class="btn" id="fbGo">Next ▸</button></div></div>`;
    const go=fb.querySelector('#fbGo');go.focus();go.onclick=()=>{go.disabled=true;safe(()=>onDone(ok),()=>{closeOv();toast('Something went wrong. Back to the map!')})};
    if(W&&!ok)speak(W.w);
  });
}

/* ================= monsters ================= */
function monSVG(type){
  const c=TYPES[type].c;
  const eyes=`<circle cx="52" cy="48" r="7" fill="#fff"/><circle cx="78" cy="48" r="7" fill="#fff"/><circle cx="53" cy="49" r="3.5" fill="#1B2430"/><circle cx="79" cy="49" r="3.5" fill="#1B2430"/>`;
  const scroll=`<g transform="translate(88 70) rotate(12)"><rect x="0" y="0" width="30" height="20" rx="3" fill="#F4EFE2" stroke="#1B2430" stroke-width="2"/><rect x="10" y="5" width="10" height="10" fill="#C63F2B"/></g>`;
  let body='';
  if(type==='fog')body=`<g fill="${c}"><circle cx="45" cy="60" r="26"/><circle cx="70" cy="48" r="28"/><circle cx="92" cy="64" r="22"/><rect x="30" y="60" width="80" height="26" rx="13"/></g>`;
  if(type==='echo')body=`<path d="M10 40 Q30 30 42 50 L42 70 Q25 62 10 70 Q18 55 10 40Z" fill="${c}"/><path d="M122 40 Q102 30 90 50 L90 70 Q107 62 122 70 Q114 55 122 40Z" fill="${c}"/><ellipse cx="66" cy="58" rx="30" ry="30" fill="${c}"/><path d="M50 30 L46 14 L58 28Z M82 30 L86 14 L74 28Z" fill="${c}"/>`;
  if(type==='twin')body=`<ellipse cx="54" cy="62" rx="28" ry="32" fill="${c}" opacity=".55"/><ellipse cx="68" cy="60" rx="28" ry="32" fill="${c}"/>`;
  if(type==='jumble')body=`<g fill="${c}"><circle cx="24" cy="80" r="14"/><circle cx="44" cy="74" r="16"/><circle cx="66" cy="62" r="20"/></g><g fill="#1B2430" font-size="14" font-family="sans-serif" text-anchor="middle"><text x="24" y="85">?</text><text x="44" y="79">!</text></g>`;
  if(type==='ink')body=`<path d="M30 90 Q26 40 66 28 Q106 40 102 90 Q94 84 88 94 Q80 84 72 96 Q64 84 56 96 Q48 84 40 94 Q36 86 30 90Z" fill="${c}"/><path d="M60 20 Q66 4 72 20" stroke="${c}" stroke-width="6" fill="none"/><ellipse cx="40" cy="102" rx="5" ry="3" fill="${c}"/><ellipse cx="92" cy="104" rx="4" ry="2.5" fill="${c}"/>`;
  const e2=type==='jumble'?`<circle cx="60" cy="56" r="5" fill="#fff"/><circle cx="74" cy="56" r="5" fill="#fff"/><circle cx="61" cy="57" r="2.5" fill="#1B2430"/><circle cx="75" cy="57" r="2.5" fill="#1B2430"/>`:type==='twin'?eyes.replace(/cx="52"/g,'cx="58"').replace(/cx="53"/g,'cx="59"'):eyes;
  return `<svg class="mon" viewBox="0 0 132 112" aria-hidden="true">${body}${e2}${scroll}</svg>`;
}
function bossSVG(){return `<svg class="mon" viewBox="0 0 132 112" aria-hidden="true" style="width:150px;height:128px"><ellipse cx="66" cy="70" rx="46" ry="38" fill="#7B5AA6"/><path d="M36 30 L44 14 L56 28 L66 10 L76 28 L88 14 L96 30Z" fill="#E2B23C"/><rect x="36" y="28" width="60" height="8" fill="#E2B23C"/><g fill="none" stroke="#fff" stroke-width="3"><path d="M44 58 a6 6 0 1 1 6 6 a3 3 0 1 1 -3 -3"/><path d="M80 58 a6 6 0 1 1 6 6 a3 3 0 1 1 -3 -3"/></g><path d="M52 84 Q66 76 80 88" stroke="#1B2430" stroke-width="3" fill="none"/><g transform="translate(94 74) rotate(160)"><rect width="30" height="22" fill="#F4EFE2" stroke="#1B2430" stroke-width="2"/><line x1="15" y1="0" x2="15" y2="22" stroke="#1B2430" stroke-width="2"/></g></svg>`}

/* ================= writing (Hanzi Writer) ================= */
const STAGE_NAME=['Trace','Guided','From memory'];
const STAGE_TIP=['Trace over the grey outline, one stroke at a time.','Write it yourself. A hint appears if you get stuck.','Write it from memory! Tap "I don\'t know" if you can\'t remember it.'];
function writeWord(container,W,opts,onDone){
  // opts.mode: 'battle' (stage per character) | 'dictation' (always from memory) | 'practice' (trace, no scoring)
  // A word counts as written if every stroke was drawn by the child: no stroke filled in automatically,
  // no "Show me how", no "I don't know". The number of wobbly attempts does not matter.
  const chars=[...W.w];let idx=0,needHelp=false,allRecall=true,writer=null,ended=false;
  const stageFor=ch=>opts.mode==='practice'?0:opts.mode==='dictation'?2:charLv(ch);
  const AUTO=4; // after this many misses on one stroke, the stroke is filled in for the child
  chars.forEach(ch=>{if(stageFor(ch)<2)allRecall=false});
  const clue=esc(W.ex).replace(esc(W.w),'<span class="blank">'+'＿'.repeat(chars.length)+'</span>');
  const draw=()=>{
    const ch=chars[idx];const st=stageFor(ch);let helped=false;
    container.innerHTML=`${opts.title?`<p class="msg"><b>${opts.title}</b></p>`:''}
      <div class="wclue"><span class="py">${esc(W.p)}</span><span>${esc(W.m)}</span><button class="speak" id="wSay">Hear it</button></div>
      <p class="sub" style="margin:0">Clue: ${clue}</p>
      <div class="wrow">
        <div class="hwbox" id="hw"></div>
        <div class="wside">
          <div class="slots">${chars.map((c,i)=>`<span class="slot ${i<idx?'done':i===idx?'cur':''}">${i<idx?esc(c):i===idx?'✎':''}</span>`).join('')}</div>
          <p class="wstage"><b>${STAGE_NAME[st]}</b> · character ${idx+1} of ${chars.length}</p>
          <p class="sub" style="margin:0">${STAGE_TIP[st]}</p>
          <div class="row">${st<2?'<button class="btn alt" id="wShow">Show me how</button>':''}<button class="btn alt" id="wSkip">I don't know</button></div>
        </div>
      </div><div id="fb"></div>`;
    $('#wSay').onclick=e=>speak(W.w,e.currentTarget);
    const box=$('#hw');const size=Math.round(box.getBoundingClientRect().width)||170;
    const lenient=S.settings.lenient;
    writer=HanziWriter.create(box,ch,{width:size,height:size,padding:10,showCharacter:false,showOutline:st===0,
      strokeColor:'#1B2430',outlineColor:'#D5CBB6',drawingColor:'#2F6F8F',drawingWidth:7,highlightColor:'#2F8A66',strokeAnimationSpeed:1.6,delayBetweenStrokes:180,
      charDataLoader:(c,ok)=>ok(CHARDATA[c])});
    const quiz=()=>writer.quiz({showHintAfterMisses:[1,2,3][st],markStrokeCorrectAfterMisses:AUTO,leniency:lenient?1.4:1,acceptBackwardsStrokes:lenient,highlightOnComplete:true,
      onCorrectStroke:d=>{if(d.mistakesOnStroke>=AUTO)helped=true},
      onComplete:()=>{if(ended)return;if(helped)needHelp=true;
        if(opts.mode!=='practice')safe(()=>recordChar(ch,helped,opts.bid));
        setTimeout(()=>{idx++;if(idx<chars.length)draw();else finish(false)},650)}});
    const sh=$('#wShow');if(sh)sh.onclick=()=>{helped=true;writer.cancelQuiz();writer.showOutline();writer.animateCharacter({onComplete:()=>{writer.hideCharacter();quiz()}})};
    $('#wSkip').onclick=()=>{ended=true;writer.cancelQuiz();
      if(opts.mode!=='practice')chars.slice(idx).forEach(c=>safe(()=>recordChar(c,true,opts.bid)));
      container.querySelectorAll('#wShow,#wSkip').forEach(b=>b.disabled=true);
      writer.animateCharacter({onComplete:()=>finish(true)})};
    quiz();
  };
  const finish=gaveUp=>{
    const ok=!gaveUp&&!needHelp;
    const msg=ok?'Well done! You wrote it all by yourself.':gaveUp?'That\'s OK! This is how you write it. You\'ll see it again soon.':'Nearly! You needed some help this time. Keep practising.';
    container.querySelector('#fb').innerHTML=`<div class="feedback ${ok?'good':'bad'}"><b>${msg}</b>
      <div class="fw"><span class="hz">${esc(W.w)}</span><span>${esc(W.p)}</span><span>${esc(W.m)}</span><button class="speak" id="wSay2">Hear it</button></div>
      <div class="row"><button class="btn" id="fbGo">Next ▸</button></div></div>`;
    container.querySelector('#wSay2').onclick=e=>speak(W.w,e.currentTarget);
    const go=container.querySelector('#fbGo');go.focus();
    go.onclick=()=>{go.disabled=true;safe(()=>onDone({ok,gaveUp,shown:needHelp,n:chars.length,allRecall}),()=>{closeOv();toast('Something went wrong. Back to the map!')})};
  };
  if(opts.say)speak(W.w);
  draw();
}

/* ================= wild battle ================= */
let B=null;
function pickWord(zone){
  const lesson=ZONES[zone].l;
  const pool=WORDS.filter(w=>w.l===lesson&&!isResting(w.w));
  if(!pool.length)return null;
  const weights=pool.map(w=>{const s=S.words[w.w];if(!s||!s.c)return 5;if(tierOf(w.w)==='gold')return 1.5;return Math.max(.5,5-starsOf(w.w))+Math.min(s.x,4)*.8});
  let t=weights.reduce((a,b)=>a+b,0)*Math.random();
  for(let i=0;i<pool.length;i++){t-=weights[i];if(t<=0)return pool[i]}
  return pool[0];
}
function recommendedSkill(word){
  const s=ws(word.w);
  const available=SK.filter(k=>(s.st[k]||0)<2&&s.ld[k]!==today());
  return available[0]||SK.reduce((best,k)=>(s.st[k]||0)<(s.st[best]||0)?k:best,'m');
}
function startBattle(zone){
  const word=pickWord(zone);if(!word)return;const type=pick(Object.keys(TYPES));
  GameAudio.setScene('battle');GameAudio.sfx('encounter');
  energyLeft();S.energy.used++;
  const review=tierOf(word.w)==='gold';
  B={zone,word,type,hp:3,max:3,bid:++S.battles,streak:0,used:{},double:false,shield:false,review,reviewFailed:false,recommended:recommendedSkill(word),skillBonus:0};
  openOv(`<div class="battle ${ZONES[zone].cls}" id="bt">
    <div class="arena">
      <div class="fighter"><div class="pcard"><b>You</b> Lv${S.lvl}<div class="hpbar"><i id="bHp"></i></div><span id="bHpT"></span></div></div>
      <div class="fighter"><div class="nameplate"><div class="n">${TYPES[type].n}</div><div class="weak">Weak to: ${SKILLS[TYPES[type].weak].n}</div><div class="pips" id="ePips"></div></div><div id="monBox">${monSVG(type)}</div></div>
    </div>
    <div class="console" id="con"></div></div>`);
  bRefresh();
  bSay(review?`A <b>${TYPES[type].n}</b> has woken up one of your Gold spirits for a review!`:`A wild <b>${TYPES[type].n}</b> appeared! It has a word spirit sealed inside.`,[{t:'Fight!',f:bMenu}]);
}
function bRefresh(){
  const mh=maxHp();$('#bHp').style.width=(S.hp/mh*100)+'%';$('#bHpT').textContent=`HP ${S.hp}/${mh}`;
  $('#ePips').innerHTML=Array.from({length:B.max},(_,i)=>`<i class="${i<B.hp?'':'off'}"></i>`).join('');refreshHud();
}
function bSay(html,btns){
  const con=$('#con');con.innerHTML=`<p class="msg">${html}</p><div class="row"></div>`;
  const row=con.querySelector('.row');btns.forEach(b=>{const e=document.createElement('button');e.className='btn'+(b.cls?' '+b.cls:'');e.textContent=b.t;e.onclick=b.f;row.appendChild(e)});row.firstChild?.focus();
}
function bMenu(){
  const weak=TYPES[B.type].weak;
  const idioms=Object.keys(IDIOMS).filter(w=>S.words[w]?.c&&!B.used[w]);
  const con=$('#con');
  con.innerHTML=`<p class="msg">Your turn! Choose an attack${B.streak>=2?` · <b style="color:var(--seal)">${B.streak} in a row!</b>`:''}</p>
   <div class="attacks">${SK.map(k=>{const s=SKILLS[k];return `<button class="atk ${k===weak?'weakto':''} ${k===B.recommended&&!B.skillBonus?'recommended':''} ${k==='w'?'wide':''}" data-k="${k}"><span class="t">${s.t}</span><span class="d">${s.d}</span></button>`}).join('')}</div>
   <div class="minor">${idioms.map(w=>`<button class="btn seal" data-idiom="${w}">Idiom: ${w}</button>`).join('')}
   <button class="btn alt" id="bPot" ${S.potions?'':'disabled'}>Rice Ball +10 · ×${S.potions}</button><button class="btn alt" id="bNoodles" ${S.noodles?'':'disabled'}>Instant Noodles +20 · ×${S.noodles}</button><button class="btn alt" id="bRun">Run away</button></div>`;
  con.querySelectorAll('.atk').forEach(b=>b.onclick=()=>b.dataset.k==='w'?bWrite():bAttack(b.dataset.k));
  con.querySelectorAll('[data-idiom]').forEach(b=>b.onclick=()=>bIdiom(b.dataset.idiom));
  $('#bPot').onclick=()=>{S.potions--;S.hp=Math.min(maxHp(),S.hp+10);bRefresh();enemyTurn('You ate a Rice Ball. +10 HP.',true)};
  $('#bNoodles').onclick=()=>{S.noodles--;S.hp=Math.min(maxHp(),S.hp+20);bRefresh();enemyTurn('You ate Instant Noodles. +20 HP.',true)};
  $('#bRun').onclick=()=>{closeOv();toast('You got away safely.')};
}
function dealDamage(k,base){
  B.streak++;let dmg=base;const notes=[];
  if(k===TYPES[B.type].weak){dmg++;notes.push('Super effective!')}
  if(B.streak>=3){dmg++;notes.push('Streak bonus!')}
  if(B.double){dmg*=2;B.double=false;notes.push('Teamwork ×2!')}
  B.hp=Math.max(0,B.hp-dmg);GameAudio.sfx('hit');hitMon();bRefresh();
  if(B.hp<=0){bWin();return}
  enemyTurn(`${SKILLS[k].t} hits for <b>${dmg}</b> damage! ${notes.join(' ')}`,true);
}
function bAttack(k){
  const q=makeQ(B.word,k);
  askQuestion($('#con'),q,B.word.w,ok=>{
    record(B.word.w,k,ok,B.bid);
    if(ok){if(k===B.recommended&&!B.skillBonus){B.skillBonus=2;S.coins+=2}dealDamage(k,1)}
    else{B.streak=0;enemyTurn('Your attack missed!',false)}
  });
}
function bWrite(){
  writeWord($('#con'),B.word,{mode:'battle',bid:B.bid,title:'Brush Finisher: write the word!'},res=>{
    // the Writing star only counts when every character was written from memory
    if(res.allRecall)record(B.word.w,'w',res.ok,B.bid);else record(B.word.w,'w',false,B.bid)
    if(res.ok){if(B.recommended==='w'&&!B.skillBonus){B.skillBonus=2;S.coins+=2}dealDamage('w',2)}
    else{B.streak=0;enemyTurn(res.gaveUp?'You didn\'t know this one yet, so your brush attack missed.':'You needed help, so your brush attack missed.',false)}
  });
}
/* the creature's turn: a plain attack or a spell you must defend against */
function enemyTurn(prefix,wasCorrect){
  const T=TYPES[B.type];const L=ZONES[B.zone].l;
  if(Math.random()<.4){
    const pool=WORDS.filter(w=>w.l===L&&w.w!==B.word.w);const coll=pool.filter(w=>S.words[w.w]?.c);
    const dw=pick(coll.length&&Math.random()<.7?coll:pool);
    bSay(`${prefix}<br><b>${T.n}</b> casts <b>${T.spell}</b>! Answer correctly to block it.`,[{t:'Defend!',f:()=>{
      askQuestion($('#con'),makeQ(dw,T.atk),dw.w,ok=>{
        record(dw.w,T.atk,ok,B.bid);
        if(ok){bSay(`Blocked! The ${T.spell} bounces right off you.`,[{t:'Next',f:bMenu}]);return}
        if(B.shield){B.shield=false;bSay(`The ${T.spell} hits, but you put it out of your mind (抛到脑后). No damage!`,[{t:'Next',f:bMenu}]);return}
        takeHit(3+L,`The ${T.spell} hits you for <b>${3+L}</b> damage!`);
      })}}]);
    return;
  }
  let dmg=2+rnd(3)+(L-1);
  if(wasCorrect){
    if(Math.random()<(B.streak>=3?.5:.3)){bSay(`${prefix}<br>The ${T.n} lunges at you, but you dodge!`,[{t:'Next',f:bMenu}]);return}
    takeHit(dmg,`${prefix}<br>The ${T.n} strikes back for <b>${dmg}</b> damage!`);
  } else {
    if(B.shield){B.shield=false;bSay(`${prefix}<br>The ${T.n} strikes, but you put it out of your mind (抛到脑后). No damage!`,[{t:'Next',f:bMenu}]);return}
    dmg=Math.ceil(dmg*1.5);takeHit(dmg,`${prefix}<br>The ${T.n} catches you off guard for <b>${dmg}</b> damage! Remember the right answer for next time.`);
  }
}
function takeHit(dmg,msg){
  S.hp=Math.max(0,S.hp-dmg);GameAudio.sfx('hurt');$('#bt').classList.add('flash');setTimeout(()=>$('#bt')?.classList.remove('flash'),400);bRefresh();
  if(S.hp<=0)return bLose();
  bSay(msg+(S.hp<=6?' <b style="color:var(--seal)">Your HP is low!</b>':''),[{t:'Next',f:bMenu}]);
}
function hitMon(){const m=document.querySelector('#monBox .mon');if(!m)return;m.classList.remove('hit');void m.offsetWidth;m.classList.add('hit')}
function bIdiom(w){
  askQuestion($('#con'),idiomQ(w),w,ok=>{
    B.used[w]=true;record(w,'u',ok,B.bid);
    if(!ok){enemyTurn(`The move fizzled. Check how ${w} is used above.`,false);return}
    const fx=IDIOMS[w].fx;let msg='';
    if(fx==='heal'){S.hp=maxHp();msg='You wolf down a big meal (狼吞虎咽). HP fully restored!'}
    if(fx==='double'){B.double=true;msg='Your spirits work together (齐心协力). Your next hit does double damage!'}
    if(fx==='shield'){B.shield=true;msg='You put your worries out of your mind (抛到脑后). Your next wrong answer does no damage.'}
    if(fx==='shout'){B.hp=Math.max(0,B.hp-1);hitMon();msg='All your spirits shout in one voice (异口同声) for 1 damage!'}
    bRefresh();if(B.hp<=0)return bWin();
    enemyTurn(msg,true);
  });
}
function bWin(){
  const w=B.word;const s=ws(w.w);const wasNew=!s.c;const before=tierOf(w.w);s.c=1;
  if(B.review&&!B.reviewFailed&&tierOf(w.w)==='gold'){s.rev=today();s.revInterval=Math.min(REVIEW_MAX_DAYS,(s.revInterval||REVIEW_DAYS)*2)}
  const up=gainXp(12);S.coins+=8;const after=tierOf(w.w);
  GameAudio.sfx('win');const m=document.querySelector('#monBox .mon');m?.classList.add('dead');
  setTimeout(()=>{
    const tierName={bronze:'Bronze',silver:'Silver',gold:'Gold'};
    const n=starsOf(w.w);
    const waiting=SK.filter(k=>s.st[k]===1&&s.ld[k]===today()).map(k=>SKILLS[k].n);
    openOv(`<div class="panel reveal">
      <p class="sub">You beat the ${TYPES[B.type].n}! The seal breaks open…</p>
      <h2 style="font-family:var(--display);font-weight:700;margin:0">${B.review?'Review complete! This spirit rests again.':wasNew?'New spirit added to your Spirit Book!':'Your spirit grew stronger!'}</h2>
      ${bigCard(w.w)}
      <p class="msg">${n}/5 stars · ${tierName[after]} spirit${before&&before!==after?` <b style="color:var(--seal)">Upgraded!</b>`:''}</p>
      ${waiting.length?`<p class="sub">Half-stars earned today: ${waiting.join(', ')}. Get them right again on another day to fill the star.</p>`:''}
      <p class="sub">+12 XP · +8 coins${B.skillBonus?` · +${B.skillBonus} useful-skill bonus`:''}</p>
      <div class="row"><button class="btn" id="goOn">Keep exploring</button><button class="btn alt" onclick="speak('${w.w}',this)">Hear it</button></div></div>`);
    $('#goOn').onclick=()=>up?showLevelUp(up,closeOv):closeOv();$('#goOn').focus();save();
  },550);
}
function bLose(){
  S.hp=maxHp();P.x=24;P.y=11;P.px=P.x*TS;P.py=P.y*TS;S.x=P.x;S.y=P.y;
  bSay('You fainted! Grandma Wang carried you back to the inn. HP fully restored.',[{t:'OK',f:closeOv}]);
}

/* ================= cards / dex ================= */
const dots=(s,cls='stars')=>`<div class="${cls}">${SK.map(k=>`<i class="${(s.st[k]||0)>=2?'on':(s.st[k]||0)===1?'half':''}" title="${SKILLS[k].n}"></i>`).join('')}</div>`;
function bigCard(w){
  const W=WMAP[w];const t=tierOf(w);const s=S.words[w]||{st:{}};
  const tierHz={bronze:'B',silver:'S',gold:'G'};
  return `<div class="bigcard">${t?`<span class="seal ${t}">${tierHz[t]}</span>`:''}<div class="hz">${esc(W.w)}</div><div>${esc(W.p)}</div><div class="sub">${esc(W.m)}</div>
  <div style="margin-top:6px">${dots(s)}</div></div>`;
}
let dexLesson=1;
function openDex(){
  const tierHz={bronze:'B',silver:'S',gold:'G'};
  const list=WORDS.filter(w=>w.l===dexLesson);
  const cnt=l=>WORDS.filter(w=>w.l===l&&S.words[w.w]?.c).length;
  openOv(`<div class="panel"><div class="phead"><h2>Spirit Book</h2><button class="close" id="x" aria-label="Close">✕</button></div>
   <p class="sub">Collected ${collectedCount()}/${WORDS.length} · Silver or better: ${silverCount()}/${WORDS.length} (the gate needs ${gateSilverRequired()}, or ${Math.round(GATE_SILVER_PCT*100)}%). The five dots are Meaning · Pinyin · Hanzi · Usage · Writing. A dot is half-filled after one correct answer and fills in after a second correct answer on a different day. Gold spirits return for review after ${REVIEW_DAYS} days; successful reviews gradually extend the interval up to ${REVIEW_MAX_DAYS} days.</p>
   <div class="tabs">${[1,2,3].map(l=>`<button class="tab ${l===dexLesson?'on':''}" data-l="${l}">Lesson ${l} · ${cnt(l)}/18</button>`).join('')}</div>
   <div class="grid">${list.map(w=>{const s=S.words[w.w];const t=tierOf(w.w);
     if(!s?.c)return `<div class="card locked"><div class="hz">?</div><div class="py">not found yet</div></div>`;
     return `<button class="card" data-w="${w.w}">${t?`<span class="seal ${t}">${tierHz[t]}</span>`:''}<div class="hz">${esc(w.w)}</div><div class="py">${isResting(w.w)?'resting':esc(w.p)}</div>${dots(ws(w.w))}</button>`}).join('')}</div></div>`);
  $('#x').onclick=closeOv;
  ov.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{dexLesson=+b.dataset.l;openDex()});
  ov.querySelectorAll('.card[data-w]').forEach(b=>b.onclick=()=>openCard(b.dataset.w));
}
function openCard(w){
  const W=WMAP[w];const s=ws(w);
  openOv(`<div class="panel"><div class="phead"><h2>Spirit · ${esc(W.w)}</h2><button class="close" id="x" aria-label="Back">✕</button></div>
   <div class="detail">${bigCard(w)}
    <div style="display:flex;flex-direction:column;gap:10px">
     <div class="skillrow">${SK.map(k=>`<span>${SKILLS[k].n}</span><span class="sub">${k==='w'?'Write it from memory':SKILLS[k].d}</span><span class="dots"><i class="${s.st[k]>=1?'on':''}"></i><i class="${s.st[k]>=2?'on':''}"></i></span>`).join('')}</div>
     <p class="sub" style="margin:0">Writing stage: ${[...W.w].map(ch=>`<b style="font-family:var(--brush);font-size:18px">${esc(ch)}</b> ${STAGE_NAME[charLv(ch)]}`).join(' · ')}</p>
     <div class="row"><button class="btn alt" onclick="speak('${W.w}',this)">Hear ${esc(W.w)}</button><button class="btn" id="prac">Practise writing</button></div>
    </div></div>
   <div class="sent">${esc(W.ex)}</div>
   ${W.sb.slice(0,3).map(s=>`<div class="sent">${esc(s[0])}<small>${esc(s[1])}</small></div>`).join('')}
   ${IDIOMS[w]?`<p class="msg"><b>Idiom move:</b> ${IDIOMS[w].e}. In battle, pick the sentence that uses it correctly to cast it.</p>`:''}
   </div>`);
  $('#x').onclick=openDex;
  $('#prac').onclick=()=>{
    openOv(`<div class="panel"><div class="phead"><h2>Writing practice</h2><button class="close" id="x" aria-label="Back">✕</button></div><div id="wbox" class="console" style="margin:0"></div></div>`);
    $('#x').onclick=()=>openCard(w);
    writeWord($('#wbox'),W,{mode:'practice',title:'Trace the word. Practice does not change your stars.'},()=>openCard(w));
  };
}

/* ================= town ================= */
function enterBuilding(id){
  if(id==='school'){const paid=schoolPaid();dialog('Teacher Li',['Welcome to the School!',`Take a <b>quiz</b> with questions from real exam papers, or try <b>tingxie</b>: I say a word and you write it.${paid?' You earn <b>5 coins</b> for each correct answer.':' You have used up today\'s coin rewards, but practice still helps your stars!'}`],[{t:'Exam quiz',f:schoolQuiz},{t:'Tingxie (dictation)',cls:'jade',f:schoolDictation},...(S.school.examWeek!==weekKey()?[{t:'Exam Day (weekly)',cls:'seal',f:examDay}]:[]),{t:'Maybe later',cls:'alt',f:closeOv}]);}
  if(id==='hall')enterHall();
  if(id==='inn')dialog('Innkeeper',[`Time for a rest! ${collectedCount()?'Before bed, let\'s review your 3 weakest spirits. Then your HP will be full.':'Your HP will be restored.'}`],[{t:'Rest',f:innRest},{t:'No thanks',cls:'alt',f:closeOv}]);
  if(id==='shop')openShop();
}
const SCHOOL_PAID_RUNS=3; // coin rewards for the first 3 school sessions each day
function schoolPaid(){if(S.school.day!==today())S.school={...S.school,day:today(),runs:0};return S.school.runs<SCHOOL_PAID_RUNS}
function quizRunner(title,items,onEnd){
  let i=0,right=0;
  const next=()=>{
    if(i>=items.length)return onEnd(right,items.length);
    const it=items[i];
    openOv(`<div class="panel"><div class="phead"><h2>${title}</h2><span class="sub">${i+1} / ${items.length}</span></div><div id="qbox" style="display:flex;flex-direction:column;gap:10px"></div></div>`);
    const after=r=>{const ok=typeof r==='object'?r.ok:r;it.onAnswer&&it.onAnswer(r);if(ok)right++;i++;next()};
    if(it.write)writeWord($('#qbox'),it.write,it.wopts,res=>after(res));
    else askQuestion($('#qbox'),it.q,it.word,after);
  };next();
}
function schoolQuiz(){
  const paid=schoolPaid();S.school.runs++;
  const items=shuffle(DATA.school).slice(0,5).map(q=>({q:examQ(q),word:null,onAnswer:ok=>{S.stats.x[1]++;if(ok){S.stats.x[0]++;if(paid)S.coins+=5}}}));
  quizRunner('School Quiz',items,(r,n)=>{const up=gainXp(r*4);save();const done=()=>dialog('Teacher Li',[`You got <b>${r}/${n}</b> right${paid?` and earned ${r*5} coins`:''}!`,'You will see question types like these in your real exams. Keep it up!']);up?showLevelUp(up,done):done()});
}
function schoolDictation(){
  const paid=schoolPaid();S.school.runs++;const bid=++S.battles;
  const col=shuffle(WORDS.filter(w=>S.words[w.w]?.c)).sort((a,b)=>(S.words[a.w].st.w||0)-(S.words[b.w].st.w||0));
  const list=[...col,...shuffle(WORDS.filter(w=>!S.words[w.w]?.c))].slice(0,5);
  const items=list.map(W=>({write:W,wopts:{mode:'dictation',bid,say:true,title:'Tingxie: listen, then write the word from memory'},onAnswer:res=>{
    if(res.ok&&paid)S.coins+=5;
    record(W.w,'w',res.ok,bid)}}));
  quizRunner('Tingxie',items,(r,n)=>{const up=gainXp(r*5);save();const done=()=>dialog('Teacher Li',[`Tingxie done! You wrote <b>${r}/${n}</b> words well${paid?` and earned ${r*5} coins`:''}.`,'Characters you found tricky will come back more often.']);up?showLevelUp(up,done):done()});
}
function examDay(){
  S.school.examWeek=weekKey();const bid=++S.battles;
  const cz=pick(DATA.clozeAll);const czItems=shuffle(cz.items).slice(0,2);
  const czText=cz.text.replace(/\[Q\d+\]_*/g,'<span class="blank">　＿　</span>');
  const items=[
    ...shuffle(DATA.school).slice(0,3).map(q=>({q:examQ(q)})),
    ...shuffle(DATA.sentence).slice(0,2).map(q=>({q:examQ(q)})),
    ...shuffle(DATA.conj).slice(0,1).map(q=>({q:{prompt:`<p class="q">${fmtQ(q.q)}</p><p class="sub">${EXAM_HINT.conj}</p>`,opts:shuffle(q.o),c:q.c}})),
    ...czItems.map(q=>({q:{prompt:`<p class="sub" style="margin:0">Passage: <b>${esc(cz.title)}</b></p><div class="passage">${czText.split(/\n+/).map(x=>`<p>${x}</p>`).join('')}</div><p class="q">${fmtQ(q.q)}</p>`,opts:shuffle(q.o),c:q.c,hz:true}}))
  ].map(it=>({...it,word:null,onAnswer:ok=>{S.stats.x[1]++;if(ok)S.stats.x[0]++}}));
  quizRunner('Exam Day',items,(r,n)=>{S.coins+=r*8;const bonus=r>=6;if(bonus)S.potions++;const up=gainXp(r*5);save();
    const done=()=>dialog('Teacher Li',[`Exam Day finished! You scored <b>${r}/${n}</b> and earned ${r*8} coins${bonus?' and a Rice Ball':''}.`,'Exam Day comes once a week. See you next week!']);up?showLevelUp(up,done):done()});
}
function innRest(){
  const col=WORDS.filter(w=>S.words[w.w]?.c);
  if(!col.length){S.hp=maxHp();dialog('Innkeeper',['You had a good night\'s sleep. HP fully restored!']);return}
  const weakest=col.map(w=>({w,score:starsOf(w.w)*3-S.words[w.w].x})).sort((a,b)=>a.score-b.score).slice(0,3).map(o=>o.w);
  const bid=++S.battles;
  const items=weakest.map(w=>{const s=ws(w.w);const k=pick(SK.filter(k=>s.st[k]<2).concat(['m']));
    if(k==='w')return{write:w,wopts:{mode:'battle',bid,title:'Bedtime writing practice'},onAnswer:res=>{if(res.allRecall)record(w.w,'w',res.ok,bid);else{S.stats.w[1]++;if(res.ok)S.stats.w[0]++}}};
    return{q:makeQ(w,k),word:w.w,onAnswer:ok=>record(w.w,k,ok,bid)}});
  quizRunner('Bedtime Review',items,(r,n)=>{S.hp=maxHp();dialog('Innkeeper',[`Review done. You had a good night\'s sleep. HP fully restored!`])});
}
function openShop(){
  openOv(`<div class="panel"><div class="phead"><h2>Shop</h2><button class="close" id="x" aria-label="Close">✕</button></div>
   <p class="sub">You have <b>${S.coins}</b> coins. Coins buy items and hats. Answers can't be bought!</p>
    <div class="shopitem"><span class="nm">Rice Ball<small>+10 HP in battle · you have ${S.potions}</small></span><button class="btn" data-buy="potion" ${S.coins<25?'disabled':''}>25 coins</button></div>
    <div class="shopitem"><span class="nm">Instant Noodles<small>+20 HP in battle · you have ${S.noodles}</small></span><button class="btn" data-buy="noodles" ${S.coins<50?'disabled':''}>50 coins</button></div>
   ${Object.entries(HATS).map(([k,h])=>`<div class="shopitem"><span class="nm">${h.n}<small>${S.hats.includes(k)?(S.hat===k?'Wearing':'Owned'):'Just for looks'}</small></span>${S.hats.includes(k)?`<button class="btn alt" data-wear="${k}">${S.hat===k?'Take off':'Wear'}</button>`:`<button class="btn" data-buy="${k}" ${S.coins<h.p?'disabled':''}>${h.p} coins</button>`}</div>`).join('')}
  </div>`);
  $('#x').onclick=closeOv;
  ov.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const k=b.dataset.buy;if(k==='potion'){S.coins-=25;S.potions++}else if(k==='noodles'){S.coins-=50;S.noodles++}else{S.coins-=HATS[k].p;S.hats.push(k);S.hat=k}save();refreshHud();openShop()});
  ov.querySelectorAll('[data-wear]').forEach(b=>b.onclick=()=>{const k=b.dataset.wear;S.hat=S.hat===k?null:k;save();openShop()});
}

/* ================= stories ================= */
function storyMenu(){
  openOv(`<div class="panel"><div class="phead"><h2>Storyteller</h2><button class="close" id="x" aria-label="Close">✕</button></div>
   <p class="msg">Come and hear a story! Tap any <span class="vw">highlighted word</span> to see its pinyin and meaning. You get a reward the first time you finish each story.</p>
   ${DATA.stories.map((s,i)=>`<div class="shopitem"><span class="nm">${esc(s.title.replace(/[《》]/g,''))}<small>Lesson ${s.l} · ${s.pages.length} pages${S.stories.includes(i)?' · finished':''}</small></span><button class="btn" data-s="${i}">Read</button></div>`).join('')}</div>`);
  $('#x').onclick=closeOv;
  ov.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>readStory(+b.dataset.s,0));
}
function markWords(text,lesson){
  const words=WORDS.filter(w=>w.l===lesson).map(w=>w.w).sort((a,b)=>b.length-a.length);
  let html=esc(text);
  const re=new RegExp(words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
  return html.replace(re,m=>`<span class="vw" data-w="${m}">${m}</span>`);
}
function readStory(i,p){
  const s=DATA.stories[i];const page=s.pages[p];const last=p===s.pages.length-1;
  const paras=page.split(/\n\s*\n/).map(x=>`<p>${markWords(x.replace(/\n/g,''),s.l)}</p>`).join('');
  openOv(`<div class="panel"><div class="phead"><h2>${esc(s.title)}</h2><button class="close" id="x" aria-label="Close">✕</button></div>
   <p class="sub">Page ${p+1} of ${s.pages.length}</p>
   <div class="story">${paras}</div><div id="pop"></div>
   <div class="row"><button class="btn alt" id="rd">Read this page aloud</button>${p>0?'<button class="btn alt" id="pv">◂ Back</button>':''}<button class="btn" id="nx">${last?'The end':'Next page ▸'}</button></div></div>`);
  $('#x').onclick=storyMenu;
  $('#rd').onclick=e=>speak(page.replace(/\s+/g,''),e.currentTarget);
  if(p>0)$('#pv').onclick=()=>readStory(i,p-1);
  $('#nx').onclick=()=>{if(!last)return readStory(i,p+1);
    if(!S.stories.includes(i)){S.stories.push(i);S.coins+=20;const up=gainXp(20);save();const done=()=>dialog('Storyteller',['The end! Here are <b>20 coins</b> and 20 XP.','The creatures in the tall grass have these same words sealed inside. Go and collect them!']);up?showLevelUp(up,done):done()}else storyMenu()};
  ov.querySelectorAll('.vw').forEach(el=>el.onclick=()=>{const W=WMAP[el.dataset.w];$('#pop').innerHTML=`<div class="pop"><span class="hz">${esc(W.w)}</span><span>${esc(W.p)}</span><span>${esc(W.m)}</span><button class="speak" style="color:var(--paper);border-color:var(--paper)" onclick="speak('${W.w}',this)">Hear it</button></div>`});
}

/* ================= boss ================= */
function bossIntro(){
  dialog('Muddle King',['Mwahaha! I am the Muddle King!','Xiaoqiang treating a pork rib like treasure… Dad hunting for the glasses on his own head… sugar in the pan instead of salt… that was all ME!','Want to beat me? Break my three spells first: joining words, a scrambled sentence, and a passage full of blanks!'],[{t:'Challenge!',cls:'seal',f:startBoss},{t:'Not ready yet',cls:'alt',f:closeOv}]);
}
function mergePunct(seg){const out=[];seg.forEach(s=>{if(/^[，。！？、；：“”‘’…,.!?]+$/.test(s)&&out.length)out[out.length-1]+=s;else out.push(s)});return out}
function startBoss(){
  GameAudio.setScene('boss');GameAudio.sfx('encounter');
  const conj=shuffle(DATA.conj).slice(0,3).map(q=>({kind:'conj',q}));
  const ord=shuffle(DATA.lessonSentences).slice(0,2).map(s=>({kind:'order',s}));
  const cz=DATA.cloze.qs.map((q,i)=>({kind:'cloze',q,i}));
  const known=WORDS.filter(w=>S.words[w.w]?.c);
  const wr=shuffle(known.length>=2?known:WORDS).slice(0,2).map(W=>({kind:'write',W}));
  B={boss:true,queue:[...conj,...ord,...wr,...cz],hp:12,max:12,phase:'',bid:++S.battles,clozeDone:{},used:{},double:false,shield:false,streak:0};
  openOv(`<div class="battle boss" id="bt">
    <div class="arena">
      <div class="fighter"><div class="pcard"><b>You</b> Lv${S.lvl}<div class="hpbar"><i id="bHp"></i></div><span id="bHpT"></span></div></div>
      <div class="fighter"><div class="nameplate"><div class="n">Muddle King</div><div class="weak" id="bPhase"></div><div class="pips" id="ePips"></div></div><div id="monBox">${bossSVG()}</div></div>
    </div><div class="console" id="con"></div></div>`);
  bRefresh();bossNext();
}
function bossNext(){
  if(B.hp<=0||!B.queue.length)return bossWin();
  const it=B.queue[0];const con=$('#con');
  const phaseName={conj:'Spell 1 · Chain Spell (joining words)',order:'Spell 2 · Scramble Spell (word order)',write:'Spell 3 · Ink Spell (tingxie)',cloze:'Spell 4 · Muddle Scroll (fill the blanks)'}[it.kind];
  $('#bPhase').textContent=phaseName;
  const done=ok=>{
    record(null,'x',ok,B.bid);B.queue.shift();
    if(ok){let dmg=1;if(B.double){dmg=2;B.double=false}B.hp=Math.max(0,B.hp-dmg);hitMon();bRefresh();if(it.kind==='cloze')B.clozeDone[it.i]=it.q.c;
      if(B.hp<=0)return bossWin();
      if(Math.random()<.3){const hit=3;S.hp=Math.max(0,S.hp-hit);bRefresh();if(S.hp<=0){S.hp=maxHp();P.x=24;P.y=11;P.px=P.x*TS;P.py=P.y*TS;return bSay('The Muddle King knocked you out! You woke up at the inn. Collect more spirits and try again!',[{t:'OK',f:closeOv}])}
        return bSayBoss('Spell broken! The Muddle King loses '+dmg+' HP… but he throws a Muddle Bomb at you for '+hit+' damage!')}
      bSayBoss('Spell broken! The Muddle King loses '+dmg+' HP.');}
    else{B.queue.push(it);
      if(B.shield){B.shield=false;bSayBoss('The Muddle King strikes back, but you put it out of your mind (抛到脑后)! This spell will come back later.');return}
      S.hp=Math.max(0,S.hp-5);bRefresh();$('#bt').classList.add('flash');setTimeout(()=>$('#bt')?.classList.remove('flash'),400);
      if(S.hp<=0){S.hp=maxHp();P.x=24;P.y=11;P.px=P.x*TS;P.py=P.y*TS;return bSay('The Muddle King knocked you out! You woke up at the inn. Collect more spirits and try again!',[{t:'OK',f:closeOv}])}
      bSayBoss('The Muddle King strikes back! You lose 5 HP. This spell will come back later.')}
  };
  if(it.kind==='conj'){askQuestion(con,{prompt:`<p class="msg"><b>${phaseName}</b></p><p class="q">${fmtQ(it.q.q)}</p><p class="sub">${EXAM_HINT.conj}</p>`,opts:shuffle(it.q.o),c:it.q.c},null,done)}
  if(it.kind==='order')orderQ(con,it.s,phaseName,done);
  if(it.kind==='write')writeWord(con,it.W,{mode:'dictation',bid:B.bid,say:true,title:phaseName+': listen, then write from memory'},res=>{record(it.W.w,'w',res.ok,B.bid);done(res.ok)});
  if(it.kind==='cloze'){
    const text=DATA.cloze.text.replace(/\[Q(\d+)\]___/g,(m,n)=>{const idx=+n-16;const d=B.clozeDone[idx];return `<span class="blank ${d?'done':idx===it.i?'cur':''}">${d?esc(d):idx+1}</span>`});
    askQuestion(con,{prompt:`<p class="msg"><b>${phaseName}</b> · ${esc(DATA.cloze.title)}</p><div class="passage">${text.split(/\n+/).map(p=>`<p>${p}</p>`).join('')}</div><p class="q">Blank ${it.i+1}: pick the word that fits best.</p>`,opts:shuffle(it.q.o),c:it.q.c,hz:true},null,done);
    const cur=con.querySelector('.blank.cur');cur?.scrollIntoView({block:'nearest'});
  }
}
function bSayBoss(msg){
  const idioms=Object.keys(IDIOMS).filter(w=>S.words[w]?.c&&!B.used[w]);
  bSay(msg,[{t:'Next',f:bossNext},...(S.potions?[{t:`Rice Ball ×${S.potions}`,cls:'alt',f:()=>{S.potions--;S.hp=Math.min(maxHp(),S.hp+10);bRefresh();bSayBoss('You ate a Rice Ball. +10 HP!')}}]:[]),
    ...(S.noodles?[{t:`Instant Noodles ×${S.noodles}`,cls:'alt',f:()=>{S.noodles--;S.hp=Math.min(maxHp(),S.hp+20);bRefresh();bSayBoss('You ate Instant Noodles. +20 HP!')}}]:[]),
    ...idioms.map(w=>({t:'Idiom: '+w,cls:'seal',f:()=>{const con=$('#con');askQuestion(con,idiomQ(w),w,ok=>{B.used[w]=true;record(w,'u',ok,B.bid);if(!ok)return bSayBoss('The move fizzled.');const fx=IDIOMS[w].fx;
      if(fx==='heal')S.hp=maxHp();if(fx==='double')B.double=true;if(fx==='shield')B.shield=true;if(fx==='shout'){B.hp=Math.max(0,B.hp-1);hitMon()}
      bRefresh();if(B.hp<=0)return bossWin();bSayBoss(w+' worked! '+IDIOMS[w].e+'.')})}}))]);
}
function orderQ(con,s,phaseName,done){
  const segs=mergePunct(s.seg);const pool=shuffle(segs.map((t,i)=>({t,i})));
  if(pool.every((p,i)=>p.i===i)&&pool.length>1)pool.reverse();
  const placed=[];
  const draw=()=>{
    con.innerHTML=`<p class="msg"><b>${phaseName}</b></p><p class="q">Tap the pieces in the right order to rebuild the sentence:</p><p class="sub">${esc(s.en)}</p>
     <div class="chips target" id="tgt">${placed.map((p,k)=>`<button class="chip placed" data-k="${k}">${esc(p.t)}</button>`).join('')}</div>
     <div class="chips" id="src">${pool.filter(p=>!placed.includes(p)).map(p=>`<button class="chip" data-i="${pool.indexOf(p)}">${esc(p.t)}</button>`).join('')}</div>
     <div class="row"><button class="btn" id="chk" ${placed.length===segs.length?'':'disabled'}>Check</button></div><div id="fb"></div>`;
    con.querySelectorAll('#src .chip').forEach(b=>b.onclick=()=>{placed.push(pool[+b.dataset.i]);draw()});
    con.querySelectorAll('#tgt .chip').forEach(b=>b.onclick=()=>{placed.splice(+b.dataset.k,1);draw()});
    $('#chk').onclick=()=>{
      const ok=placed.map(p=>p.t).join('')===segs.join('');
      con.querySelectorAll('.chip').forEach(c=>c.disabled=true);$('#chk').disabled=true;
      con.querySelector('#fb').innerHTML=`<div class="feedback ${ok?'good':'bad'}"><b>${ok?'Correct!':'Not quite. The correct sentence is:'}</b><div>${esc(s.t)}</div><div class="row"><button class="speak" onclick="speak('${s.t}',this)">Hear it</button></div><div class="row"><button class="btn" id="fbGo">Next ▸</button></div></div>`;
      $('#fbGo').onclick=()=>done(ok);$('#fbGo').focus();
    };
  };draw();
}
function bossWin(){
  S.boss=true;S.coins+=100;const up=gainXp(80);GameAudio.sfx('win');save();
  const m=document.querySelector('#monBox .mon');m?.classList.add('dead');
  setTimeout(()=>openOv(`<div class="panel reveal" style="justify-content:center">
    <div class="bigcard" style="padding:18px 26px"><span class="seal gold">G</span><div class="hz" style="font-family:var(--display);font-size:40px">Cleared!</div><div class="sub">Region 1 · Scholar Village</div></div>
    <h2 style="font-family:var(--display);font-weight:700;margin:0">You beat the Muddle King!</h2>
    <p class="msg">Nobody in the village is muddled any more. +100 coins · +80 XP</p>
    <p class="sub">The next region (Lessons 4–6) is still being built. Keep turning your spirits Gold!</p>
    <div class="row"><button class="btn" id="goOn">Back to the village</button></div></div>`),600);
  setTimeout(()=>{const b=$('#goOn');if(b){b.onclick=()=>up?showLevelUp(up,closeOv):closeOv();b.focus()}},700);
}

/* ================= parent panel ================= */
function downloadProgress(raw,name){
  const blob=new Blob([raw],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportProgress(){
  downloadProgress(encodeSave(S),`word-spirit-${LEVEL}-${today()}.wsq-save.txt`);
  toast('Progress copy downloaded.');
}
function restoreBackup(){
  try{
    const raw=localStorage.getItem(backupKey(LEVEL));
    if(!raw)throw Error('No valid backup is available yet.');
    validateSave(decodeSave(raw),LEVEL);localStorage.setItem(saveKey(LEVEL),raw);saveBlocked=false;loadSave(LEVEL);
    P={x:S.x,y:S.y,px:S.x*TS,py:S.y*TS,moving:false,dir:S.dir,step:0};refreshHud();openParent();toast('The last valid backup was restored.');
  }catch(e){toast(e.message||'The backup could not be restored.')}
}
function openImport(){
  openOv(`<div class="panel"><div class="phead"><h2>Import progress</h2><button class="close" id="x" aria-label="Back">✕</button></div>
    <p class="msg">Paste the complete contents of a Word Spirit Quest save file. Importing replaces progress for ${esc(LEVEL.toUpperCase())} after the file passes validation.</p>
    <textarea id="imp" class="rh-input" rows="8" spellcheck="false" placeholder="WSQ1.…"></textarea><div id="ifb"></div>
    <div class="row"><button class="btn" id="doImp">Validate and import</button><button class="btn alt" id="back">Cancel</button></div></div>`);
  $('#x').onclick=openParent;$('#back').onclick=openParent;
  $('#doImp').onclick=()=>{try{
    const raw=$('#imp').value.trim(),obj=validateSave(decodeSave(raw),LEVEL);if(!obj)throw Error('This is not a Word Spirit Quest save.');
    S=obj;saveBlocked=false;saveRecovery=null;storageWarning='';migrate();
    if(!save())throw Error(storageWarning||'The imported progress could not be saved.');
    P={x:S.x,y:S.y,px:S.x*TS,py:S.y*TS,moving:false,dir:S.dir,step:0};refreshHud();openParent();toast('Progress imported.');
  }catch(e){$('#ifb').innerHTML=`<div class="feedback bad"><b>Import failed.</b><div class="sub">${esc(e.message||'The save could not be read.')}</div></div>`}};
}
function openParent(){
  const pct=a=>a[1]?Math.round(a[0]/a[1]*100):0;
  const weak=WORDS.filter(w=>S.words[w.w]&&(S.words[w.w].x>0)).sort((a,b)=>S.words[b.w].x-S.words[a.w].x).slice(0,8);
  const wchars=Object.entries(S.chars).filter(([c,v])=>v.n>0&&(v.help||0)>0).map(([c,v])=>({c,...v})).sort((a,b)=>b.help/b.n-a.help/a.n).slice(0,10);
  const tiers={bronze:0,silver:0,gold:0};WORDS.forEach(w=>{const t=tierOf(w.w);if(t)tiers[t]++});
  const mins=Math.round(S.playMs/60000);const left=energyLeft();
  const lvl=LEVELS.find(l=>l.id===LEVEL);let hasBackup=false;try{hasBackup=!!localStorage.getItem(backupKey(LEVEL))}catch(e){}
  openOv(`<div class="panel"><div class="phead"><h2>Parent Panel</h2><button class="close" id="x" aria-label="Close">✕</button></div>
   ${storageWarning?`<div class="feedback bad"><b>${saveBlocked?'This save needs recovery.':'Progress is not being saved.'}</b><div class="sub">${esc(storageWarning)}</div>${saveBlocked?'<div class="sub">The damaged data has been preserved and this session will not overwrite it.</div>':''}</div>`:''}
   ${S.tampered?`<div class="feedback bad"><b>Heads up: this save was changed outside the game.</b><div class="sub">The saved data didn't match its checksum, so someone may have edited it in the browser. Progress still loads. Reset it below if you want a clean start.</div><div class="row"><button class="btn alt" id="clrT">Dismiss</button></div></div>`:''}
   <div class="row" style="align-items:center"><span style="font-size:15px">Level: <b>${esc(lvl?.label||LEVEL)}</b></span><button class="btn alt" id="swl">Switch level</button></div>
   <div class="kv"><div><b>${collectedCount()}/54</b><span>Spirits collected</span></div><div><b>${tiers.bronze} · ${tiers.silver} · ${tiers.gold}</b><span>Bronze · Silver · Gold</span></div><div><b>${mins} min</b><span>Time played</span></div><div><b>${S.settings.daily?S.energy.used+'/'+S.settings.daily:S.energy.used}</b><span>Battles today</span></div></div>
   <div style="display:flex;flex-direction:column;gap:6px"><p class="sub">Accuracy by skill (correct % · questions answered)</p>
   ${[['m','Meaning'],['p','Pinyin'],['h','Hanzi'],['u','Usage'],['w','Writing'],['c','Reading'],['x','Exam/Boss']].map(([k,n])=>`<div class="skbar"><span>${n}</span><span class="track"><i style="width:${pct(S.stats[k])}%"></i></span><span>${pct(S.stats[k])}% · ${S.stats[k][1]}</span></div>`).join('')}</div>
   <div><p class="sub" style="margin-bottom:6px">Words missed most often</p>
   ${weak.length?`<div style="overflow-x:auto"><table class="weak"><thead><tr><th>Word</th><th>Pinyin</th><th>Meaning</th><th>Missed</th><th>Stars</th></tr></thead><tbody>${weak.map(w=>`<tr><td>${esc(w.w)}</td><td>${esc(w.p)}</td><td>${esc(w.m)}</td><td>${S.words[w.w].x}</td><td>${starsOf(w.w)}/5</td></tr>`).join('')}</tbody></table></div>`:'<p class="sub">No missed words yet.</p>'}</div>
   <div><p class="sub" style="margin-bottom:6px">Characters that needed help (gave up, "Show me how", or a stroke filled in)</p>
   ${wchars.length?`<div style="overflow-x:auto"><table class="weak"><thead><tr><th>Character</th><th>Times written</th><th>Needed help</th><th>Stage</th></tr></thead><tbody>${wchars.map(c=>`<tr><td style="font-family:var(--brush);font-size:22px">${esc(c.c)}</td><td>${c.n}</td><td>${c.help}</td><td>${STAGE_NAME[c.lv]}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sub">Nothing yet. Every character so far was written without help.</p>'}</div>
   <div><p class="sub" style="margin-bottom:6px">Written answers from Reading Hall passages (the child checked these against the model answer)</p>
   ${S.written.length?S.written.slice(0,10).map(w=>`<div class="sent" style="margin-bottom:6px"><small>${esc(w.day)} · ${esc(w.title)} · rated: <b>${esc(w.rating)}</b></small>${esc(w.q)}<small>Child wrote: ${w.a?esc(w.a):'(on paper / nothing typed)'}</small><small>Model answer: ${esc(w.ans)}</small></div>`).join(''):'<p class="sub">None yet.</p>'}</div>
   <div style="display:flex;flex-direction:column;gap:8px"><p class="sub" style="margin:0">Settings</p>
    <div class="row" style="align-items:center"><label for="sw" style="font-size:14px">Show written answers here</label>
     <select id="sw" style="font:inherit;padding:6px 8px;border-radius:8px;border:2px solid var(--ink)"><option value="1" ${S.settings.sendWritten?'selected':''}>Yes</option><option value="0" ${S.settings.sendWritten?'':'selected'}>No</option></select></div>
    <div class="row" style="align-items:center"><label for="daily" style="font-size:14px">Creature battles per day</label>
     <select id="daily" style="font:inherit;padding:6px 8px;border-radius:8px;border:2px solid var(--ink)">${DAILY_OPTIONS.map(v=>`<option value="${v}" ${S.settings.daily===v?'selected':''}>${v||'No limit'}</option>`).join('')}</select></div>
    <div class="row" style="align-items:center"><label for="len" style="font-size:14px">Writing check</label>
     <select id="len" style="font:inherit;padding:6px 8px;border-radius:8px;border:2px solid var(--ink)"><option value="1" ${S.settings.lenient?'selected':''}>Gentle (accepts wobbly and backwards strokes)</option><option value="0" ${S.settings.lenient?'':'selected'}>Strict</option></select></div>
     <p class="sub" style="margin:0">Stroke order is always checked. Stars need correct answers on two different days. Gold spirits first return after ${REVIEW_DAYS} days; successful reviews extend the interval up to ${REVIEW_MAX_DAYS} days, so extra play on one day can't fill up the Spirit Book.</p>
   </div>
    <div><p class="sub" style="margin-bottom:6px">Backup and recovery</p><div class="row"><button class="btn alt" id="exp">Export progress</button><button class="btn alt" id="impBtn">Import progress</button>${hasBackup?'<button class="btn alt" id="restore">Restore last valid backup</button>':''}${saveRecovery?'<button class="btn alt" id="raw">Download damaged save</button>':''}</div></div>
   <div class="row"><button class="btn alt" id="gt">Test mode: ${S.gateTest?'close':'open'} the boss gate</button><button class="btn alt" id="gl">Test mode: give Cave Lantern</button><button class="btn alt" id="en">Give 5 more battles today</button><button class="btn seal" id="rs">Reset progress</button></div>
    <p class="sub">Progress is saved in this browser on this device only. Export a copy before clearing browser data or changing devices.</p></div>`);
  $('#x').onclick=closeOv;
  $('#daily').onchange=e=>{S.settings.daily=+e.target.value;warnedTired=false;save();refreshHud()};
  $('#len').onchange=e=>{S.settings.lenient=e.target.value==='1';save()};
  $('#gt').onclick=()=>{S.gateTest=!S.gateTest;save();openParent()};
  $('#gl').onclick=()=>{if(!hasLantern())S.keyItems.push('cave-lantern');save();openParent()};
  $('#sw').onchange=e=>{S.settings.sendWritten=e.target.value==='1';save()};
  $('#swl').onclick=()=>openLevelPicker(true);
  $('#exp').onclick=exportProgress;$('#impBtn').onclick=openImport;
  if($('#restore'))$('#restore').onclick=restoreBackup;
  if($('#raw'))$('#raw').onclick=()=>downloadProgress(saveRecovery,`word-spirit-${LEVEL}-recovery-${today()}.txt`);
  if($('#clrT'))$('#clrT').onclick=()=>{S.tampered=false;save();openParent()};
  $('#en').onclick=()=>{energyLeft();S.energy.used=Math.max(0,S.energy.used-5);warnedTired=false;save();refreshHud();openParent()};
  $('#rs').onclick=()=>{if($('#rs').dataset.c){saveBlocked=false;saveRecovery=null;storageWarning='';try{localStorage.removeItem(saveKey(LEVEL));localStorage.removeItem(recoveryKey(LEVEL))}catch(e){}S=freshState();P={x:S.x,y:S.y,px:S.x*TS,py:S.y*TS,moving:false,dir:'down',step:0};save();closeOv();startIntro()}else{$('#rs').dataset.c=1;$('#rs').textContent='Tap again to confirm reset'}};
}

/* ================= boot ================= */
$('#bDex').onclick=()=>{if(!B||ov.hidden||!ov.querySelector('#bt'))openDex()};
$('#bParent').onclick=()=>{if(ov.hidden||!ov.querySelector('#bt'))openParent()};
$('#bAudio').onclick=()=>{GameAudio.unlock();GameAudio.toggle();refreshHud()};
addEventListener('pointerdown',()=>GameAudio.unlock(),{once:true});
addEventListener('keydown',()=>GameAudio.unlock(),{once:true});
refreshHud();
lastZone=zoneAt(P.x,P.y);
loop();
function openLevelPicker(fromParent){
  openOv(`<div class="panel"><div class="phead"><h2>${fromParent?'Switch level':'Choose your level'}</h2>${fromParent?'<button class="close" id="x" aria-label="Back">✕</button>':''}</div>
    <p class="msg">${fromParent?'Each level is a separate game with its own save. Switching keeps the progress on every level.':'Pick the school level you are studying. You will stay on this level until you finish it. A parent can switch levels later in the Parent Panel.'}</p>
    <div class="lv-grid">${LEVELS.map(l=>`<button class="lv-card ${l.id===LEVEL?'on':''}" data-l="${l.id}" ${l.ready?'':'disabled'}><b>${l.label}</b><span>${l.ready?(l.id===LEVEL?'Playing now':'Ready'):'Coming soon'}</span></button>`).join('')}</div></div>`);
  if(fromParent)$('#x').onclick=openParent;
  ov.querySelectorAll('.lv-card').forEach(b=>b.onclick=()=>{
    const id=b.dataset.l;if(fromParent&&id===LEVEL)return openParent();
    save();LEVEL=id;try{localStorage.setItem(PROFILE_KEY,JSON.stringify({level:id}))}catch(e){}
    loadSave(id);P={x:S.x,y:S.y,px:S.x*TS,py:S.y*TS,moving:false,dir:S.dir,step:0};
    $('#hLevel').textContent=LEVELS.find(l=>l.id===id).label.replace('Primary ','P');refreshHud();save();closeOv();startIntro();
  });
}
function startIntro(){if(S.seenIntro)return;S.seenIntro=true;save();
  dialog('Grandma Wang',['Welcome to <b>Scholar Village</b>, young hero!','The Muddle King has got everyone in the village all muddled up. The creatures in the tall grass have <b>54 word spirits</b> sealed inside them: the words from Lessons 1 to 3.','Beat a creature to free its spirit and add it to your Spirit Book. Once your spirits are strong enough, the Gatekeeper will let you challenge the Muddle King!','Watch your HP: creatures fight back! Rest at the Inn when you get tired.','Visit the <b>Reading Hall</b> too. The villagers will ask you about its passage, and they have something you need to reach the Muddle King.','You could hear a story from the Storyteller first, or head straight into the grass. Good luck!']);}
if(!LEVEL)openLevelPicker(false);else{$('#hLevel').textContent=LEVELS.find(l=>l.id===LEVEL).label.replace('Primary ','P');startIntro()}
