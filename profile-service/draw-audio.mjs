// Original synthesised soundtrack. Audio never supplies entropy or changes a draw.
export function createDrawAudio({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
 let ctx=null,master=null,music=null,riser=null,run=false,muted=false,hidden=false,nextBeat=0,beat=0,progress=0;
 const sources=new Set();
 function level(){if(master&&ctx)master.gain.setTargetAtTime(muted||hidden?0:.24,ctx.currentTime,.025)}
 function oscillator(frequency,time,length,gain=.08,type='sine',bus=master){
  if(!ctx||!bus)return null;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,time);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),time+.008);g.gain.exponentialRampToValueAtTime(.0001,time+length);o.connect(g);g.connect(bus);sources.add(o);o.onended=()=>{sources.delete(o);o.disconnect();g.disconnect()};o.start(time);o.stop(time+length+.025);return o;
 }
 function halt(){run=false;for(const o of sources){try{o.stop()}catch{}}sources.clear();if(music){music.disconnect();music=null}riser=null}
 return {
  get muted(){return muted},get active(){return !!ctx&&ctx.state==='running'},
  setMuted(value){muted=!!value;level()},setHidden(value){hidden=!!value;level()},
  async start(){
   halt();if(!AudioContext)return false;
   try{if(!ctx){ctx=new AudioContext();master=ctx.createGain();const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=4;master.connect(compressor);compressor.connect(ctx.destination)}await ctx.resume();level();music=ctx.createGain();music.gain.value=.75;music.connect(master);run=true;progress=0;nextBeat=ctx.currentTime+.025;beat=0;
    riser=oscillator(92,ctx.currentTime,60,.025,'triangle',music);return true;
   }catch{run=false;return false}
  },
  update(value){
   if(!run||!ctx||ctx.state!=='running')return;progress=Math.max(0,Math.min(1,value));
   music.gain.setTargetAtTime(.55+progress*.6,ctx.currentTime,.1);if(riser)riser.frequency.setTargetAtTime(92+progress*350,ctx.currentTime,.16);
   if(nextBeat<ctx.currentTime-.2)nextBeat=ctx.currentTime;
   let count=0;while(nextBeat<ctx.currentTime+.12&&count++<3){
    const step=60/(108+progress*64)/2;
    if(beat%2===0){const kick=oscillator(100,nextBeat,.15,.28,'sine',music);kick.frequency.exponentialRampToValueAtTime(42,nextBeat+.13)}
    oscillator([73.42,73.42,87.31,110][Math.floor(beat/2)%4],nextBeat,.13,.065,'triangle',music);
    oscillator([293.66,349.23,440,523.25,440,349.23,293.66,220][beat%8],nextBeat,.09,.018+progress*.018,'sine',music);
    oscillator(4500+progress*1200,nextBeat,.021,.008,'triangle',music);
    if(progress>.7)oscillator(880,nextBeat+step/2,.035,.018,'sine',music);
    nextBeat+=step;beat++;
   }
  },
  tick(index){if(run&&ctx&&ctx.state==='running')oscillator(520+(index%12)*29,ctx.currentTime,.035,.055,'triangle',music)},
  finish(outcome){
   halt();if(!ctx||ctx.state!=='running')return;const t=ctx.currentTime+.04;
   if(outcome==='loser'){
    [329.63,293.66,246.94,196].forEach((f,i)=>oscillator(f,t+i*.2,.38,.13,'sine'));
    [196,246.94].forEach(f=>oscillator(f,t+.8,.85,.04,'triangle'));
   }else if(outcome==='winner'||outcome==='spectator'){
    if(outcome==='winner'){const roar=oscillator(130,t,1.7,.18,'triangle');roar.frequency.exponentialRampToValueAtTime(38,t+1.6);[587.33,739.99,880].forEach((f,i)=>oscillator(f,t+.9+i*.16,1.2,.065,'sine'))}
    [293.66,369.99,440].forEach(f=>oscillator(f,t,.75,outcome==='winner'?.11:.075,'triangle'));
    [587.33,739.99,880,1174.66].forEach((f,i)=>oscillator(f,t+.14+i*.14,.45,.1,'sine'));
    oscillator(73.42,t,1,.17,'sine');[0,.28,.56].forEach(d=>oscillator(130,t+d,.1,.18,'sine'));
   }else{oscillator(440,t,.3,.09);oscillator(587.33,t+.16,.45,.07)}
  },
  stop(){halt()},dispose(){halt();if(ctx){void ctx.close();ctx=null;master=null}}
 };
}
