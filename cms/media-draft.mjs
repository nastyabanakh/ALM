import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CmsError } from './store.mjs';
import { validateMediaBytes } from './media-validation.mjs';
import { listMedia, mediaReferences, trashMediaSelection } from './media-library.mjs';
import { publishMediaLayout } from './media-publish.mjs';

const root = process.cwd(), directory = path.join(root, '.cms/media-draft'), stateFile = path.join(directory, 'state.json');
const catalogFile = path.join(root, 'src/data/media-library.json');
const clone = value => structuredClone(value);
async function atomic(file, text) { await mkdir(path.dirname(file), { recursive: true }); const tmp = file + '.' + randomUUID() + '.tmp'; try { await writeFile(tmp, text); await rename(tmp,file); } finally { await rm(tmp,{force:true}); } }
async function readState() { return JSON.parse(await readFile(stateFile,'utf8').catch(error => { if(error.code==='ENOENT') return 'null'; throw error; })); }
async function base() { const media = await listMedia(); return { ...media, removed: [], replacements: {}, created: [], uploads: {} }; }
async function state() { return await readState() || { revision: null, position:0, snapshots:[await base()] }; }
function current(draft) { return draft.snapshots[draft.position]; }
const physical = url => { if(typeof url!=='string'||!url.startsWith('/assets/')||url.split('/').some(part=>part==='..'||part==='.'||part.includes('\\'))) throw new CmsError(400,'Invalid media path'); return path.join(root,'public',url.slice(1)); };
const filename = value => { if(typeof value!=='string'||!value.trim()||value.length>120||!/^[\p{L}\p{N} _.-]+$/u.test(value)||value.startsWith('.')) throw new CmsError(400,'Enter a valid name'); return value.trim(); };
function folderPath(view, folder) { return '/assets' + folder.slice(7).split('/').filter(Boolean).map((part,index,parts)=>'/' + (view.folderNames?.['/assets/'+parts.slice(0,index+1).join('/')] || part)).join(''); }
function targetPath(view, asset) { return folderPath(view,asset.folder) + '/' + asset.name + path.extname(asset.url); }
function decorate(draft) {
  const view = clone(current(draft));
  for(const asset of view.assets) { asset.targetUrl=targetPath(view,asset); asset.pending=asset.targetUrl!==asset.url||Boolean(view.replacements[asset.url]||view.uploads[asset.url]); const token=view.replacements[asset.url]||view.uploads[asset.url]; if(token) asset.previewUrl='/api/admin?op=media-preview&token='+token; }
  return { ...view, hasDraft:Boolean(draft.revision), pendingChanges:draft.position>0, pendingFolders:false, mediaRevision:draft.revision, historyPosition:draft.position, canUndo:draft.position>0, canRedo:draft.position<draft.snapshots.length-1 };
}
export async function listDraftMedia() { const result=decorate(await state()); const isUsed=await mediaReferences(); for(const asset of result.assets) asset.used=isUsed(asset.url); return result; }
export async function mediaDraftHistory({direction,expectedMediaRevision}) { const draft=await state(); if(expectedMediaRevision!==draft.revision) throw new CmsError(409,'Media changed in another tab. Refresh Media.'); const next=draft.position+(direction==='undo'?-1:1); if(next<0||next>=draft.snapshots.length) return decorate(draft); draft.position=next; draft.revision=randomUUID(); await atomic(stateFile,JSON.stringify(draft)); return decorate(draft); }
export async function discardMediaDraft({expectedMediaRevision} = {}) { const draft=await state(); if ((expectedMediaRevision??null)!==draft.revision) throw new CmsError(409,'Media changed in another tab. Refresh Media.'); const view=current(draft),isUsed=await mediaReferences(); if(Object.keys(view.uploads).some(url=>isUsed(url))) throw new CmsError(409,'Remove draft references to uploaded media before discarding.'); await rm(stateFile,{force:true}); await rm(path.join(directory,'files'),{recursive:true,force:true}); return listDraftMedia(); }
function mediaEntry(view,url) { const asset=view.assets.find(asset=>asset.url===url); if(!asset) throw new CmsError(404,'Media file not found'); return asset; }
async function unmanagedFolderFiles(folder, known) {
  let count = 0;
  async function walk(url) {
    for (const entry of await readdir(physical(url),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})) {
      const next=url+'/'+entry.name;
      if(entry.isSymbolicLink()) count++;
      else if(entry.isDirectory()) await walk(next);
      else if(entry.isFile() && !known.some(asset=>asset.url===next)) count++;
    }
  }
  await walk(folder); return count;
}
async function binary(body, extension) {
  if(typeof body.base64!=='string'||body.base64.length>140*1024*1024) throw new CmsError(413,'File is too large');
  const bytes=Buffer.from(body.base64,'base64'); if(!bytes.length||bytes.length>96*1024*1024) throw new CmsError(413,'File is too large');
  const kind = await validateMediaBytes(bytes, extension);
  const token=randomUUID()+'.'+kind; await atomic(path.join(directory,'files',token),bytes); return {token,kind,size:bytes.length};
}
export async function stageMediaOperation(op,body={}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CmsError(400,'Invalid media request');
  if (body.urls !== undefined && (!Array.isArray(body.urls) || body.urls.some(url=>typeof url!=='string'))) throw new CmsError(400,'Select valid media files');
  if (body.assignments !== undefined && (!Array.isArray(body.assignments) || body.assignments.some(move=>!move||typeof move.url!=='string'||typeof move.folder!=='string'))) throw new CmsError(400,'Select valid media destinations');
  const draft=await state();
  if((body.expectedMediaRevision??null)!==draft.revision) throw new CmsError(409,'Media changed in another tab. Refresh Media.');
  const view=clone(current(draft)); let result={}; const createdTokens=[];
  try {
  if(op==='media-update') { const asset=mediaEntry(view,body.url); const extension=path.extname(asset.url); if(body.name!==undefined) { let name=filename(body.name); if(name.toLowerCase().endsWith(extension.toLowerCase())) name=name.slice(0,-extension.length); asset.name=filename(name); } if(body.alt!==undefined) asset.alt=String(body.alt).slice(0,250); result={url:asset.url,metadata:{name:asset.name,alt:asset.alt}}; }
  else if(op==='media-folder') { const name=filename(body.name); if(name.includes('.')) throw new CmsError(400,'Use a folder name without dots'); const parent=body.parent||'/assets'; if(!view.folders.includes(parent)) throw new CmsError(404,'Folder not found'); const folder=parent+'/'+name; if(view.folders.includes(folder)) throw new CmsError(409,'Folder already exists'); view.folders.push(folder); view.created.push(folder); result={folder}; }
  else if(op==='media-folder-rename') { if(body.folder==='/assets'||!view.folders.includes(body.folder)) throw new CmsError(400,'Choose a folder'); if(await unmanagedFolderFiles(body.folder,draft.snapshots[0].assets)) throw new CmsError(409,'Folder contains new, hidden or linked files. Review its project files before renaming.'); const before=view.folderNames?.[body.folder]||body.folder.split('/').at(-1); const name=filename(body.name); if(name.includes('.')) throw new CmsError(400,'Use a folder name without dots'); (view.folderNames||={})[body.folder]=name; result={folder:body.folder,before,name}; }
  else if(op==='media-move-selection') { const moves=body.assignments||[...new Set(body.urls||[])].map(url=>({url,folder:body.folder})); if(!moves.length||moves.length>2000) throw new CmsError(400,'Select files'); const before=[]; for(const move of moves) { const asset=mediaEntry(view,move.url); if(!view.folders.includes(move.folder)) throw new CmsError(404,'Folder not found'); before.push({url:asset.url,folder:asset.folder}); asset.folder=move.folder; } result={before,after:moves}; }
  else if(['media-stash','media-trash-selection','media-folder-trash','media-folder-remove'].includes(op)) {
    const folder=body.folder; if(folder==='/assets') throw new CmsError(400,'Cannot delete assets root');
    const urls=folder?view.assets.filter(asset=>asset.folder===folder||asset.folder.startsWith(folder+'/')).map(asset=>asset.url):body.urls||[body.url];
    if (folder) {
      if (!view.folders.includes(folder)) throw new CmsError(404,'Folder not found');
      const published = await listMedia(), original = draft.snapshots[0];
      if (await unmanagedFolderFiles(folder,original.assets)) throw new CmsError(409,'Folder contains new, hidden or linked files. Review its project files before deleting.');
      const within = asset => asset.folder === folder || asset.folder.startsWith(folder + '/');
      if (published.assets.filter(within).some(asset=>!original.assets.some(before=>before.url===asset.url))) throw new CmsError(409,'Folder files changed. Review the folder before deleting.');
      if (body.expectedFiles !== undefined && body.expectedFiles !== urls.length) throw new CmsError(409,'Folder files changed. Review the folder before deleting.');
    }
    const assets=urls.map(url=>mediaEntry(view,url)); const isUsed=await mediaReferences(); if(assets.some(asset=>isUsed(asset.url))) throw new CmsError(409,'Replace used files before deleting.');
    view.removed.push(...urls.filter(url=>!view.uploads[url])); view.assets=view.assets.filter(asset=>!urls.includes(asset.url));
    if(folder) view.folders=view.folders.filter(path=>path!==folder&&!path.startsWith(folder+'/'));
    result={token:'draft',count:urls.length,folder,url:body.url};
  }
  else if(op==='media-upload') { const folder=body.folder||'/assets/uploads'; if(!view.folders.includes(folder)) throw new CmsError(404,'Folder not found'); const file=await binary(body); createdTokens.push(file.token); const stem=String(body.filename||'media').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'-').slice(0,90)||'media'; const url=folder+'/'+stem+'-'+file.token.slice(0,8)+'.'+file.kind; const asset={url,folder,name:stem+'-'+file.token.slice(0,8),alt:'',filename:path.basename(url),updatedAt:new Date().toISOString(),size:file.size,used:false,replaceable:true}; view.assets.push(asset); view.uploads[url]=file.token; result={url,metadata:asset}; }
  else if(op==='media-replace') { const asset=mediaEntry(view,body.url); const file=await binary(body,path.extname(asset.url).slice(1)); createdTokens.push(file.token); view.replacements[asset.url]=file.token; asset.updatedAt=new Date().toISOString(); result={url:asset.url,backup:'draft'}; }
  else throw new CmsError(400,'Use media draft Undo or Redo for this action');
  const targets=view.assets.map(asset=>targetPath(view,asset)); if(new Set(targets).size!==targets.length) throw new CmsError(409,'Two files would have the same name in a folder.');
  const folderTargets=view.folders.map(folder=>folderPath(view,folder)); if(new Set(folderTargets).size!==folderTargets.length) throw new CmsError(409,'Folder name already exists');
  draft.snapshots.splice(draft.position+1); draft.snapshots.push(view); draft.position++; draft.revision=randomUUID();
  await atomic(stateFile,JSON.stringify(draft)); return {...result,mediaDraft:true,mediaState:decorate(draft)};
  } catch(error) { for(const token of createdTokens) await rm(path.join(directory,'files',token),{force:true}); throw error; }
}
export async function draftFolderInfo({folder}) {
  const draft=await state(), view=current(draft);
  if(!view.folders.includes(folder)) throw new CmsError(404,'Folder not found');
  const assets=view.assets.filter(asset=>asset.folder===folder||asset.folder.startsWith(folder+'/'));
  const unmanaged=await unmanagedFolderFiles(folder,draft.snapshots[0].assets);
  return {folder,files:assets.length+unmanaged,images:assets.filter(asset=>/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(asset.url)).length,blockedReason:unmanaged?'Folder contains new, hidden or linked files. Review its project files before deleting.':null};
}
export async function serveMediaDraft(req,res) {
  const token=req.query.token; if(typeof token!=='string'||!/^[0-9a-f-]{36}\.(png|jpg|webp|mp4)$/.test(token)) throw new CmsError(400,'Invalid media preview');
  const bytes=await readFile(path.join(directory,'files',token)); const type=token.endsWith('.mp4')?'video/mp4':token.endsWith('.jpg')?'image/jpeg':token.endsWith('.png')?'image/png':'image/webp';
  res.setHeader('Content-Type',type); res.setHeader('Accept-Ranges','bytes');
  const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers?.range||'');
  if(range) { const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1; if(start>=bytes.length||end<start) {res.statusCode=416;res.setHeader('Content-Range',`bytes */${bytes.length}`);return res.end();} res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);res.setHeader('Content-Length',end-start+1);return res.end(bytes.subarray(start,end+1)); }
  res.setHeader('Content-Length',bytes.length);return res.end(bytes);
}

