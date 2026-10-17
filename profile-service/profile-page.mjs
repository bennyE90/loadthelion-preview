import {discoverWallets,legacyWallets} from './wallet-discovery.mjs';
import {walletConnect,signIn,saveNickname,uploadAvatar,removeProfile,disconnect,watchWallet,loadProfile} from './wallet-client.mjs';
export function mountProfile(root,{projectId}){
 root.innerHTML=`<section class="wallet-profile"><h2>YOUR PRIDE PROFILE</h2><button type="button" data-injected>CHOOSE IN-APP WALLET</button><div data-wallet-list hidden></div> <button type="button" data-walletconnect>WALLETCONNECT</button><button type="button" data-cancel-pairing hidden>CANCEL CONNECTION</button><p role="status" data-status></p><div data-pairing hidden><button type="button" data-copy-pairing>COPY CONNECTION LINK</button><p>On Crypto.com Onchain, open this site in the app browser and choose IN-APP WALLET. Other wallets may let you paste a WalletConnect link.</p></div><form hidden><p data-address></p><label>Nickname <input name="nickname" maxlength="24" required autocomplete="off"></label><label>Avatar <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label><p>Your nickname, avatar and wallet address will be public. Images: JPEG, PNG or WebP, maximum 1 MB.</p><button type="submit">SAVE PROFILE</button> <button type="button" data-delete>REMOVE PROFILE</button> <button type="button" data-disconnect>DISCONNECT</button></form></section>`;
 const find=q=>root.querySelector(q),status=find('[data-status]'),form=find('form');let provider=null,unwatch=null,busy=false,pairingUri='',pairingController=null;
 const buttons=()=>root.querySelectorAll('button');
 function locked(value){busy=value;buttons().forEach(b=>b.disabled=value)}
 function clear(){form.hidden=true;form.reset();find('[data-address]').textContent='';pairingUri='';find('[data-pairing]').hidden=true;status.textContent='Disconnected. Sign in again to edit your profile.'}
 async function run(fn){if(busy)return;locked(true);try{await fn()}catch(e){status.textContent=e.code===4001||e.name==='AbortError'?'Request cancelled.':e.message||'Connection failed.'}finally{pairingController=null;find('[data-cancel-pairing]').hidden=true;locked(false)}}
 async function connect(mode,selected){status.textContent='Choose your wallet and confirm profile sign-in.';if(unwatch)unwatch();await fetch('/api/profile/logout',{method:'POST',credentials:'same-origin'});clear();status.textContent='Choose your wallet and confirm profile sign-in.';
  if(mode==='injected'){if(!selected?.request)throw Error('Choose a browser wallet first.');provider=selected}
  else {pairingController=new AbortController();find('[data-cancel-pairing]').hidden=false;find('[data-cancel-pairing]').disabled=false;provider=await walletConnect({projectId,signal:pairingController.signal,onUri:uri=>{pairingUri=uri;status.textContent='Connection ready. Continue in your wallet.';find('[data-pairing]').hidden=false;find('[data-copy-pairing]').disabled=false}});pairingController=null;find('[data-cancel-pairing]').hidden=true;}
  unwatch=await watchWallet(provider,clear);const user=await signIn(provider);const profile=await loadProfile();form.elements.nickname.value=profile.nickname||'';form.hidden=false;pairingUri='';find('[data-pairing]').hidden=true;find('[data-address]').textContent=user.address;status.textContent='Wallet verified. You can now edit your profile.';
 }
 find('[data-cancel-pairing]').addEventListener('click',()=>{pairingController?.abort();pairingUri='';find('[data-pairing]').hidden=true});
 find('[data-copy-pairing]').addEventListener('click',async()=>{try{if(!pairingUri)return;await navigator.clipboard.writeText(pairingUri);status.textContent='Connection link copied. Paste it in your wallet if supported.'}catch{status.textContent='Open the site inside your wallet and choose IN-APP WALLET.'}});
 const cancelPending=()=>{if(pairingController){pairingController.abort();pairingUri='';find('[data-pairing]').hidden=true}};
 root.addEventListener('wallet-profile-close',cancelPending);
 const known=new Set();
 function addWallet({name,provider:found}){if(known.has(found))return;known.add(found);const button=document.createElement('button');button.type='button';button.textContent=name;button.addEventListener('click',()=>run(()=>connect('injected',found)));find('[data-wallet-list]').append(button)}
 const stopDiscovery=discoverWallets(window,addWallet);
 find('[data-injected]').addEventListener('click',()=>{find('[data-wallet-list]').hidden=false;for(const wallet of legacyWallets(window.ethereum))addWallet(wallet);if(!known.size)status.textContent='Open the site inside Crypto.com Onchain, or choose WalletConnect.'});
 find('[data-walletconnect]').addEventListener('click',()=>run(()=>connect('walletconnect')));
 form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{const file=form.elements.avatar.files[0];if(file)await uploadAvatar(file);await saveNickname(form.elements.nickname.value);status.textContent='Profile saved. Nickname and avatar are public.'})});
 find('[data-disconnect]').addEventListener('click',()=>run(async()=>{await disconnect(provider);unwatch?.();provider=null;clear()}));
 find('[data-delete]').addEventListener('click',()=>run(async()=>{await removeProfile();form.reset();status.textContent='Your public nickname and avatar have been removed.'}));
 return ()=>{root.removeEventListener('wallet-profile-close',cancelPending);pairingController?.abort();stopDiscovery();unwatch?.();root.replaceChildren()};
}
