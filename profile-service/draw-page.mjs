import {verifyPublicDraw} from './draw-proof.mjs';
import {participantName,revealFrame,chainReceiptUrl,publishedPrize,REVEAL_DURATION} from './draw-grid-model.mjs';
import {createDrawAudio} from './draw-audio.mjs';
const $=id=>document.getElementById(id),cards=[],names=[],audio=createDrawAudio();
let celebrationTimer,prizeUrl=null,sharedPrize=null,previewing=false,previewFocus=null,previewSerial=0;
const atlas=[];
let evidence=null,verified=null,playing=false,active=-1;
const short=a=>a.slice(0,6)+'…'+a.slice(-4),percent=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(n)+'%';
function highlight(index,winner=false){if(active>=0){cards[active]?.classList.remove('active');atlas[active]?.classList.remove('active')}active=index;cards[index]?.classList.add(winner?'winner':'active');atlas[index]?.classList.add(winner?'winner':'active')}
function theater(value){document.querySelector('.reveal-stage').classList[value?'add':'remove']('theater');$('draw-exit').hidden=!value}

function paint(rows,probabilities,profiles=[]){
 const mapped=new Map(profiles.filter(p=>/^0x[0-9a-f]{40}$/i.test(p?.address)).map(p=>[p.address.toLowerCase(),p]));
 $('draw-candidates').replaceChildren();$('draw-atlas').replaceChildren();cards.length=0;names.length=0;atlas.length=0;
 for(const [i,row] of rows.entries()){
  const card=document.createElement('li');card.className='candidate';card.dataset.wallet=row.address;
  const meta=document.createElement('div');meta.className='card-meta';const rank=document.createElement('span');rank.className='card-rank';rank.textContent='#'+String(row.rank).padStart(3,'0');const chance=document.createElement('span');chance.className='card-chance';chance.textContent=percent(probabilities[i]);meta.append(rank,chance);
  const name=document.createElement('strong');name.className='candidate-name';name.textContent=participantName(row,mapped.get(row.address));names.push(name.textContent);
  const wallet=document.createElement('span');wallet.className='candidate-wallet';wallet.textContent=short(row.address);wallet.title=row.address;wallet.hidden=name.textContent===short(row.address);
  const tile=document.createElement('button');tile.type='button';tile.className='atlas-tile';tile.textContent=String(row.rank).padStart(2,'0');tile.title='#'+row.rank+' · '+name.textContent;tile.setAttribute('aria-label',tile.title);tile.addEventListener('click',()=>{$('draw-inspect').textContent=tile.title+' · '+short(row.address)});$('draw-atlas').append(tile);atlas.push(tile);
  card.append(meta,name,wallet);$('draw-candidates').append(card);cards.push(card);
 }
}
async function profiles(rows){try{const r=await fetch('/api/profile/lookup',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({addresses:rows.map(r=>r.address)}),signal:AbortSignal.timeout(5000)});if(!r.ok)return [];const p=await r.json();return Array.isArray(p.profiles)?p.profiles:[]}catch{return []}}
async function load(){
 try{
  const r=await fetch('/api/roar/draw',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Proof unavailable');const p=await r.json();
  if(p.status==='PENDING'){$('draw-title').textContent='THE PRIDE IS GATHERING';$('draw-play').textContent='RESULTS PENDING';$('draw-state').textContent='Waiting for the closed event';return}
  const result=await verifyPublicDraw(p);evidence=p;verified=result;
  const [people,award]=await Promise.all([profiles(p.final.ranking),loadPrize(p.plan?.eventId)]);sharedPrize=award;paint(p.final.ranking,p.probabilitiesPercent,people);$('draw-studio').hidden=p.prizesEnabled!==false;
  const first=new Date(p.final.eventStart*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'}),last=new Date(p.final.snapshotTimestamp*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
  $('draw-event').textContent=`${first} — ${last} · UTC`;$('draw-play').disabled=false;$('draw-play').textContent='WATCH THE FINAL ROAR';$('draw-state').textContent='Ready when you are';
  const chain=chainReceiptUrl(p.onchain);if(chain){$('draw-chain-proof').href=chain;$('draw-chain-proof').hidden=false;$('draw-chain-pending').hidden=true}
 }catch{$('draw-title').textContent='REVEAL PAUSED';$('draw-play').textContent='TRY AGAIN LATER';$('draw-state').textContent='Verified result unavailable'}
}
function visible(){if(!document.hidden)return Promise.resolve();return new Promise(resolve=>{const check=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',check);resolve()}};document.addEventListener('visibilitychange',check)})}
async function loadViewer(){
 try{const r=await fetch('/api/profile/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(3500)});if(!r.ok)return null;const p=await r.json();if(!/^0x[0-9a-f]{40}$/i.test(p.address||''))return null;const link=$('draw-viewer-link');link.textContent=typeof p.nickname==='string'&&p.nickname.trim()?p.nickname.trim():short(p.address);link.href='settings.html';return p.address.toLowerCase()}catch{return null}
}
async function loadPrize(eventId){try{const response=await fetch('/draw-prize.json',{cache:'no-store',signal:AbortSignal.timeout(3500)});return response.ok?publishedPrize(await response.json(),eventId):null}catch{return null}}
function prize(prefix){const src=prizeUrl||sharedPrize?.image;$(prefix+'-prize').hidden=!src;if(src){$(prefix+'-prize-image').src=src;if(prefix==='draw')$('draw-prize-caption').textContent=prizeUrl?'ANTEPRIMA IMMAGINE · SOLO QUESTA SCHEDA':sharedPrize.name+' · TEST'}if(prefix==='draw')$('draw-prize-empty').hidden=!!src;else $('preview-prize-empty').hidden=!!src}
function clearResult(){clearTimeout(celebrationTimer);$('draw-celebration').replaceChildren();$('draw-result').hidden=true;document.querySelector('.reveal-stage').classList.remove('personal-win')}
function celebrate(reduced){
 if(reduced)return;const layer=$('draw-celebration');
 for(let i=0;i<110;i++){const spark=document.createElement('i');spark.style.setProperty('--x',((i*37)%100)+'%');spark.style.setProperty('--size',(3+i%4)+'px');spark.style.setProperty('--delay',(i%13*.035)+'s');spark.style.setProperty('--drift',((i*29)%160-80)+'px');spark.style.setProperty('--turn',(i%2?'-':'')+(180+i*17)+'deg');spark.style.setProperty('--color',['#eebb77','#ea4261','#fff0c9'][i%3]);layer.append(spark)}
 celebrationTimer=setTimeout(()=>layer.replaceChildren(),3400);
}
function showWinner(reduced){
 $('draw-result-symbol').textContent='★';$('draw-result-title').textContent='ROOOOAR, YOU WON!';$('draw-result-message').textContent=names[verified.rank-1]+' · THE WINNER · TEST';$('draw-result').dataset.outcome='winner';$('draw-result').hidden=false;
 document.querySelector('.reveal-stage').classList.add('personal-win');prize('draw');celebrate(reduced);audio.finish();
}
async function play(){
 if(!verified||playing||previewing)return;playing=true;$('draw-play').disabled=true;clearResult();document.querySelector('.reveal-stage').classList.remove('finished');for(const card of [...cards,...atlas])card.classList.remove('winner','active');active=-1;theater(true);
 const music=audio.start();
 $('draw-kicker').textContent='THE PRIDE IS WATCHING';$('draw-title').textContent='LET THE ROAR BEGIN';$('draw-wallet').textContent='';$('draw-state').textContent='The reveal is in motion';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?3000:REVEAL_DURATION;
 try{
  const audioReady=await music;$('draw-sound').dataset.ready=String(audioReady);
  await new Promise(resolve=>{let start;function frame(now){if(start===undefined)start=now;const view=revealFrame(now-start,duration);audio.update(view.progress);$('draw-kicker').textContent=view.phase;if(view.done){resolve();return}if(!reduced&&view.index!==active){highlight(view.index);audio.tick(view.index);$('draw-title').textContent=names[view.index];$('draw-wallet').textContent=short(evidence.final.ranking[view.index].address)}requestAnimationFrame(frame)}requestAnimationFrame(frame)});
  await visible();const row=evidence.final.ranking[verified.rank-1],name=names[verified.rank-1];highlight(verified.rank-1,true);
  $('draw-kicker').textContent='THE WINNER';$('draw-title').textContent=name;$('draw-wallet').textContent=row.address;$('draw-state').textContent='FINAL RANK #'+String(verified.rank).padStart(3,'0')+' · '+percent(evidence.probabilitiesPercent[verified.rank-1]);
  theater(false);document.querySelector('.reveal-stage').classList.add('finished');showWinner(reduced);$('draw-play').textContent='WATCH AGAIN';
 }catch{audio.stop();$('draw-state').textContent='Playback interrupted · result unchanged';$('draw-play').textContent='WATCH AGAIN'}finally{theater(false);playing=false;$('draw-play').disabled=false}
}
$('draw-sound').addEventListener('click',()=>{audio.setMuted(!audio.muted);$('draw-sound').textContent=audio.muted?'♫ AUDIO OFF':'♫ AUDIO ON';$('draw-sound').setAttribute('aria-pressed',String(!audio.muted))});
document.addEventListener('visibilitychange',()=>audio.setHidden(document.hidden));
window.addEventListener('pagehide',()=>audio.dispose());
$('draw-play').addEventListener('click',play);loadViewer();load();

$('draw-expand').addEventListener('click',()=>theater(true));$('draw-exit').addEventListener('click',()=>theater(false));
async function preview(){
 if(playing||previewing)return;previewing=true;const serial=++previewSerial;previewFocus=document.activeElement;
 const ready=audio.start();$('draw-preview').hidden=false;$('draw-preview').dataset.outcome='winner';
 $('preview-title').textContent='ROOOOAR, YOU WON!';
 $('preview-message').textContent='Un solo vincitore. Un unico grande ruggito per tutta la Pride.';
 prize('preview');
 $('preview-close').focus();await ready;if(!previewing||serial!==previewSerial)return;celebrate(matchMedia('(prefers-reduced-motion: reduce)').matches);audio.finish();
}
function closePreview(){if(!previewing)return;previewing=false;previewSerial++;audio.stop();clearTimeout(celebrationTimer);$('draw-celebration').replaceChildren();$('draw-preview').hidden=true;previewFocus?.focus()}
$('preview-win').addEventListener('click',preview);$('preview-close').addEventListener('click',closePreview);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closePreview();theater(false)}if(event.key==='Tab'&&previewing){event.preventDefault();$('preview-close').focus()}});
$('prize-upload').addEventListener('change',()=>{const file=$('prize-upload').files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){$('prize-upload-status').textContent='Scegli un JPG, PNG o WebP entro 8 MB.';return}const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{if(prizeUrl)URL.revokeObjectURL(prizeUrl);prizeUrl=url;$('prize-upload-status').textContent='Loaded Lion pronto per l’anteprima · solo in questa scheda';if($('draw-result').dataset.outcome==='winner')prize('draw')};image.onerror=()=>{URL.revokeObjectURL(url);$('prize-upload-status').textContent='Immagine non leggibile: scegli un altro file.'};image.src=url});
