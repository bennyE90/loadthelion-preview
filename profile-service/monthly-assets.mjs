import sharp from 'sharp';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
// Collection examples published in the official Mane City NFT integration guide.
// These previews do not identify the specific NFT to be awarded.
export const MONTHLY_ART=[
 {name:'loaded-lion',url:'https://3111127319-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fm4p9gBMjLFvkHqBuFkiT%2Fuploads%2FI6Q9xFNufHuPAEv2w1jS%2F999.jpg?alt=media&token=1a309be0-d471-4f63-bfb6-b9c3529fde33'},
 {name:'dark-lion',url:'https://3111127319-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fm4p9gBMjLFvkHqBuFkiT%2Fuploads%2FzX8KmcpdnyIoJlpBzIpJ%2FDark%20Lion%201.png?alt=media&token=8eeb8fa9-0022-42c3-a6e7-b91c2fcf4e6f'},
 {name:'cyber-cub',url:'https://3111127319-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fm4p9gBMjLFvkHqBuFkiT%2Fuploads%2Fh25TOQpFN2GcWCcsv0Cv%2FDeep_Relief_Wizard_Broom_Fish_Skin_Red_Tee_Bored_Happy_Green_Floral_Glasses_Red_Party_Hat.jpg?alt=media&token=c5474a78-8a7c-4e1a-b20c-6304c100754f'}
];
export async function prepareMonthlyArt({fetcher=fetch,output='site'}={}){
 let html=await readFile(output+'/monthly.html','utf8');await mkdir(output+'/assets',{recursive:true});
 for(const art of MONTHLY_ART){try{
  const response=await fetcher(art.url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>8*1024*1024)throw Error('Oversize preview');
  const image=await sharp(bytes,{limitInputPixels:20000000}).rotate().resize(480,480,{fit:'cover'}).webp({quality:86}).toBuffer();
  const path='assets/monthly-'+art.name+'.webp';await writeFile(output+'/'+path,image);html=html.replace(art.url.replaceAll('&','&amp;'),path);console.log('Monthly NFT preview prepared: '+art.name);
 }catch{console.log('Monthly NFT preview uses official remote fallback: '+art.name)}}
 await writeFile(output+'/monthly.html',html);
}
