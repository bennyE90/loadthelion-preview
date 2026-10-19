import test from 'node:test';
import assert from 'node:assert/strict';
import {participantName,revealFrame,chainReceiptUrl,publishedPrize} from './draw-grid-model.mjs';
test('finalists use registered names and identifiable wallet fallbacks without inventing nicknames',()=>{
 const row={address:'0x'+'a'.repeat(40)};
 assert.equal(participantName(row,{nickname:'  The Lion  '}),'The Lion');
 for(const profile of [null,{}, {nickname:''},{nickname:' '.repeat(5)},{nickname:'x'.repeat(49)}])assert.equal(participantName(row,profile),'0xaaaa…aaaa');
 assert.equal(participantName(row,{nickname:'A'.repeat(48)}),'A'.repeat(48));
});
test('the 45-second reveal visits ranks 1 through 100 exactly in order and never reveals early',()=>{
 const seen=[];for(let at=0;at<45000;at+=16){const frame=revealFrame(at,45000);assert.equal(frame.done,false);if(seen.at(-1)!==frame.index)seen.push(frame.index)}assert.deepEqual(seen,Array.from({length:100},(_,i)=>i));
 assert.equal(revealFrame(44999,45000).done,false);assert.equal(revealFrame(45000,45000).done,true);
 assert.equal(revealFrame(0,45000).index,0);assert.equal(revealFrame(44999,45000).index,99);
});
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
