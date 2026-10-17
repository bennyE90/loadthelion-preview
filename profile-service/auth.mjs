import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {SiweMessage} from 'siwe';
import {getAddress} from 'ethers';
import sharp from 'sharp';
export const CHAIN_ID=25;
const digest=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const statement='Sign in to your LoadTheLion profile. No transactions or token spending permissions.';
export function createProfiles({origin,filename,now=()=>Date.now()}){
 const url=new URL(origin);
 if(url.origin!==origin||url.protocol!=='https:')throw Error('Exact HTTPS origin required');
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,message TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,address TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS profiles(address TEXT PRIMARY KEY,nickname TEXT NOT NULL DEFAULT '',avatar BLOB);`);
 function sweep(){db.prepare('DELETE FROM challenges WHERE expires<=?').run(now());db.prepare('DELETE FROM sessions WHERE expires<=?').run(now())}
 function session(secret){if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret))throw Error('Sign in required');const s=db.prepare('SELECT address FROM sessions WHERE id=? AND expires>?').get(digest(secret),now());if(!s)throw Error('Sign in required');return s.address}
 return {
  challenge(address){sweep();const account=getAddress(address),secret=token(),issued=new Date(now()),expires=now()+300000;
   const message=new SiweMessage({domain:url.host,address:account,statement,uri:origin+'/profile',version:'1',chainId:CHAIN_ID,nonce:randomBytes(16).toString('hex'),issuedAt:issued.toISOString(),expirationTime:new Date(expires).toISOString()}).prepareMessage();
   db.prepare('INSERT INTO challenges VALUES(?,?,?)').run(digest(secret),message,expires);return {secret,message};
  },
  async login(secret,message,signature){
   if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret)||typeof message!=='string'||message.length>2048||typeof signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(signature))throw Error('Invalid authentication');
   const challenge=db.prepare('SELECT * FROM challenges WHERE id=? AND expires>?').get(digest(secret),now());
   if(!challenge||challenge.message!==message)throw Error('Expired or invalid challenge');
   const parsed=new SiweMessage(message);
   if(parsed.chainId!==CHAIN_ID||parsed.uri!==origin+'/profile'||parsed.statement!==statement)throw Error('Invalid scope');
   await parsed.verify({signature,domain:url.host,nonce:parsed.nonce,time:new Date(now()).toISOString()});
   // Atomic consume AFTER signature verification; exactly one concurrent login wins.
   if(db.prepare('DELETE FROM challenges WHERE id=? AND expires>?').run(digest(secret),now()).changes!==1)throw Error('Challenge already used');
   const sessionSecret=token();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(sessionSecret),parsed.address.toLowerCase(),now()+1800000);return {secret:sessionSecret,address:parsed.address.toLowerCase()};
  },
  me(secret){const address=session(secret);return {address,...(db.prepare('SELECT nickname FROM profiles WHERE address=?').get(address)||{nickname:''})}},
  save(secret,{nickname}){const address=session(secret);if(typeof nickname!=='string')throw Error('Invalid nickname');nickname=nickname.normalize('NFKC').trim();if(!/^[\p{L}\p{N}_ .-]{1,24}$/u.test(nickname))throw Error('Use 1–24 letters, numbers, spaces, dots, underscores or hyphens');db.prepare('INSERT INTO profiles(address,nickname) VALUES(?,?) ON CONFLICT(address) DO UPDATE SET nickname=excluded.nickname').run(address,nickname);return {address,nickname}},
  async avatar(secret,bytes){const address=session(secret);if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>1048576)throw Error('Image must be at most 1 MB');const image=sharp(bytes,{limitInputPixels:16000000,animated:false});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw Error('Use a static JPEG, PNG or WebP');const safe=await image.rotate().resize(256,256,{fit:'cover'}).webp({quality:82}).toBuffer();session(secret);db.prepare("INSERT INTO profiles(address,avatar) VALUES(?,?) ON CONFLICT(address) DO UPDATE SET avatar=excluded.avatar").run(address,safe);return {address}},
  public(address){address=getAddress(address).toLowerCase();const p=db.prepare('SELECT nickname,avatar IS NOT NULL AS hasAvatar FROM profiles WHERE address=?').get(address);return p?{address,nickname:p.nickname,hasAvatar:!!p.hasAvatar}:null},
  image(address){return db.prepare('SELECT avatar FROM profiles WHERE address=?').get(getAddress(address).toLowerCase())?.avatar},
  remove(secret){const address=session(secret);db.prepare('DELETE FROM profiles WHERE address=?').run(address)},
  logout(secret){if(typeof secret==='string')db.prepare('DELETE FROM sessions WHERE id=?').run(digest(secret))},
  close(){db.close()}
 };
}
