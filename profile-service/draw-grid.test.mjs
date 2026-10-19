import test from 'node:test';
import assert from 'node:assert/strict';
import {participantName,revealFrame,winnerMessage,chainReceiptUrl,publishedPrize} from './draw-grid-model.mjs';
test('finalists use registered names and identifiable wallet fallbacks without inventing nicknames',()=>{
 const row={address:'0x'+'a'.repeat(40)};
 assert.equal(participantName(row,{nickname:'  The Lion  '}),'The Lion');
 for(const profile of [null,{}, {nickname:''},{nickname:' '.repeat(5)},{nickname:'x'.repeat(49)}])assert.equal(participantName(row,profile),'0xaaaa…aaaa');
 assert.equal(participantName(row,{nickname:'A'.repeat(48)}),'A'.repeat(48));
});
test('repeated ascending laps wrap 100 to 1 and decelerate to every verified winner',()=>{
 for(let rank=1;rank<=100;rank++)for(const seed of [0,1,2,100]){
  let last=-1;const seen=[];
  for(let at=0;at<45000;at+=16){const f=revealFrame(at,45000,rank,seed);assert.equal(f.done,false);if(f.step!==last){if(last>=0)assert.equal(f.step,last+1);last=f.step;seen.push(f.index)}}
  const final=revealFrame(45000,45000,rank,seed);assert.equal(final.index,rank-1);assert.equal(final.done,true);assert.equal(final.step,last);assert(seen.length>=300);assert.equal(seen[99],99);assert.equal(seen[100],0);
  assert(revealFrame(1000,45000,rank,seed).step>final.step-revealFrame(44000,45000,rank,seed).step);
 }
 assert.notEqual(revealFrame(10000,45000,12,0).laps,revealFrame(10000,45000,12,1).laps);
});
test('winner message includes the actual displayed nickname or wallet',()=>{assert.equal(winnerMessage('Lion King'),'ROOOOAR, Lion King, YOU WON!!! 🎉🎉🎉')});
test('only a confirmed Cronos transaction produces the single chain-proof link',()=>{
 const tx='0x'+'a'.repeat(64);
 for(const receipt of [null,{}, {status:'NOT_REGISTERED',chainId:25,transactionHash:tx},{status:'CONFIRMED',chainId:1,transactionHash:tx},{status:'CONFIRMED',chainId:25,transactionHash:'javascript:bad'}])assert.equal(chainReceiptUrl(receipt),null);
 assert.equal(chainReceiptUrl({status:'CONFIRMED',chainId:25,transactionHash:tx}),'https://explorer.cronos.org/tx/'+tx);
});

test('a shared prize must match the exact event and a local image asset',()=>{
 assert.equal(publishedPrize({eventId:'old',image:'assets/prize.webp'},'new'),null);
 for(const image of [null,'https://evil.test/nft.png','assets/../x.png','javascript:bad'])assert.equal(publishedPrize({eventId:'week',image},'week'),null);
 assert.deepEqual(publishedPrize({eventId:'week',image:'assets/lion-42.webp',name:'Loaded Lion #42'},'week'),{image:'assets/lion-42.webp',name:'Loaded Lion #42'});
});

test('winner holds visibly before celebration; the preceding rank cannot look like the final stop',()=>{
 for(let rank=1;rank<=100;rank++)for(const seed of [0,1,2]){
  const hold=revealFrame(43000,45000,rank,seed);assert.equal(hold.locked,true);assert.equal(hold.index,rank-1);assert.equal(hold.done,false);
  const tail=revealFrame(44999,45000,rank,seed);assert.equal(tail.index,rank-1);assert.equal(tail.locked,true);
  let previousHold=0;for(let at=40000;at<45000;at+=16){const f=revealFrame(at,45000,rank,seed);if(f.step===hold.step-1)previousHold+=16}assert(previousHold<1300);
 }
});

test('the final tile pauses normally before its delayed winner illumination',()=>{
 for(let rank=1;rank<=100;rank++)for(const seed of [0,1,2]){
  const suspense=revealFrame(43000,45000,rank,seed);assert.equal(suspense.locked,true);assert.equal(suspense.confirmed,false);assert.equal(suspense.index,rank-1);
  assert.equal(revealFrame(44000,45000,rank,seed).confirmed,false);assert.equal(revealFrame(44400,45000,rank,seed).confirmed,true);assert.equal(revealFrame(45000,45000,rank,seed).confirmed,true);
 }
});
