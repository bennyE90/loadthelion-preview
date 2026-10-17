export function createHandler({profiles,origin}){
 const cookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=')));
 const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
 async function body(req,limit){const length=Number(req.headers.get('content-length'));if(length>limit)throw Error('Request too large');if(!req.body)return Buffer.alloc(0);const reader=req.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Request too large')}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}return Buffer.concat(chunks)}
 return async req=>{
  const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});
  const reply=(code,data)=>new Response(JSON.stringify(data),{status:code,headers});
  try{
   const url=new URL(req.url),path=url.pathname;
   if(url.origin!==origin)return reply(403,{error:'Origin rejected'});
   if(!['GET','POST','PUT','DELETE'].includes(req.method))return reply(405,{error:'Method not allowed'});
   if(req.method!=='GET'&&req.headers.get('origin')!==origin)return reply(403,{error:'Origin rejected'});
   if(req.method==='GET'&&path==='/api/profile/status')return reply(200,{ready:true,chainId:25});
   const auth=cookies(req),session=auth['__Host-load-session'];
   async function json(limit){if(!req.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON required');return JSON.parse(await body(req,limit))}
   if(req.method==='POST'&&path==='/api/profile/challenge'){const data=await json(1024),c=await profiles.challenge(data.address);headers.append('Set-Cookie',cookie('__Host-load-challenge',c.secret,300));return reply(200,{message:c.message})}
   if(req.method==='POST'&&path==='/api/profile/login'){const data=await json(4096),s=await profiles.login(auth['__Host-load-challenge'],data.message,data.signature);await profiles.logout(session);headers.append('Set-Cookie',cookie('__Host-load-session',s.secret,1800));headers.append('Set-Cookie',cookie('__Host-load-challenge','',0));return reply(200,{address:s.address})}
   if(req.method==='POST'&&path==='/api/profile/logout'){await profiles.logout(session);headers.append('Set-Cookie',cookie('__Host-load-session','',0));return reply(200,{ok:true})}
   if(req.method==='POST'&&path==='/api/profile/lookup'){const data=await json(6000);if(!Array.isArray(data.addresses)||data.addresses.length>100||data.addresses.some(a=>typeof a!=='string'||!/^0x[a-f0-9]{40}$/i.test(a)))throw Error('Invalid addresses');const rows=await Promise.all([...new Set(data.addresses.map(a=>a.toLowerCase()))].map(a=>profiles.public(a)));return reply(200,{profiles:rows.filter(Boolean)})}
   if(req.method==='GET'&&path==='/api/profile/me')return reply(200,await profiles.me(session));
   if(req.method==='PUT'&&path==='/api/profile/me')return reply(200,await profiles.save(session,await json(1024)));
   if(req.method==='PUT'&&path==='/api/profile/avatar'){await profiles.me(session);return reply(200,await profiles.avatar(session,await body(req,1048576)))}
   if(req.method==='DELETE'&&path==='/api/profile/me'){await profiles.remove(session);return reply(200,{ok:true})}
   const match=path.match(/^\/api\/profile\/(0x[a-f0-9]{40})(\/avatar)?$/i);
   if(req.method==='GET'&&match){if(!match[2])return reply(200,await profiles.public(match[1]));const image=await profiles.image(match[1]);if(!image)return reply(404,{error:'No avatar'});headers.set('Content-Type','image/webp');return new Response(image,{headers})}
   return reply(404,{error:'Not found'});
  }catch{return reply(400,{error:'Request rejected. Sign in again or check the profile fields.'})}
 };
}
