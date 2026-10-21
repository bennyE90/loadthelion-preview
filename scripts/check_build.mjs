import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=path.join(root,'site');
async function fingerprint(directory=site,prefix='') {
 const result={};
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  const relative=prefix+entry.name,absolute=path.join(directory,entry.name);
  if(entry.isDirectory()) Object.assign(result,await fingerprint(absolute,relative+'/'));
  else if(entry.isFile()) result[relative]=createHash('sha256').update(await readFile(absolute)).digest('hex');
  else throw Error('Unexpected publish entry: '+relative);
 }
 return result;
}
function build() {
 const result=spawnSync(process.execPath,[path.join(root,'profile-service','build.mjs')],{
  cwd:root,stdio:'inherit',env:{...process.env,
   REOWN_PROJECT_ID:process.env.REOWN_PROJECT_ID||'00000000000000000000000000000000',
   PROFILE_ORIGIN:process.env.PROFILE_ORIGIN||'https://example.invalid'}
 });
 if(result.error) throw result.error;
 assert.equal(result.status,0,'Build failed');
}
async function checkHome() {
 const html=await readFile(path.join(site,'home.html'),'utf8');
 for(const name of ['hero-wallet-cta','hero-legend-link','nav-profile-link','nav-settings-link'])
  assert.equal(html.split(`class="${name}"`).length-1,1,`${name} must appear exactly once`);
 for(const id of ['wallet-dialog','top-monthly-roar'])
  assert.equal(html.split(`id="${id}"`).length-1,1,`${id} must appear exactly once`);
 const sources=html.match(/script-src\s+([^;]+);/)?.[1].trim().split(/\s+/);
 assert.ok(sources?.length,'Script policy is missing');
 assert.equal(new Set(sources).size,sources.length,'Duplicate script authorizations');
}
build();await checkHome();const first=await fingerprint();
build();await checkHome();const second=await fingerprint();
assert.deepEqual(second,first,'Repeated builds must preserve every published file');
console.log(`PASS: two identical builds, ${Object.keys(first).length} files, home actions and script policy intact.`);
