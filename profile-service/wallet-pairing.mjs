// Keep cancelled or late provider work from becoming an active wallet session.
export function pairWallet({createProvider,onUri,signal,timeoutMs=120000}){
 return new Promise((resolve,reject)=>{
  let provider,settled=false,timer;
  const stop=()=>{try{Promise.resolve(provider?.disconnect?.()).catch(()=>{})}catch{}};
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);provider?.removeListener?.('display_uri',uri)};
  const fail=error=>{if(settled)return;settled=true;cleanup();stop();reject(error)};
  const abort=()=>fail(new DOMException('Connection cancelled.','AbortError'));
  const uri=value=>{if(!settled&&!signal?.aborted)onUri?.(value)};
  if(signal?.aborted){abort();return}
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>fail(Error('Connection timed out. Please try again.')),timeoutMs);
  Promise.resolve().then(createProvider).then(async value=>{
   provider=value;if(settled){stop();return}
   provider.on('display_uri',uri);
   await provider.connect();
   if(settled||signal?.aborted){stop();return}
   settled=true;cleanup();resolve(provider);
  }).catch(fail);
 });
}
