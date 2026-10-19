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
  if(r.boostAtOpening!==undefined&&(typeof r.boostAtOpening!=='boolean'||r.boostAtOpening&&r.boostStartedAt!==source.eventStart))throw Error('Invalid opening activation marker');
  const gated=source.resetPolicy==='MIN_BUY_USD5_V1';
  if(gated&&r.boostAtOpening===true)throw Error('Minimum-buy boost cannot start at opening');
  const assumedOpening=!gated&&(r.boostAtOpening===true||r.boostAtOpening===undefined&&r.boostStartedAt===source.eventStart);
  const since=assumedOpening?PREVIEW_START:r.boostStartedAt;
  const elapsed=since===null?0:Math.min(8*86400,Math.max(0,source.snapshotTimestamp-since));
  const steps=Math.floor(elapsed*25000/(8*86400));
  return {...r,boostStartedAt:since,boostPercent:steps/100,boostMaxPercent:250,pointsDenominator:10000,pointsNumerator:BigInt(r.balanceRaw)*BigInt(10000+steps)};
 }).sort((a,b)=>a.pointsNumerator===b.pointsNumerator?a.address.localeCompare(b.address):a.pointsNumerator>b.pointsNumerator?-1:1).map((r,i)=>({...r,rank:i+1}));
}
function verifiedRows(source,ranking){
 if(!Array.isArray(ranking)||ranking.length!==100)throw Error('Incomplete simulation ranking');
 const rows=previewRows(source,ranking.map(r=>({...r,boostStartedAt:r.sourceBoostStartedAt,boostAtOpening:r.sourceBoostAtOpening})));
 if(rows.some((r,i)=>r.address!==ranking[i].address||ranking[i].rank!==i+1))throw Error('Invalid simulated ranking order');
 return rows;
}
export function verifyPreviewBaseline(payload,current){
 if(!payload||!/^[0-9a-f]{64}$/.test(payload.snapshotHash||''))throw Error('Missing verified midnight baseline');
 const source=verifySnapshot(payload.source),day=Math.floor(current.snapshotTimestamp/86400)*86400;
 if(source.eventStart!==current.eventStart||source.chainId!==current.chainId||source.token!==current.token||source.decimals!==current.decimals||source.snapshotTimestamp!==day||payload.comparisonTimestamp!==day||source.snapshotBlock>current.snapshotBlock||source.prizesEnabled!==false)throw Error('Wrong baseline day or event');
 const b=payload.boundary,n=x=>Number(BigInt(x));
 if(!b||n(b.block.number)!==source.snapshotBlock||b.block.hash!==source.blockHash||n(b.block.timestamp)>=day||n(b.block.timestamp)<day-86400||n(b.nextBlock.timestamp)<day||n(b.nextBlock.number)!==source.snapshotBlock+1||b.nextBlock.parentHash!==source.blockHash||n(b.safeHead)<n(b.nextBlock.number))throw Error('Unproven midnight boundary');
 const gated=current.resetPolicy==='MIN_BUY_USD5_V1';
 if(gated&&source.resetPolicy!==current.resetPolicy)throw Error('Wrong baseline boost policy');
 if(payload.ranking.some(r=>gated?r.sourceBoostStartedAt!==null||r.sourceBoostAtOpening!==false:r.sourceBoostStartedAt!==source.eventStart||r.sourceBoostAtOpening===false))throw Error('Invalid opening boost state');
 return {...source,comparisonTimestamp:day,snapshotTimestamp:n(b.block.timestamp),ranking:verifiedRows(source,payload.ranking)};
}
export function verifyRoarPreview(payload){
 if(payload?.schema!==1||payload.status!=='SIMULATED'||payload.prizesEnabled!==false||payload.start!==PREVIEW_START||payload.end!==PREVIEW_END)throw Error('Invalid simulation');
 const source=verifySnapshot(payload.source),rows=verifiedRows(source,payload.ranking);
 let baseline=null;try{baseline=verifyPreviewBaseline(payload.baseline,source)}catch{/* A missing or wrong baseline must not fabricate movements. */}
 return {source,ranking:rows,baseline,start:PREVIEW_START,end:PREVIEW_END};
}
