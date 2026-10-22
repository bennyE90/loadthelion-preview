// EIP-6963 discovery. Provider metadata is untrusted: render names via textContent,
// never render provider-supplied icon URLs/SVG or use rdns as proof of identity.
export function discoverWallets(target,onWallet){
 const seen=new Set();
 const announce=event=>{const data=event.detail;if(!data?.provider||typeof data.provider.request!=='function'||typeof data.info?.uuid!=='string'||typeof data.info?.name!=='string'||data.info.uuid.length>100||data.info.name.length>80||seen.has(data.provider))return;seen.add(data.provider);onWallet({name:data.info.name,provider:data.provider})};
 target.addEventListener('eip6963:announceProvider',announce);
 target.dispatchEvent(new Event('eip6963:requestProvider'));
 return ()=>target.removeEventListener('eip6963:announceProvider',announce);
}
export function legacyWallets(ethereum){
 const providers=Array.isArray(ethereum?.providers)?ethereum.providers:[ethereum];
 return [...new Set(providers)].filter(p=>typeof p?.request==='function').map((provider,i)=>({name:providers.length===1?'Onchain / browser wallet':'Browser wallet '+(i+1),provider}));
}
