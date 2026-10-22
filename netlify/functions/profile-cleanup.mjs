import {getProfileStore} from '../../profile-service/blob-store.mjs';
import {createBlobProfiles} from '../../profile-service/blob-profiles.mjs';
export default async function(){const origin=process.env.PROFILE_ORIGIN;if(!origin)return new Response('Not configured',{status:503});const profiles=createBlobProfiles({origin,store:getProfileStore()});await profiles.cleanup();return new Response('OK')}
export const config={schedule:'17 3 * * *'};
