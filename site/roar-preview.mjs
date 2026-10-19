import {verifySnapshot,score} from './roar-data.mjs';
import {POOL_START,REWARD_TOKEN} from './roar-rewards.mjs';
export const PREVIEW_START=1791590400,PREVIEW_END=1792454400;
// Scenario assumption: wallets active at the real opening are treated as active
// at the simulated opening. Verified later buys/resets keep their actual times.
export function previewRows(source,rows){
 if(source.eventStart!==POOL_START||source.token!==REWARD_TOKEN||source.decimals!==18||source.snapshotTimestamp>=PREVIEW_END)throw Error('Preview source outside simulated event');
 const seen=new Set();
 return rows.map(r=>{
  if(!/^0x[0-9a-f]{40}$/.test(r.address)||seen.has(r.address))throw Error('Invalid preview wallet');seen.add(r.address);score(r,source.snapshotTimestamp,source.eventStart);
  const since=r.boostStartedAt===source.eventStart?PREVIEW_START:r.boostStartedAt;
  const elapsed=since===null?0:Math.min(8*86400,Math.max(0,source.snapshotTimestamp-since));
  const steps=Math.floor(elapsed*25000/(8*86400));
  return {...r,boostStartedAt:since,boostPercent:steps/100,boostMaxPercent:250,pointsDenominator:10000,pointsNumerator:BigInt(r.balanceRaw)*BigInt(10000+steps)};
 }).sort((a,b)=>a.pointsNumerator===b.pointsNumerator?a.address.localeCompare(b.address):a.pointsNumerator>b.pointsNumerator?-1:1).map((r,i)=>({...r,rank:i+1}));
}
export function verifyRoarPreview(payload){
 if(payload?.schema!==1||payload.status!=='SIMULATED'||payload.prizesEnabled!==false||payload.start!==PREVIEW_START||payload.end!==PREVIEW_END||!Array.isArray(payload.ranking)||payload.ranking.length!==100)throw Error('Invalid simulation');
 const source=verifySnapshot(payload.source);
 const original=payload.ranking.map(r=>({...r,boostStartedAt:r.sourceBoostStartedAt}));
 const rows=previewRows(source,original);
 if(rows.some((r,i)=>r.address!==payload.ranking[i].address||payload.ranking[i].rank!==i+1))throw Error('Invalid simulated ranking order');
 return {source,ranking:rows,start:PREVIEW_START,end:PREVIEW_END};
}
