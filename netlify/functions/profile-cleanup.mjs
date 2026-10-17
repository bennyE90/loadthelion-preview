import {getStore} from '@netlify/blobs';
import {createBlobProfiles} from '../../profile-service/blob-profiles.mjs';
export default async function(){const origin=process.env.PROFILE_ORIGIN;if(!origin)return new Response('Not configured',{status:503});const profiles=createBlobProfiles({origin,store:getStore({name:'loadthelion-profiles-v1',consistency:'strong'})});await profiles.cleanup();return new Response('OK')}
export const config={schedule:'17 3 * * *'};
