import {discoverWallets,legacyWallets} from './wallet-discovery.mjs';
import {walletConnect,signIn,saveNickname,uploadAvatar,removeProfile,disconnect,watchWallet,loadProfile} from './wallet-client.mjs';
export function mountProfile(root,{projectId,mode='connect'}){
 root.innerHTML=`<section class="wallet-profile"><h2>${mode==='settings'?'YOUR PROFILE':'CONNECT WALLET'}</h2><div data-connect-controls><div data-wallet-list aria-label="Choose your wallet"></div><button type="button" data-injected>DETECT BROWSER WALLETS</button> <button type="button" data-walletconnect>OTHER WALLETS · WALLETCONNECT</button><button type="button" data-cancel-pairing hidden>CANCEL CONNECTION</button><div data-pairing hidden><button type="button" data-copy-pairing>COPY CONNECTION LINK</button><p>On Crypto.com Onchain, open this site in the app browser and choose IN-APP WALLET. Other wallets may let you paste a WalletConnect link.</p></div></div><p role="status" data-status></p><div data-connected-actions hidden><a class="settings-link" href="settings.html">OPEN SETTINGS</a><button type="button" data-session-disconnect>DISCONNECT</button></div><a data-settings-connect class="settings-link" href="home.html#connect-wallet" hidden>CONNECT WALLET</a><form><p data-address></p><div class="profile-identity-preview"><button type="button" class="avatar-tile" data-choose-avatar aria-label="Choose profile photo"><img data-avatar-preview alt="Profile photo preview" hidden><span data-avatar-placeholder><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-5 3 3 4-6 5 8"/></svg><small>ADD PHOTO</small></span></button><div><span class="preview-label">YOUR NAME</span><output data-nickname-preview>YOUR NICKNAME</output><small data-preview-note>Preview · save to publish</small></div></div><input class="avatar-file-input" aria-label="Profile photo" name="avatar" type="file" accept="image/jpeg,image/png,image/webp"><label>Nickname <input name="nickname" maxlength="24" required autocomplete="off" placeholder="Your nickname" class="nickname-editor"></label><p>Your nickname, avatar and wallet address will be public. Images: JPEG, PNG or WebP, maximum 1 MB.</p><div data-profile-actions hidden><button type="submit">SAVE PROFILE</button> <button type="button" data-delete>REMOVE PROFILE</button> <button type="button" data-disconnect>DISCONNECT</button></div></form></section>`;
 const find=q=>root.querySelector(q),status=find('[data-status]'),form=find('form');let provider=null,unwatch=null,busy=false,pairingUri='',pairingController=null,verified=false;
 form.hidden=mode!=='settings';find('[data-connect-controls]').hidden=mode==='settings';
 let photoRead=0,pendingAvatar=null,savedAvatar='';
 function showProfile(profile){verified=true;form.elements.nickname.value=profile.nickname||'';previewName();find('[data-address]').textContent=profile.address;savedAvatar=profile.hasAvatar?'/api/profile/'+encodeURIComponent(profile.address)+'/avatar?v='+Date.now():'';showPhoto(savedAvatar);find('[data-profile-actions]').hidden=false;find('[data-connect-controls]').hidden=true;find('[data-settings-connect]').hidden=true;find('[data-connected-actions]').hidden=mode==='settings';status.textContent=mode==='settings'?'Wallet verified. Edit your public profile.':'Wallet connected. Open SETTINGS to edit your profile.';}
 function previewName(){find('[data-nickname-preview]').textContent=form.elements.nickname.value.trim()||'YOUR NICKNAME'}
 function showPhoto(src){const photo=find('[data-avatar-preview]');if(src)photo.src=src;else photo.removeAttribute('src');photo.hidden=!src;find('[data-avatar-placeholder]').hidden=!!src}
 function resetPhoto(){photoRead++;showPhoto('')}
 find('[data-choose-avatar]').addEventListener('click',()=>form.elements.avatar.click());
 form.elements.nickname.addEventListener('input',previewName);
 form.elements.avatar.addEventListener('change',()=>{
  const file=form.elements.avatar.files[0],read=++photoRead;
  pendingAvatar=null;showPhoto(savedAvatar);
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>1048576){form.elements.avatar.value='';status.textContent='Choose JPEG, PNG or WebP, maximum 1 MB.';return}
  pendingAvatar=file;const reader=new FileReader();
  reader.onload=()=>{if(read===photoRead)showPhoto(reader.result)};
  reader.onerror=()=>{if(read!==photoRead)return;pendingAvatar=null;form.elements.avatar.value='';photoRead++;showPhoto(savedAvatar);status.textContent='Photo could not be read. Choose another image.'};
  reader.readAsDataURL(file);
 });
 const buttons=()=>root.querySelectorAll('button');
 function locked(value){busy=value;buttons().forEach(b=>b.disabled=value)}
 function clear(){pendingAvatar=null;savedAvatar='';verified=false;find('[data-connected-actions]').hidden=true;find('[data-connect-controls]').hidden=mode==='settings';find('[data-settings-connect]').hidden=mode!=='settings';find('[data-profile-actions]').hidden=true;form.reset();resetPhoto();previewName();find('[data-address]').textContent='';pairingUri='';find('[data-pairing]').hidden=true;status.textContent='Disconnected. Sign in again to edit your profile.'}
 async function run(fn){if(busy)return;locked(true);try{await fn()}catch(e){status.textContent=e.code===4001||e.name==='AbortError'?'Request cancelled.':e.message||'Connection failed.'}finally{pairingController=null;pairingUri='';find('[data-pairing]').hidden=true;find('[data-cancel-pairing]').hidden=true;locked(false)}}
 async function connect(mode,selected){const draft=!verified?{name:form.elements.nickname.value,file:pendingAvatar,photo:find('[data-avatar-preview]').getAttribute('src')}:null;const attempt=mode==='walletconnect'?new AbortController():null;if(attempt){pairingController=attempt;find('[data-cancel-pairing]').hidden=false;find('[data-cancel-pairing]').disabled=false}status.textContent='Choose your wallet and confirm profile sign-in.';if(unwatch)unwatch();await fetch('/api/profile/logout',{method:'POST',credentials:'same-origin'});if(attempt?.signal.aborted)throw new DOMException('Connection cancelled.','AbortError');clear();status.textContent='Choose your wallet and confirm profile sign-in.';
  if(mode==='injected'){if(!selected?.request)throw Error('Choose a browser wallet first.');provider=selected}
  else {provider=await walletConnect({projectId,signal:attempt.signal,onUri:uri=>{pairingUri=uri;status.textContent='Connection ready. Continue in your wallet.';find('[data-pairing]').hidden=false;find('[data-copy-pairing]').disabled=false}});pairingController=null;find('[data-cancel-pairing]').hidden=true;}
  unwatch=await watchWallet(provider,clear);const user=await signIn(provider);const profile=await loadProfile();showProfile({...profile,address:user.address});pairingUri='';find('[data-pairing]').hidden=true;
 }
 find('[data-cancel-pairing]').addEventListener('click',()=>{pairingController?.abort();pairingUri='';find('[data-pairing]').hidden=true});
 find('[data-copy-pairing]').addEventListener('click',async()=>{try{if(!pairingUri)return;await navigator.clipboard.writeText(pairingUri);status.textContent='Connection link copied. Paste it in your wallet if supported.'}catch{status.textContent='Open the site inside your wallet and choose IN-APP WALLET.'}});
 const cancelPending=()=>{if(pairingController){pairingController.abort();pairingUri='';find('[data-pairing]').hidden=true}};
 root.addEventListener('wallet-profile-close',cancelPending);
 const known=new Set(),cards=new Map();
 const brands=[['onchain','Crypto.com Onchain',/crypto\.com|onchain|defi wallet/i],['metamask','MetaMask',/metamask/i],['trust','Trust Wallet',/trust/i],['rabby','Rabby',/rabby/i]];
 function walletCard(id,name){const button=document.createElement('button');button.type='button';button.className='wallet-choice';const img=document.createElement('img');img.src='/wallet-icons/'+id+'.svg';img.alt='';const caption=document.createElement('span'),title=document.createElement('span'),hint=document.createElement('small');title.textContent=name;hint.textContent='Open this site in your wallet browser';caption.append(title,hint);button.append(img,caption);const card={button,hint,provider:null};button.addEventListener('click',()=>{if(card.provider)run(()=>connect('injected',card.provider));else status.textContent='Open this site in '+name+"’s app browser or enable its browser extension, then try again."});find('[data-wallet-list]').append(button);cards.set(id,card)}
 for(const [id,name] of brands)walletCard(id,name);
 function addWallet({name,provider:found}){if(known.has(found))return;known.add(found);const brand=brands.find(([, ,pattern])=>pattern.test(name));if(brand&&!cards.get(brand[0]).provider){const card=cards.get(brand[0]);card.provider=found;card.hint.textContent='Detected · connect on Cronos';return}const button=document.createElement('button');button.type='button';button.className='wallet-choice';button.textContent=name+' · Detected';button.addEventListener('click',()=>run(()=>connect('injected',found)));find('[data-wallet-list]').append(button)}
 const stopDiscovery=discoverWallets(window,addWallet);
 for(const wallet of legacyWallets(window.ethereum))addWallet(wallet);
 find('[data-injected]').addEventListener('click',()=>{window.dispatchEvent(new Event('eip6963:requestProvider'));for(const wallet of legacyWallets(window.ethereum))addWallet(wallet);if(!known.size)status.textContent='Open this site inside your wallet app to connect directly.'});
 find('[data-walletconnect]').addEventListener('click',()=>run(()=>connect('walletconnect')));
 form.addEventListener('submit',e=>{e.preventDefault();if(!verified){status.textContent='Connect your wallet to save this preview.';return}run(async()=>{
  const file=pendingAvatar,read=photoRead;
  await saveNickname(form.elements.nickname.value);
  if(file){
   try{await uploadAvatar(file)}catch{status.textContent='Nickname saved. Photo upload failed. Try saving again to publish the photo.';return}
   savedAvatar='/api/profile/'+encodeURIComponent(find('[data-address]').textContent)+'/avatar?v='+Date.now();
  }
  if(read===photoRead){form.elements.avatar.value='';pendingAvatar=null;photoRead++;showPhoto(savedAvatar)}
  status.textContent=pendingAvatar?'Profile saved. Your newer photo selection is not saved yet.':'Profile saved. Nickname and avatar are public.';
 })});
 find('[data-session-disconnect]').addEventListener('click',()=>run(async()=>{await disconnect(provider);unwatch?.();provider=null;clear()}));
 find('[data-disconnect]').addEventListener('click',()=>run(async()=>{await disconnect(provider);unwatch?.();provider=null;clear()}));
 find('[data-delete]').addEventListener('click',()=>run(async()=>{await removeProfile();pendingAvatar=null;savedAvatar='';form.reset();resetPhoto();previewName();status.textContent='Your public nickname and avatar have been removed.'}));
 loadProfile().then(profile=>{if(!busy)showProfile(profile)}).catch(()=>{if(mode==='settings'&&!busy){find('[data-settings-connect]').hidden=false;status.textContent='Preview your profile here. Connect your wallet to save changes.'}});
 return ()=>{root.removeEventListener('wallet-profile-close',cancelPending);pairingController?.abort();stopDiscovery();unwatch?.();root.replaceChildren()};
}
