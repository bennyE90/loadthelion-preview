// Original synthesised soundtrack. Audio never supplies entropy or changes a draw.
export function createDrawAudio({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
 let ctx=null,master=null,music=null,riser=null,run=false,muted=false,hidden=false,nextBeat=0,beat=0,progress=0;
 const sources=new Set();
 function level(){if(master&&ctx)master.gain.setTargetAtTime(muted||hidden?0:.85,ctx.currentTime,.025)}
 function oscillator(frequency,time,length,gain=.08,type='sine',bus=master){
  if(!ctx||!bus)return null;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,time);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),time+.008);g.gain.exponentialRampToValueAtTime(.0001,time+length);o.connect(g);g.connect(bus);sources.add(o);o.onended=()=>{sources.delete(o);o.disconnect();g.disconnect()};o.start(time);o.stop(time+length+.025);return o;
 }
 function halt(){run=false;for(const o of sources){try{o.stop()}catch{}}sources.clear();if(music){music.disconnect();music=null}riser=null}
 return {
  get muted(){return muted},get active(){return !!ctx&&ctx.state==='running'},
  setMuted(value){muted=!!value;level()},setHidden(value){hidden=!!value;level()},
  async start(){
   halt();if(!AudioContext)return false;
   try{if(!ctx){ctx=new AudioContext();master=ctx.createGain();const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-8;compressor.ratio.value=6;master.connect(compressor);compressor.connect(ctx.destination)}await ctx.resume();level();music=ctx.createGain();music.gain.value=.75;music.connect(master);run=true;progress=0;nextBeat=ctx.currentTime+.025;beat=0;
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
  finish(){
   halt();if(!ctx||ctx.state!=='running')return;const t=ctx.currentTime+.04;
   // Eight-second stadium finale: layered brass, sub impact, drums and a rising lead.
   const chords=[[146.83,185,220],[123.47,146.83,185],[98,123.47,146.83],[110,138.59,164.81],[146.83,185,220]];
   chords.forEach((notes,c)=>{const at=t+c*1.15,duration=c===4?3:.95;
    notes.forEach(f=>{oscillator(f,at,duration,.105,'triangle');oscillator(f*2,at,duration,.042,'sawtooth');oscillator(f*1.004,at,duration,.055,'triangle')});
    oscillator(notes[0]/2,at,duration,.24,'sine');
   });
   for(let beat=0;beat<20;beat++){const at=t+beat*.2875,kick=oscillator(150,at,.22,.38,'sine');kick.frequency.exponentialRampToValueAtTime(42,at+.2);if(beat%2)oscillator(2200,at,.09,.035,'triangle')}
   [293.66,369.99,440,587.33,440,587.33,739.99,880,1174.66].forEach((f,i)=>{oscillator(f,t+i*.2875,.55,.14,'triangle');oscillator(f*1.003,t+i*.2875,.55,.065,'sine')});
   [587.33,739.99,880,1174.66].forEach((f,i)=>oscillator(f,t+4.6+i*.12,2.6,.08,'triangle'));
   const impact=oscillator(160,t,1.6,.3,'triangle');impact.frequency.exponentialRampToValueAtTime(35,t+1.5);
  },
  stop(){halt()},dispose(){halt();if(ctx){void ctx.close();ctx=null;master=null}}
 };
}
