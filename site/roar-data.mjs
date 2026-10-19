export const BOOST_SECONDS=6*24*3600;
export function eventStart(at){const day=Math.floor(at/86400);return (day-((day+3)%7))*86400}
const address=a=>typeof a==='string'&&/^0x[0-9a-f]{40}$/i.test(a);
function validRanks(rows){return Array.isArray(rows)&&rows.length<=100&&new Set(rows.map(r=>r.address?.toLowerCase())).size===rows.length&&rows.every((r,i)=>address(r.address)&&r.rank===i+1)}
export function score(row,at,start){
 if(!/^\d+$/.test(row.balanceRaw)||BigInt(row.balanceRaw)<=0n)throw Error('Invalid balance');
 const since=row.boostStartedAt;
 if(since!==null&&(!Number.isSafeInteger(since)||since<start||since>at))throw Error('Invalid boost start');
 const elapsed=since===null?0:Math.min(BOOST_SECONDS,at-since);
 return {elapsed,boostPercent:200*elapsed/BOOST_SECONDS,pointsNumerator:BigInt(row.balanceRaw)*BigInt(BOOST_SECONDS+2*elapsed)};
}
export function verifySnapshot(d){
 if(d?.schema!==1||d.status!=='verified'||d.chainId!==25||!address(d.token)||!Number.isInteger(d.decimals)||d.decimals<0||d.decimals>36)throw Error('No verified token snapshot');
 if(!Number.isSafeInteger(d.snapshotTimestamp)||!Number.isSafeInteger(d.snapshotBlock)||d.snapshotBlock<0||d.eventStart!==eventStart(d.snapshotTimestamp)||d.snapshotTimestamp>=d.eventStart+7*86400)throw Error('Invalid event snapshot');
 if(!['complete','balancesVerified','openingBalancesVerified','dexClassificationVerified'].every(k=>d[k]===true))throw Error('Incomplete verification');
 if(!validRanks(d.ranking))throw Error('Invalid ranking');
 const rows=d.ranking.map(r=>({...r,address:r.address.toLowerCase(),...score(r,d.snapshotTimestamp,d.eventStart)}));
 for(let i=1;i<rows.length;i++)if(rows[i].pointsNumerator>rows[i-1].pointsNumerator||rows[i].pointsNumerator===rows[i-1].pointsNumerator&&rows[i].address<rows[i-1].address)throw Error('Ranking is not ordered by points and address');
 return {...d,ranking:rows};
}
export function movements(current,baseline){
 const dayStart=Math.floor(current.snapshotTimestamp/86400)*86400;
 const previous=baseline;
 const ranks=new Map();
 const comparable=previous?.status==='verified'&&previous.chainId===current.chainId&&previous.token?.toLowerCase()===current.token.toLowerCase()&&previous.eventStart===current.eventStart&&previous.comparisonTimestamp===dayStart&&Number.isSafeInteger(previous.snapshotTimestamp)&&previous.snapshotTimestamp<=dayStart&&previous.snapshotTimestamp>=(dayStart===current.eventStart?current.eventStart-86400:current.eventStart)&&Number.isSafeInteger(previous.snapshotBlock)&&previous.snapshotBlock<=current.snapshotBlock&&validRanks(previous.ranking);
 if(!comparable)return ranks;
 const old=new Map(previous.ranking.map(r=>[r.address.toLowerCase(),r.rank]));
 for(const row of current.ranking){const before=old.get(row.address);ranks.set(row.address,before===undefined?{text:'NEW',type:'new',label:'New to the Top 100 since 00:00 UTC'}:before===row.rank?{text:'—',type:'same',label:'Position unchanged since 00:00 UTC'}:before>row.rank?{text:'↑'+(before-row.rank),type:'up',label:'Up '+(before-row.rank)+' positions since 00:00 UTC'}:{text:'↓'+(row.rank-before),type:'down',label:'Down '+(row.rank-before)+' positions since 00:00 UTC'})}
 return ranks;
}
export function formatAmount(raw,decimals=18,denominator=1n){const value=BigInt(raw),base=10n**BigInt(decimals)*denominator;const whole=value/base;const fraction=(value%base)*100n/base;return whole.toLocaleString('en-US')+(fraction?'.'+String(fraction).padStart(2,'0'):'')}
export function formatBoost(value){return value.toFixed(1).replace('.',',')+'%'}
