const profileRoot=document.getElementById('roar-rows');
async function hydrateProfiles(){
 const wallets=[...profileRoot.querySelectorAll('.roar-name[title]')].filter(w=>/^0x[a-f0-9]{40}$/i.test(w.title));
 if(!wallets.length)return;
 try{
  const response=await fetch('/api/profile/lookup',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({addresses:wallets.map(w=>w.title)})});
  if(!response.ok)return;
  const data=await response.json();if(!Array.isArray(data.profiles))return;
  const profiles=new Map(data.profiles.filter(p=>/^0x[a-f0-9]{40}$/i.test(p?.address)).map(p=>[p.address.toLowerCase(),p]));
  for(const wallet of wallets){if(!profileRoot.contains(wallet))continue;const p=profiles.get(wallet.title.toLowerCase());if(!p)continue;
   if(typeof p.nickname==='string'&&p.nickname.length<=48&&p.nickname&&wallet.firstChild?.nodeType===3)wallet.firstChild.nodeValue=p.nickname;
   if(p.hasAvatar&&!wallet.querySelector('img')){const image=document.createElement('img');image.alt='';image.width=34;image.height=34;image.loading='lazy';image.src='/api/profile/'+encodeURIComponent(p.address.toLowerCase())+'/avatar';image.style.cssText='border-radius:50%;object-fit:cover;float:left;margin:0 9px 4px 0';image.addEventListener('error',()=>image.remove(),{once:true});wallet.prepend(image)}
  }
 }catch{/* Wallet addresses remain visible when profile service is unavailable. */}
}
if(profileRoot){hydrateProfiles();new MutationObserver(hydrateProfiles).observe(profileRoot,{childList:true})}
