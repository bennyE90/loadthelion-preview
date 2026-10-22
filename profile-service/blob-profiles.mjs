import {randomBytes,createHash} from 'node:crypto';
import {SiweMessage} from 'siwe';
import {getAddress} from 'ethers';
import sharp from 'sharp';
const hash=s=>createHash('sha256').update(s).digest('hex');
const secret=()=>randomBytes(32).toString('hex');
const validSecret=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const statement='Sign in to your LoadTheLion profile. No transactions or token spending permissions.';
export function createBlobProfiles({store,origin,now=()=>Date.now()}){
 const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)throw Error('Exact HTTPS origin required');
 const read=key=>store.getWithMetadata(key,{type:'json',consistency:'strong'});
 async function session(token){if(!validSecret(token))throw Error('Sign in required');const s=await read('sessions/'+hash(token));if(!s||s.data.expires<=now())throw Error('Sign in required');return s.data.address}
 async function mutate(address,change){const key='profiles/'+address;for(let tries=0;tries<4;tries++){const old=await read(key),data=change(old?.data||{nickname:'',avatar:null});const result=await store.setJSON(key,data,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(result.modified)return data}throw Error('Concurrent edit; retry')}
 return {
  async challenge(address){const account=getAddress(address),token=secret(),expires=now()+300000;const message=new SiweMessage({domain:url.host,address:account,statement,uri:origin+'/profile',version:'1',chainId:25,nonce:randomBytes(16).toString('hex'),issuedAt:new Date(now()).toISOString(),expirationTime:new Date(expires).toISOString()}).prepareMessage();await store.setJSON('challenges/'+hash(token),{message,expires,used:false},{onlyIfNew:true});return {secret:token,message}},
  async login(token,message,signature){if(!validSecret(token)||typeof message!=='string'||message.length>2048||typeof signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(signature))throw Error('Invalid authentication');const key='challenges/'+hash(token),c=await read(key);if(!c||c.data.used||c.data.expires<=now()||c.data.message!==message)throw Error('Expired or invalid challenge');const parsed=new SiweMessage(message);if(parsed.chainId!==25||parsed.uri!==origin+'/profile'||parsed.statement!==statement)throw Error('Invalid scope');await parsed.verify({signature,domain:url.host,nonce:parsed.nonce,time:new Date(now()).toISOString()});
   // ETag compare-and-set makes one-use challenges safe across concurrent Functions.
   if(!(await store.setJSON(key,{...c.data,used:true},{onlyIfMatch:c.etag})).modified)throw Error('Challenge already used');
   const id=secret(),address=parsed.address.toLowerCase();await store.setJSON('sessions/'+hash(id),{address,expires:now()+1800000},{onlyIfNew:true});return {secret:id,address}},
  async me(token){const address=await session(token),p=await read('profiles/'+address);return {address,nickname:p?.data.nickname||'',hasAvatar:!!p?.data.avatar}},
  async save(token,{nickname}){const address=await session(token);if(typeof nickname!=='string')throw Error('Invalid nickname');nickname=nickname.normalize('NFKC').trim();if(!/^[\p{L}\p{N}_ .-]{1,24}$/u.test(nickname))throw Error('Use 1–24 letters, numbers, spaces, dots, underscores or hyphens');await mutate(address,p=>({...p,nickname,removed:false}));return {address,nickname}},
  async avatar(token,bytes){const address=await session(token);if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>1048576)throw Error('Image must be at most 1 MB');const image=sharp(bytes,{limitInputPixels:16000000,animated:false});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw Error('Use a static JPEG, PNG or WebP');const safe=await image.rotate().resize(256,256,{fit:'cover'}).webp({quality:82}).toBuffer();await session(token);await mutate(address,p=>({...p,avatar:safe.toString('base64'),removed:false}));return {address}},
  async public(address){address=getAddress(address).toLowerCase();const p=await read('profiles/'+address);return p&&!p.data.removed?{address,nickname:p.data.nickname,hasAvatar:!!p.data.avatar}:null},
  async image(address){const p=await read('profiles/'+getAddress(address).toLowerCase());return p?.data.avatar?Buffer.from(p.data.avatar,'base64'):null},
  async remove(token){const address=await session(token);await mutate(address,()=>({nickname:'',avatar:null,removed:true}))},
  async logout(token){if(validSecret(token))await store.delete('sessions/'+hash(token))},
  async cleanup(){let deleted=0;for(const prefix of ['challenges/','sessions/'])for await(const page of store.list({prefix,paginate:true})){for(const item of page.blobs){const row=await read(item.key);if(row?.data.expires<=now()){await store.delete(item.key);deleted++}}}return deleted}
 };
}
