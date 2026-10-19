export function participantName(row,profile){return typeof profile?.nickname==='string'&&profile.nickname.trim()&&profile.nickname.length<=48?profile.nickname.trim():row.address.slice(0,6)+'…'+row.address.slice(-4)}
export const REVEAL_DURATION=45000;
export function revealFrame(elapsed,duration){
 if(!Number.isFinite(elapsed)||!Number.isFinite(duration)||duration<=0)throw Error('Invalid reveal clock');
 const progress=Math.max(0,Math.min(1,elapsed/duration));
 // One ascending pass, with longer holds toward rank 100. Never chooses a winner.
 const index=Math.min(99,Math.floor(100*(1-(1-progress)**1.5)));
 return {progress,done:progress===1,index,phase:progress<.7?'THE PRIDE · 01 → 100':progress<.92?'FEEL THE TENSION':'ONE FINAL ROAR'};
}
export function chainReceiptUrl(receipt){return receipt?.status==='CONFIRMED'&&receipt.chainId===25&&/^0x[0-9a-fA-F]{64}$/.test(receipt.transactionHash||'')?'https://explorer.cronos.org/tx/'+receipt.transactionHash:null}
export function publishedPrize(config,eventId){
 if(!eventId||config?.eventId!==eventId||typeof config.image!=='string'||!/^assets\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/.test(config.image))return null;
 return {image:config.image,name:typeof config.name==='string'?config.name.slice(0,80):'Loaded Lion'};
}
