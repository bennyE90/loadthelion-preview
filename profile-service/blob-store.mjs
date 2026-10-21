import {getStore} from '@netlify/blobs';
const failedWrite=response=>!response?.ok&&response?.status!==412;
const methodOf=(input,init)=>(init?.method||input?.method||'GET').toUpperCase();
// Kept for existing ROAR callers that reject failed PUTs at the transport.
export async function strictBlobFetch(input,init,transport=globalThis.fetch){
 const response=await transport(input,init);
 if(methodOf(input,init)==='PUT'&&failedWrite(response)){
  await response.body?.cancel().catch(()=>{});
  throw Error('Blob write failed');
 }
 return response;
}
export function getProfileStore({fetch:transport=globalThis.fetch,...connection}={}){
 const config={...connection,name:'loadthelion-profiles-v1',consistency:'strong'};
 const store=getStore({...config,fetch:transport});
 for(const method of ['set','setJSON'])store[method]=async(...args)=>{
  // Let the SDK honor its retry/backoff policy, then reject a false write acknowledgement.
  // A separate recorder per operation prevents concurrent writes sharing response state.
  let response;
  const writer=getStore({...config,fetch:async(input,init)=>{
   const result=await transport(input,init);
   if(methodOf(input,init)==='PUT')response=result;
   return result;
  }});
  const result=await writer[method](...args);
  if(failedWrite(response))throw Error('Blob write failed');
  return result;
 };
 return store;
}
