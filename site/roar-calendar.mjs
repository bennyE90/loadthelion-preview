// UTC policy cutover: preserve completed weekly history; start calendar rounds on 21 Oct 2026.
export const DAY=86400,ACTIVATION=1792540800;
export function mondayUtcStart(at){if(!Number.isSafeInteger(at)||at<0)throw Error('Invalid timestamp');const day=Math.floor(at/DAY);return (day-(day+3)%7)*DAY}
export function eventStart(at){
 if(!Number.isSafeInteger(at)||at<0)throw Error('Invalid timestamp');
 if(at<ACTIVATION)return mondayUtcStart(at);
 const date=new Date(at*1000),day=date.getUTCDate(),first=day<=10?1:day<=20?11:21;
 return Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),first)/1000;
}
export function eventEnd(start){
 if(eventStart(start)!==start)throw Error('Invalid event start');
 if(start<ACTIVATION)return Math.min(start+7*DAY,ACTIVATION);
 const date=new Date(start*1000),day=date.getUTCDate();
 return Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+(day===21?1:0),day===1?11:day===11?21:1)/1000;
}
export function rulesForStart(start){
 if(eventStart(start)!==start)throw Error('Invalid event start');
 return start<ACTIVATION?{version:'WEEKLY_200_V1',boostSeconds:6*DAY,maxBoostPercent:200,denominator:6*DAY,slope:2}:{version:'CALENDAR_250_V2',boostSeconds:8*DAY,maxBoostPercent:250,denominator:10000,maxBoostBasisPoints:25000};
}
export function eventScore(balance,since,at,start=eventStart(at)){
 const rules=rulesForStart(start),elapsed=since===null?0:Math.min(rules.boostSeconds,Math.max(0,at-since));
 const steps=rules.maxBoostBasisPoints===undefined?null:Math.floor(elapsed*rules.maxBoostBasisPoints/rules.boostSeconds);
 return {elapsed,boostPercent:steps===null?rules.maxBoostPercent*elapsed/rules.boostSeconds:steps/100,boostMaxPercent:rules.maxBoostPercent,pointsDenominator:rules.denominator,pointsNumerator:balance*BigInt(rules.denominator+(steps===null?rules.slope*elapsed:steps))};
}
