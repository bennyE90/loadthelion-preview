import {build} from 'esbuild';
import {writeFile,copyFile,readFile} from 'node:fs/promises';
const projectId=process.env.REOWN_PROJECT_ID,origin=process.env.PROFILE_ORIGIN;
if(!/^[a-f0-9]{32}$/i.test(projectId||''))throw Error('Configure REOWN_PROJECT_ID before building');
if(!origin||new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('Configure an exact HTTPS PROFILE_ORIGIN');
await build({entryPoints:['profile-service/browser-entry.mjs'],bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,outfile:'site/profile.js',legalComments:'eof'});
await writeFile('site/profile-config.json',JSON.stringify({projectId,origin}));

await copyFile('profile-service/public/profile.html','site/profile.html');
await copyFile('profile-service/public/profile.css','site/profile.css');
let home=await readFile('site/home.html','utf8');
if(!home.includes('class="nav-profile-link"'))home=home.replace('<a href="#faq">FAQ</a></nav>','<a href="#faq">FAQ</a><a class="nav-profile-link" href="profile.html">CONNECT WALLET</a></nav>').replace('</head>','<style>.nav-profile-link{color:#efbd68!important;border:1px solid #a65369;border-radius:8px;padding:7px 9px;font-size:.65rem;white-space:nowrap}@media(min-width:1000px){.nav{gap:clamp(.45rem,1vw,1.1rem)}}</style></head>');
await writeFile('site/home.html',home);
let roar=await readFile('site/roar.html','utf8');
if(!roar.includes('profile.html'))roar=roar.replace('<h2>THE LEADERBOARD</h2>','<p><a class="back" href="profile.html" target="_top">CONNECT WALLET · EDIT PROFILE</a></p><h2>THE LEADERBOARD</h2>');
await writeFile('site/roar.html',roar);
const roarScript=await readFile('site/roar.js','utf8');
if(!roarScript.includes('async function hydrateProfiles()'))await writeFile('site/roar.js',roarScript+'\n'+await readFile('profile-service/leaderboard-profiles.mjs','utf8'));
