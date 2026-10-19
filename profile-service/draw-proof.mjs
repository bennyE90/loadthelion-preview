import {sha256,toUtf8Bytes} from 'ethers';
import {fetchBeacon} from 'drand-client';
import approved from '../site/probabilities.json' with {type:'json'};
export const BEACON=Object.freeze({hash:'8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce',public_key:'868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31',period:30,genesis_time:1595431050,schemeID:'pedersen-bls-chained'});
export function canonical(v){if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype)return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';throw Error('Invalid proof value')}
export const hash=v=>sha256(toUtf8Bytes(typeof v==='string'?v:canonical(v))).slice(2);
export function units(probabilities){if(!Array.isArray(probabilities)||probabilities.length!==100)throw Error('100 approved weights required');return probabilities.map(v=>{const t=String(v);if(!/^\d+(\.\d{1,12})?$/.test(t)||Number(v)<=0)throw Error('Invalid weight');const [a,b='']=t.split('.');return BigInt(a)*10n**12n+BigInt(b.padEnd(12,'0'))})}
export function selectRank(plan,randomness,weights){
 const total=weights.reduce((a,b)=>a+b,0n),space=1n<<256n,limit=space-space%total;
 for(let counter=0;counter<10000;counter++){const value=BigInt('0x'+hash({domain:'LOAD_ROAR_TEST_DRAW_V1',plan,randomness,counter}));if(value>=limit)continue;const ticket=value%total;let sum=0n;for(let i=0;i<100;i++){sum+=weights[i];if(ticket<sum)return {rank:i+1,ticket:String(ticket),totalUnits:String(total),counter}}}
 throw Error('Entropy rejection limit');
}
export async function verifyPublicDraw(p){
 const f=p?.final,d=p?.draw,plan=p?.plan;
 if(canonical(p?.probabilitiesPercent)!==canonical(approved.probabilitiesPercent))throw Error('Unapproved probability change');
 if(p?.schema!==1||p.environment!=='ULTON_TEST'||p.prizesEnabled!==false||!f||!d||!plan||p.onchain?.status!=='NOT_REGISTERED')throw Error('Unexpected draw scope');
 const token='0x7ebfd1b08e1d7413d6d8fe6c3eef28945ce776ef',week=f.eventStart,end=week+604800;
 if(!Number.isSafeInteger(week)||week%604800!==345600||f.token!==token||f.snapshotTimestamp!==end-1||f.ranking?.length!==100||new Set(f.ranking.map(r=>r.address)).size!==100||f.ranking.some((r,i)=>r.rank!==i+1||!/^0x[0-9a-f]{40}$/.test(r.address)))throw Error('Invalid final candidates');
 const b=f.boundary,number=x=>Number(BigInt(x));
 if(!b||number(b.block.number)!==f.snapshotBlock||b.block.hash!==f.blockHash||number(b.block.timestamp)>=end||number(b.nextBlock.timestamp)<end||number(b.nextBlock.number)!==f.snapshotBlock+1||b.nextBlock.parentHash!==f.blockHash||number(b.safeHead)<number(b.nextBlock.number))throw Error('Invalid final boundary');
 const weights=units(p.probabilitiesPercent),release=end+3600,round=Math.ceil((release-BEACON.genesis_time)/BEACON.period)+1;
 const expected={schema:1,eventId:`25:${token}:${week}`,snapshotHash:f.snapshotHash,weightsHash:hash(weights.map(String)),chainHash:BEACON.hash,round,releaseTime:BEACON.genesis_time+(round-1)*BEACON.period,algorithm:'SHA256_REJECTION_SAMPLING_V1',prizesEnabled:false};
 if(!/^[0-9a-f]{64}$/.test(f.snapshotHash)||canonical(plan)!==canonical(expected)||d.planHash!==hash(plan)||d.snapshotHash!==f.snapshotHash||d.eventId!==plan.eventId||d.round!==round||d.proof?.round!==round||d.proof.randomness!==d.randomness||!/^[0-9a-f]{64}$/.test(d.randomness)||d.prizesEnabled!==false||d.automaticTransfer!==false||d.status!=='TEST_SELECTED_AWAITING_WALLET_PROOF')throw Error('Draw binding mismatch');
 const client={options:{disableBeaconVerification:false,noCache:false},chain:()=>({info:async()=>BEACON}),get:async()=>d.proof};
 await fetchBeacon(client,round);
 const result=selectRank(plan,d.randomness,weights);
 for(const [k,v] of Object.entries(result))if(d[k]!==v)throw Error('Draw result mismatch');
 if(d.winner!==f.ranking[result.rank-1].address)throw Error('Winner mismatch');
 return {rank:result.rank,winner:d.winner,weights,round};
}
export function wheelStop(weights,rank){if(rank<1||rank>weights.length)throw Error('Invalid stop');const total=weights.reduce((a,b)=>a+b,0n),before=weights.slice(0,rank-1).reduce((a,b)=>a+b,0n);return 360*Number(before*2n+weights[rank-1])/Number(total*2n)}
