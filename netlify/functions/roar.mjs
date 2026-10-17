import {getStore} from '@netlify/blobs';
import {createRoarRelay,strictBlobFetch} from '../../profile-service/roar-relay.mjs';
export default async function(request){
 const store=getStore({name:'loadthelion-ulton-roar-test-v1',consistency:'strong',fetch:strictBlobFetch});
 return createRoarRelay({store})(request);
}
export const config={path:'/api/roar/*',rateLimit:{windowLimit:90,windowSize:60,aggregateBy:['ip','domain']}};
