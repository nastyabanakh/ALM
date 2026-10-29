import {collectionSchema,inferFields,getPath} from '../public/admin/cms-schema-model.mjs';
import {renderRichText,escapeHTML,safeURL} from '../public/admin/rich-text-model.mjs';
import {inlineCollectionMap} from './custom-fields.mjs';

const titleOf=item=>item.title||item.name||item.question||item.label||item.heading||'Untitled';
const routeFor=(scope,item,content)=>scope==='page:posts'?`/blog/${encodeURIComponent(item.slug)}/`:scope==='page:projects'?`/portfolio/${encodeURIComponent(item.slug)}/`:scope.startsWith('content:')&&content.editorSettings?.collectionModes?.[scope.slice(8)]==='page'?`/collections/${encodeURIComponent(scope.slice(8))}/${encodeURIComponent(String(item.slug||item.id))}/`:null;
export function publishedCatalog(content,pageEntries={}){
  const catalog=inlineCollectionMap(content),states=content.editorSettings?.entryStates||{};
  for(const [collection,entries] of Object.entries(pageEntries))catalog.set('page:'+collection,entries.filter(item=>(item.isPublished!==false||states[collection+':'+item.id]?.state==='active')&&!['archived','deleted'].includes(states[collection+':'+item.id]?.state||item.cmsState)));
  return catalog;
}
function relatedHTML(field,value,catalog,content){
  const entries=catalog.get(field.collection)||[],ids=field.type==='reference'?[value]:Array.isArray(value)?value:[];
  const output=ids.map(id=>{const target=entries.find(item=>String(item.id)===String(id));if(!target)return '';const title=escapeHTML(titleOf(target));const href=routeFor(field.collection,target,content);return href?`<a href="${escapeHTML(href)}">${title}</a>`:`<span>${title}</span>`;}).filter(Boolean);
  return output.length?`<div class="cms-related">${output.join('')}</div>`:'';
}
function fieldHTML(field,item,catalog,content){
  const raw=getPath(item,field.key)??field.default,value=field.type==='richtext'?item.richText?.[field.key]??raw:raw;if(value==null||value===''||Array.isArray(value)&&!value.length)return '';
  const label=`<h3 class="cms-field-label">${escapeHTML(field.label)}</h3>`;
  if(field.type==='richtext')return renderRichText(value);
  if(['reference','multireference'].includes(field.type))return label+relatedHTML(field,value,catalog,content);
  if(['select','multiselect','status'].includes(field.type)){const values=Array.isArray(value)?value:[value];return label+`<p>${values.map(escapeHTML).join(', ')}</p>`;}
  if(field.type==='checkbox')return label+`<p>${value?'Yes':'No'}</p>`;
  if(field.type==='image' && typeof value==='string' && safeURL(value,true))return `<figure><img src="${escapeHTML(value)}" alt="${escapeHTML(getPath(item,field.key.replace(/\.src$/,'.alt'))||'')}"></figure>`;
  if(field.type==='gallery' && Array.isArray(value))return `<div class="gallery">${value.filter(image=>image&&safeURL(image.src,true)).map(image=>`<img src="${escapeHTML(image.src)}" alt="${escapeHTML(image.alt||'')}">`).join('')}</div>`;
  if(field.type==='file' && safeURL(value,true))return `${label}<p><a href="${escapeHTML(value)}">Download file</a></p>`;
  if(field.type==='url' && safeURL(value))return `${label}<p><a href="${escapeHTML(value)}">${escapeHTML(value)}</a></p>`;
  if(field.type==='email' && typeof value==='string')return `${label}<p><a href="mailto:${escapeHTML(value)}">${escapeHTML(value)}</a></p>`;
  if(field.type==='phone' && typeof value==='string')return `${label}<p><a href="tel:${escapeHTML(value.replace(/[^+\d]/g,''))}">${escapeHTML(value)}</a></p>`;
  if(typeof value==='string'||typeof value==='number')return `${label}<p>${escapeHTML(value).replace(/\n/g,'<br>')}</p>`;
  return '';
}
export function configuredFieldsHTML(content,scope,item,pageEntries={},mode='custom',excludeCollections=[]){
  const catalog=publishedCatalog(content,pageEntries),saved=content.editorSettings?.collectionSchemas?.[scope];
  if(mode==='all'&&!saved)return null;
  const schema=collectionSchema(content.editorSettings,scope,scope.startsWith('content:')?inferFields(item):[]);
  const fields=schema.fields.filter(field=>!excludeCollections.includes(field.collection)&&!['slug','seo.title','seo.description','ogImage','ogImageAlt'].includes(field.key)&&!field.hidden&&(mode==='all'||!field.builtin)&&!(mode==='all'&&['title','name','question','stageTitle','label','titleLine1'].includes(field.key)&&getPath(item,field.key)===titleOf(item)));
  return fields.map(field=>fieldHTML(field,item,catalog,content)).filter(Boolean).join('\n');
}

export function linkedAccordionItems(content,scope,item){
  const target='content:sections.singlePointContact.accordionItems',schema=collectionSchema(content.editorSettings,scope,[]),catalog=publishedCatalog(content),source=catalog.get(target)||[];
  const ids=schema.fields.filter(field=>field.collection===target&&['reference','multireference'].includes(field.type)).flatMap(field=>{const value=getPath(item,field.key);return Array.isArray(value)?value:value?[value]:[];});
  return [...new Set(ids)].map(id=>source.find(record=>String(record.id)===String(id))).filter(record=>record&&record.isPublished!==false&&!['archived','deleted'].includes(record.cmsState));
}
