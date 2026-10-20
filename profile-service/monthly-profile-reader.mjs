// Public nickname reads only; wallet authentication remains on the existing exact-origin service.
export function createMonthlyProfileReader({lookup}){
 return async request=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  try{const raw=new URL(request.url).searchParams.get('addresses');if(!raw||raw.length>4300)throw Error('Invalid addresses');const list=raw.split(',');if(list.length>100||list.some(a=>!/^0x[a-f0-9]{40}$/i.test(a)))throw Error('Invalid addresses');
   const profiles=(await Promise.all([...new Set(list.map(a=>a.toLowerCase()))].map(async address=>{const p=await lookup(address);if(!p||p.removed||typeof p.nickname!=='string'||p.nickname.length>48)return null;return {address,nickname:p.nickname}}))).filter(Boolean);
   return new Response(request.method==='HEAD'?null:JSON.stringify({profiles}),{headers});
  }catch{return Response.json({error:'Nickname lookup unavailable'},{status:400,headers})}
 };
}
