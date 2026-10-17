import {getStore} from '@netlify/blobs';
import {createBlobProfiles} from '../../profile-service/blob-profiles.mjs';
import {createHandler} from '../../profile-service/profile-handler.mjs';
export default async function(request){
 const origin=process.env.PROFILE_ORIGIN;
 if(!origin)return new Response('Profile service not configured',{status:503});
 const store=getStore({name:'loadthelion-profiles-v1',consistency:'strong'});
 return createHandler({origin,profiles:createBlobProfiles({origin,store})})(request);
}
export const config={path:'/api/profile/*',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain']}};
