import {getStore} from '@netlify/blobs';
import {createRoarRelay,strictBlobFetch} from '../../profile-service/roar-relay.mjs';
import {createArchiveReader} from '../../profile-service/roar-archive-reader.mjs';
import {createPriceService} from '../../profile-service/roar-price.mjs';
const priceService=createPriceService();
const readToken=process.env.ROAR_ARCHIVE_READ_TOKEN;
const archiveReader=readToken?createArchiveReader({token:readToken}):undefined;
export default async function(request){
 if(new URL(request.url).pathname==='/api/roar/price')return priceService(request);
 const store=getStore({name:'loadthelion-ulton-roar-test-v1',consistency:'strong',fetch:strictBlobFetch});
 return createRoarRelay({store,archiveReader})(request);
}
export const config={path:'/api/roar/*',rateLimit:{windowLimit:90,windowSize:60,aggregateBy:['ip','domain']}};
