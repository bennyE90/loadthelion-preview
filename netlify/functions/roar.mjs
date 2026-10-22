import {createMonthlyProfileReader,createMonthlyAvatarReader} from '../../profile-service/monthly-profile-reader.mjs';
import {createMonthlyService} from '../../profile-service/monthly-service.mjs';
import {getStore} from '@netlify/blobs';
import {getProfileStore} from '../../profile-service/blob-store.mjs';
import {createRoarRelay,strictBlobFetch} from '../../profile-service/roar-relay.mjs';
import {createArchiveReader} from '../../profile-service/roar-archive-reader.mjs';
import {createPriceService} from '../../profile-service/roar-price.mjs';
import {createDrawService} from '../../profile-service/roar-draw-service.mjs';
import {createRewardsService} from '../../profile-service/roar-rewards-service.mjs';
import {createPreviewService} from '../../profile-service/roar-preview-service.mjs';
const priceService=createPriceService();
const readToken=process.env.ROAR_ARCHIVE_READ_TOKEN;
const monthlyService=createMonthlyService({token:readToken});
const drawService=createDrawService({token:readToken});
const rewardsService=createRewardsService({token:readToken});
const previewService=createPreviewService({token:readToken});
const archiveReader=readToken?createArchiveReader({token:readToken}):undefined;
export default async function(request){
 if(['/api/roar/monthly-profiles','/api/roar/monthly-avatar'].includes(new URL(request.url).pathname)){
  const profiles=getProfileStore();
  const reader=new URL(request.url).pathname==='/api/roar/monthly-avatar'?createMonthlyAvatarReader:createMonthlyProfileReader;
  return reader({lookup:async address=>(await profiles.getWithMetadata('profiles/'+address,{type:'json'}))?.data})(request);
 }
 if(new URL(request.url).pathname==='/api/roar/monthly')return monthlyService(request);
 if(new URL(request.url).pathname==='/api/roar/preview')return previewService(request);
 if(new URL(request.url).pathname==='/api/roar/rewards')return rewardsService(request);
 if(new URL(request.url).pathname==='/api/roar/draw')return drawService(request);
 if(new URL(request.url).pathname==='/api/roar/price')return priceService(request);
 const store=getStore({name:'loadthelion-ulton-roar-test-v1',consistency:'strong',fetch:strictBlobFetch});
 return createRoarRelay({store,archiveReader})(request);
}
export const config={path:'/api/roar/*',rateLimit:{windowLimit:90,windowSize:60,aggregateBy:['ip','domain']}};
