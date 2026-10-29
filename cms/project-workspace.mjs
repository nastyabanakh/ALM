import { invalidConstReferences, resolveEntryConstants } from './constants.mjs';
import { references } from '../public/admin/const-tokens.mjs';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CmsError, getEntry, listEntries, publishDraft, saveDraft, applyEntryLifecycle } from './store.mjs';
import {validateOpenGraphImages} from './open-graph.mjs';
import {validateConfiguredContent} from './custom-fields.mjs';
import { validateEntry, HOME_PAGE_ID, collectionFields } from './model.mjs';
import { listDraftMedia, publishMediaDraft } from './media-draft.mjs';
import { withMediaMutation } from './media-library.mjs';
import { listSitePages } from './page-list.mjs';
const root = process.cwd();
let queue = Promise.resolve();
export async function withProjectLock(action) { const previous=queue;let release;queue=new Promise(resolve=>{release=resolve;});await previous;try{return await action();}finally{release();} }
async function drafts() {
  const result=[];
  for(const collection of ['pages','posts','projects']) for(const summary of await listEntries(collection)) {
    if(!summary.draft)continue;
    const entry=await getEntry(collection,summary.id);
    if(entry.draft)result.push({collection,...entry});
  }
  return result;
}
export async function projectDraftStatus() {
  const entries=await drafts(),media=await listDraftMedia();
  const constUsage = {};
  const count = value => { if(typeof value==='string') { for(const ref of references(value)) constUsage[ref.key]=(constUsage[ref.key]||0)+1; } else if(Array.isArray(value)) value.forEach(count); else if(value && typeof value==='object') Object.values(value).forEach(count); };
  for(const collection of ['posts','projects']) for(const summary of await listEntries(collection)) {const entry=await getEntry(collection,summary.id);count(entry.draft?.data||entry.published);}
  const lifecycleChanges=Object.keys(entries.find(entry=>entry.collection==='pages' && entry.id===HOME_PAGE_ID)?.draft?.data.content.editorSettings?.entryStates || {}).length;
  const changed = entries.filter(entry=>JSON.stringify(entry.draft.data)!==JSON.stringify(entry.published));
  return { constUsage, lifecycleChanges, entryChanges:changed.filter(entry=>entry.collection!=='pages').length, entries:entries.map(entry=>({collection:entry.collection,id:entry.id,revision:entry.draft.revision,title:entry.draft.data.title||'Untitled'})), mediaRevision:media.mediaRevision, mediaPending:media.pendingChanges, pending:changed.length>0||media.pendingChanges };
}
export async function publishProject({expectedDraftRevision,expectedMediaRevision,expectedEntries}={}) {
  return withProjectLock(()=>withMediaMutation(async()=>{
    const entries=await drafts(),home=await getEntry('pages',HOME_PAGE_ID),media=await listDraftMedia();
    if((home.draft?.revision??null)!==(expectedDraftRevision??null)||media.mediaRevision!==(expectedMediaRevision??null))throw new CmsError(409,'Project draft changed. Review the latest changes before publishing.');
    if(expectedEntries) {
      const expected=new Map(expectedEntries.map(entry=>[entry.collection+':'+entry.id,entry.revision]));
      if(expected.size!==entries.length||entries.some(entry=>expected.get(entry.collection+':'+entry.id)!==entry.draft.revision))throw new CmsError(409,'CMS drafts changed. Review the latest project changes.');
    }
    const consts=(home.draft?.data || home.published).content.consts || {};
    const schemaContent=(home.draft?.data || home.published).content,pageEntries={};
    for(const collection of ['posts','projects'])pageEntries[collection]=await Promise.all((await listEntries(collection)).map(async summary=>{const entry=await getEntry(collection,summary.id);return entry.draft?.data || entry.published;}));
    await validateOpenGraphImages(schemaContent,pageEntries,media);
    const fieldIssues=validateConfiguredContent(schemaContent,pageEntries,collectionFields);if(fieldIssues.length)throw new CmsError(422,'Fix collection fields before publishing',fieldIssues);
    const entryStates=home.draft?.data.content.editorSettings?.entryStates || {};
    const lifecycle=[];
    for(const [key,operation] of Object.entries(entryStates)){
      const [collection,id]=key.split(':');
      if(!['posts','projects'].includes(collection))throw new CmsError(400,'Invalid entry operation');
      const entry=await getEntry(collection,id);
      if(entry.publishedRevision!==operation.publishedRevision)throw new CmsError(409,'An item changed since the archive/delete action. Refresh and review it.');
      lifecycle.push({collection,id,state:operation.state});
    }

    // Also check published entries: removing a shared Const must not break pages
    // which have no draft of their own in this publication.
    for(const collection of ['posts','projects']) for(const summary of await listEntries(collection)) {
      if(entryStates[collection+':'+summary.id]?.state==='deleted')continue;
      const entry=await getEntry(collection,summary.id),data=entry.draft?.data||entry.published;
      const issues=invalidConstReferences({...data,consts});
      const checked=validateEntry(collection,resolveEntryConstants(data,consts));
      if(issues.length||!checked.success) throw new CmsError(422,`Fix ${data.title||entry.id} before publishing`,issues.length?issues:checked.issues);
    }
    const routeDrafts=new Map(entries.map(entry=>[entry.collection+':'+entry.id,entry.draft.data]));
    const routes=(await listSitePages()).filter(route=>!['archived','deleted'].includes(entryStates[route.id]?.state)&&(routeDrafts.get(route.id)?.isPublished!==false||entryStates[route.id]?.state==='active'));
    for(const operation of lifecycle)if(operation.state==='active'){const entry=await getEntry(operation.collection,operation.id),data=entry.draft?.data || entry.published;if(data?.slug)routes.push({id:operation.collection+':'+operation.id,path:`/${operation.collection==='posts'?'blog':'portfolio'}/${data.slug}/`});}
    for(const entry of entries) {
      if(entryStates[entry.collection+':'+entry.id]?.state==='deleted')continue;
      const checked=validateEntry(entry.collection,entry.draft.data);
      if(!checked.success)throw new CmsError(422,`Fix ${entry.draft.data.title||entry.id} before publishing`,checked.issues);
      if(entry.collection!=='pages' && (checked.data.isPublished!==false||entryStates[entry.collection+':'+entry.id]?.state==='active') && !['archived','deleted'].includes(entryStates[entry.collection+':'+entry.id]?.state))routes.push({id:entry.collection+':'+entry.id,path:`/${entry.collection==='posts'?'blog':'portfolio'}/${checked.data.slug}/`});
      const others=await listEntries(entry.collection);
      if(entry.collection!=='pages'&&others.some(other=>other.id!==entry.id&&(other.slugs||[other.slug]).includes(checked.data.slug)&&(other.published||other.draft)))throw new CmsError(409,`URL already used: ${checked.data.slug}`);
    }
    for(const setting of Object.values(home.draft?.data.content?.linkSettings||{})) {
      if(['page','section'].includes(setting.type)&&!routes.some(route=>route.id===setting.pageId))throw new CmsError(422,'Choose an existing page for automatic links');
      if(setting.type==='section'&&!setting.sectionId)throw new CmsError(422,'Choose a section for automatic links');
    }
    const backup=path.join(root,'.cms/project-publications',randomUUID());await mkdir(backup,{recursive:true});
    const targets=['src','public','cms','api','.cms/drafts','.cms/history','.cms/media-draft/state.json'];
    const existing=[];
    for(const [index,relative] of targets.entries()) {const target=path.join(root,relative);const exists=Boolean(await stat(target).catch(()=>null));existing.push({relative,index,exists});if(exists)await cp(target,path.join(backup,String(index)),{recursive:true,verbatimSymlinks:true});}
    await writeFile(path.join(backup,'journal.json'),JSON.stringify({targets:existing,entries:entries.map(entry=>({collection:entry.collection,id:entry.id})),at:new Date().toISOString()},null,2));
    try {
      if(lifecycle.length && home.draft){const data=structuredClone(home.draft.data);data.content.editorSettings.entryStates={};await saveDraft('pages',{id:HOME_PAGE_ID,data,expectedDraftRevision:home.draft.revision});}
      const mediaResult=await publishMediaDraft({expectedMediaRevision});
      for(const entry of entries) {if(entryStates[entry.collection+':'+entry.id]?.state==='deleted')continue;const current=await getEntry(entry.collection,entry.id);await publishDraft(entry.collection,{id:entry.id,expectedDraftRevision:current.draft.revision});}
      for(const operation of lifecycle)await applyEntryLifecycle(operation.collection,operation.id,operation.state);
      await writeFile(path.join(backup,'complete.json'),JSON.stringify({at:new Date().toISOString()}));
      const current=await getEntry('pages',HOME_PAGE_ID);
      return {ok:true,sha:current.publishedRevision,content:current.published.content,media:mediaResult,mediaState:await listDraftMedia(),pages:await listSitePages(),entries:await Promise.all(entries.map(async entry=>({collection:entry.collection,id:entry.id,data:entryStates[entry.collection+':'+entry.id]?.state==='deleted'?null:(await getEntry(entry.collection,entry.id)).published}))),publishedEntries:entries.length,state:'saved-locally'};
    } catch(error) {
      for(const {relative,index,exists} of existing) {const target=path.join(root,relative);await rm(target,{recursive:true,force:true});if(exists){await mkdir(path.dirname(target),{recursive:true});await cp(path.join(backup,String(index)),target,{recursive:true,verbatimSymlinks:true});}}
      throw error;
    }
  }));
}
