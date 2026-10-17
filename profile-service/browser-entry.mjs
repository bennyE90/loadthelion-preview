import {mountProfile} from './profile-page.mjs';
const root=document.getElementById('profile-root');
try{
 const response=await fetch('profile-config.json',{cache:'no-store'});if(!response.ok)throw Error('Wallet profiles are not active on this deployment.');const config=await response.json();
 if(config.origin!==location.origin)throw Error('Open wallet profiles on the configured LoadTheLion profile domain.');
 const status=await fetch('/api/profile/status',{cache:'no-store'});if(!status.ok||(await status.json()).chainId!==25)throw Error('The profile service is temporarily unavailable. Please retry later.');
 mountProfile(root,{...config,mode:root.dataset.profileMode||'connect'});
}catch(e){root.textContent=e.message}
