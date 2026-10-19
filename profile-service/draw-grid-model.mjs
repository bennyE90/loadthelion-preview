export function participantName(row,profile){return typeof profile?.nickname==='string'&&profile.nickname.trim()&&profile.nickname.length<=48?profile.nickname.trim():row.address.slice(0,6)+'…'+row.address.slice(-4)}
export const REVEAL_DURATION=45000;
export function revealFrame(elapsed,duration,offset=0){
 if(!Number.isFinite(elapsed)||!Number.isFinite(duration)||duration<=0)throw Error('Invalid reveal clock');
 const progress=Math.max(0,Math.min(1,elapsed/duration));
 // First pass visits every finalist once; the last third slows into suspense.
 const step=progress<2/3?Math.floor(progress*150):100+Math.floor(30*(1-(1-(progress-2/3)*3)**2));
 return {progress,done:progress===1,index:(step*37+offset)%100,phase:progress<2/3?'MEET THE PRIDE':progress<.9?'FEEL THE TENSION':'ONE FINAL ROAR'};
}
export function chainReceiptUrl(receipt){return receipt?.status==='CONFIRMED'&&receipt.chainId===25&&/^0x[0-9a-fA-F]{64}$/.test(receipt.transactionHash||'')?'https://explorer.cronos.org/tx/'+receipt.transactionHash:null}
export function viewerOutcome(viewer,winner,finalists){
 if(!/^0x[0-9a-f]{40}$/i.test(viewer||''))return 'spectator';
 const address=viewer.toLowerCase();
 if(!finalists.some(r=>r.address.toLowerCase()===address))return 'not-entered';
 return address===winner.toLowerCase()?'winner':'loser';
}
