import QRCode from 'qrcode';
import {walletConnect,signIn,saveNickname,uploadAvatar,removeProfile,disconnect,watchWallet} from './wallet-client.mjs';
export function mountProfile(root,{projectId}){
 root.innerHTML=`<section class="wallet-profile"><h2>YOUR PRIDE PROFILE</h2><p>Connect on Cronos to personalise your public nickname and avatar. Your wallet address remains visible. No transactions or token spending permissions.</p><button type="button" data-injected>CONNECT IN-APP WALLET</button> <button type="button" data-walletconnect>WALLETCONNECT</button><p role="status" data-status></p><canvas data-qr hidden></canvas><p data-pairing hidden>Open WalletConnect in your wallet and scan this QR code. On the same phone, use your wallet's in-app browser.</p><form hidden><p data-address></p><label>Nickname <input name="nickname" maxlength="24" required autocomplete="off"></label><label>Avatar <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label><p>Your nickname, avatar and wallet address will be public. Images: JPEG, PNG or WebP, maximum 1 MB.</p><button type="submit">SAVE PROFILE</button> <button type="button" data-delete>REMOVE PROFILE</button> <button type="button" data-disconnect>DISCONNECT</button></form></section>`;
 const find=q=>root.querySelector(q),status=find('[data-status]'),form=find('form');let provider=null,unwatch=null,busy=false;
 const buttons=()=>root.querySelectorAll('button');
 function locked(value){busy=value;buttons().forEach(b=>b.disabled=value)}
 function clear(){form.hidden=true;form.reset();find('[data-address]').textContent='';find('[data-qr]').hidden=true;find('[data-pairing]').hidden=true;status.textContent='Disconnected. Sign in again to edit your profile.'}
 async function run(fn){if(busy)return;locked(true);try{await fn()}catch(e){status.textContent=e.code===4001?'Request cancelled.':e.message||'Connection failed.'}finally{locked(false)}}
 async function connect(mode){status.textContent='Choose your wallet and confirm profile sign-in.';if(unwatch)unwatch();await fetch('/api/profile/logout',{method:'POST',credentials:'same-origin'});clear();
  if(mode==='injected'){if(!window.ethereum?.request)throw Error('Open this page inside Crypto.com Onchain, or use WalletConnect.');provider=window.ethereum}
  else provider=await walletConnect({projectId,onUri:async uri=>{find('[data-qr]').hidden=false;find('[data-pairing]').hidden=false;await QRCode.toCanvas(find('[data-qr]'),uri,{width:256,margin:2})}});
  unwatch=await watchWallet(provider,clear);const user=await signIn(provider);form.hidden=false;find('[data-qr]').hidden=true;find('[data-pairing]').hidden=true;find('[data-address]').textContent=user.address;status.textContent='Wallet verified. You can now edit your profile.';
 }
 find('[data-injected]').addEventListener('click',()=>run(()=>connect('injected')));
 find('[data-walletconnect]').addEventListener('click',()=>run(()=>connect('walletconnect')));
 form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{const file=form.elements.avatar.files[0];if(file)await uploadAvatar(file);await saveNickname(form.elements.nickname.value);status.textContent='Profile saved. Nickname and avatar are public.'})});
 find('[data-disconnect]').addEventListener('click',()=>run(async()=>{await disconnect(provider);unwatch?.();provider=null;clear()}));
 find('[data-delete]').addEventListener('click',()=>run(async()=>{await removeProfile();form.reset();status.textContent='Your public nickname and avatar have been removed.'}));
}
