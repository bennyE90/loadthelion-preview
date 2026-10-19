import {createArchiveReader} from './roar-archive-reader.mjs';
import {previewRows,verifyRoarPreview,verifyPreviewBaseline,PREVIEW_START,PREVIEW_END} from '../site/roar-preview.mjs';
export function createPreviewService({token,fetcher=fetch,now=()=>Date.now()}={}){
 const read=createArchiveReader({token,fetcher,now,withFull:true,withOpening:true});
 return async request=>{
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405});
  try{
   const {snapshot:source,full,opening,openingHash}=await read();
   if(Math.floor(now()/1000)>=PREVIEW_END)return Response.json({status:'CLOSED',prizesEnabled:false},{headers:{'Cache-Control':'no-store'}});
   if(!Array.isArray(full.allRanking)||full.allRanking.length<100)throw Error('Complete private ranking required');
   const ranking=previewRows(source,full.allRanking).slice(0,100).map(r=>({rank:r.rank,address:r.address,balanceRaw:r.balanceRaw,sourceBoostStartedAt:full.allRanking.find(s=>s.address===r.address).boostStartedAt,...(typeof r.boostAtOpening==='boolean'?{sourceBoostAtOpening:r.boostAtOpening}:{})}));
   let baseline=null;
   if(opening){
    try{
     if(opening.environment!=='ULTON_TEST'||opening.prizesEnabled!==false||opening.allRanking.some(r=>r.boostStartedAt!==opening.eventStart))throw Error('Invalid opening archive');
     const {allRanking,excludedAddresses,boundary,kind,eventId,schema,...publicData}=opening;
     const baseSource={...publicData,schema:1};
     const ranking=previewRows(baseSource,allRanking).slice(0,100).map(r=>({rank:r.rank,address:r.address,balanceRaw:r.balanceRaw,sourceBoostStartedAt:opening.eventStart,sourceBoostAtOpening:true}));
     const candidate={source:baseSource,ranking,boundary,snapshotHash:openingHash,comparisonTimestamp:opening.eventStart};
     verifyPreviewBaseline(candidate,source);baseline=candidate;
    }catch{/* Preserve current preview when yesterday's verified baseline is unavailable. */}
   }
   const payload={schema:1,status:'SIMULATED',prizesEnabled:false,start:PREVIEW_START,end:PREVIEW_END,source,ranking,baseline};
   verifyRoarPreview(payload);
   return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({status:'UNAVAILABLE',error:'Event preview unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
 };
}