export async function publishMediaDraft({expectedMediaRevision}={}) {
  const draft=await state(); if((expectedMediaRevision??null)!==draft.revision) throw new CmsError(409,'Media changed in another tab. Refresh Media.');
  if(!draft.position) {await rm(stateFile,{force:true});return {files:0,folders:0};}
  const view=current(draft), original=draft.snapshots[0], published=await listMedia();
  for(const asset of original.assets) { const actual=published.assets.find(item=>item.url===asset.url); if(!actual||actual.size!==asset.size||actual.updatedAt!==asset.updatedAt||actual.fileModifiedAt!==asset.fileModifiedAt) throw new CmsError(409,'A media file changed outside this draft. Discard the media draft and start again.'); }
  for(const folder of original.folders.filter(folder=>!view.folders.includes(folder))) if(await unmanagedFolderFiles(folder,original.assets)) throw new CmsError(409,'Folder files changed. Review its project files before publishing.');
  const backup=path.join(directory,'publications',randomUUID()); await mkdir(backup,{recursive:true});
  const snapshots=[],newPaths=new Set(),directories=[];
  const textExtensions=/\.(astro|css|html|js|jsx|json|md|mdx|mjs|ts|tsx|svg)$/i;
  async function sources(folder) { for(const entry of await readdir(folder,{withFileTypes:true}).catch(()=>[])) { if(entry.name.startsWith('.')) continue; const file=path.join(folder,entry.name); if(file===path.join(root,'public/assets')) continue; if(entry.isDirectory()) await sources(file); else if(entry.isFile()&&textExtensions.test(entry.name)) snapshots.push({file,text:await readFile(file)}); } }
  for(const folder of ['src','public','cms','api','.cms/drafts']) await sources(path.join(root,folder));
  for(const [index,snapshot] of snapshots.entries()) await writeFile(path.join(backup,'source-'+index),snapshot.text);
  await writeFile(path.join(backup,'sources.json'),JSON.stringify(snapshots.map((snapshot,index)=>({file:path.relative(root,snapshot.file),backup:'source-'+index}))));
  const changed=original.assets.filter(asset=>view.removed.includes(asset.url)||view.replacements[asset.url]||view.assets.some(next=>next.url===asset.url&&targetPath(view,next)!==asset.url));
  const files=[];
  for(const asset of changed) {const location=physical(asset.url);const saved=path.join(backup,String(files.length));await copyFile(location,saved);files.push({location,saved});}
  const makeDir=async directory=>{if(!await stat(directory).catch(()=>null)){await mkdir(directory,{recursive:true});directories.push(directory);}};
  try {
    if(view.removed.length) await trashMediaSelection({urls:[...new Set(view.removed)]});
    for(const folder of view.created) if(view.folders.includes(folder)) await makeDir(physical(folder));
    const data=JSON.parse(await readFile(catalogFile,'utf8').catch(()=>'{"version":1,"assets":{}}'));
    data.assets||={};data.folderNames=view.folderNames;data.assetFolders={};data.assetFilenames={};
    for(const asset of view.assets) {
      if(view.uploads[asset.url]) {await makeDir(path.dirname(physical(asset.url)));if(await stat(physical(asset.url)).catch(()=>null))throw new CmsError(409,'Uploaded file destination already exists');await copyFile(path.join(directory,'files',view.uploads[asset.url]),physical(asset.url));newPaths.add(physical(asset.url));}
      if(view.replacements[asset.url]) await atomic(physical(asset.url),await readFile(path.join(directory,'files',view.replacements[asset.url])));
      data.assets[asset.url]={name:asset.name,alt:asset.alt,updatedAt:asset.updatedAt};data.assetFolders[asset.url]=asset.folder;data.assetFilenames[asset.url]=asset.name+path.extname(asset.url);
      const target=physical(targetPath(view,asset));if(target!==physical(asset.url)&&!await stat(target).catch(()=>null))newPaths.add(target);
    }
    await atomic(catalogFile,JSON.stringify(data,null,2));
    const result=await publishMediaLayout();
    for(const folder of original.folders.filter(folder=>!view.folders.includes(folder)).sort((a,b)=>b.length-a.length)) {await rmdir(physical(folder));}
    await atomic(path.join(backup,'complete.json'),JSON.stringify({at:new Date().toISOString()}));
    await rm(stateFile,{force:true});return result;
  } catch(error) {
    for(const file of newPaths) await rm(file,{force:true}).catch(()=>{});
    for(const {location,saved} of files) {await mkdir(path.dirname(location),{recursive:true});await copyFile(saved,location);}
    for(const snapshot of snapshots) await atomic(snapshot.file,snapshot.text);
    for(const folder of directories.reverse()) await rmdir(folder).catch(()=>{});
    throw error;
  }
}
