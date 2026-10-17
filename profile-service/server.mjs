import {createServer} from 'node:http';
import {createProfiles} from './auth.mjs';
const origin=process.env.PROFILE_ORIGIN;
const profiles=createProfiles({origin,filename:process.env.PROFILE_DB||'profiles.sqlite'});
// Host behind HTTPS on the SAME origin as the site. Do not enable cross-site cookies/CORS.
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const rates=new Map();
function throttle(key){const now=Date.now();for(const [k,v] of rates)if(v.until<=now)rates.delete(k);let v=rates.get(key);if(!v){v={count:0,until:now+60000};rates.set(key,v)}if(++v.count>40)throw Error('Too many requests')}
async function body(req,limit){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw Error('Request too large');chunks.push(c)}return Buffer.concat(chunks)}
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
 const reply=(code,data,extra={})=>{res.writeHead(code,{'Content-Type':'application/json',...extra});res.end(JSON.stringify(data))};
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith('/api/profile/'))return reply(404,{error:'Not found'});
  throttle(req.socket.remoteAddress);const auth=cookies(req);
  if(!['GET','POST','PUT','DELETE'].includes(req.method))return reply(405,{error:'Method not allowed'});
  if(req.method!=='GET'&&req.headers.origin!==origin)return reply(403,{error:'Origin rejected'});
  if(req.method==='POST'&&path==='/api/profile/challenge'){if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON required'});const data=JSON.parse(await body(req,1024));const c=profiles.challenge(data.address);return reply(200,{message:c.message},{'Set-Cookie':cookie('__Host-load-challenge',c.secret,300)})}
  if(req.method==='POST'&&path==='/api/profile/login'){if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON required'});const data=JSON.parse(await body(req,4096));const s=await profiles.login(auth['__Host-load-challenge'],data.message,data.signature);profiles.logout(auth['__Host-load-session']);return reply(200,{address:s.address},{'Set-Cookie':[cookie('__Host-load-session',s.secret,1800),cookie('__Host-load-challenge','',0)]})}
  if(req.method==='POST'&&path==='/api/profile/logout'){profiles.logout(auth['__Host-load-session']);return reply(200,{ok:true},{'Set-Cookie':cookie('__Host-load-session','',0)})}
  if(req.method==='GET'&&path==='/api/profile/me')return reply(200,profiles.me(auth['__Host-load-session']));
  if(req.method==='PUT'&&path==='/api/profile/me'){if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON required'});return reply(200,profiles.save(auth['__Host-load-session'],JSON.parse(await body(req,1024))))}
  if(req.method==='PUT'&&path==='/api/profile/avatar')return reply(200,await profiles.avatar(auth['__Host-load-session'],await body(req,1048576)));
  if(req.method==='DELETE'&&path==='/api/profile/me'){profiles.remove(auth['__Host-load-session']);return reply(200,{ok:true})}
  const match=path.match(/^\/api\/profile\/(0x[a-f0-9]{40})(\/avatar)?$/i);
  if(req.method==='GET'&&match){if(!match[2])return reply(200,profiles.public(match[1]));const image=profiles.image(match[1]);if(!image)return reply(404,{error:'No avatar'});res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store'});return res.end(image)}
  reply(404,{error:'Not found'});
 }catch{reply(400,{error:'Request rejected. Sign in again or check the profile fields.'})}
});
server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;
server.listen(Number(process.env.PORT||8787),'127.0.0.1');
