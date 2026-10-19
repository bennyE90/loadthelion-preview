import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawAudio} from './draw-audio.mjs';
function engine(){const events=[];const param=()=>({value:0,setValueAtTime(v,t){events.push(['value',v,t])},exponentialRampToValueAtTime(v,t){events.push(['ramp',v,t])},setTargetAtTime(v,t){events.push(['target',v,t])}});class Context{currentTime=0;state='running';destination={};createGain(){return {gain:param(),connect(){},disconnect(){}}}createDynamicsCompressor(){return {threshold:param(),ratio:param(),connect(){}}}createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(t){events.push(['start',t])},stop(t){events.push(['stop',t])}}}async resume(){}async close(){this.state='closed'}}const audio=createDrawAudio({AudioContext:Context});return {audio,events}}
test('soundtrack starts on demand, accents participant changes and grows toward the finish',async()=>{
 const {audio,events}=engine();assert.equal(events.length,0);assert.equal(await audio.start(),true);audio.update(0);audio.tick(3);const before=events.filter(x=>x[0]==='start').length;audio.update(.95);audio.tick(4);assert(events.filter(x=>x[0]==='start').length>before);assert(events.some(x=>x[0]==='target'&&x[1]===1.12));audio.stop();assert(events.some(x=>x[0]==='stop'));
});
test('mute and background visibility silence the master without changing outcome logic',async()=>{
 const {audio,events}=engine();await audio.start();audio.setMuted(true);assert.equal(audio.muted,true);assert.deepEqual(events.at(-1).slice(0,2),['target',0]);audio.setMuted(false);assert.deepEqual(events.at(-1).slice(0,2),['target',.24]);audio.setHidden(true);assert.deepEqual(events.at(-1).slice(0,2),['target',0]);audio.setHidden(false);assert.deepEqual(events.at(-1).slice(0,2),['target',.24]);audio.dispose();
});
test('winning fanfare and losing cadence are distinct and never reroll a result',async()=>{
 for(const outcome of ['winner','loser','spectator','not-entered']){const {audio,events}=engine();await audio.start();const at=events.length;audio.finish(outcome);const notes=events.slice(at).filter(x=>x[0]==='value').map(x=>x[1]);assert(notes.includes(outcome==='loser'?329.63:outcome==='not-entered'?440:1174.66));audio.dispose()}
});
test('unavailable audio is harmless to playback',async()=>{const audio=createDrawAudio({AudioContext:null});assert.equal(await audio.start(),false);audio.update(.8);audio.tick(12);audio.finish('winner');audio.dispose()});
