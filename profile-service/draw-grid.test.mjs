import test from 'node:test';
import assert from 'node:assert/strict';
import {participantName,revealFrame,chainReceiptUrl} from './draw-grid-model.mjs';
test('finalists use registered names and identifiable wallet fallbacks without inventing nicknames',()=>{
 const row={address:'0x'+'a'.repeat(40)};
 assert.equal(participantName(row,{nickname:'  The Lion  '}),'The Lion');
 for(const profile of [null,{}, {nickname:''},{nickname:' '.repeat(5)},{nickname:'x'.repeat(49)}])assert.equal(participantName(row,profile),'0xaaaa…aaaa');
 assert.equal(participantName(row,{nickname:'A'.repeat(48)}),'A'.repeat(48));
});
test('the presentation visits every finalist and cannot finish before the reveal deadline',()=>{
 for(const offset of [0,37,99]){const seen=new Set();for(let at=0;at<30000;at+=250){const f=revealFrame(at,45000,offset);assert.equal(f.done,false);seen.add(f.index)}assert.equal(seen.size,100)}
 assert.equal(revealFrame(14999,15000).done,false);assert.equal(revealFrame(15000,15000).done,true);
 assert.equal(revealFrame(2999,3000).done,false);assert.equal(revealFrame(3000,3000).done,true);
});
test('only a confirmed Cronos transaction produces the single chain-proof link',()=>{
 const tx='0x'+'a'.repeat(64);
 for(const receipt of [null,{}, {status:'NOT_REGISTERED',chainId:25,transactionHash:tx},{status:'CONFIRMED',chainId:1,transactionHash:tx},{status:'CONFIRMED',chainId:25,transactionHash:'javascript:bad'}])assert.equal(chainReceiptUrl(receipt),null);
 assert.equal(chainReceiptUrl({status:'CONFIRMED',chainId:25,transactionHash:tx}),'https://explorer.cronos.org/tx/'+tx);
});

test('45-second reveal keeps the full first pass readable and slows the last third',()=>{
 const first=new Set();for(let n=0;n<100;n++)first.add(revealFrame(n*300+1,45000).index);assert.equal(first.size,100);
 assert.equal(revealFrame(44999,45000).done,false);assert.equal(revealFrame(45000,45000).done,true);
 assert.equal(revealFrame(44900,45000).index,revealFrame(44000,45000).index);
});
