import sharp from 'sharp';
import path from 'node:path';
import {readFile,realpath} from 'node:fs/promises';
import {CmsError} from './store.mjs';
import {collectionPages} from './collection-pages.mjs';
const oriented=info=>[5,6,7,8].includes(info.orientation)?{...info,width:info.height,height:info.width}:info;
const root=process.cwd(),assetsRoot=path.join(root,'public/assets');
async function imageBytes(url,media){
  if(typeof url!=='string'||!url.startsWith('/assets/')||url.includes('\\')||url.split('/').some(part=>part==='..'||part==='.')||/[?#\u0000-\u001f]/.test(url))throw new CmsError(422,'Choose an Open Graph image from Media or upload a new one.');
  const asset=media?.assets.find(asset=>asset.url===url);
  if(media&&!asset)throw new CmsError(422,'Open Graph image no longer exists. Choose another image.');
  if(asset?.previewUrl){const token=new URL(asset.previewUrl,'http://localhost').searchParams.get('token');if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(token||''))throw new CmsError(422,'Choose a valid Open Graph image.');return readFile(path.join(root,'.cms/media-draft/files',token));}
  const file=await realpath(path.join(root,'public',url.slice(1))),relative=path.relative(await realpath(assetsRoot),file);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new CmsError(422,'Invalid Open Graph image path');
  return readFile(file);
}
export async function ogImageMetadata(url){
  if(!url)return null;
  try{const info=oriented(await sharp(await imageBytes(url),{limitInputPixels:40000000}).metadata());return {width:info.width,height:info.height,type:info.format==='jpeg'?'image/jpeg':'image/'+info.format};}catch{return null;}
}
export async function validateOpenGraphImages(content,pageEntries,media){
  const sources=Object.entries(content.pageSettings||{}).map(([route,settings])=>({name:route,url:settings.ogImage}));
  for(const entries of Object.values(pageEntries))for(const entry of entries)sources.push({name:entry.title||entry.id,url:entry.ogImage});
  for(const page of collectionPages(content))sources.push({name:page.title,url:page.item.ogImage});
  for(const {name,url}of sources){
    if(!url)continue;
    try{const info=oriented(await sharp(await imageBytes(url,media),{limitInputPixels:40000000}).metadata());if(!['jpeg','png'].includes(info.format)||info.width!==1200||info.height!==630)throw new Error('Use a JPG or PNG cropped to 1200 × 630.');}
    catch(error){throw new CmsError(422,`${name} · Open Graph: ${error.message||'Image could not be opened'}`);}
  }
}
