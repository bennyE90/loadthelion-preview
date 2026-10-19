import {eventStart,eventEnd} from './roar-calendar.mjs';
import {verifySnapshot} from './roar-data.mjs';
export const REWARD_TOKEN='0x7ebfd1b08e1d7413d6d8fe6c3eef28945ce776ef';
export const POOL_RAW=1000000n*10n**18n;
export const POOL_START=1792368000; // First explicitly funded simulation: 19 October 2026.
const UNIT=10n**12n,DENOMINATOR=100n*UNIT;
export function allocateRewards(raw,percentages){
 if(typeof raw!=='bigint'||raw<0n||!Array.isArray(percentages)||percentages.length!==100)throw Error('Invalid reward pool');
 const units=percentages.map((v,i)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0||(i&&v>=percentages[i-1])||!/^\d+(?:\.\d{1,12})?$/.test(String(v)))throw Error('Invalid reward weights');const [a,b='']=String(v).split('.');return BigInt(a)*UNIT+BigInt(b.padEnd(12,'0'))});
 const total=units.reduce((a,b)=>a+b,0n);
 // Preserve the approved percentages, including exactly 5% for #1. The table
 // is short by 0.000000000003 percentage points. Decimal/floor dust goes to #100.
 if(total>DENOMINATOR||DENOMINATOR-total>10n)throw Error('Reward weights do not total 100%');
 const amounts=units.map(v=>raw*v/DENOMINATOR);
 amounts[99]+=raw-amounts.reduce((a,b)=>a+b,0n);
 return amounts;
}
export function poolState(start,now){
 if(!Number.isSafeInteger(start)||start!==eventStart(start)||!Number.isSafeInteger(now))throw Error('Invalid reward event');
 const end=eventEnd(start),duration=end-start,elapsed=Math.max(0,Math.min(duration,now-start));
 const funded=start>=POOL_START,amount=funded?POOL_RAW:0n,emitted=amount*BigInt(elapsed)/BigInt(duration);
 return {start,end,funded,total:amount,emitted,remaining:amount-emitted,remainingPercent:100*(duration-elapsed)/duration,closed:now>=end};
}
export function verifyRewardFinal(payload,start,now){
 const end=eventEnd(start),s=payload?.snapshot;
 if(now<end||payload?.schema!==1||payload.status!=='FINAL'||payload.environment!=='ULTON_TEST'||payload.prizesEnabled!==false||payload.eventStart!==start||!/^[0-9a-f]{40}$/.test(payload.archiveCommit||'')||!/^[0-9a-f]{64}$/.test(payload.snapshotHash||''))throw Error('Final rewards not verified');
 if(s?.eventStart!==start||s.token!==REWARD_TOKEN||s.decimals!==18||s.prizesEnabled!==false||s.snapshotTimestamp!==end-1)throw Error('Final rewards event mismatch');
 const b=payload.boundary,n=x=>Number(BigInt(x));
 if(!b||n(b.block.number)!==s.snapshotBlock||b.block.hash!==s.blockHash||n(b.block.timestamp)>=end||n(b.nextBlock.timestamp)<end||n(b.nextBlock.number)!==s.snapshotBlock+1||b.nextBlock.parentHash!==s.blockHash||n(b.safeHead)<n(b.nextBlock.number))throw Error('Invalid final rewards boundary');
 const verified=verifySnapshot(s);
 if(verified.ranking.length!==100)throw Error('Full Top 100 reward weights required');
 return verified;
}
