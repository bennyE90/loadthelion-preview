import {verifySnapshot,score} from './roar-data.mjs';
import {POOL_START,REWARD_TOKEN} from './roar-rewards.mjs';
export const PREVIEW_START=1791676800,PREVIEW_END=1792540800;
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
 if(payload?.schema===2&&payload.status==='SIMULATED'&&payload.prizesEnabled===false&&payload.start===PREVIEW_START&&payload.end===PREVIEW_END)return verifyHistoricalPreview(payload);
 if(payload?.schema===1&&payload.source?.resetPolicy==='MIN_BUY_USD5_V1')throw Error('Complete historical reconstruction required');
 if(payload?.schema!==1||payload.status!=='SIMULATED'||payload.prizesEnabled!==false||payload.start!==PREVIEW_START||payload.end!==PREVIEW_END)throw Error('Invalid simulation');
 const source=verifySnapshot(payload.source),rows=verifiedRows(source,payload.ranking);
 let baseline=null;try{baseline=verifyPreviewBaseline(payload.baseline,source)}catch{/* A missing or wrong baseline must not fabricate movements. */}
 return {source,ranking:rows,baseline,start:PREVIEW_START,end:PREVIEW_END};
}

function historicalRows(source,ranking,at=source.snapshotTimestamp,physicalAt=at){
 if(!Array.isArray(ranking)||ranking.length<100)throw Error('Incomplete historical ranking');
 const seen=new Set();const rows=ranking.map(r=>{
  const since=r.sourceBoostStartedAt===undefined?r.boostStartedAt:r.sourceBoostStartedAt;
  if(!/^0x[0-9a-f]{40}$/.test(r.address)||seen.has(r.address)||typeof r.balanceRaw!=='string'||!/^\d{1,100}$/.test(r.balanceRaw)||BigInt(r.balanceRaw)<=0n||since!==null&&(!Number.isSafeInteger(since)||since<PREVIEW_START||since>physicalAt))throw Error('Invalid historical boost state');
  seen.add(r.address);const steps=since===null?0:Math.floor(Math.min(691200,at-since)*25000/691200);
  return {...r,boostStartedAt:since,boostAtOpening:false,boostPercent:steps/100,boostMaxPercent:250,pointsDenominator:10000,pointsNumerator:BigInt(r.balanceRaw)*BigInt(10000+steps)};
 });
 for(let i=0;i<rows.length;i++){if(rows[i].rank!==i+1||i&&(rows[i].pointsNumerator>rows[i-1].pointsNumerator||rows[i].pointsNumerator===rows[i-1].pointsNumerator&&rows[i].address<rows[i-1].address))throw Error('Historical ranking order mismatch');}
 return rows;
}
function historyBoundary(boundary,cut,block,hash,safe){
 const n=x=>Number(BigInt(x));if(!boundary||n(boundary.block.number)!==block||boundary.block.hash!==hash||n(boundary.block.timestamp)>=cut||n(boundary.nextBlock.timestamp)<cut||n(boundary.nextBlock.number)!==block+1||boundary.nextBlock.parentHash!==hash||n(boundary.safeHead)<block+1||n(boundary.safeHead)>safe)throw Error('Unproven historical boundary');
 return n(boundary.block.timestamp);
}
export function verifyHistoricalSimulation(simulation,source,full){
 if(simulation?.schema!==1||simulation.status!=='HISTORICAL_SIMULATION_VERIFIED'||simulation.start!==PREVIEW_START||simulation.end!==PREVIEW_END||simulation.historyFrom!==PREVIEW_START||simulation.prizesEnabled!==false||simulation.complete!==true||simulation.balancesVerified!==true||simulation.resetPolicy!=='MIN_BUY_USD5_V1'||simulation.minimumBuyUsd!=='5.00'||simulation.chainId!==source.chainId||simulation.token!==source.token||simulation.decimals!==source.decimals||simulation.snapshotBlock!==source.snapshotBlock||simulation.snapshotTimestamp!==source.snapshotTimestamp||simulation.blockHash!==source.blockHash||source.snapshotTimestamp>=PREVIEW_END)throw Error('Historical simulation is not bound to verified source');
 if(!Array.isArray(simulation.qualificationEvidenceHashes)||simulation.qualificationEvidenceHashes.some(h=>!/^[0-9a-f]{64}$/.test(h)))throw Error('Missing historical purchase evidence');
 const rows=historicalRows(source,simulation.allRanking);
 if(rows.length!==full.allRanking.length)throw Error('Historical wallet coverage mismatch');const balances=new Map(full.allRanking.map(r=>[r.address,r.balanceRaw]));if(rows.some(r=>balances.get(r.address)!==r.balanceRaw))throw Error('Historical balances differ from verified source');
 historyBoundary(simulation.openingBoundary,PREVIEW_START,Number(BigInt(simulation.openingBoundary.block.number)),simulation.openingBoundary.block.hash,source.snapshotBlock);
 const baseline=simulation.baseline,day=Math.floor(source.snapshotTimestamp/86400)*86400;
 if(!baseline||baseline.comparisonTimestamp!==day||baseline.snapshotBlock>source.snapshotBlock)throw Error('Historical midnight baseline mismatch');
 const at=historyBoundary(baseline.boundary,day,baseline.snapshotBlock,baseline.boundary.block.hash,source.snapshotBlock);if(at!==baseline.snapshotTimestamp)throw Error('Baseline timestamp mismatch');historicalRows(source,baseline.allRanking,day,at);
 return simulation;
}
function verifyHistoricalPreview(payload){
 const source=verifySnapshot(payload.source),day=Math.floor(source.snapshotTimestamp/86400)*86400;
 if(source.resetPolicy!=='MIN_BUY_USD5_V1'||payload.historyHash!==source.simulationHash||!/^[0-9a-f]{64}$/.test(payload.historyHash||'')||payload.historyFrom!==PREVIEW_START||payload.historyComplete!==true||source.snapshotTimestamp>=PREVIEW_END||payload.ranking?.length!==100)throw Error('Incomplete historical preview');
 const rows=historicalRows(source,payload.ranking);let baseline=null;
 try{const b=payload.baseline;if(!b||b.comparisonTimestamp!==day||b.snapshotBlock>source.snapshotBlock||b.ranking?.length!==100)throw Error('Missing historical daily baseline');const at=historyBoundary(b.boundary,day,b.snapshotBlock,b.blockHash,source.snapshotBlock);if(at!==b.snapshotTimestamp)throw Error('Wrong historical baseline timestamp');baseline={status:'verified',chainId:source.chainId,token:source.token,eventStart:source.eventStart,snapshotBlock:b.snapshotBlock,snapshotTimestamp:at,comparisonTimestamp:day,ranking:historicalRows(source,b.ranking,day,at)}}catch{/* Missing proof cannot create arrows. */}
 return {source,ranking:rows,baseline,start:PREVIEW_START,end:PREVIEW_END,historyFrom:PREVIEW_START};
}
