import {mountProfile} from './profile-page.mjs';
const dialog=document.getElementById('wallet-dialog');
const root=dialog.querySelector('[data-profile-root]');
let mounted=false,loading=false,opener;
async function openWallet(event){
 event?.preventDefault();opener=event?.currentTarget;
 document.querySelector('#nav')?.classList.remove('open');
 const menu=document.getElementById('menu');menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Open navigation menu');
 dialog.showModal();document.documentElement.classList.add('wallet-modal-open');
 if(mounted||loading)return;loading=true;root.textContent='Preparing wallet profiles…';
 try{
  const response=await fetch('/profile-config.json',{cache:'no-store'});if(!response.ok)throw Error('Wallet profiles are temporarily unavailable.');
  const config=await response.json();if(config.origin!==location.origin)throw Error('Open the configured LoadTheLion site to connect.');
  const status=await fetch('/api/profile/status',{cache:'no-store'});if(!status.ok||(await status.json()).chainId!==25)throw Error('The profile service is temporarily unavailable.');
  mountProfile(root,config);mounted=true;
 }catch(error){root.textContent=error.message}finally{loading=false}
}
document.querySelectorAll('[data-open-wallet]').forEach(button=>button.addEventListener('click',openWallet));
dialog.querySelector('[data-close-wallet]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
dialog.addEventListener('close',()=>{root.dispatchEvent(new Event('wallet-profile-close'));document.documentElement.classList.remove('wallet-modal-open');opener?.focus()});
