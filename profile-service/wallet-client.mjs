// Bundle this module locally; never import an unpinned remote CDN script.
import {EthereumProvider} from '@walletconnect/ethereum-provider';
export const CRONOS=25;
export const WALLET_METHODS=Object.freeze(['personal_sign']);
const account=a=>typeof a==='string'&&/^0x[0-9a-f]{40}$/i.test(a);
export async function walletConnect({projectId,onUri}){
 if(!/^[a-f0-9]{32}$/i.test(projectId||''))throw Error('WalletConnect is not configured');
 const provider=await EthereumProvider.init({projectId,chains:[CRONOS],methods:[...WALLET_METHODS],optionalMethods:[],events:['accountsChanged','chainChanged'],optionalEvents:[],showQrModal:false,metadata:{name:'LoadTheLion',description:'Profile sign-in only. No transactions or spending permissions.',url:location.origin,icons:[]}});
 provider.on('display_uri',onUri);
 await provider.connect();
 return provider;
}
async function api(path,options={}){const response=await fetch('/api/profile/'+path,{...options,credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('Profile service rejected the request');return response.json()}
export async function signIn(provider){
 const chain=await provider.request({method:'eth_chainId'});
 if(Number(chain)!==CRONOS)throw Error('Select Cronos EVM in your wallet, then reconnect');
 const accounts=await provider.request({method:'eth_requestAccounts'});
 if(!account(accounts?.[0]))throw Error('No valid wallet account');
 const address=accounts[0];
 const {message}=await api('challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address})});
 // Verify the expected server-issued sign-in scope before requesting a signature.
 if(typeof message!=='string'||!message.startsWith(location.host+' wants you to sign in with your Ethereum account:\n')||!message.includes('\nURI: '+location.origin+'/profile\n')||!message.includes('\nChain ID: 25\n'))throw Error('Unexpected sign-in scope');
 const signature=await provider.request({method:'personal_sign',params:['0x'+Array.from(new TextEncoder().encode(message),b=>b.toString(16).padStart(2,'0')).join(''),address]});
 const active=await provider.request({method:'eth_accounts'});
 if(!account(active?.[0])||active[0].toLowerCase()!==address.toLowerCase()||Number(await provider.request({method:'eth_chainId'}))!==CRONOS)throw Error('Wallet changed during sign-in');
 return api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,signature})});
}
export const saveNickname=nickname=>api('me',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname})});
export const uploadAvatar=file=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1048576)throw Error('Choose JPEG, PNG or WebP, at most 1 MB');return api('avatar',{method:'PUT',headers:{'Content-Type':file.type},body:file})};
export const removeProfile=()=>api('me',{method:'DELETE'});
export async function disconnect(provider){await api('logout',{method:'POST'});if(provider?.disconnect)await provider.disconnect()}
export async function watchWallet(provider,onInvalidated){const invalidate=async()=>{try{await api('logout',{method:'POST'})}finally{onInvalidated()}};provider.on?.('accountsChanged',invalidate);provider.on?.('chainChanged',invalidate);provider.on?.('disconnect',invalidate);return ()=>{provider.removeListener?.('accountsChanged',invalidate);provider.removeListener?.('chainChanged',invalidate);provider.removeListener?.('disconnect',invalidate)}}
