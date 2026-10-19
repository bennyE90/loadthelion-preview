import {verifyPublicDraw} from './draw-proof.mjs';
import {participantName,revealFrame,chainReceiptUrl,viewerOutcome,REVEAL_DURATION} from './draw-grid-model.mjs';
import {createDrawAudio} from './draw-audio.mjs';
const $=id=>document.getElementById(id),cards=[],names=[],audio=createDrawAudio();
let celebrationTimer,prizeUrl=null,previewing=false,previewFocus=null,previewSerial=0;
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
  paint(p.final.ranking,p.probabilitiesPercent,await profiles(p.final.ranking));$('draw-studio').hidden=p.prizesEnabled!==false;
  const first=new Date(p.final.eventStart*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'}),last=new Date(p.final.snapshotTimestamp*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
  $('draw-event').textContent=`${first} — ${last} · UTC`;$('draw-play').disabled=false;$('draw-play').textContent='WATCH THE FINAL ROAR';$('draw-state').textContent='Ready when you are';
  const chain=chainReceiptUrl(p.onchain);if(chain){$('draw-chain-proof').href=chain;$('draw-chain-proof').hidden=false;$('draw-chain-pending').hidden=true}
 }catch{$('draw-title').textContent='REVEAL PAUSED';$('draw-play').textContent='TRY AGAIN LATER';$('draw-state').textContent='Verified result unavailable'}
}
function visible(){if(!document.hidden)return Promise.resolve();return new Promise(resolve=>{const check=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',check);resolve()}};document.addEventListener('visibilitychange',check)})}
async function loadViewer(){
 try{const r=await fetch('/api/profile/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(3500)});if(!r.ok)return null;const p=await r.json();if(!/^0x[0-9a-f]{40}$/i.test(p.address||''))return null;const link=$('draw-viewer-link');link.textContent=typeof p.nickname==='string'&&p.nickname.trim()?p.nickname.trim():short(p.address);link.href='settings.html';return p.address.toLowerCase()}catch{return null}
}
function prize(prefix,outcome){const show=outcome==='winner'&&!!prizeUrl;$(prefix+'-prize').hidden=!show;if(show){$(prefix+'-prize-image').src=prizeUrl;if(prefix==='draw')$('draw-prize-caption').textContent='ANTEPRIMA PREMIO · TEST'}}
function clearResult(){clearTimeout(celebrationTimer);$('draw-celebration').replaceChildren();$('draw-celebration').classList.remove('loss-glow');$('draw-result').hidden=true;document.querySelector('.reveal-stage').classList.remove('personal-win','personal-loss')}
function celebrate(outcome,reduced){
 const layer=$('draw-celebration');
 if(outcome==='loser'){if(!reduced)layer.classList.add('loss-glow');return}
 if(reduced||outcome==='not-entered')return;
 for(let i=0;i<(outcome==='winner'?86:42);i++){const spark=document.createElement('i');spark.style.setProperty('--x',((i*37)%100)+'%');spark.style.setProperty('--size',(3+i%4)+'px');spark.style.setProperty('--delay',(i%13*.035)+'s');spark.style.setProperty('--drift',((i*29)%160-80)+'px');spark.style.setProperty('--turn',(i%2?'-':'')+(180+i*17)+'deg');spark.style.setProperty('--color',['#eebb77','#ea4261','#fff0c9'][i%3]);layer.append(spark)}
 celebrationTimer=setTimeout(()=>layer.replaceChildren(),3400);
}
function showOutcome(outcome,reduced){
 const text={winner:['★','ROOOOAR, YOU WON!','Un Loaded Lion. Un nuovo capitolo della tua leggenda. · TEST'],loser:['↻','ALLA PROSSIMA ESTRAZIONE','Ritenta, sarai più fortunato.'],spectator:['★','IL RUGGITO HA SCELTO','Il vincitore è stato rivelato.'],'not-entered':['◇','ESTRAZIONE CONCLUSA','Il tuo wallet non era tra i 100 finalisti.']}[outcome];
 $('draw-result-symbol').textContent=text[0];$('draw-result-title').textContent=text[1];$('draw-result-message').textContent=text[2];$('draw-result').dataset.outcome=outcome;$('draw-result').hidden=false;
 if(outcome==='winner')document.querySelector('.reveal-stage').classList.add('personal-win');if(outcome==='loser')document.querySelector('.reveal-stage').classList.add('personal-loss');prize('draw',outcome);celebrate(outcome,reduced);audio.finish(outcome);
}
async function play(){
 if(!verified||playing||previewing)return;playing=true;$('draw-play').disabled=true;clearResult();document.querySelector('.reveal-stage').classList.remove('finished');for(const card of [...cards,...atlas])card.classList.remove('winner','active');active=-1;theater(true);
 const music=audio.start(),viewer=loadViewer();
 $('draw-kicker').textContent='THE PRIDE IS WATCHING';$('draw-title').textContent='LET THE ROAR BEGIN';$('draw-wallet').textContent='';$('draw-state').textContent='The reveal is in motion';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?3000:REVEAL_DURATION,offset=parseInt(evidence.draw.randomness.slice(0,4),16)%100;
 try{
  const audioReady=await music;$('draw-sound').dataset.ready=String(audioReady);
  await new Promise(resolve=>{let start;function frame(now){if(start===undefined)start=now;const view=revealFrame(now-start,duration,offset);$('draw-progress').style.width=view.progress*100+'%';audio.update(view.progress);$('draw-kicker').textContent=view.phase;if(view.done){resolve();return}if(!reduced&&view.index!==active){highlight(view.index);audio.tick(view.index);$('draw-title').textContent=names[view.index];$('draw-wallet').textContent=short(evidence.final.ranking[view.index].address)}requestAnimationFrame(frame)}requestAnimationFrame(frame)});
  await visible();const row=evidence.final.ranking[verified.rank-1],name=names[verified.rank-1];highlight(verified.rank-1,true);
  $('draw-kicker').textContent='THE WINNER';$('draw-title').textContent=name;$('draw-wallet').textContent=row.address;$('draw-state').textContent='FINAL RANK #'+String(verified.rank).padStart(3,'0')+' · '+percent(evidence.probabilitiesPercent[verified.rank-1]);
  theater(false);document.querySelector('.reveal-stage').classList.add('finished');showOutcome(viewerOutcome(await viewer,verified.winner,evidence.final.ranking),reduced);$('draw-play').textContent='WATCH AGAIN';
 }catch{audio.stop();$('draw-state').textContent='Playback interrupted · result unchanged';$('draw-play').textContent='WATCH AGAIN'}finally{theater(false);playing=false;$('draw-play').disabled=false}
}
$('draw-sound').addEventListener('click',()=>{audio.setMuted(!audio.muted);$('draw-sound').textContent=audio.muted?'♫ AUDIO OFF':'♫ AUDIO ON';$('draw-sound').setAttribute('aria-pressed',String(!audio.muted))});
document.addEventListener('visibilitychange',()=>audio.setHidden(document.hidden));
window.addEventListener('pagehide',()=>audio.dispose());
$('draw-play').addEventListener('click',play);loadViewer();load();

$('draw-expand').addEventListener('click',()=>theater(true));$('draw-exit').addEventListener('click',()=>theater(false));
async function preview(outcome){
 if(playing||previewing)return;previewing=true;const serial=++previewSerial;previewFocus=document.activeElement;
 const ready=audio.start();$('draw-preview').hidden=false;$('draw-preview').dataset.outcome=outcome;
 $('preview-title').textContent=outcome==='winner'?'ROOOOAR, YOU WON!':'ALLA PROSSIMA ESTRAZIONE';
 $('preview-message').textContent=outcome==='winner'?'Il ruggito è tuo. Libera il tuo Loaded Lion.':'Ritenta, sarai più fortunato.';
 prize('preview',outcome);$('preview-prize-empty').hidden=outcome!=='winner'||!!prizeUrl;
 $('preview-close').focus();await ready;if(!previewing||serial!==previewSerial)return;celebrate(outcome,matchMedia('(prefers-reduced-motion: reduce)').matches);audio.finish(outcome);
}
function closePreview(){if(!previewing)return;previewing=false;previewSerial++;audio.stop();clearTimeout(celebrationTimer);$('draw-celebration').replaceChildren();$('draw-celebration').classList.remove('loss-glow');$('draw-preview').hidden=true;previewFocus?.focus()}
$('preview-win').addEventListener('click',()=>preview('winner'));$('preview-loss').addEventListener('click',()=>preview('loser'));$('preview-close').addEventListener('click',closePreview);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closePreview();theater(false)}if(event.key==='Tab'&&previewing){event.preventDefault();$('preview-close').focus()}});
$('prize-upload').addEventListener('change',()=>{const file=$('prize-upload').files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){$('prize-upload-status').textContent='Scegli un JPG, PNG o WebP entro 8 MB.';return}const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{if(prizeUrl)URL.revokeObjectURL(prizeUrl);prizeUrl=url;$('prize-upload-status').textContent='Loaded Lion pronto per l’anteprima · solo in questa scheda';if($('draw-result').dataset.outcome==='winner')prize('draw','winner')};image.onerror=()=>{URL.revokeObjectURL(url);$('prize-upload-status').textContent='Immagine non leggibile: scegli un altro file.'};image.src=url});
